// Dialpad webhook simulator — Phase 5 E2E validation against the CLOUD sales workspace.
// Signs synthetic Dialpad-style JWT payloads with the webhook secret and POSTs them at
// the dialpad-webhook server route, then verifies the resulting Call/Task records via
// the core API. Idempotency, outcome-upgrade, unmatched-queue and bad-signature paths
// are all exercised. Scrubs everything it created at the end (KEEP_RECORDS=1 to skip).
//
// Prereqs: app synced to sales, DIALPAD_WEBHOOK_SECRET + DIALPAD_WORKSPACE_ID set as
// app server variables (setup-dialpad.mjs prints them), DIALPAD_LOG_ONLY unset.
// Usage: TWENTY_BO_API_KEY=… DIALPAD_WEBHOOK_SECRET=… node scripts/simulate-dialpad.mjs
import { createHmac } from 'node:crypto';

const API_KEY = process.env.TWENTY_BO_API_KEY;
const SECRET = process.env.DIALPAD_WEBHOOK_SECRET;
if (!API_KEY) { console.error('TWENTY_BO_API_KEY not set'); process.exit(1); }
if (!SECRET) { console.error('DIALPAD_WEBHOOK_SECRET not set (same value as the app server variable)'); process.exit(1); }
const claims = JSON.parse(Buffer.from(API_KEY.split('.')[1], 'base64url').toString());
if (claims.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('ABORT: key workspaceId is not the sales workspace:', claims.workspaceId);
  process.exit(1);
}

const BASE = 'https://fundthrough-sales.twenty.com';
const HOOK = `${BASE}/webhooks/server/8b0356ab-189c-4012-b5d6-b3208ecdc28a`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gql = async (query, variables) => {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
};

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const signJwt = (payload, secret = SECRET) => {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};
// text/plain: the only content type Twenty's body parsers accept for a bare JWT string
// (json chokes on it, application/jwt is never parsed → no rawBody). Real Dialpad
// deliveries are validated separately in DIALPAD_LOG_ONLY mode.
const post = async (payload, secret = SECRET) => {
  const res = await fetch(HOOK, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: signJwt(payload, secret) });
  return res.status;
};

let pass = 0; let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

const RUN = Date.now();
const MATCHED_PHONE = '+14165550111';
const UNMATCHED_PHONE = '+14165559999';
const id = (n) => `sim-${RUN}-${n}`;
const NOW = Date.now();
const baseEvent = (n, extra) => ({
  call_id: id(n),
  direction: 'inbound',
  external_number: MATCHED_PHONE,
  internal_number: '+14165550100',
  contact: { phone: MATCHED_PHONE, name: 'Dialpad Testperson', type: 'external' },
  target: { name: 'Test AM', email: 'am@fundthrough.com', type: 'user' },
  date_started: NOW - 300000,
  date_ended: NOW - 30000,
  state: 'hangup',
  ...extra,
});

const findCall = async (callId) => {
  const r = await gql('query C($f: CallFilterInput) { calls(filter: $f, first: 2) { edges { node { id name outcome direction durationSeconds externalNumber voicemailTranscript recordingUrl { primaryLinkUrl } person { id } company { id } } } } }',
    { f: { dialpadCallId: { eq: callId } } });
  return r.data?.calls?.edges?.map((e) => e.node) ?? [];
};

// ---- seed a matchable person ----
console.log('Seeding test person…');
const created = await gql('mutation P($data: PersonCreateInput!) { createPerson(data: $data) { id } }',
  { data: { name: { firstName: 'Dialpad', lastName: 'Testperson' }, emails: { primaryEmail: `dialpad-sim-${RUN}@example.com` }, phones: { primaryPhoneNumber: MATCHED_PHONE } } });
const personId = created.data?.createPerson?.id;
if (!personId) { console.error('could not create test person:', JSON.stringify(created.errors).slice(0, 300)); process.exit(1); }

console.log('\n== scenarios ==');
// 1. inbound completed (matched)
let status = await post(baseEvent(1, { date_connected: NOW - 290000, duration: 252000 }));
await sleep(5000);
let calls = await findCall(id(1));
check('S1 inbound completed → 1 Call', calls.length === 1, `status ${status}`);
check('S1 outcome COMPLETED', calls[0]?.outcome === 'COMPLETED', calls[0]?.outcome);
check('S1 matched person', calls[0]?.person?.id === personId);
check('S1 duration 252s', calls[0]?.durationSeconds === 252, String(calls[0]?.durationSeconds));

