import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { CE_COMPANY_LINK_UID } from 'src/constants/universal-identifiers';

// campaignEngagement records (created by the Marketo admin's app) carry only a person
// relation. Company-level aggregation needs the workspace-level `company` relation
// (see scripts/backfill-ce-company.mjs) populated from person.companyId — this trigger
// keeps it set for every new engagement. Layout/data-level only: their app's own
// fields and logic are untouched.

type CampaignEngagementCreatedEvent = {
  recordId?: string;
  properties?: {
    after?: {
      id?: string;
      personId?: string | null;
      companyId?: string | null;
    };
  };
};

const handler = async (event: CampaignEngagementCreatedEvent) => {
  console.log('ce-company-link fired:', JSON.stringify(event).slice(0, 500));
  const record = event?.properties?.after;
  if (!record?.id) return { skipped: 'no record in event' };
  if (record.companyId) return { skipped: 'company already set' };
  if (!record.personId) return { skipped: 'no person on engagement' };

  const client = new CoreApiClient();
  // campaignEngagement is the Marketo app's object — not in our typed client schema,
  // so the update goes through the raw GraphQL escape hatch
  const gql = async (query: string, variables?: Record<string, unknown>) => {
    const res = await (client as unknown as {
      executeGraphqlRequestWithOptionalRefresh: (args: { operation: { query: string; variables?: Record<string, unknown> } }) => Promise<{ payload?: { data?: Record<string, unknown> } }>;
    }).executeGraphqlRequestWithOptionalRefresh({ operation: { query, variables } });
    return res.payload?.data as Record<string, unknown> | undefined;
  };

  const found = await client.query({
    people: {
      __args: { filter: { id: { eq: record.personId } }, first: 1 },
      edges: { node: { id: true, companyId: true } },
    },
  }) as { people?: { edges?: Array<{ node: { id: string; companyId?: string | null } }> } };
  const companyId = found.people?.edges?.[0]?.node?.companyId;
  if (!companyId) return { skipped: 'person has no company' };

  await gql(
    `mutation U($id: UUID!, $data: CampaignEngagementUpdateInput!) { updateCampaignEngagement(id: $id, data: $data) { id } }`,
    { id: record.id, data: { companyId } },
  );

  return { linked: true, campaignEngagementId: record.id, companyId };
};

export default defineLogicFunction({
  universalIdentifier: CE_COMPANY_LINK_UID,
  name: 'ce-company-link',
  description: 'Copies person.companyId onto new campaignEngagement records so they aggregate at company level.',
  timeoutSeconds: 10,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'campaignEngagement.created',
  },
});
