// Fills company.sfAmEmail and company.accountManager from Salesforce Client__c.am_email__c.
//
// Ownership follows the lifecycle: while a company is a prospect the Sales rep is its AM, and
// once it is Funded the Client Success rep takes over. So accountOwner means "who owns this
// relationship now" and changes hands at funding, while accountManager records the Client
// Success rep and sfOwnerEmail keeps the original Sales owner.
//
// Shared queues are never pointed at a person. backoffice@ alone is the AM on 4,532 clients;
// assigning those to an individual would invent ownership that does not exist.
//
// Reads SF directly rather than waiting on a full import run, and writes sfAmEmail too so the
// relation stays re-derivable inside Twenty. Idempotent. DRY_RUN=1 reports without writing.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';
const SHARED = new Set(['backoffice@fundthrough.com', 'marketingadmin@fundthrough.com', 'techadmin@fundthrough.com']);
const CHUNK = 200;

// Departed AMs whose clients moved to a current member. jc@ is deliberately absent: those
// clients stay unassigned rather than being handed to someone who does not run them.
const AM_REASSIGNED = {
  'arosbrook@fundthrough.com': 'kelli@fundthrough.com',
  'ebooker@fundthrough.com': 'kelli@fundthrough.com',
};

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

const SF = (process.env.SALESFORCE_INSTANCE_URL ?? '').replace(/\/$/, '');
const tok = await fetch(`${SF}/services/oauth2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SALESFORCE_CLIENT_ID,
    client_secret: process.env.SALESFORCE_CLIENT_SECRET,
  }),
}).then((r) => r.json());
if (!tok.access_token) {
  console.error('SF auth failed. Set SALESFORCE_CLIENT_ID / SECRET / INSTANCE_URL.');
  process.exit(1);
}
const soql = async (q) => {
  let url = `${SF}/services/data/v61.0/query?q=${encodeURIComponent(q)}`;
  const out = [];
  for (;;) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
    if (r.records) out.push(...r.records);
    if (!r.nextRecordsUrl) break;
    url = `${SF}${r.nextRecordsUrl}`;
  }
  return out;
};

const amByClientId = new Map();
let sharedSkipped = 0;
for (const c of await soql(`SELECT Client_ID__c, am_email__c FROM Client__c WHERE am_email__c != null`)) {
  const email = (c.am_email__c ?? '').toLowerCase().trim();
  if (!c.Client_ID__c || !email) continue;
  if (SHARED.has(email)) { sharedSkipped++; continue; }
  amByClientId.set(c.Client_ID__c, email);
}
console.log(`SF clients with a named AM: ${amByClientId.size} (shared queues left alone: ${sharedSkipped})`);

const members = (await gql('{ workspaceMembers(first: 200) { edges { node { id userEmail name { firstName lastName } } } } }'))
  ?.workspaceMembers?.edges?.map((e) => e.node) ?? [];
const memberByEmail = new Map(members.map((m) => [m.userEmail.toLowerCase(), m]));
for (const [from, to] of Object.entries(AM_REASSIGNED)) {
  const member = memberByEmail.get(to);
  if (member) memberByEmail.set(from, member);
  else console.log(`AM_REASSIGNED target is not a workspace member, skipping: ${to}`);
}

// Walk Twenty companies once, deciding per record what it needs. The relation write is grouped
// by member so it can go out as filtered bulk updates instead of one call per company.
const pendingByMember = new Map();
const handoffByMember = new Map();
const pendingEmail = [];
const unresolved = new Map();
let cursor = null;
let scanned = 0;
let notFundedYet = 0;
for (;;) {
  const d = await gql(
    `query C($after: String) { companies(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id clientId sfAmEmail accountManagerId accountOwnerId applicationStatus } } } }`,
    { after: cursor },
  );
  const conn = d?.companies;
  if (!conn) break;
  for (const { node } of conn.edges) {
    scanned++;
    const am = node.clientId ? amByClientId.get(node.clientId) : undefined;
    if (!am) continue;
    if ((node.sfAmEmail ?? '').toLowerCase() !== am) pendingEmail.push({ id: node.id, am });

    const member = memberByEmail.get(am);
    if (!member) { unresolved.set(am, (unresolved.get(am) ?? 0) + 1); continue; }

    if (!node.accountManagerId) {
      if (!pendingByMember.has(member.id)) pendingByMember.set(member.id, { member, ids: [] });
      pendingByMember.get(member.id).ids.push(node.id);
    }

    // The handoff only happens at funding. A prospect keeps its Sales owner even when a Client
    // Success rep is already named on the Salesforce client.
    if (node.applicationStatus !== 'Funded') { notFundedYet++; continue; }
    if (node.accountOwnerId === member.id) continue;
    if (!handoffByMember.has(member.id)) handoffByMember.set(member.id, { member, ids: [] });
    handoffByMember.get(member.id).ids.push(node.id);
  }
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}

console.log(`companies scanned: ${scanned}`);
console.log(`${DRY_RUN ? '[dry run] ' : ''}sfAmEmail to write: ${pendingEmail.length}`);
if (!DRY_RUN) {
  for (const { id, am } of pendingEmail) {
    await gql('mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }', {
      id,
      data: { sfAmEmail: am },
    });
  }
}

let linked = 0;
for (const { member, ids } of pendingByMember.values()) {
  let done = 0;
  if (DRY_RUN) {
    done = ids.length;
  } else {
    for (let i = 0; i < ids.length; i += CHUNK) {
      done += await gql(
        `mutation U($ids: [UUID!], $memberId: UUID!) {
          updateCompanies(filter: { id: { in: $ids } }, data: { accountManagerId: $memberId }) { id }
        }`,
        { ids: ids.slice(i, i + CHUNK), memberId: member.id },
      ).then((d) => d?.updateCompanies?.length ?? 0);
    }
  }
  linked += done;
  console.log(`  ${member.name.firstName} ${member.name.lastName}: ${done}`);
}
console.log(`${DRY_RUN ? '[dry run] ' : ''}accountManager linked: ${linked}`);

let handed = 0;
for (const { member, ids } of handoffByMember.values()) {
  let done = 0;
  if (DRY_RUN) {
    done = ids.length;
  } else {
    for (let i = 0; i < ids.length; i += CHUNK) {
      done += await gql(
        `mutation U($ids: [UUID!], $memberId: UUID!) {
          updateCompanies(filter: { id: { in: $ids } }, data: { accountOwnerId: $memberId }) { id }
        }`,
        { ids: ids.slice(i, i + CHUNK), memberId: member.id },
      ).then((d) => d?.updateCompanies?.length ?? 0);
    }
  }
  handed += done;
  console.log(`  ${member.name.firstName} ${member.name.lastName}: ${done}`);
}
console.log(`${DRY_RUN ? '[dry run] ' : ''}accountOwner handed to Client Success (Funded only): ${handed}`);
console.log(`  named AM but not Funded yet, Sales keeps ownership: ${notFundedYet}`);
if (unresolved.size > 0) {
  console.log('no workspace member for:', [...unresolved.entries()].map(([e, c]) => `${e} (${c})`).join(', '));
}
