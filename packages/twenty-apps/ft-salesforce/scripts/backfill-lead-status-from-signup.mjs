// Corrects leadStatus so NEW_SIGN_UP means what it says.
//
// A lead is a PROSPECT until they actually sign up on the FundThrough platform, and the signal for
// that is their company carrying a PRO company id (Client__c.PRO_Company_ID__c ->
// company.companyId). Salesforce used "New Sign up" more loosely, and the old field default
// stamped it on every record Twenty created, so 9,159 of 9,501 people carried it against 5
// PROSPECT -- a status on everything distinguishes nothing.
//
// Rule: NEW_SIGN_UP survives only where the person's company has a PRO company id. Everyone else
// on NEW_SIGN_UP becomes PROSPECT, including people with no company at all.
//
// Deliberately narrow: only records currently on NEW_SIGN_UP are touched. A rep who has moved
// someone to REACHED_OUT, ENGAGED, CLOSED_LOST or anything else keeps it.
//
// Idempotent. DRY_RUN=1 reports without writing.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';
const CHUNK = 200;

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

// which companies represent a real platform signup
const signedUp = new Set();
let cursor = null;
for (;;) {
  const d = await gql(
    `query C($after: String) { companies(filter: { companyId: { is: "NOT_NULL" } }, first: 200, after: $after) {
      pageInfo { hasNextPage endCursor } edges { node { id } } } }`,
    { after: cursor },
  );
  const conn = d?.companies;
  if (!conn) break;
  for (const e of conn.edges) signedUp.add(e.node.id);
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
console.log(`companies with a PRO company id (signed up): ${signedUp.size}`);

const toProspect = [];
let keptSignUp = 0;
let noCompany = 0;
cursor = null;
let scanned = 0;
for (;;) {
  const d = await gql(
    `query P($after: String) { people(filter: { leadStatus: { eq: "NEW_SIGN_UP" } }, first: 200, after: $after) {
      pageInfo { hasNextPage endCursor } edges { node { id companyId } } } }`,
    { after: cursor },
  );
  const conn = d?.people;
  if (!conn) break;
  for (const { node } of conn.edges) {
    scanned++;
    if (!node.companyId) { noCompany++; toProspect.push(node.id); continue; }
    if (signedUp.has(node.companyId)) { keptSignUp++; continue; }
    toProspect.push(node.id);
  }
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}

console.log(`people on NEW_SIGN_UP: ${scanned}`);
console.log(`  company has a PRO id, staying NEW_SIGN_UP: ${keptSignUp}`);
console.log(`  ${DRY_RUN ? 'would move' : 'moving'} to PROSPECT: ${toProspect.length} (of which ${noCompany} have no company at all)`);

let written = 0;
if (!DRY_RUN) {
  for (let i = 0; i < toProspect.length; i += CHUNK) {
    written += await gql(
      'mutation U($ids: [UUID!]) { updatePeople(filter: { id: { in: $ids } }, data: { leadStatus: "PROSPECT" }) { id } }',
      { ids: toProspect.slice(i, i + CHUNK) },
    ).then((d) => d?.updatePeople?.length ?? 0);
  }
  console.log(`people moved to PROSPECT: ${written}`);
}

// companies carry the same field and the same rule
const companyToProspect = [];
let cKept = 0;
cursor = null;
for (;;) {
  const d = await gql(
    `query C($after: String) { companies(filter: { leadStatus: { eq: "NEW_SIGN_UP" } }, first: 200, after: $after) {
      pageInfo { hasNextPage endCursor } edges { node { id companyId } } } }`,
    { after: cursor },
  );
  const conn = d?.companies;
  if (!conn) break;
  for (const { node } of conn.edges) {
    if (node.companyId) { cKept++; continue; }
    companyToProspect.push(node.id);
  }
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
console.log(`\ncompanies on NEW_SIGN_UP: ${cKept + companyToProspect.length}`);
console.log(`  keeping NEW_SIGN_UP (has PRO id): ${cKept}`);
console.log(`  ${DRY_RUN ? 'would move' : 'moving'} to PROSPECT: ${companyToProspect.length}`);

if (!DRY_RUN && companyToProspect.length) {
  let cWritten = 0;
  for (let i = 0; i < companyToProspect.length; i += CHUNK) {
    cWritten += await gql(
      'mutation U($ids: [UUID!]) { updateCompanies(filter: { id: { in: $ids } }, data: { leadStatus: "PROSPECT" }) { id } }',
      { ids: companyToProspect.slice(i, i + CHUNK) },
    ).then((d) => d?.updateCompanies?.length ?? 0);
  }
  console.log(`companies moved to PROSPECT: ${cWritten}`);
}
