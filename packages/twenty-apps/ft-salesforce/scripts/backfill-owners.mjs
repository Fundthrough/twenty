// Populates person.owner and company.accountOwner from the sfOwnerEmail carried over by the
// Salesforce import. The import never resolved these relations, so every record landed unowned.
//
// Only Salesforce owners who are current workspace members are assigned. The rest are departed
// reps, plus shared mailboxes (backoffice@, marketingadmin@, techadmin@) that own thousands of
// records between them and must never be folded into an individual's book.
//
// Filtered bulk mutations rather than one call per record, chunked because the API rejects an
// update touching more than 200 rows. Each chunk re-queries for rows whose owner is still NULL,
// so re-runs are no-ops and an interrupted run resumes where it stopped.
//
// Idempotent. DRY_RUN=1 reports what would be written.
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
  if (body?.errors) console.log('  gql error:', JSON.stringify(body.errors).slice(0, 200));
  return body?.data;
};

const members = (await gql('{ workspaceMembers(first: 200) { edges { node { id userEmail name { firstName lastName } } } } }'))
  ?.workspaceMembers?.edges?.map((e) => e.node) ?? [];

const CHUNK = 200;

const TARGETS = [
  {
    label: 'people',
    count: (email) =>
      gql(
        `query C($email: String!) { people(filter: { and: [{ ownerId: { is: "NULL" } }, { sfOwnerEmail: { ilike: $email } }] }, first: 1) { totalCount } }`,
        { email },
      ).then((d) => d?.people?.totalCount ?? 0),
    ids: (email) =>
      gql(
        `query I($email: String!, $limit: Int!) { people(filter: { and: [{ ownerId: { is: "NULL" } }, { sfOwnerEmail: { ilike: $email } }] }, first: $limit) { edges { node { id } } } }`,
        { email, limit: CHUNK },
      ).then((d) => d?.people?.edges?.map((e) => e.node.id) ?? []),
    update: (ids, memberId) =>
      gql(
        `mutation U($ids: [UUID!], $memberId: UUID!) {
          updatePeople(filter: { id: { in: $ids } }, data: { ownerId: $memberId }) { id }
        }`,
        { ids, memberId },
      ).then((d) => d?.updatePeople?.length ?? 0),
    remaining: `{ people(filter: { and: [{ ownerId: { is: "NULL" } }, { sfOwnerEmail: { is: "NOT_NULL" } }] }, first: 1) { totalCount } }`,
  },
  {
    label: 'companies',
    count: (email) =>
      gql(
        `query C($email: String!) { companies(filter: { and: [{ accountOwnerId: { is: "NULL" } }, { sfOwnerEmail: { ilike: $email } }] }, first: 1) { totalCount } }`,
        { email },
      ).then((d) => d?.companies?.totalCount ?? 0),
    ids: (email) =>
      gql(
        `query I($email: String!, $limit: Int!) { companies(filter: { and: [{ accountOwnerId: { is: "NULL" } }, { sfOwnerEmail: { ilike: $email } }] }, first: $limit) { edges { node { id } } } }`,
        { email, limit: CHUNK },
      ).then((d) => d?.companies?.edges?.map((e) => e.node.id) ?? []),
    update: (ids, memberId) =>
      gql(
        `mutation U($ids: [UUID!], $memberId: UUID!) {
          updateCompanies(filter: { id: { in: $ids } }, data: { accountOwnerId: $memberId }) { id }
        }`,
        { ids, memberId },
      ).then((d) => d?.updateCompanies?.length ?? 0),
    remaining: `{ companies(filter: { and: [{ accountOwnerId: { is: "NULL" } }, { sfOwnerEmail: { is: "NOT_NULL" } }] }, first: 1) { totalCount } }`,
  },
];

for (const target of TARGETS) {
  let total = 0;
  const lines = [];
  for (const member of members) {
    const email = member.userEmail.toLowerCase();
    const pending = await target.count(email);
    if (pending === 0) continue;

    let written = 0;
    if (DRY_RUN) {
      written = pending;
    } else {
      for (let chunk = 0; chunk * CHUNK < pending + CHUNK; chunk++) {
        const ids = await target.ids(email);
        if (ids.length === 0) break;
        written += await target.update(ids, member.id);
      }
    }
    total += written;
    lines.push(`  ${member.name.firstName} ${member.name.lastName}: ${written}${written === pending ? '' : ` of ${pending}`}`);
  }
  console.log(`${DRY_RUN ? '[dry run] ' : ''}${target.label} assigned: ${total}`);
  if (lines.length > 0) console.log(lines.join('\n'));

  const remaining = await gql(target.remaining);
  const left = (remaining?.people ?? remaining?.companies)?.totalCount;
  console.log(`  still unowned with an sfOwnerEmail (departed reps and shared mailboxes): ${left}`);
}
