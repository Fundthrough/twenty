// Repairs Dialpad calls and SMS that arrived before the SF import loaded their people.
//
// For every Call with no person: match the external number to a person by E.164, national and
// last-ten-digit forms, then link the person and their company, and set handledBy from the
// dialpadUser name. For every "Unmatched call: <number>" review task: assign the handler when
// they are a workspace member, and close the task when the number now resolves.
//
// Idempotent: already-linked calls and already-closed tasks are skipped, so a second run
// reports zero changes. DRY_RUN=1 reports without writing.
//
// Usage: node scripts/fix-unmatched-calls.mjs [DRY_RUN=1]
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

// Dialpad hands us E.164; Twenty stores the national part separately, and SF imports vary.
// Matching on the last ten digits catches both, and is only trusted when exactly one person
// comes back.
const numberForms = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 7) return [];
  const last10 = digits.slice(-10);
  return [...new Set([`+${digits}`, digits, last10])];
};

const personCache = new Map();
const findPerson = async (externalNumber) => {
  const forms = numberForms(externalNumber);
  if (forms.length === 0) return undefined;
  const cacheKey = forms[forms.length - 1];
  if (personCache.has(cacheKey)) return personCache.get(cacheKey);

  const exact = await gql(
    `query P($forms: [String!]) { people(filter: { phones: { primaryPhoneNumber: { in: $forms } } }, first: 3) { edges { node { id companyId name { firstName lastName } } } } }`,
    { forms },
  );
  let hits = exact?.people?.edges ?? [];

  if (hits.length === 0) {
    const suffix = await gql(
      `query P($suffix: String!) { people(filter: { phones: { primaryPhoneNumber: { ilike: $suffix } } }, first: 3) { edges { node { id companyId name { firstName lastName } } } } }`,
      { suffix: `%${cacheKey}` },
    );
    hits = suffix?.people?.edges ?? [];
  }

  const person = hits.length === 1 ? hits[0].node : undefined;
  personCache.set(cacheKey, person);
  return person;
};

const members = (await gql('{ workspaceMembers(first: 200) { edges { node { id name { firstName lastName } } } } }'))
  ?.workspaceMembers?.edges?.map((e) => e.node) ?? [];
const memberByName = new Map(
  members.map((m) => [`${m.name.firstName} ${m.name.lastName}`.trim().toLowerCase(), m.id]),
);
const findMember = (name) => (name ? memberByName.get(String(name).trim().toLowerCase()) : undefined);

// ---- 1. link calls ----
let calls = [];
let cursor = null;
for (;;) {
  const page = await gql(
    `query C($after: String) { calls(filter: { personId: { is: "NULL" } }, first: 100, after: $after) { pageInfo { hasNextPage endCursor } edges { node { id externalNumber dialpadUser startedAt direction name } } } }`,
    { after: cursor },
  );
  const conn = page?.calls;
  if (!conn) break;
  calls.push(...conn.edges.map((e) => e.node));
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
console.log(`calls without a person: ${calls.length}`);

let linked = 0;
let handlerSet = 0;
const matchedNumbers = new Map();
for (const call of calls) {
  const person = await findPerson(call.externalNumber);
  const handledById = findMember(call.dialpadUser);
  const data = {};
  if (person) {
    data.personId = person.id;
    if (person.companyId) data.companyId = person.companyId;
    matchedNumbers.set(numberForms(call.externalNumber).slice(-1)[0], person);
  }
  if (handledById) data.handledById = handledById;
  if (Object.keys(data).length === 0) continue;

  if (!DRY_RUN) {
    await gql('mutation U($id: UUID!, $data: CallUpdateInput!) { updateCall(id: $id, data: $data) { id } }', {
      id: call.id,
      data,
    });
  }
  if (data.personId) linked++;
  if (data.handledById) handlerSet++;
}
console.log(`calls linked to a person: ${linked}, handledBy set: ${handlerSet}`);

// ---- 2. review tasks ----
let tasks = [];
cursor = null;
for (;;) {
  const page = await gql(
    `query T($after: String) { tasks(filter: { title: { ilike: "%Unmatched call%" } }, first: 60, after: $after) { pageInfo { hasNextPage endCursor } edges { node { id title status assigneeId bodyV2 { markdown } } } } }`,
    { after: cursor },
  );
  const conn = page?.tasks;
  if (!conn) break;
  tasks.push(...conn.edges.map((e) => e.node));
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
console.log(`review tasks: ${tasks.length}`);

let assigned = 0;
let closed = 0;
for (const task of tasks) {
  const number = (task.title.match(/\+?\d{7,}/) ?? [''])[0];
  const handler = (task.bodyV2?.markdown?.match(/Handled by: (.+)/) ?? [null, null])[1];
  const assigneeId = findMember(handler);
  const person = matchedNumbers.get(numberForms(number).slice(-1)[0]) ?? (await findPerson(number));

  const data = {};
  if (assigneeId && !task.assigneeId) data.assigneeId = assigneeId;
  if (person && task.status !== 'DONE') {
    data.status = 'DONE';
    const who = `${person.name.firstName} ${person.name.lastName}`.trim();
    data.bodyV2 = { markdown: `${task.bodyV2?.markdown ?? ''}\n\nAuto-matched to ${who} and closed by fix-unmatched-calls.` };
  }
  if (Object.keys(data).length === 0) continue;

  if (!DRY_RUN) {
    await gql('mutation U($id: UUID!, $data: TaskUpdateInput!) { updateTask(id: $id, data: $data) { id } }', {
      id: task.id,
      data,
    });
  }
  if (data.assigneeId) assigned++;
  if (data.status) closed++;
}

console.log(`${DRY_RUN ? '[dry run] ' : ''}tasks assigned: ${assigned}, tasks closed: ${closed}`);
