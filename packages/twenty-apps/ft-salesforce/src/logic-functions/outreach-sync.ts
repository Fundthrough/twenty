import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { OUTREACH_SYNC_UID } from 'src/constants/universal-identifiers';

// Polling transport for Outreach -> Twenty (EE-5069). Webhook deliveries are unusable:
// Outreach POSTs application/vnd.api+json, which Twenty does not body-parse, so the
// signature cannot be verified and Outreach never retries. This cron pulls recently
// updated resources on a sliding lookback window; every write is an upsert keyed on the
// Outreach id, so overlapping windows are harmless and no watermark state is needed.
//
// OUTREACH_LOG_ONLY=1 reports counts and samples without writing.

const API = 'https://api.outreach.io/api/v2';
const DEFAULT_LOOKBACK_MINUTES = 20;
const PAGE_LIMIT = 50;

type OutreachRow = {
  id: number;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id?: number | string } | null }>;
};

type PersonRef = { id: string; companyId?: string | null };

const handler = async () => {
  const token = process.env.OUTREACH_ACCESS_TOKEN;
  if (!token) {
    console.log('outreach-sync: OUTREACH_ACCESS_TOKEN not set, skipping');
    return { skipped: 'no token' };
  }
  const logOnly = (process.env.OUTREACH_LOG_ONLY ?? '1') !== '0';

  const client = new CoreApiClient();
  const gql = async (query: string, variables?: Record<string, unknown>) => {
    const res = await (client as unknown as {
      executeGraphqlRequestWithOptionalRefresh: (args: {
        operation: { query: string; variables?: Record<string, unknown> };
      }) => Promise<{ payload?: { data?: Record<string, unknown> } }>;
    }).executeGraphqlRequestWithOptionalRefresh({ operation: { query, variables } });
    return res.payload?.data as Record<string, unknown> | undefined;
  };

  const outreach = async (path: string) => {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new Error('token expired');
    if (!res.ok) return undefined;
    return (await res.json()) as { data?: OutreachRow[] | OutreachRow };
  };

  const relId = (row: OutreachRow, name: string) => {
    const id = row.relationships?.[name]?.data?.id;
    return id === undefined || id === null ? undefined : String(id);
  };

  const personCache = new Map<string, PersonRef | null>();
  const findPerson = async (prospectId: string | undefined): Promise<PersonRef | undefined> => {
    if (!prospectId) return undefined;
    if (personCache.has(prospectId)) return personCache.get(prospectId) ?? undefined;

    const byId = await gql(
      `query P($pid: String!) { people(filter: { outreachProspectId: { eq: $pid } }, first: 1) { edges { node { id companyId } } } }`,
      { pid: prospectId },
    ) as { people?: { edges?: Array<{ node: PersonRef }> } } | undefined;
    let person = byId?.people?.edges?.[0]?.node;

    if (!person) {
      const prospect = await outreach(`/prospects/${prospectId}`);
      const attrs = (prospect?.data as OutreachRow | undefined)?.attributes as { emails?: string[] } | undefined;
      const emails = (attrs?.emails ?? []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
      if (emails.length > 0) {
        const byEmail = await gql(
          `query P($emails: [String!]) { people(filter: { emails: { primaryEmail: { in: $emails } } }, first: 1) { edges { node { id companyId } } } }`,
          { emails },
        ) as { people?: { edges?: Array<{ node: PersonRef }> } } | undefined;
        person = byEmail?.people?.edges?.[0]?.node;
        if (person) {
          await gql(
            `mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }`,
            { id: person.id, data: { outreachProspectId: prospectId } },
          );
        }
      }
    }
    personCache.set(prospectId, person ?? null);
    return person;
  };

  const memberCache = new Map<string, string | null>();
  const findAssignee = async (ownerId: string | undefined): Promise<string | undefined> => {
    if (!ownerId) return undefined;
    if (memberCache.has(ownerId)) return memberCache.get(ownerId) ?? undefined;
    const user = await outreach(`/users/${ownerId}`);
    const email = String(((user?.data as OutreachRow | undefined)?.attributes as { email?: string } | undefined)?.email ?? '')
      .trim()
      .toLowerCase();
    let memberId: string | undefined;
    if (email) {
      const found = await gql(
        `query M($email: String!) { workspaceMembers(filter: { userEmail: { eq: $email } }, first: 1) { edges { node { id } } } }`,
        { email },
      ) as { workspaceMembers?: { edges?: Array<{ node: { id: string } }> } } | undefined;
      memberId = found?.workspaceMembers?.edges?.[0]?.node?.id;
    }
    memberCache.set(ownerId, memberId ?? null);
    return memberId;
  };

  const setEngagement = async (person: PersonRef, event: string, occurredAt: unknown, sequenceName?: string) => {
    const data: Record<string, unknown> = {
      outreachLastEvent: event,
      outreachLastEventAt: typeof occurredAt === 'string' && occurredAt ? occurredAt : new Date().toISOString(),
    };
    if (sequenceName) data.outreachSequence = sequenceName;
    await gql(`mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }`, {
      id: person.id,
      data,
    });
  };

  const sequenceNameCache = new Map<string, string | undefined>();
  const sequenceName = async (sequenceId: string | undefined) => {
    if (!sequenceId) return undefined;
    if (sequenceNameCache.has(sequenceId)) return sequenceNameCache.get(sequenceId);
    const seq = await outreach(`/sequences/${sequenceId}`);
    const name = ((seq?.data as OutreachRow | undefined)?.attributes as { name?: string } | undefined)?.name;
    sequenceNameCache.set(sequenceId, name);
    return name;
  };

  const lookbackMinutes = Number(process.env.OUTREACH_SYNC_LOOKBACK_MINUTES ?? DEFAULT_LOOKBACK_MINUTES) || DEFAULT_LOOKBACK_MINUTES;
  const sinceIso = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
  const window = `filter[updatedAt]=${encodeURIComponent(`${sinceIso}..inf`)}&sort=-updatedAt&page[limit]=${PAGE_LIMIT}`;
  const summary: Record<string, number> = { tasks: 0, mailings: 0, sequenceStates: 0, calls: 0, unmatchedTasks: 0, unmatchedMailings: 0, unmatchedStates: 0 };

  try {
    // ---- tasks -> Twenty Tasks (upsert by outreachTaskId) ----
    const tasks = (await outreach(`/tasks?${window}`))?.data as OutreachRow[] | undefined;
    for (const row of tasks ?? []) {
      const prospectId = relId(row, 'prospect');
      const person = await findPerson(prospectId);
      if (!person) {
        summary.unmatchedTasks++;
        console.log(`outreach-sync: task ${row.id} prospect ${prospectId ?? 'none'} has no Twenty person`);
        continue;
      }
      summary.tasks++;
      if (logOnly) continue;

      const a = row.attributes ?? {};
      const seq = await sequenceName(relId(row, 'sequence'));
      const action = String(a.action ?? 'task');
      const data: Record<string, unknown> = {
        title: seq ? `Outreach ${action}: ${seq}` : `Outreach ${action}`,
        outreachTaskId: String(row.id),
        status: a.completedAt ? 'DONE' : 'TODO',
        dueAt: typeof a.dueAt === 'string' ? a.dueAt : null,
        taskType: String(a.action ?? '').toLowerCase() === 'call' ? 'CALL' : 'OTHER',
      };
      const assigneeId = await findAssignee(relId(row, 'owner'));
      if (assigneeId) data.assigneeId = assigneeId;

      const existing = await gql(
        `query T($tid: String!) { tasks(filter: { outreachTaskId: { eq: $tid } }, first: 1) { edges { node { id } } } }`,
        { tid: String(row.id) },
      ) as { tasks?: { edges?: Array<{ node: { id: string } }> } } | undefined;
      const taskId = existing?.tasks?.edges?.[0]?.node?.id;

      if (taskId) {
        await gql(`mutation U($id: UUID!, $data: TaskUpdateInput!) { updateTask(id: $id, data: $data) { id } }`, { id: taskId, data });
      } else {
        const created = await gql(`mutation C($data: TaskCreateInput!) { createTask(data: $data) { id } }`, { data }) as
          | { createTask?: { id?: string } }
          | undefined;
        const newId = created?.createTask?.id;
        if (newId) {
          await gql(
            `mutation L($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }`,
            { data: { taskId: newId, personId: person.id, ...(person.companyId ? { companyId: person.companyId } : {}) } },
          );
        }
      }
    }

    // ---- mailings -> person engagement ----
    const mailings = (await outreach(`/mailings?${window}`))?.data as OutreachRow[] | undefined;
    for (const row of mailings ?? []) {
      const person = await findPerson(relId(row, 'prospect'));
      if (!person) { summary.unmatchedMailings++; continue; }
      summary.mailings++;
      if (logOnly) continue;
      const a = row.attributes ?? {};
      const state = a.repliedAt ? 'replied' : a.clickedAt ? 'clicked' : a.openedAt ? 'opened' : a.bouncedAt ? 'bounced' : 'delivered';
      await setEngagement(person, `mailing_${state}`, a.repliedAt ?? a.clickedAt ?? a.openedAt ?? a.bouncedAt ?? a.deliveredAt ?? a.updatedAt);
    }

    // ---- sequence states -> person sequence + engagement ----
    const states = (await outreach(`/sequenceStates?${window}`))?.data as OutreachRow[] | undefined;
    for (const row of states ?? []) {
      const person = await findPerson(relId(row, 'prospect'));
      if (!person) { summary.unmatchedStates++; continue; }
      summary.sequenceStates++;
      if (logOnly) continue;
      const a = row.attributes ?? {};
      await setEngagement(person, `sequence_${String(a.state ?? 'updated')}`, a.updatedAt, await sequenceName(relId(row, 'sequence')));
    }

    // ---- calls -> Call records (upsert by external id) ----
    const calls = (await outreach(`/calls?${window}`))?.data as OutreachRow[] | undefined;
    for (const row of calls ?? []) {
      const person = await findPerson(relId(row, 'prospect'));
      summary.calls++;
      if (logOnly) continue;
      const a = row.attributes ?? {};
      const externalId = `outreach-${row.id}`;
      const direction = String(a.direction ?? '').toLowerCase() === 'inbound' ? 'INBOUND' : 'OUTBOUND';
      const data: Record<string, unknown> = {
        name: `Outreach ${direction === 'INBOUND' ? 'inbound' : 'outbound'} call${person ? '' : ' (unmatched)'}`,
        dialpadCallId: externalId,
        callSource: 'OUTREACH',
        direction,
        startedAt: typeof a.completedAt === 'string' ? a.completedAt : (a.createdAt as string | undefined) ?? new Date().toISOString(),
        personId: person?.id ?? null,
        companyId: person?.companyId ?? null,
      };
      const existing = await gql(
        `query C($cid: String!) { calls(filter: { dialpadCallId: { eq: $cid } }, first: 1) { edges { node { id } } } }`,
        { cid: externalId },
      ) as { calls?: { edges?: Array<{ node: { id: string } }> } } | undefined;
      let callId = existing?.calls?.edges?.[0]?.node?.id;
      if (callId) {
        await gql(`mutation U($id: UUID!, $data: CallUpdateInput!) { updateCall(id: $id, data: $data) { id } }`, { id: callId, data });
      } else {
        const created = await gql(`mutation C($data: CallCreateInput!) { createCall(data: $data) { id } }`, { data }) as
          | { createCall?: { id?: string } }
          | undefined;
        callId = created?.createCall?.id;
      }

      if (person && callId) {
        const startedAt = String(data.startedAt);
        const activity = { lastActivityAt: startedAt, lastActivityType: 'CALL', lastActivityItemCallId: callId };
        const current = await gql(`query P($id: UUID!) { person(filter: { id: { eq: $id } }) { lastActivityAt } }`, { id: person.id }) as
          | { person?: { lastActivityAt?: string | null } }
          | undefined;
        if (!current?.person?.lastActivityAt || new Date(startedAt) >= new Date(current.person.lastActivityAt)) {
          await gql(`mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }`, { id: person.id, data: activity });
        }
        if (person.companyId) {
          await gql(`mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }`, { id: person.companyId, data: activity });
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`outreach-sync aborted: ${message}`);
    return { error: message, summary };
  }

  console.log(`outreach-sync ${logOnly ? '(log only) ' : ''}window ${lookbackMinutes}m:`, JSON.stringify(summary));
  return { logOnly, summary };
};

export default defineLogicFunction({
  universalIdentifier: OUTREACH_SYNC_UID,
  name: 'outreach-sync',
  description: 'Cron pull of recent Outreach activity into Twenty tasks, calls and person engagement fields.',
  timeoutSeconds: 120,
  handler,
  cronTriggerSettings: {
    pattern: '*/5 * * * *',
  },
});
