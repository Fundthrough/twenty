// Resolves call.handledBy from the Dialpad user name on every call, not just the ones that
// arrived without a person (fix-unmatched-calls only walked those). Last Activity By reads
// from this, so calls looked unowned next to emails until it was filled in.
//
// Calls whose dialpadUser is a Dialpad-only user or a route name (Sales team, Customer Success)
// have no workspace member to point at and stay blank by design.
//
// Idempotent. DRY_RUN=1 reports without writing.
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

const members = (await gql('{ workspaceMembers(first: 200) { edges { node { id name { firstName lastName } } } } }'))
  ?.workspaceMembers?.edges?.map((e) => e.node) ?? [];
const memberByName = new Map(members.map((m) => [`${m.name.firstName} ${m.name.lastName}`.trim().toLowerCase(), m.id]));

let scanned = 0;
let set = 0;
const unresolved = new Map();
// Live runs shrink the filter as they write, so page with the cursor inside a pass and repeat
// passes until one resolves nothing. Records already carrying handledBy drop out on their own.
for (let pass = 1; pass <= 20; pass++) {
  let cursor = null;
  let resolvedThisPass = 0;
  unresolved.clear();
  for (;;) {
    const page = await gql(
      `query C($after: String) { calls(filter: { handledById: { is: "NULL" } }, first: 100, after: $after) { pageInfo { hasNextPage endCursor } edges { node { id dialpadUser } } } }`,
      { after: cursor },
    );
    const conn = page?.calls;
    if (!conn) break;
    for (const { node } of conn.edges) {
      scanned++;
      const memberId = node.dialpadUser ? memberByName.get(node.dialpadUser.trim().toLowerCase()) : undefined;
      if (!memberId) {
        if (node.dialpadUser) unresolved.set(node.dialpadUser, (unresolved.get(node.dialpadUser) ?? 0) + 1);
        continue;
      }
      if (!DRY_RUN) {
        await gql('mutation U($id: UUID!, $data: CallUpdateInput!) { updateCall(id: $id, data: $data) { id } }', {
          id: node.id,
          data: { handledById: memberId },
        });
      }
      set++;
      resolvedThisPass++;
    }
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  if (DRY_RUN || resolvedThisPass === 0) break;
}

console.log(`${DRY_RUN ? '[dry run] ' : ''}calls without handledBy scanned: ${scanned}, resolved: ${set}`);
if (unresolved.size > 0) {
  console.log('no workspace member for:', [...unresolved.entries()].map(([n, c]) => `${n} (${c})`).join(', '));
}
