import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { LAST_ACTIVITY_SWEEP_UID } from 'src/constants/universal-identifiers';

// Keeps lastActivity* honest for email and meeting touches.
//
// Calls and SMS update lastActivity* the moment we write them (process-dialpad-event,
// outreach-sync). Emails and meetings are owned by the separate "Last contact" app, whose
// events we cannot hook, so this cron picks up people whose lastContactAt moved ahead of our
// lastActivityAt and promotes the newer value. Calls never get downgraded: the comparison
// only ever moves lastActivityAt forward.

const LOOKBACK_MINUTES = 60;
const PAGE_SIZE = 60;

const handler = async () => {
  const client = new CoreApiClient();
  const gql = async (query: string, variables?: Record<string, unknown>) => {
    const res = await (client as unknown as {
      executeGraphqlRequestWithOptionalRefresh: (args: {
        operation: { query: string; variables?: Record<string, unknown> };
      }) => Promise<{ data?: Record<string, unknown>; errors?: unknown }>;
    }).executeGraphqlRequestWithOptionalRefresh({ operation: { query, variables } });
    if (res?.errors) console.log('gql error:', JSON.stringify(res.errors).slice(0, 200));
    return res?.data as Record<string, unknown> | undefined;
  };

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000).toISOString();
  const page = await gql(
    `query P($since: DateTime!, $limit: Int!) {
      people(filter: { lastContactAt: { gte: $since } }, first: $limit, orderBy: { lastContactAt: DescNullsLast }) {
        edges { node {
          id companyId lastContactAt lastContactById lastActivityAt
          lastContactItemMessageId lastContactItemCalendarEventId
        } }
      }
    }`,
    { since, limit: PAGE_SIZE },
  ) as { people?: { edges?: Array<{ node: Record<string, string | null> }> } } | undefined;

  const candidates = (page?.people?.edges ?? []).map((e) => e.node);
  let promoted = 0;

  for (const person of candidates) {
    const contactAt = person.lastContactAt;
    if (!contactAt) continue;
    if (person.lastActivityAt && new Date(person.lastActivityAt) >= new Date(contactAt)) continue;

    const data: Record<string, unknown> = {
      lastActivityAt: contactAt,
      lastActivityType: person.lastContactItemCalendarEventId ? 'MEETING' : 'EMAIL',
    };
    if (person.lastContactById) data.lastActivityById = person.lastContactById;
    if (person.lastContactItemMessageId) data.lastActivityItemMessageId = person.lastContactItemMessageId;
    if (person.lastContactItemCalendarEventId) data.lastActivityItemCalendarEventId = person.lastContactItemCalendarEventId;

    await gql(`mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }`, {
      id: person.id,
      data,
    });

    if (person.companyId) {
      const company = await gql(`query C($id: UUID!) { company(filter: { id: { eq: $id } }) { lastActivityAt } }`, {
        id: person.companyId,
      }) as { company?: { lastActivityAt?: string | null } } | undefined;
      if (!company?.company?.lastActivityAt || new Date(contactAt) > new Date(company.company.lastActivityAt)) {
        await gql(`mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }`, {
          id: person.companyId,
          data,
        });
      }
    }
    promoted++;
  }

  // Anyone whose last contact predates the window above would never be picked up, which is how
  // email-only people ended up with an empty Last Activity. This pass drains them a page at a
  // time so the column stays complete without a hand-run backfill.
  let seeded = 0;
  const backlog = await gql(
    `query B($limit: Int!) {
      people(filter: { and: [{ lastContactAt: { is: "NOT_NULL" } }, { lastActivityAt: { is: "NULL" } }] }, first: $limit) {
        edges { node { id companyId lastContactAt lastContactById lastContactItemMessageId lastContactItemCalendarEventId } }
      }
    }`,
    { limit: PAGE_SIZE },
  ) as { people?: { edges?: Array<{ node: Record<string, string | null> }> } } | undefined;

  for (const person of backlog?.people?.edges?.map((e) => e.node) ?? []) {
    if (!person.lastContactAt) continue;
    const data: Record<string, unknown> = {
      lastActivityAt: person.lastContactAt,
      lastActivityType: person.lastContactItemCalendarEventId ? 'MEETING' : 'EMAIL',
    };
    if (person.lastContactById) data.lastActivityById = person.lastContactById;
    if (person.lastContactItemMessageId) data.lastActivityItemMessageId = person.lastContactItemMessageId;
    if (person.lastContactItemCalendarEventId) data.lastActivityItemCalendarEventId = person.lastContactItemCalendarEventId;
    await gql(`mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }`, {
      id: person.id,
      data,
    });
    seeded++;
  }

  console.log(`last-activity-sweep: ${candidates.length} recent contacts, ${promoted} promoted, ${seeded} backlog seeded`);
  return { candidates: candidates.length, promoted, seeded };
};

export default defineLogicFunction({
  universalIdentifier: LAST_ACTIVITY_SWEEP_UID,
  name: 'last-activity-sweep',
  description: 'Promotes email and meeting touches into lastActivity, which calls and SMS already update directly.',
  timeoutSeconds: 60,
  handler,
  cronTriggerSettings: {
    pattern: '*/10 * * * *',
  },
});
