// FULL RESET of the sales cloud workspace (CLOUD-DEPLOY-PLAN step 2, approved by Linesh
// 2026-07-14: "I don't need any data in the sales workspace").
//   a. wipe ALL records (delete + destroy)
//   b. remove the mis-scoped HubSpot app registration + its metadata (hs* fields, object)
//   c. delete old demo fields on company/person
//   d. delete demo workflows
// Read the audit manifest first: docs/sales-audit-pre-wipe-2026-07-14.json
// Usage: node scripts/reset-sales-workspace.mjs
const BASE = 'https://fundthrough.twenty.com';
const API_KEY = process.env.TWENTY_BO_API_KEY;
if (!API_KEY) { console.error('TWENTY_BO_API_KEY not set'); process.exit(1); }
const claims = JSON.parse(Buffer.from(API_KEY.split('.')[1], 'base64url').toString());
if (claims.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('ABORT: not the sales workspace:', claims.workspaceId); process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gql(query, variables, endpoint = '/graphql', attempt = 1) {
  const res = await fetch(BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 8) {
    console.log('  rate limited — waiting 62s');
    await sleep(62000); return gql(query, variables, endpoint, attempt + 1);
  }
  return body;
}
const T = 400; // throttle ms

// ---- a. wipe all records ----
const FILTERS = { opportunities: 'OpportunityFilterInput', tasks: 'TaskFilterInput', notes: 'NoteFilterInput', people: 'PersonFilterInput', companies: 'CompanyFilterInput' };
const objects = [
  ['tasks', 'deleteTasks', 'destroyTasks'],
  ['notes', 'deleteNotes', 'destroyNotes'],
  ['opportunities', 'deleteOpportunities', 'destroyOpportunities'],
  ['people', 'deletePeople', 'destroyPeople'],
  ['companies', 'deleteCompanies', 'destroyCompanies'],
];
for (const [plural, del, destroy] of objects) {
  let total = 0;
  for (;;) {
    const q = await gql(`{ ${plural}(first: 60) { edges { node { id } } } }`);
    const ids = (q?.data?.[plural]?.edges ?? []).map((e) => e.node.id);
    if (!ids.length) break;
    const r = await gql(`mutation D($filter: ${FILTERS[plural]}!) { ${del}(filter: $filter) { id } }`, { filter: { id: { in: ids } } });
    const n = r?.data?.[del]?.length ?? 0;
    if (!n) { console.error(`${plural} delete FAILED:`, JSON.stringify(r?.errors?.[0]?.message ?? r).slice(0, 200)); break; }
    total += n; await sleep(T);
  }
  for (;;) {
    const q = await gql(`{ ${plural}(filter: { deletedAt: { is: "NOT_NULL" } }, first: 60) { edges { node { id } } } }`);
    const ids = (q?.data?.[plural]?.edges ?? []).map((e) => e.node.id);
    if (!ids.length) break;
    await gql(`mutation X($filter: ${FILTERS[plural]}!) { ${destroy}(filter: $filter) { id } }`, { filter: { id: { in: ids }, deletedAt: { is: 'NOT_NULL' } } });
    await sleep(T);
  }
  console.log(`records: ${plural} wiped ${total}`);
}

// ---- d(first). demo workflows (before metadata so nothing re-triggers) ----
const wf = await gql('{ workflows(first: 30) { edges { node { id name } } } }');
for (const e of wf?.data?.workflows?.edges ?? []) {
  const r = await gql('mutation D($id: UUID!) { deleteWorkflow(id: $id) { id } }', { id: e.node.id });
  console.log(`workflow "${e.node.name || '(unnamed)'}":`, r?.data?.deleteWorkflow?.id ? 'deleted' : JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 120));
  await sleep(T);
}

// ---- b. HubSpot registration + metadata ----
const HS_APP_REG = '11396add-d4a5-4837-8520-ccc9d9c26777';
for (const mut of [
  `mutation { deleteApplicationRegistration(id: "${HS_APP_REG}") { id } }`,
  `mutation { deleteOneApplicationRegistration(input: { id: "${HS_APP_REG}" }) { id } }`,
]) {
  const r = await gql(mut, undefined, '/metadata');
  if (r?.data && !r.errors) { console.log('hubspot registration deleted'); break; }
  console.log('reg delete attempt:', JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 140));
  await sleep(T);
}

// re-read metadata, then remove hs object + all non-standard demo fields
const meta = await gql('{ objects(paging: { first: 200 }) { edges { node { id nameSingular fieldsList { id name type } } } } }', undefined, '/metadata');
const objs = meta.data.objects.edges.map((e) => e.node);

const hsObj = objs.find((o) => o.nameSingular === 'hsPartnerDeal');
if (hsObj) {
  const r = await gql('mutation D($id: UUID!) { deleteOneObject(input: { id: $id }) { id } }', { id: hsObj.id }, '/metadata');
  console.log('hsPartnerDeal object:', r?.data?.deleteOneObject?.id ? 'deleted' : JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 140));
  await sleep(T);
}

// ---- c. old demo fields (from the audit manifest) ----
const DOOMED = {
  company: ['hsLifecycleStage', 'hsIndustry', 'hsNumberOfEmployees', 'hsHubspotId', 'hsPartnerDeals',
            'hasInvoiceFinancingSolution', 'annualRevenue', 'sfAccountId', 'clientStatus',
            'accountingSoftware', 'fundingType', 'numAdvances', 'signupDate', 'firstAdvanceDate',
            'lastAdvanceDate', 'proAdminCompany', 'testCurrency14345', 'totalAdvancedCAD', 'creditLimit'],
  person: ['hsHubspotId', 'hsLifecycleStage', 'hsLeadStatus', 'hsPartnerDeals'],
};
for (const [objName, names] of Object.entries(DOOMED)) {
  const obj = objs.find((o) => o.nameSingular === objName);
  let ok = 0;
  for (const name of names) {
    const f = obj?.fieldsList.find((x) => x.name === name);
    if (!f) continue; // already gone (e.g. removed with the app registration)
    const r = await gql('mutation D($input: DeleteOneFieldInput!) { deleteOneField(input: $input) { id } }', { input: { id: f.id } }, '/metadata');
    if (r?.data?.deleteOneField?.id) ok++;
    else console.error(`field ${objName}.${name}:`, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 140));
    await sleep(T);
  }
  console.log(`fields: ${objName} deleted ${ok}`);
}

// ---- HS/demo views + orphan nav ----
const views = (await gql('{ getViews { id name } }', undefined, '/metadata')).data?.getViews ?? [];
for (const v of views.filter((v) => /^HS |Hubspot|Partner Deal/i.test(v.name))) {
  const r = await gql(`mutation { deleteView(id: "${v.id}") }`, undefined, '/metadata');
  console.log(`view "${v.name}":`, r?.data?.deleteView === true ? 'deleted' : JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 120));
  await sleep(T);
}
const navs = (await gql('{ navigationMenuItems { id type name targetObjectMetadataId } }', undefined, '/metadata')).data?.navigationMenuItems ?? [];
const liveObjIds = new Set(objs.filter((o) => o.nameSingular !== 'hsPartnerDeal').map((o) => o.id));
for (const n of navs.filter((n) => n.type === 'OBJECT' && n.targetObjectMetadataId && !liveObjIds.has(n.targetObjectMetadataId))) {
  await gql(`mutation { deleteNavigationMenuItem(id: "${n.id}") { id } }`, undefined, '/metadata');
  console.log('orphan nav item deleted');
  await sleep(T);
}

console.log('RESET COMPLETE');
