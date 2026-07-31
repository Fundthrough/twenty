// Set or read one app registration variable on the sales workspace.
// Usage:  node scripts/set-app-variable.mjs OUTREACH_SYNC_LOOKBACK_MINUTES 20
//         node scripts/set-app-variable.mjs --list
// Secret values are write-only on read, so --list shows keys only.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const REGISTRATION_ID = '0cdeaad6-03e8-456d-ae94-f372b9b2439e';

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const TWENTY_KEY = cfg.apiKey;
const claim = JSON.parse(Buffer.from(TWENTY_KEY.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== SALES_WORKSPACE_ID) { console.error('API key is not the sales workspace — aborting'); process.exit(1); }

const gql = async (query, variables) => {
  const res = await fetch((cfg.apiUrl ?? cfg.url) + '/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TWENTY_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  return res.json().catch(() => null);
};

// never select `value`: secrets read back null and GraphQL null-propagation empties the whole list
const listed = await gql(
  `query V($id: String!) { findApplicationRegistrationVariables(applicationRegistrationId: $id) { id key isSecret } }`,
  { id: REGISTRATION_ID },
);
const vars = listed?.data?.findApplicationRegistrationVariables;
if (!vars) { console.error('listing failed:', JSON.stringify(listed?.errors).slice(0, 200)); process.exit(1); }

const [key, ...rest] = process.argv.slice(2);
if (!key || key === '--list') {
  for (const v of vars.sort((a, b) => a.key.localeCompare(b.key))) console.log(`${v.isSecret ? 'secret' : 'plain '}  ${v.key}`);
  process.exit(0);
}

const value = rest.join(' ');
if (!value) { console.error(`no value given for ${key}`); process.exit(1); }

const existing = vars.find((v) => v.key === key);
const r = existing
  ? await gql(
      `mutation U($input: UpdateApplicationRegistrationVariableInput!) { updateApplicationRegistrationVariable(input: $input) { id } }`,
      { input: { id: existing.id, update: { value } } },
    )
  : await gql(
      `mutation C($input: CreateApplicationRegistrationVariableInput!) { createApplicationRegistrationVariable(input: $input) { id } }`,
      { input: { applicationRegistrationId: REGISTRATION_ID, key, value, isSecret: false, description: 'set via scripts/set-app-variable.mjs' } },
    );

if (!r?.data) { console.error(`${existing ? 'update' : 'create'} failed:`, JSON.stringify(r?.errors).slice(0, 300)); process.exit(1); }
console.log(`${key} = ${value} (${existing ? 'updated' : 'created'})`);
