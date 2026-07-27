// Outreach ⇄ Twenty wiring bootstrap (EE-5069 Phase 1). Idempotent.
//   1. loads/refreshes Outreach tokens (~/.outreach-tokens-<env>.json from outreach-auth.mjs)
//   2. sets Twenty app registration variables (OUTREACH_WORKSPACE_ID / WEBHOOK_SECRET /
//      ACCESS_TOKEN / LOG_ONLY) — same mechanism as the Dialpad vars
//   3. creates one Outreach webhook per resource pointed at the outreach-webhook function
// Usage:  node scripts/setup-outreach.mjs            # dev Outreach app
//         OUTREACH_ENV=prod node scripts/setup-outreach.mjs
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ENV = process.env.OUTREACH_ENV === 'prod' ? 'prod' : 'dev';
const TOKENS_PATH = join(homedir(), `.outreach-tokens-${ENV}.json`);
const HOOK_URL = 'https://fundthrough-sales.twenty.com/webhooks/server/c77f6ccf-c9c0-42b2-8875-970643187fab';
const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const REGISTRATION_ID = '0cdeaad6-03e8-456d-ae94-f372b9b2439e'; // FT Salesforce Migration
const RESOURCES = ['prospect', 'call', 'mailing', 'sequenceState', 'task'];

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const TWENTY_KEY = cfg.apiKey;
const claim = JSON.parse(Buffer.from(TWENTY_KEY.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== SALES_WORKSPACE_ID) { console.error('API key is not the sales workspace — aborting'); process.exit(1); }

const twentyGql = async (query, variables) => {
  const res = await fetch((cfg.apiUrl ?? cfg.url) + '/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TWENTY_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  return res.json().catch(() => null);
};

// ---- 1. Outreach tokens (refresh when older than 100 min; refresh tokens ROTATE) ----
let tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
const ageMinutes = (Date.now() - new Date(tokens.savedAt).getTime()) / 60000;
if (ageMinutes > 100) {
  const CLIENT_ID = ENV === 'prod' ? process.env.PROD_OUTREACH_CLIENT_ID : process.env.DEV_OUTREACH_CLIENT_ID;
  const CLIENT_SECRET = ENV === 'prod' ? process.env.PROD_OUTREACH_CLIENT_SECRET : process.env.DEV_OUTREACH_CLIENT_SECRET;
  const res = await fetch('https://api.outreach.io/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: tokens.refresh_token }),
  });
  if (!res.ok) { console.error(`token refresh failed (${res.status}) — rerun scripts/outreach-auth.mjs`); process.exit(1); }
  tokens = await res.json();
  writeFileSync(TOKENS_PATH, JSON.stringify({ ...tokens, savedAt: new Date().toISOString(), env: ENV }, null, 2));
  chmodSync(TOKENS_PATH, 0o600);
  console.log('access token refreshed (rotated refresh token saved)');
} else {
  console.log(`access token is ${Math.round(ageMinutes)} min old — still valid`);
}

const outreach = async (method, path, body) => {
  const res = await fetch(`https://api.outreach.io/api/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/vnd.api+json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
};

// ---- 2. Twenty app registration variables ----
// NOTE: never request `value` here — secret variables read back as null and GraphQL
// null-propagation then nukes the whole list, which mis-routes everything to CREATE
const varsRes = await twentyGql(
  `query V($id: String!) { findApplicationRegistrationVariables(applicationRegistrationId: $id) { id key } }`,
  { id: REGISTRATION_ID },
);
const existingVars = varsRes.data?.findApplicationRegistrationVariables ?? [];
if (!varsRes.data) { console.error('variable listing failed:', JSON.stringify(varsRes?.errors).slice(0, 200)); process.exit(1); }
const byKey = Object.fromEntries(existingVars.map((v) => [v.key, v]));

// secret app variables are write-only on read — keep the canonical copy in a local
// 600-file so the simulator can sign, and rotate Twenty + Outreach together from it
const SECRET_PATH = join(homedir(), `.outreach-webhook-secret-${ENV}`);
let secret = process.env.OUTREACH_WEBHOOK_SECRET;
if (!secret) { try { secret = readFileSync(SECRET_PATH, 'utf8').trim(); } catch { /* first run */ } }
if (!secret) secret = randomBytes(24).toString('hex');
writeFileSync(SECRET_PATH, secret);
chmodSync(SECRET_PATH, 0o600);

const ensureVariable = async (key, value, isSecret) => {
  if (byKey[key]) {
    // values are unreadable (see listing note) — push unconditionally, it's idempotent
    const r = await twentyGql(
      `mutation U($input: UpdateApplicationRegistrationVariableInput!) { updateApplicationRegistrationVariable(input: $input) { id } }`,
      { input: { id: byKey[key].id, update: { value } } },
    );
    console.log(`var ${key}: ${r?.data ? 'updated' : 'UPDATE FAILED ' + JSON.stringify(r?.errors).slice(0, 120)}`);
  } else {
    const r = await twentyGql(
      `mutation C($input: CreateApplicationRegistrationVariableInput!) { createApplicationRegistrationVariable(input: $input) { id } }`,
      { input: { applicationRegistrationId: REGISTRATION_ID, key, value, isSecret, description: 'Outreach integration (EE-5069)' } },
    );
    console.log(`var ${key}: ${r?.data ? 'created' : 'CREATE FAILED ' + JSON.stringify(r?.errors).slice(0, 120)}`);
  }
};

await ensureVariable('OUTREACH_WORKSPACE_ID', SALES_WORKSPACE_ID, false);
await ensureVariable('OUTREACH_WEBHOOK_SECRET', secret, true);
await ensureVariable('OUTREACH_ACCESS_TOKEN', tokens.access_token, true);
await ensureVariable('OUTREACH_LOG_ONLY', process.env.OUTREACH_LOG_ONLY ?? '1', false);

// push-button auth token (outreach-push httpRoute) — same local-600-file pattern
const PUSH_TOKEN_PATH = join(homedir(), `.outreach-push-token-${ENV}`);
let pushToken;
try { pushToken = readFileSync(PUSH_TOKEN_PATH, 'utf8').trim(); } catch { /* first run */ }
if (!pushToken) { pushToken = randomBytes(24).toString('hex'); }
writeFileSync(PUSH_TOKEN_PATH, pushToken);
chmodSync(PUSH_TOKEN_PATH, 0o600);
await ensureVariable('OUTREACH_PUSH_TOKEN', pushToken, true);

// ---- 3. Outreach webhook subscriptions ----
const hooks = (await outreach('GET', '/webhooks?page[limit]=100')).data ?? [];
for (const resource of RESOURCES) {
  const existing = hooks.find((h) => h.attributes.url === HOOK_URL && h.attributes.resource === resource);
  if (existing) {
    // secret is unreadable remotely — re-push it so both sides always share the local copy
    await outreach('PATCH', `/webhooks/${existing.id}`, {
      data: { type: 'webhook', id: Number(existing.id), attributes: { secret, active: true } },
    });
    console.log(`webhook ${resource}: exists (#${existing.id}) — secret re-synced`);
    continue;
  }
  const created = await outreach('POST', '/webhooks', {
    data: { type: 'webhook', attributes: { url: HOOK_URL, secret, resource, action: '*', active: true } },
  });
  console.log(`webhook ${resource}: created #${created.data.id}`);
}

console.log('\nOUTREACH WIRING COMPLETE — LOG_ONLY is on; watch: npx twenty dev:function:logs -n process-outreach-event');
