// Resolves the answering rep on calls that arrived through a Dialpad ring group.
//
// A ring-group call's webhook payload has target.type "coaching_team" (Sales team, Customer
// Success, Sales General), so process-dialpad-event stored the group name in dialpadUser and had
// no member to point handledBy at. The answerer is not in that payload at all -- it lives one
// level down. /call/{id} returns operator_call_id, and /call/{operator_call_id} has
// target.type "user" with the rep's email:
//
//   parent  target = { name: "Sales team", type: "coaching_team" }
//     leg   target = { email: "loneill@fundthrough.com", name: "Lyle O'Neill", type: "user" }
//
// Matching on the leg's email rather than a display name, which is what makes this more reliable
// than the dialpadUser text matching in backfill-call-handled-by.mjs.
//
// Read-only against Dialpad (GET), writes only handledBy and dialpadUser in Twenty.
// Idempotent. DRY_RUN=1 reports without writing.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';
const RING_GROUPS = ['Sales team', 'Sales (General)', 'Customer Success'];

const DIALPAD_KEY = process.env.DIALPAD_API_KEY ?? process.env.DIALPAD_FT_API_KEY;
if (!DIALPAD_KEY) {
  console.error('Set DIALPAD_API_KEY (or DIALPAD_FT_API_KEY) — it lives in ~/.zshrc.local');
  process.exit(1);
}

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
  if (body?.errors) console.log('  gql error:', JSON.stringify(body.errors).slice(0, 200));
  return body?.data;
};

const dialpad = async (path, attempt = 1) => {
  const res = await fetch(`https://dialpad.com/api/v2${path}`, {
    headers: { Authorization: `Bearer ${DIALPAD_KEY}`, Accept: 'application/json' },
  }).catch(() => null);
  if (res?.status === 429 && attempt < 6) {
    await sleep(5000 * attempt);
    return dialpad(path, attempt + 1);
  }
  const body = await res?.json().catch(() => null);
  return { status: res?.status ?? 0, ok: Boolean(res?.ok), body };
};

const auth = await dialpad('/company');
if (!auth.ok) {
  console.error(`Dialpad rejected the key: HTTP ${auth.status}`);
  process.exit(1);
}
console.log(`Dialpad auth ok — company "${auth.body?.name}"`);

const members = (await gql('{ workspaceMembers(first: 200) { edges { node { id userEmail name { firstName lastName } } } } }'))
  ?.workspaceMembers?.edges?.map((e) => e.node) ?? [];
const memberByEmail = new Map(members.map((m) => [m.userEmail.toLowerCase(), m]));

const quoted = RING_GROUPS.map((g) => `"${g}"`).join(', ');
const calls = [];
let cursor = null;
for (;;) {
  const d = await gql(
    `query C($after: String) { calls(filter: { and: [{ dialpadUser: { in: [${quoted}] } }, { handledById: { is: "NULL" } }] }, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id dialpadCallId dialpadUser } } } }`,
    { after: cursor },
  );
  const conn = d?.calls;
  if (!conn) break;
  calls.push(...conn.edges.map((e) => e.node));
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
console.log(`ring-group calls without an owner: ${calls.length}`);

const resolved = new Map();
const failures = new Map();
for (const call of calls) {
  if (!call.dialpadCallId) { failures.set('no dialpadCallId stored', (failures.get('no dialpadCallId stored') ?? 0) + 1); continue; }
  const parent = await dialpad(`/call/${call.dialpadCallId}`);
  if (!parent.ok) { failures.set(`parent HTTP ${parent.status}`, (failures.get(`parent HTTP ${parent.status}`) ?? 0) + 1); continue; }
  const legId = parent.body?.operator_call_id;
  if (!legId) { failures.set('no operator_call_id (never answered by a person)', (failures.get('no operator_call_id (never answered by a person)') ?? 0) + 1); continue; }
  const leg = await dialpad(`/call/${legId}`);
  if (!leg.ok) { failures.set(`leg HTTP ${leg.status}`, (failures.get(`leg HTTP ${leg.status}`) ?? 0) + 1); continue; }
  const target = leg.body?.target;
  if (target?.type !== 'user' || !target?.email) {
    failures.set(`leg target not a user (${target?.type ?? 'none'})`, (failures.get(`leg target not a user (${target?.type ?? 'none'})`) ?? 0) + 1);
    continue;
  }
  const member = memberByEmail.get(String(target.email).toLowerCase());
  if (!member) { failures.set(`no workspace member for ${target.email}`, (failures.get(`no workspace member for ${target.email}`) ?? 0) + 1); continue; }
  resolved.set(call.id, { member, answeredBy: target.name ?? `${member.name.firstName} ${member.name.lastName}` });
}

const perMember = new Map();
let written = 0;
for (const [callId, { member, answeredBy }] of resolved) {
  perMember.set(member.id, (perMember.get(member.id) ?? 0) + 1);
  if (DRY_RUN) { written++; continue; }
  // dialpadUser keeps the human-readable answerer so the record no longer reads as a queue
  const r = await gql(
    'mutation U($id: UUID!, $data: CallUpdateInput!) { updateCall(id: $id, data: $data) { id } }',
    { id: callId, data: { handledById: member.id, dialpadUser: answeredBy } },
  );
  if (r?.updateCall?.id) written++;
}

console.log(`${DRY_RUN ? '[dry run] ' : ''}resolved ${resolved.size} of ${calls.length}, wrote ${written}`);
for (const [id, n] of [...perMember.entries()].sort((a, b) => b[1] - a[1])) {
  const m = members.find((x) => x.id === id);
  console.log(`    ${m.name.firstName} ${m.name.lastName}: ${n}`);
}
if (failures.size > 0) {
  console.log('unresolved:');
  for (const [reason, n] of [...failures.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${reason}`);
}
