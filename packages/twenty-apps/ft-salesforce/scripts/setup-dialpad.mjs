// Dialpad-side bootstrap — Phase 4 of the Dialpad integration (docs/DIALPAD-SETUP.md).
// Idempotent: creates (or finds) the Dialpad webhook pointing at the Twenty sales
// workspace and ensures one call-event subscription PER SALES USER. Department/office
// targeting was rejected by the data: FT's calls happen on personal user lines
// (verified 2026-07-20 — sales departments have zero activity).
// Touches DIALPAD only — the Twenty side is configured via app server variables.
//
// Usage:
//   DIALPAD_API_KEY=…  node scripts/setup-dialpad.mjs
// Optional:
//   DIALPAD_WEBHOOK_SECRET=…   reuse an existing secret (else one is generated)
//   DIALPAD_TARGET_USERS="Name A,Name B"   override/extend the default sales list
//   DIALPAD_CALL_STATES=hangup,voicemail,recording   override subscribed states
import { randomBytes } from 'node:crypto';

const BASE = 'https://dialpad.com/api/v2';
const API_KEY = process.env.DIALPAD_API_KEY;
if (!API_KEY) { console.error('DIALPAD_API_KEY not set'); process.exit(1); }

// sales/AM list confirmed by Linesh 2026-07-20 (top user-line callers)
const SALES_USERS = (process.env.DIALPAD_TARGET_USERS ?? [
  'Moksh Chaddha',
  "Lyle O'Neill",
  'Alvaro Cu',
  'Vincent Grassa',
  'Shivani Anand',
  'Allie Bacon',
  'Francisco Cancino',
].join(',')).split(',').map((s) => s.trim()).filter(Boolean);

// serverRoute logic function `dialpad-webhook` (DIALPAD_EVENTS_FUNCTION_UID) on the
// canonical sales host — fundthrough.twenty.com redirects and can downgrade POSTs
const HOOK_URL = 'https://fundthrough-sales.twenty.com/webhooks/server/8b0356ab-189c-4012-b5d6-b3208ecdc28a';
const CALL_STATES = (process.env.DIALPAD_CALL_STATES ?? 'hangup,voicemail,recording').split(',').map((s) => s.trim()).filter(Boolean);

const api = async (method, path, payload) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
};
const listAll = async (path) => {
  const items = []; let cursor; let pages = 0;
  do {
    const j = await api('GET', `${path}${path.includes('?') ? '&' : '?'}limit=50${cursor ? `&cursor=${cursor}` : ''}`);
    items.push(...(j.items ?? []));
    cursor = j.cursor; pages++;
  } while (cursor && pages < 20);
  return items;
};

// ---- 1. webhook (find by hook_url prefix or create) ----
// JSON mode (no secret): Dialpad's JWT mode posts Content-Type: application/jwt, which
// Twenty's server does not body-parse (main.ts: json/urlencoded/text-plain only) — real
// deliveries failed with "No JWT body available" (2026-07-20). Until upstream accepts
// application/jwt, auth = random ?token= in the URL, checked constant-time by the
// resolver against the DIALPAD_URL_TOKEN app variable. Set DIALPAD_USE_JWT=1 to go back
// to secret/JWT mode once Twenty parses it.
const USE_JWT = !!process.env.DIALPAD_USE_JWT;
const hooks = await listAll('/webhooks');
let hook = hooks.find((h) => (h.hook_url ?? '').startsWith(HOOK_URL));
let secret = process.env.DIALPAD_WEBHOOK_SECRET;
let urlToken = process.env.DIALPAD_URL_TOKEN;
if (hook) {
  console.log(`webhook exists (id ${hook.id})`);
} else if (USE_JWT) {
  secret = secret ?? randomBytes(32).toString('hex');
  hook = await api('POST', '/webhooks', { hook_url: HOOK_URL, secret });
  console.log(`webhook created in JWT mode (id ${hook.id})`);
} else {
  urlToken = urlToken ?? randomBytes(24).toString('hex');
  hook = await api('POST', '/webhooks', { hook_url: `${HOOK_URL}?token=${urlToken}` });
  console.log(`webhook created in JSON+token mode (id ${hook.id})`);
}

// ---- 2. resolve sales users → ids ----
const users = await listAll('/users?state=active');
const byName = new Map(users.map((u) => [(u.display_name ?? `${u.first_name} ${u.last_name}`).toLowerCase(), u]));
const targets = [];
for (const name of SALES_USERS) {
  const u = byName.get(name.toLowerCase());
  if (u) targets.push({ id: u.id, name });
  else console.error(`WARNING: no active Dialpad user named "${name}" — skipped`);
}
if (!targets.length) { console.error('no target users resolved — aborting'); process.exit(1); }

// ---- 3. one call-event subscription per user (skip existing) ----
const subs = await listAll('/subscriptions/call');
const hookSubs = subs.filter((s) => String(s.webhook?.id ?? s.webhook_id) === String(hook.id));
for (const t of targets) {
  const existing = hookSubs.find((s) => String(s.target?.id ?? s.target_id) === String(t.id));
  if (existing) { console.log(`subscription exists for ${t.name} (id ${existing.id})`); continue; }
  const sub = await api('POST', '/subscriptions/call', {
    webhook_id: hook.id,
    enabled: true,
    target_type: 'user',
    target_id: Number(t.id),
    call_states: CALL_STATES,
  });
  console.log(`subscription created for ${t.name} (id ${sub.id}, states: ${CALL_STATES.join(', ')})`);
}

// ---- 4. one SMS event subscription per user (skip existing) ----
const smsSubs = await listAll('/subscriptions/sms');
const hookSmsSubs = smsSubs.filter((s) => String(s.webhook?.id ?? s.webhook_id) === String(hook.id));
for (const t of targets) {
  const existing = hookSmsSubs.find((s) => String(s.target?.id ?? s.target_id) === String(t.id));
  if (existing) { console.log(`sms subscription exists for ${t.name} (id ${existing.id})`); continue; }
  const sub = await api('POST', '/subscriptions/sms', {
    webhook_id: hook.id,
    enabled: true,
    direction: 'all',
    target_type: 'user',
    target_id: Number(t.id),
  });
  console.log(`sms subscription created for ${t.name} (id ${sub.id})`);
}

console.log('\n== Twenty-side wiring (Settings → Applications → FT Salesforce Migration → server variables) ==');
console.log('  DIALPAD_WORKSPACE_ID = 3ae378c2-3871-4fff-8c69-b4dff2bd5501');
if (USE_JWT) console.log(`  DIALPAD_WEBHOOK_SECRET = ${secret ?? '<the secret from the original run>'}`);
else console.log(`  DIALPAD_URL_TOKEN = ${urlToken ?? '<the token from the original run>'}`);
console.log('  DIALPAD_LOG_ONLY = 1   (keep until real payloads are validated, then remove)');
