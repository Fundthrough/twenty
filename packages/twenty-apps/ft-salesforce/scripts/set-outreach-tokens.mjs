// Pushes the freshly refreshed Outreach tokens from ~/.outreach-tokens-<env>.json into the app
// variables. Values are read from disk and sent straight to the API: never logged.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const ENV = process.env.OUTREACH_ENV === 'prod' ? 'prod' : 'dev';
const REG = '0cdeaad6-03e8-456d-ae94-f372b9b2439e';
const t = JSON.parse(readFileSync(join(homedir(), `.outreach-tokens-${ENV}.json`), 'utf8'));
if (!t.access_token) { console.error('no access token in file'); process.exit(1); }
const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const apiKey = process.env.OUTREACH_TWENTY_KEY ?? cfg.apiKey;
const claim = JSON.parse(Buffer.from(apiKey.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') { console.error('wrong workspace'); process.exit(1); }
const gql = async (query, variables) => (await fetch(`${cfg.apiUrl ?? cfg.url}/metadata`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({ query, variables }) }).then(r => r.json()));
const list = await gql('query V($id: String!) { findApplicationRegistrationVariables(applicationRegistrationId: $id) { id key } }', { id: REG });
if (!list.data) { console.error('listing failed:', JSON.stringify(list.errors).slice(0,200)); process.exit(1); }
const byKey = Object.fromEntries((list.data.findApplicationRegistrationVariables ?? []).map(v => [v.key, v.id]));
for (const [key, value] of [['OUTREACH_ACCESS_TOKEN', t.access_token], ['OUTREACH_REFRESH_TOKEN', t.refresh_token]]) {
  if (!value || !byKey[key]) { console.log(`${key}: skipped`); continue; }
  const r = await gql('mutation U($input: UpdateApplicationRegistrationVariableInput!) { updateApplicationRegistrationVariable(input: $input) { id } }',
    { input: { id: byKey[key], update: { value } } });
  console.log(`${key}: ${r?.data ? 'updated' : 'FAILED ' + JSON.stringify(r?.errors).slice(0,140)}`);
}
