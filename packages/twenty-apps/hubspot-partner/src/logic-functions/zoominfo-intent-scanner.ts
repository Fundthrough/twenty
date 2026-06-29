import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { ZOOMINFO_INTENT_SCANNER_UID } from 'src/constants/universal-identifiers';
import { getCompanyIntentAndNews } from 'src/utils/zoominfo-client';

// Topics to watch for buyer intent — companies researching these are prime FundThrough targets
const INTENT_TOPICS = [
  'invoice factoring',
  'accounts receivable financing',
  'B2B payments',
  'supply chain finance',
  'working capital',
  'invoice financing',
];

const handler = async (): Promise<object> => {
  const client = new CoreApiClient();

  // Fetch all active pipeline companies (not customers yet)
  const companyResult = await client.query({
    companies: {
      edges: {
        node: {
          id: true,
          name: true,
          domainName: true,
        },
      },
    },
  });

  const companies = (companyResult.companies?.edges ?? []).map((e: { node: { id: string; name: string; domainName?: { primaryLinkUrl?: string } } }) => e.node);
  const companiesWithDomain = companies.filter(
    (c: { id: string; name: string; domainName?: { primaryLinkUrl?: string } }) => c.domainName?.primaryLinkUrl,
  );

  if (companiesWithDomain.length === 0) {
    return { companiesScanned: 0, intentFlagged: [] };
  }

  const domains = companiesWithDomain.map(
    (c: { id: string; name: string; domainName?: { primaryLinkUrl?: string } }) =>
      c.domainName!.primaryLinkUrl!.replace(/^https?:\/\//, '').replace(/\/$/, ''),
  );

  // Pull intent signals + scoops
  const enriched = await getCompanyIntentAndNews(domains, [
    'primaryIndustry',
    'employeeCount',
    'intendedTopics',
    'scoops',
  ]);

  const today = new Date().toISOString().split('T')[0];
  const intentFlagged: string[] = [];

  for (const result of enriched) {
    const website = result.attributes.name ?? '';
    // Match enriched result back to company by domain
    const company = companiesWithDomain.find((c: { id: string; name: string; domainName?: { primaryLinkUrl?: string } }) => {
      const d = c.domainName?.primaryLinkUrl ?? '';
      return d.includes(result.id) || result.attributes.name === c.name;
    });
    if (!company) continue;

    // Check for relevant intent topics
    const intendedTopics = (result.attributes as Record<string, unknown>)['intendedTopics'] as string[] | undefined;
    const matchedTopics = (intendedTopics ?? []).filter((topic: string) =>
      INTENT_TOPICS.some((t) =>
        topic.toLowerCase().includes(t.toLowerCase()),
      ),
    );

    if (matchedTopics.length > 0) {
      intentFlagged.push(company.name);

      // Create a note on the company timeline
      await client.mutation({
        createNote: {
          __args: {
            data: {
              title: `🎯 ZoomInfo Intent Signal — ${today}`,
              body: {
                markdown: `**Topics:** ${matchedTopics.join(', ')}\n\nThis company is actively researching topics relevant to FundThrough's offering. Consider prioritizing outreach.`,
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
    }
  }

  return {
    companiesScanned: companiesWithDomain.length,
    intentFlagged,
    date: today,
  };
};

export default defineLogicFunction({
  universalIdentifier: ZOOMINFO_INTENT_SCANNER_UID,
  name: 'zoominfo-intent-scanner',
  description:
    'Daily scan: flags partner pipeline companies showing buyer intent for invoice factoring / B2B payments topics. Creates timeline notes on high-intent companies.',
  timeoutSeconds: 120,
  handler,
  cronTriggerSettings: {
    pattern: '0 8 * * *', // Daily at 8am
  },
});
