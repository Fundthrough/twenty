// Gives auto-created records an owner: the rep whose mailbox brought them into the CRM.
//
// Twenty only syncs mail from connected accounts, so any message in the workspace arrived through
// some rep's mailbox and that rep is a participant on it. messageChannel and connectedAccount are
// not exposed on the API, so the participant is the way to identify the inbox.
//
// Where several reps appear on a contact's history the earliest message wins, because that is
// literally who first brought the record in. Ties inside the same message prefer the sender.
//
// Only fills empty owners: person.owner and company.accountOwner. Never overwrites the Salesforce
// ownership or the Client Success handoff that backfill-owners.mjs and
// backfill-account-manager.mjs establish, and only touches records those scripts leave alone
// because they were never in Salesforce.
//
// Idempotent. DRY_RUN=1 reports without writing.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';
const CHUNK = 200;
const ROLE_RANK = { FROM: 0, TO: 1, CC: 2, BCC: 3, REPLY_TO: 4 };

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

const members = (await gql('{ workspaceMembers(first: 200) { edges { node { id name { firstName lastName } } } } }'))
  ?.workspaceMembers?.edges?.map((e) => e.node) ?? [];
const memberById = new Map(members.map((m) => [m.id, m]));

// ---- who owns each auto-created person, by earliest message ----
const AUTO = '{ or: [{ createdBy: { source: { eq: "EMAIL" } } }, { createdBy: { source: { eq: "CALENDAR" } } }] }';
const candidates = [];
let cursor = null;
for (;;) {
  const d = await gql(
    `query P($after: String) { people(filter: { and: [${AUTO}, { ownerId: { is: "NULL" } }] }, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id companyId messageParticipants { edges { node { messageId } } } } } } }`,
    { after: cursor },
  );
  const conn = d?.people;
  if (!conn) break;
  candidates.push(...conn.edges.map((e) => ({
    id: e.node.id,
    companyId: e.node.companyId,
    messageIds: (e.node.messageParticipants?.edges ?? []).map((x) => x.node.messageId).filter(Boolean),
  })));
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
console.log(`auto-created people without an owner: ${candidates.length}`);

const ownerByPerson = new Map();
const ownerVotesByCompany = new Map(); // companyId -> Map<memberId, earliest receivedAt>
let noMessages = 0;
let noMember = 0;
for (const person of candidates) {
  if (person.messageIds.length === 0) { noMessages++; continue; }
  // relation depth caps at 2, so the members on these messages need their own query
  const ids = person.messageIds.slice(0, 40).map((i) => `"${i}"`).join(', ');
  const mp = await gql(
    `{ messageParticipants(filter: { and: [{ messageId: { in: [${ids}] } }, { workspaceMemberId: { is: "NOT_NULL" } }] }, first: 80) {
      edges { node { role workspaceMemberId message { receivedAt } } } } }`,
  );
  const rows = (mp?.messageParticipants?.edges ?? []).map((e) => e.node)
    .filter((n) => n.workspaceMemberId && memberById.has(n.workspaceMemberId));
  if (rows.length === 0) { noMember++; continue; }
  rows.sort((a, b) => {
    const ta = a.message?.receivedAt ? Date.parse(a.message.receivedAt) : Infinity;
    const tb = b.message?.receivedAt ? Date.parse(b.message.receivedAt) : Infinity;
    if (ta !== tb) return ta - tb;
    return (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9);
  });
  const winner = rows[0];
  ownerByPerson.set(person.id, winner.workspaceMemberId);
  if (person.companyId) {
    if (!ownerVotesByCompany.has(person.companyId)) ownerVotesByCompany.set(person.companyId, new Map());
    const votes = ownerVotesByCompany.get(person.companyId);
    const at = winner.message?.receivedAt ? Date.parse(winner.message.receivedAt) : Infinity;
    const prev = votes.get(winner.workspaceMemberId);
    if (prev === undefined || at < prev) votes.set(winner.workspaceMemberId, at);
  }
}
console.log(`  resolved to an inbox owner: ${ownerByPerson.size}`);
console.log(`  no messages at all: ${noMessages} | no workspace member on their messages: ${noMember}`);

const writeGrouped = async (pairs, mutation, resultKey, label) => {
  const byMember = new Map();
  for (const [recordId, memberId] of pairs) {
    if (!byMember.has(memberId)) byMember.set(memberId, []);
    byMember.get(memberId).push(recordId);
  }
  let written = 0;
  const lines = [];
  for (const [memberId, ids] of [...byMember.entries()].sort((a, b) => b[1].length - a[1].length)) {
    let done = 0;
    if (DRY_RUN) {
      done = ids.length;
    } else {
      for (let i = 0; i < ids.length; i += CHUNK) {
        done += await gql(mutation, { ids: ids.slice(i, i + CHUNK), memberId }).then((d) => d?.[resultKey]?.length ?? 0);
      }
    }
    written += done;
    const m = memberById.get(memberId);
    lines.push(`    ${m ? `${m.name.firstName} ${m.name.lastName}` : memberId}: ${done}`);
  }
  console.log(`${DRY_RUN ? '[dry run] ' : ''}${label}: ${written}`);
  console.log(lines.join('\n'));
};

await writeGrouped(
  [...ownerByPerson.entries()],
  'mutation U($ids: [UUID!], $memberId: UUID!) { updatePeople(filter: { id: { in: $ids } }, data: { ownerId: $memberId }) { id } }',
  'updatePeople',
  'people given an owner',
);

// ---- companies: same rule, and only where nobody owns them yet ----
const companyIds = [...ownerVotesByCompany.keys()];
const companyPairs = [];
for (let i = 0; i < companyIds.length; i += 100) {
  const slice = companyIds.slice(i, i + 100).map((x) => `"${x}"`).join(', ');
  const d = await gql(
    `{ companies(filter: { and: [{ id: { in: [${slice}] } }, { accountOwnerId: { is: "NULL" } }] }, first: 100) {
      edges { node { id } } } }`,
  );
  for (const e of d?.companies?.edges ?? []) {
    const votes = ownerVotesByCompany.get(e.node.id);
    if (!votes || votes.size === 0) continue;
    // earliest contact across all of this company's people decides
    const [memberId] = [...votes.entries()].sort((a, b) => a[1] - b[1])[0];
    companyPairs.push([e.node.id, memberId]);
  }
}
await writeGrouped(
  companyPairs,
  'mutation U($ids: [UUID!], $memberId: UUID!) { updateCompanies(filter: { id: { in: $ids } }, data: { accountOwnerId: $memberId }) { id } }',
  'updateCompanies',
  'companies given an account owner',
);