// 2. duplicate delivery → still one record
await post(baseEvent(1, { date_connected: NOW - 290000, duration: 252000 }));
await sleep(5000);
calls = await findCall(id(1));
check('S2 duplicate delivery → still 1 Call', calls.length === 1, `${calls.length} records`);

// 3. recording event arrives late → url attached, outcome kept
status = await post(baseEvent(1, { state: 'recording', date_connected: NOW - 290000, admin_call_recording_urls: ['https://dialpad.com/recording/sim-1'] }));
await sleep(5000);
calls = await findCall(id(1));
check('S3 recording attached', !!calls[0]?.recordingUrl?.primaryLinkUrl, calls[0]?.recordingUrl?.primaryLinkUrl);
check('S3 outcome still COMPLETED', calls[0]?.outcome === 'COMPLETED', calls[0]?.outcome);

// 4. missed inbound (no date_connected)
await post(baseEvent(4, {}));
await sleep(5000);
calls = await findCall(id(4));
check('S4 missed call → MISSED', calls[0]?.outcome === 'MISSED', calls[0]?.outcome);

// 5. voicemail with transcription
await post(baseEvent(5, { state: 'voicemail', voicemail_link: 'https://dialpad.com/voicemail/sim-5', transcription_text: 'Hi, please call me back about the invoice.' }));
await sleep(5000);
calls = await findCall(id(5));
check('S5 voicemail → VOICEMAIL', calls[0]?.outcome === 'VOICEMAIL', calls[0]?.outcome);
check('S5 transcript stored', (calls[0]?.voicemailTranscript ?? '').includes('invoice'));

// 6. unmatched number → Call without person + ONE review task (twice)
await post(baseEvent(6, { external_number: UNMATCHED_PHONE, contact: { phone: UNMATCHED_PHONE, name: 'Unknown', type: 'external' }, date_connected: NOW - 200000, duration: 61000 }));
await sleep(5000);
await post(baseEvent(7, { external_number: UNMATCHED_PHONE, contact: { phone: UNMATCHED_PHONE, name: 'Unknown', type: 'external' } }));
await sleep(5000);
calls = await findCall(id(6));
check('S6 unmatched call logged without person', calls.length === 1 && !calls[0]?.person, calls[0]?.person?.id ?? 'no person');
const tasks = await gql('query T($f: TaskFilterInput) { tasks(filter: $f, first: 5) { edges { node { id status } } } }',
  { f: { title: { eq: `Unmatched call: ${UNMATCHED_PHONE}` } } });
const taskNodes = tasks.data?.tasks?.edges?.map((e) => e.node) ?? [];
check('S6 exactly one open review task for the number', taskNodes.length === 1, `${taskNodes.length} tasks`);

// 7. bad signature rejected, nothing written
status = await post(baseEvent(8, { date_connected: NOW }), 'wrong-secret');
await sleep(3000);
calls = await findCall(id(8));
check('S7 bad signature → non-2xx', status < 200 || status >= 300, `status ${status}`);
check('S7 no record written', calls.length === 0, `${calls.length} records`);

console.log(`\n== ${pass} passed, ${fail} failed ==`);

// ---- scrub (unique index counts soft-deleted rows: delete then destroy) ----
if (!process.env.KEEP_RECORDS) {
  console.log('Scrubbing…');
  const ids = [];
  for (const n of [1, 4, 5, 6, 7, 8]) ids.push(...(await findCall(id(n))).map((c) => c.id));
  for (const cid of ids) { await gql('mutation($id: UUID!) { deleteCall(id: $id) { id } }', { id: cid }); await sleep(300); }
  const trashed = await gql('query { calls(filter: { deletedAt: { is: "NOT_NULL" } }, first: 50) { edges { node { id dialpadCallId } } } }');
  for (const e of trashed.data?.calls?.edges ?? []) {
    if ((e.node.dialpadCallId ?? '').startsWith(`sim-${RUN}-`)) { await gql('mutation($id: UUID!) { destroyCall(id: $id) { id } }', { id: e.node.id }); await sleep(300); }
  }
  for (const t of taskNodes) { await gql('mutation($id: UUID!) { deleteTask(id: $id) { id } }', { id: t.id }); await sleep(300); }
  await gql('mutation($id: UUID!) { deletePerson(id: $id) { id } }', { id: personId });
  console.log('scrub complete');
}
process.exit(fail ? 1 : 0);
