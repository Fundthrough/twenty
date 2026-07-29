// Upserts DIALPAD_API_KEY as a secret app variable so process-dialpad-event can resolve the
// answering user on a ring-group call, which needs a Dialpad API call the webhook payload alone
// cannot answer (see resolve-ring-group-calls.mjs for the operator_call_id chain).
//
// The value is read from the environment and passed straight to the API: never logged, never
// echoed. The key lives in ~/.zshrc.local as DIALPAD_FT_API_KEY, so run this from an interactive
// shell:
//   DIALPAD_API_KEY="$DIALPAD_FT_API_KEY" node scripts/set-dialpad-api-key.mjs
//
// Idempotent: updates in place if the variable already exists.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const REGISTRATION_ID = '0cdeaad6-03e8-456d-ae94-f372b9b2439e'; // FT Salesforce Migration
const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const KEY_NAME = 'DIALPAD_API_KEY';

const value = process.env.DIALPAD_API_KEY ?? process.env.DIALPAD_FT_API_KEY;
if (!value) { console.error('no DIALPAD key in env'); process.exit(1); }

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
// Writes from the Dialpad integration should carry its own key rather than the admin key,
// so they are attributable in Twenty. Falls back to the config key when the env var is absent.
// The workspace guard below then validates whichever key is actually in use.
if (process.env.DIALPAD_TWENTY_KEY) cfg.apiKey = process.env.DIALPAD_TWENTY_KEY;
const claim = JSON.parse(Buffer.from(cfg.apiKey.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== SALES_WORKSPACE_ID) { console.error('not the sales workspace, aborting'); process.exit(1); }

const gql = async (query, variables) => (await fetch(`${cfg.apiUrl ?? cfg.url}/metadata`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
  body: JSON.stringify({ query, variables }),
}).then((r) => r.json()));

// never select `value`: secret variables read back null and null-propagation empties the list
const list = await gql(
  'query V($id: String!) { findApplicationRegistrationVariables(applicationRegistrationId: $id) { id key } }',
  { id: REGISTRATION_ID },
);
if (!list.data) { console.error('listing failed:', JSON.stringify(list.errors).slice(0, 200)); process.exit(1); }
const vars = list.data.findApplicationRegistrationVariables ?? [];
console.log('existing app variables:', vars.map((v) => v.key).sort().join(', '));

const existing = vars.find((v) => v.key === KEY_NAME);
const res = existing
  ? await gql('mutation U($input: UpdateApplicationRegistrationVariableInput!) { updateApplicationRegistrationVariable(input: $input) { id } }',
      { input: { id: existing.id, update: { value } } })
  : await gql('mutation C($input: CreateApplicationRegistrationVariableInput!) { createApplicationRegistrationVariable(input: $input) { id } }',
      { input: { applicationRegistrationId: REGISTRATION_ID, key: KEY_NAME, value, isSecret: true,
                 description: 'Dialpad API key — resolves the answering user on ring-group calls (EE-4972)' } });

console.log(`${KEY_NAME}: ${res?.data ? (existing ? 'updated' : 'created') : 'FAILED ' + JSON.stringify(res?.errors).slice(0, 200)}`);
