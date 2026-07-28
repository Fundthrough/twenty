// Computes lastActivity* on person and company for the existing book.
//
// lastActivityAt is the greatest of the Last contact app's lastContactAt (email and meeting)
// and the newest Call or SMS we hold. Whichever source wins also supplies lastActivityType,
// lastActivityBy and lastActivityItem. We only ever read the other app's fields.
//
// Idempotent: a record already carrying the winning value is skipped, so a second run reports
// zero changes. DRY_RUN=1 reports without writing.
//
// Usage: node scripts/backfill-last-activity.mjs [DRY_RUN=1]
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const claim = JSON.parse(Buffer.from(cfg.apiKey.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== SALES_WORKSPACE_ID) {
  console.error('API key is not the sales workspace, aborting');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gql = async (query, variables, attempt = 1) => {
  const res = await fetch(`${cfg.apiUrl ?? cfg.url}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ query, variables }),
  }).catch(() => null);
  const body = await res?.json().catch(() => null);
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 20) {
    await sleep(62000);
    return gql(query, variables, attempt + 1);
  }
  if (body?.errors) console.log('  gql error:', JSON.stringify(body.errors).slice(0, 160));
  return body?.data;
};

const isSms = (call) => /^sms/i.test(String(call.name ?? ''));
const newer = (a, b) => (!a ? b : !b ? a : new Date(a) > new Date(b) ? a : b);

// Newest call per person and per company, in one pass over the call book.
const callsByPerson = new Map();
const callsByCompany = new Map();
let cursor = null;
let callCount = 0;
for (;;) {
  const page = await gql(
    `query C($after: String) { calls(first: 100, after: $after, orderBy: { startedAt: AscNullsFirst }) { pageInfo { hasNextPage endCursor } edges { node { id name startedAt personId companyId handledById } } } }`,
    { after: cursor },
  );
  const conn = page?.calls;
  if (!conn) break;
  for (const { node } of conn.edges) {
    callCount++;
    if (!node.startedAt) continue;
    if (node.personId) {
      const prev = callsByPerson.get(node.personId);
      if (!prev || new Date(node.startedAt) > new Date(prev.startedAt)) callsByPerson.set(node.personId, node);
    }
    if (node.companyId) {
      const prev = callsByCompany.get(node.companyId);
      if (!prev || new Date(node.startedAt) > new Date(prev.startedAt)) callsByCompany.set(node.companyId, node);
    }
  }
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
console.log(`scanned ${callCount} calls: ${callsByPerson.size} people, ${callsByCompany.size} companies have one`);

const applyPeople = async () => {
  let updated = 0;
  let skipped = 0;
  for (const [personId, call] of callsByPerson) {
    const res = await gql(
      `query P($id: UUID!) { person(filter: { id: { eq: $id } }) { id lastContactAt lastContactById lastActivityAt lastContactItem { __typename ... on CalendarEvent { id } ... on Message { id } } } }`,
      { id: personId },
    );
    const person = res?.person;
    if (!person) continue;

    const winner = newer(person.lastContactAt, call.startedAt);
    if (!winner) continue;
    if (person.lastActivityAt && new Date(person.lastActivityAt).getTime() === new Date(winner).getTime()) {
      skipped++;
      continue;
    }

    const callWins = winner === call.startedAt;
    const data = { lastActivityAt: winner };
    if (callWins) {
      data.lastActivityType = isSms(call) ? 'SMS' : 'CALL';
      data.lastActivityItemCallId = call.id;
      if (call.handledById) data.lastActivityById = call.handledById;
    } else {
      const item = person.lastContactItem;
      data.lastActivityType = item?.__typename === 'CalendarEvent' ? 'MEETING' : 'EMAIL';
      if (item?.__typename === 'CalendarEvent') data.lastActivityItemCalendarEventId = item.id;
      if (item?.__typename === 'Message') data.lastActivityItemMessageId = item.id;
      if (person.lastContactById) data.lastActivityById = person.lastContactById;
    }

    if (!DRY_RUN) {
      await gql('mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }', {
        id: personId,
        data,
      });
    }
    updated++;
  }
  console.log(`${DRY_RUN ? '[dry run] ' : ''}people updated: ${updated}, already current: ${skipped}`);
};

const applyCompanies = async () => {
  let updated = 0;
  for (const [companyId, call] of callsByCompany) {
    const res = await gql(`query C($id: UUID!) { company(filter: { id: { eq: $id } }) { id lastActivityAt } }`, { id: companyId });
    const company = res?.company;
    if (!company) continue;
    if (company.lastActivityAt && new Date(company.lastActivityAt).getTime() >= new Date(call.startedAt).getTime()) continue;

    const data = {
      lastActivityAt: call.startedAt,
      lastActivityType: isSms(call) ? 'SMS' : 'CALL',
      lastActivityItemCallId: call.id,
    };
    if (call.handledById) data.lastActivityById = call.handledById;
    if (!DRY_RUN) {
      await gql('mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }', {
        id: companyId,
        data,
      });
    }
    updated++;
  }
  console.log(`${DRY_RUN ? '[dry run] ' : ''}companies updated: ${updated}`);
};

await applyPeople();
await applyCompanies();
