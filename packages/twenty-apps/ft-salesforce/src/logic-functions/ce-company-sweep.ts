import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { CE_COMPANY_SWEEP_UID } from 'src/constants/universal-identifiers';

// Safety net for the "Campaign Engagement → Company auto-link" native workflow: cron
// sweep linking any campaignEngagement rows still missing their materialized company
// relation (person.companyId is the source of truth). Cheap no-op when nothing to do.
// campaignEngagement belongs to the Marketo admin's app, so it is NOT in this app's
// typed client schema — raw GraphQL via executeGraphqlRequestWithOptionalRefresh.

type GqlResult = { payload?: { data?: Record<string, unknown> } };

const handler = async () => {
  const client = new CoreApiClient();
  const gql = async (query: string, variables?: Record<string, unknown>) => {
    const res = await (client as unknown as {
      executeGraphqlRequestWithOptionalRefresh: (args: { operation: { query: string; variables?: Record<string, unknown> } }) => Promise<GqlResult>;
    }).executeGraphqlRequestWithOptionalRefresh({ operation: { query, variables } });
    if (res?.errors) console.log('gql error:', JSON.stringify(res.errors).slice(0, 200));
    return res?.data as Record<string, unknown> | undefined;
  };

  const found = await gql(
    `{ campaignEngagements(filter: { companyId: { is: NULL } }, first: 60) { edges { node { id personId } } } }`,
  ) as { campaignEngagements?: { edges?: Array<{ node: { id: string; personId?: string | null } }> } } | undefined;
  const unlinked = (found?.campaignEngagements?.edges ?? []).map((e) => e.node).filter((n) => n.personId);
  if (unlinked.length === 0) return { linked: 0 };

  const personIds = [...new Set(unlinked.map((n) => n.personId as string))];
  const people = await gql(
    `query P($ids: [UUID!]) { people(filter: { id: { in: $ids } }, first: ${personIds.length}) { edges { node { id companyId } } } }`,
    { ids: personIds },
  ) as { people?: { edges?: Array<{ node: { id: string; companyId?: string | null } }> } } | undefined;
  const companyByPerson = new Map((people?.people?.edges ?? []).map((e) => [e.node.id, e.node.companyId]));

  let linked = 0;
  for (const n of unlinked) {
    const companyId = companyByPerson.get(n.personId as string);
    if (!companyId) continue;
    await gql(
      `mutation U($id: UUID!, $data: CampaignEngagementUpdateInput!) { updateCampaignEngagement(id: $id, data: $data) { id } }`,
      { id: n.id, data: { companyId } },
    );
    linked++;
  }
  console.log(`ce-company-sweep: linked ${linked} of ${unlinked.length} unlinked engagements`);
  return { linked, scanned: unlinked.length };
};

export default defineLogicFunction({
  universalIdentifier: CE_COMPANY_SWEEP_UID,
  name: 'ce-company-sweep',
  description: 'Cron sweep linking campaignEngagement records to companies via person.companyId.',
  timeoutSeconds: 30,
  handler,
  cronTriggerSettings: {
    pattern: '*/15 * * * *',
  },
});
