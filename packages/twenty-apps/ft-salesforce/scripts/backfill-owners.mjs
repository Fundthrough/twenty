// Links person.owner / company.accountOwner to workspace members by matching the
// imported sfOwnerEmail against member emails. Run after each AM invite; idempotent —
// only fills NULL relations, never overwrites a manual reassignment.
// Usage: TWENTY_BO_API_KEY=… node scripts/backfill-owners.mjs
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const API_KEY = process.env.TWENTY_BO_API_KEY ?? cfg.apiKey;
const BASE = 'https://fundthrough-sales.twenty.com';
const claims = JSON.parse(Buffer.from(API_KEY.split('.')[1], 'base64url').toString());
if (claims.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('ABORT: not the sales workspace:', claims.workspaceId); process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gql = async (q, v) => (await (await fetch(`${BASE}/graphql`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
  body: JSON.stringify({ query: q, variables: v }),
})).json());

const members = (await gql('{ workspaceMembers(first: 100) { edges { node { id userEmail name { firstName lastName } } } } }')).data.workspaceMembers.edges.map((e) => e.node);
const memberByEmail = new Map(members.map((m) => [m.userEmail.toLowerCase(), m]));
console.log(`workspace members: ${members.map((m) => m.userEmail).join(', ')}`);

async function backfill(plural, ownerField, updateMutation) {
  let cursor; let linked = 0; let unresolved = new Set();
  for (;;) {
    const r = await gql(`query Q($after: String) { ${plural}(first: 60, after: $after, filter: { sfOwnerEmail: { neq: "" }, ${ownerField}: { is: "NULL" } }) { edges { node { id sfOwnerEmail } } pageInfo { hasNextPage endCursor } } }`, { after: cursor });
    const conn = r?.data?.[plural];
    if (!conn) { console.error(`${plural} query failed:`, JSON.stringify(r?.errors).slice(0, 200)); return; }
    for (const { node } of conn.edges) {
      const member = memberByEmail.get((node.sfOwnerEmail ?? '').toLowerCase());
      if (!member) { unresolved.add(node.sfOwnerEmail); continue; }
      const u = await gql(updateMutation, { id: node.id, data: { [ownerField]: member.id } });
      if (u?.data) linked++;
      await sleep(400);
    }
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  console.log(`${plural}: ${linked} linked; unresolved owner emails: ${[...unresolved].join(', ') || 'none'}`);
}

await backfill('people', 'ownerId', 'mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }');
await backfill('companies', 'accountOwnerId', 'mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }');
console.log('backfill complete');
