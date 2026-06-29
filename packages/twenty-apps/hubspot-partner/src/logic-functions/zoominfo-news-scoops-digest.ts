import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { ZOOMINFO_NEWS_DIGEST_UID } from 'src/constants/universal-identifiers';
import { getCompanyIntentAndNews } from 'src/utils/zoominfo-client';

const handler = async (): Promise<object> => {
  const client = new CoreApiClient();

  // Fetch companies that have active (non-closed) deals
  const dealResult = await client.query({
    hsPartnerDeals: {
      edges: {
        node: {
          id: true,
          name: true,
          stage: true,
          primaryCompany: {
            id: true,
            name: true,
            domainName: true,
          },
        },
      },
    },
  });

  const deals = (dealResult.hsPartnerDeals?.edges ?? []).map((e: { node: { id: string; name: string; stage: string; primaryCompany?: { id: string; name: string; domainName?: { primaryLinkUrl?: string } } } }) => e.node);
  const activeDeals = deals.filter(
    (d: { id: string; name: string; stage: string; primaryCompany?: { id: string; name: string; domainName?: { primaryLinkUrl?: string } } }) =>
      d.stage !== 'CLOSED_WON' &&
      d.stage !== 'CLOSED_LOST' &&
      d.stage !== 'DISQUALIFIED' &&
      d.primaryCompany?.domainName?.primaryLinkUrl,
  );

  // Deduplicate companies
  const seenIds = new Set<string>();
  const activeCompanies = activeDeals
    .map((d: { id: string; name: string; stage: string; primaryCompany?: { id: string; name: string; domainName?: { primaryLinkUrl?: string } } }) => d.primaryCompany!)
    .filter((c: { id: string; name: string; domainName?: { primaryLinkUrl?: string } }) => {
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });

  if (activeCompanies.length === 0) {
    return { companiesChecked: 0, notesCreated: 0 };
  }

  const domains = activeCompanies.map(
    (c: { id: string; name: string; domainName?: { primaryLinkUrl?: string } }) =>
      c.domainName!.primaryLinkUrl!.replace(/^https?:\/\//, '').replace(/\/$/, ''),
  );

  const enriched = await getCompanyIntentAndNews(domains, [
    'scoops',
    'recentNews',
  ]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const today = new Date().toISOString().split('T')[0];

  let notesCreated = 0;

  for (const result of enriched) {
    const company = activeCompanies.find(
      (c: { id: string; name: string; domainName?: { primaryLinkUrl?: string } }) =>
        c.name === result.attributes.name ||
        (c.domainName?.primaryLinkUrl ?? '').includes(result.id),
    );
    if (!company) continue;

    const attrs = result.attributes as Record<string, unknown>;
    const scoops = (attrs['scoops'] as Array<{ content?: string; publishedAt?: string }> | undefined) ?? [];
    const news = (attrs['recentNews'] as Array<{ headline?: string; summary?: string; publishedAt?: string }> | undefined) ?? [];

    // Filter to last 7 days
    const recentScoops = scoops.filter((s) => {
      const d = s.publishedAt ? new Date(s.publishedAt) : null;
      return d && d >= weekAgo;
    });
    const recentNews = news.filter((n) => {
      const d = n.publishedAt ? new Date(n.publishedAt) : null;
      return d && d >= weekAgo;
    });

    if (recentScoops.length === 0 && recentNews.length === 0) continue;

    const lines: string[] = [];
    if (recentScoops.length > 0) {
      lines.push('**Scoops:**');
      recentScoops.slice(0, 3).forEach((s) => {
        if (s.content) lines.push(`• ${s.content}`);
      });
    }
    if (recentNews.length > 0) {
      lines.push('**News:**');
      recentNews.slice(0, 3).forEach((n) => {
        if (n.headline) lines.push(`• ${n.headline}`);
      });
    }

    await client.mutation({
      createNote: {
        __args: {
          data: {
            title: `📰 Weekly Intel — ${company.name} — ${today}`,
            body: {
              markdown: lines.join('\n'),
              blocknote: '',
            },
            noteTargets: {
              createMany: {
                data: [{ companyId: company.id }],
              },
            },
          },
        },
        id: true,
      },
    });

    notesCreated++;
  }

  return {
    companiesChecked: activeCompanies.length,
    notesCreated,
    date: today,
  };
};

export default defineLogicFunction({
  universalIdentifier: ZOOMINFO_NEWS_DIGEST_UID,
  name: 'zoominfo-news-scoops-digest',
  description:
    'Weekly digest: pulls ZoomInfo news and scoops for companies with active partner deals and attaches them as timeline notes. Runs every Monday at 7am.',
  timeoutSeconds: 180,
  handler,
  cronTriggerSettings: {
    pattern: '0 7 * * 1', // Mondays at 7am
  },
});
