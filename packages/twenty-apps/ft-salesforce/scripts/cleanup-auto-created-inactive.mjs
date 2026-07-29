// Removes auto-created records that carry no correspondence, keeping the ones that do.
//
// Second and wider pass after cleanup-auto-created-noise.mjs, which only took machine senders.
// Twenty's contact auto-creation is now off, so nothing here regenerates.
//
// Policy (Linesh 2026-07-29): auto-created records are not CRM records and should go, EXCEPT
// where a rep genuinely corresponded -- those keep their timeline attribution. Correspondence is
// lastActivityAt or lastContactAt being set, which means a contact was actually recorded rather
// than the person merely appearing on a thread.
//
// Guards, all measured rather than assumed:
//   people    - skip anything with sfLeadId or sfContactId (imported), or calls, notes or tasks
//   companies - skip anything with a PRO companyId, clientId or sfAccountId (39, 39 and 7 records:
//               real FundThrough clients that auto-creation happened to touch first), anything
//               with people left after this pass, and anything with opportunities, term sheets,
//               calls, notes or tasks. One auto-created company holds an imported lead and is
//               caught by the people-remaining guard.
//
// Everything removed is exported to docs/ first as an out-of-band backup, because the in-app
// soft delete is recoverable but not portable. The export is verified on disk before any delete.
//
// DRY_RUN=1 exports and reports without deleting.
import { writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';
const CHUNK = 100;
const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const STAMP = process.env.EXPORT_STAMP ?? '2026-07-29';

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
const doomed = [];
const kept = { correspondence: 0, imported: 0, attached: 0 };
let cursor = null;
let scanned = 0;
for (;;) {
  const d = await gql(
    `query P($after: String) { people(filter: ${AUTO}, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id sfLeadId sfContactId companyId createdAt
        name { firstName lastName } emails { primaryEmail } jobTitle
        lastActivityAt lastActivityType lastContactAt
        createdBy { source }
        company { name }
        calls { edges { node { id } } }
        noteTargets { edges { node { id } } }
        taskTargets { edges { node { id } } }
        messageParticipants { edges { node { id } } } } } } }`,
    { after: cursor },
  );
  const conn = d?.people;
  if (!conn) break;
  for (const { node } of conn.edges) {
    scanned++;
    if (node.sfLeadId || node.sfContactId) { kept.imported++; continue; }
    const attached = (node.calls?.edges?.length ?? 0) + (node.noteTargets?.edges?.length ?? 0) + (node.taskTargets?.edges?.length ?? 0);
    if (attached > 0) { kept.attached++; continue; }
    if (node.lastActivityAt || node.lastContactAt) { kept.correspondence++; continue; }
    doomed.push({
      id: node.id,
      firstName: node.name?.firstName ?? null,
      lastName: node.name?.lastName ?? null,
      email: node.emails?.primaryEmail ?? null,
      jobTitle: node.jobTitle ?? null,
      company: node.company?.name ?? null,
      companyId: node.companyId ?? null,
      createdAt: node.createdAt ?? null,
      createdBySource: node.createdBy?.source ?? null,
      messageCount: node.messageParticipants?.edges?.length ?? 0,
    });
  }
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
console.log(`auto-created people scanned: ${scanned}`);
console.log(`  keeping ${kept.correspondence} with recorded correspondence, ${kept.attached} with calls/notes/tasks, ${kept.imported} imported`);
console.log(`  to remove: ${doomed.length}`);

// ---- companies: only those left with nothing ----
const doomedIds = new Set(doomed.map((p) => p.id));
const doomedCompanies = [];
const companyKept = { realClient: 0, peopleRemain: 0, attached: 0 };
cursor = null;
let cScanned = 0;
for (;;) {
  const d = await gql(
    `query C($after: String) { companies(filter: ${AUTO}, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id name companyId clientId sfAccountId createdAt
        domainName { primaryLinkUrl }
        createdBy { source }
        people { edges { node { id } } }
        opportunities { edges { node { id } } }
        termSheets { edges { node { id } } }
        calls { edges { node { id } } }
        noteTargets { edges { node { id } } }
        taskTargets { edges { node { id } } } } } } }`,
    { after: cursor },
  );
  const conn = d?.companies;
  if (!conn) break;
  for (const { node } of conn.edges) {
    cScanned++;
    if (node.companyId || node.clientId || node.sfAccountId) { companyKept.realClient++; continue; }
    const remaining = (node.people?.edges ?? []).filter((e) => !doomedIds.has(e.node.id)).length;
    if (remaining > 0) { companyKept.peopleRemain++; continue; }
    const attached = (node.opportunities?.edges?.length ?? 0) + (node.termSheets?.edges?.length ?? 0)
      + (node.calls?.edges?.length ?? 0) + (node.noteTargets?.edges?.length ?? 0) + (node.taskTargets?.edges?.length ?? 0);
    if (attached > 0) { companyKept.attached++; continue; }
    doomedCompanies.push({
      id: node.id,
      name: node.name ?? null,
      domain: node.domainName?.primaryLinkUrl ?? null,
      createdAt: node.createdAt ?? null,
      createdBySource: node.createdBy?.source ?? null,
    });
  }
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}
console.log(`\nauto-created companies scanned: ${cScanned}`);
console.log(`  keeping ${companyKept.realClient} real FT clients, ${companyKept.peopleRemain} with people remaining, ${companyKept.attached} with work attached`);
console.log(`  to remove: ${doomedCompanies.length}`);

// ---- export before touching anything ----
const out = join(APP, `docs/deleted-auto-created-${STAMP}.json`);
writeFileSync(out, JSON.stringify({
  exportedFor: 'cleanup-auto-created-inactive.mjs',
  policy: 'auto-created (EMAIL/CALENDAR), no recorded correspondence, no calls/notes/tasks, not imported; companies additionally empty and not a real FT client',
  workspace: 'fundthrough-sales.twenty.com',
  counts: { people: doomed.length, companies: doomedCompanies.length },
  people: doomed,
  companies: doomedCompanies,
}, null, 2));
if (!existsSync(out) || statSync(out).size < 100) {
  console.error(`export missing or too small at ${out}, refusing to delete`);
  process.exit(1);
}
console.log(`\nexported ${doomed.length} people and ${doomedCompanies.length} companies to ${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);

if (DRY_RUN) {
  console.log('[dry run] export written, nothing deleted');
  process.exit(0);
}

let peopleRemoved = 0;
const pIds = doomed.map((p) => p.id);
for (let i = 0; i < pIds.length; i += CHUNK) {
  peopleRemoved += await gql('mutation D($ids: [UUID!]) { deletePeople(filter: { id: { in: $ids } }) { id } }',
    { ids: pIds.slice(i, i + CHUNK) }).then((d) => d?.deletePeople?.length ?? 0);
}
console.log(`people removed: ${peopleRemoved}`);

let companiesRemoved = 0;
const cIds = doomedCompanies.map((c) => c.id);
for (let i = 0; i < cIds.length; i += CHUNK) {
  companiesRemoved += await gql('mutation D($ids: [UUID!]) { deleteCompanies(filter: { id: { in: $ids } }) { id } }',
    { ids: cIds.slice(i, i + CHUNK) }).then((d) => d?.deleteCompanies?.length ?? 0);
}
console.log(`companies removed: ${companiesRemoved}`);
