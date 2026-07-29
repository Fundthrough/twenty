// Removes the records Twenty's contact auto-creation made from machine senders.
//
// Twenty creates a person for every email and calendar participant and a company for every email
// domain, so notification senders and Google Meet rooms became CRM records: mail1.dialpad.com,
// mail.pipefy.com, mktomail, atlassian-bounces, resource.calendar.google.com and friends.
//
// Policy, deliberately narrow (agreed with Linesh 2026-07-29):
//   1. the record was auto-created (createdBy.source EMAIL or CALENDAR), never imported
//   2. its email domain matches a known machine-sender pattern -- the DOMAIN alone decides.
//      Local-part shape is not enough: mccain.com carries "bpo-canada-accountspayableproc" and
//      eqt.com carries a Proofpoint-mangled address for a real person, and a local-part rule
//      would delete both.
//   3. nothing of substance hangs off it: no calls, notes or tasks
// A company additionally has to be empty afterwards -- no remaining people, no clientId, no
// opportunities, term sheets, calls, notes or tasks -- so a real business that merely received a
// notification is never removed.
//
// Uses deletePeople / deleteCompanies, which are soft (they set deletedAt) rather than the
// destroy* variants, so everything here is recoverable from the workspace UI.
// DRY_RUN=1 reports without deleting.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';
const CHUNK = 100;

const NOTIFICATION_DOMAIN = [
  /(^|\.)mktomail\.com$/i,
  /(^|\.)hubspotemail\.net$/i,
  /(^|\.)seu\.salesforce\.com$/i,
  /^resource\.calendar\.google\.com$/i,
  /(^|\.)bounce[.\-]/i,
  /^bounce/i,
  /(^|\.)bounces\./i,
  /(^|\.)mail\d+\./i,
  /^em\d+\./i,
  /^em[-.]/i,
  /(^|\.)mail\.pipefy\.com$/i,
  /(^|\.)mail1\.dialpad\.com$/i,
  /atlassian-bounces\./i,
  /(^|\.)email\.dropbox\.com$/i,
  /(^|\.)em-s\.dropbox\.com$/i,
  /(^|\.)mail\.periscopedata\.com$/i,
  /(^|\.)sendgrid\.(net|com)$/i,
  /(^|\.)mailgun\./i,
  /(^|\.)amazonses\.com$/i,
  /^(no-?reply|notifications?|mailer|notify)\./i,
];
const isNotificationDomain = (domain) => NOTIFICATION_DOMAIN.some((re) => re.test(domain));

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

const AUTO = '{ or: [{ createdBy: { source: { eq: "EMAIL" } } }, { createdBy: { source: { eq: "CALENDAR" } } }] }';

// ---- people ----
const doomedPeople = [];
const candidateCompanyIds = new Set();
let cursor = null;
let scanned = 0;
for (;;) {
  const d = await gql(
    `query P($after: String) { people(filter: ${AUTO}, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id companyId emails { primaryEmail }
        calls { edges { node { id } } }
        noteTargets { edges { node { id } } }
        taskTargets { edges { node { id } } } } } } }`,
    { after: cursor },
  );
  const conn = d?.people;
  if (!conn) break;
  for (const { node } of conn.edges) {
    scanned++;
    const email = (node.emails?.primaryEmail ?? '').toLowerCase();
    const domain = email.includes('@') ? email.split('@')[1] : '';
    if (!domain || !isNotificationDomain(domain)) continue;
    const activity = (node.calls?.edges?.length ?? 0) + (node.noteTargets?.edges?.length ?? 0) + (node.taskTargets?.edges?.length ?? 0);
    if (activity > 0) continue;
    doomedPeople.push({ id: node.id, email, domain });
    if (node.companyId) candidateCompanyIds.add(node.companyId);
  }
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
const byDomain = new Map();
for (const p of doomedPeople) byDomain.set(p.domain, (byDomain.get(p.domain) ?? 0) + 1);
console.log(`auto-created people scanned: ${scanned}`);
console.log(`${DRY_RUN ? '[dry run] ' : ''}people to remove: ${doomedPeople.length}`);
for (const [dom, n] of [...byDomain.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${dom}`);

let peopleRemoved = 0;
if (!DRY_RUN) {
  const ids = doomedPeople.map((p) => p.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const r = await gql('mutation D($ids: [UUID!]) { deletePeople(filter: { id: { in: $ids } }) { id } }',
      { ids: ids.slice(i, i + CHUNK) });
    peopleRemoved += r?.deletePeople?.length ?? 0;
  }
  console.log(`people removed: ${peopleRemoved}`);
}

// ---- companies: only ones left completely empty by the above ----
const doomedIds = new Set(doomedPeople.map((p) => p.id));
const doomedCompanies = [];
for (const companyId of candidateCompanyIds) {
  const d = await gql(
    `query C($id: UUID!) { company(filter: { id: { eq: $id } }) {
      id name clientId sfAccountId createdBy { source }
      people { edges { node { id } } }
      opportunities { edges { node { id } } }
      termSheets { edges { node { id } } }
      calls { edges { node { id } } }
      noteTargets { edges { node { id } } }
      taskTargets { edges { node { id } } } } }`,
    { id: companyId },
  );
  const c = d?.company;
  if (!c) continue;
  const src = c.createdBy?.source;
  if (src !== 'EMAIL' && src !== 'CALENDAR') continue; // never touch an imported company
  if (c.clientId || c.sfAccountId) continue;           // a real FundThrough client
  // Count only the people that will still be there afterwards. On a dry run nothing has been
  // deleted yet, so without discounting the doomed ones every company looks occupied and the
  // dry run would under-report what a live run removes.
  const remainingPeople = (c.people?.edges ?? []).filter((e) => !doomedIds.has(e.node.id)).length;
  const attached = remainingPeople + (c.opportunities?.edges?.length ?? 0)
    + (c.termSheets?.edges?.length ?? 0) + (c.calls?.edges?.length ?? 0)
    + (c.noteTargets?.edges?.length ?? 0) + (c.taskTargets?.edges?.length ?? 0);
  if (attached > 0) continue;                          // still has something hanging off it
  doomedCompanies.push({ id: c.id, name: c.name });
}
console.log(`\n${DRY_RUN ? '[dry run] ' : ''}companies left empty and removable: ${doomedCompanies.length} of ${candidateCompanyIds.size} linked`);
for (const c of doomedCompanies.slice(0, 30)) console.log(`    ${JSON.stringify(c.name)}`);

let companiesRemoved = 0;
if (!DRY_RUN && doomedCompanies.length) {
  const ids = doomedCompanies.map((c) => c.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const r = await gql('mutation D($ids: [UUID!]) { deleteCompanies(filter: { id: { in: $ids } }) { id } }',
      { ids: ids.slice(i, i + CHUNK) });
    companiesRemoved += r?.deleteCompanies?.length ?? 0;
  }
  console.log(`companies removed: ${companiesRemoved}`);
}
