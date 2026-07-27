// Success-criteria verification:
// 1. every data-model field visible AND populated (fill-rate per field per object)
// 2. relationships: company<>people, termsheet<>company, task/note targets
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API_KEY = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.local.apiKey;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gql(query, variables, endpoint = '/graphql', attempt = 1) {
  const res = await fetch('http://localhost:2020' + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 8) {
    await sleep(62000); return gql(query, variables, endpoint, attempt + 1);
  }
  return body;
}

const meta = await gql('{ objects(paging: { first: 200 }) { edges { node { id nameSingular fieldsList { id name isCustom type } } } } }', undefined, '/metadata');
const objects = Object.fromEntries(meta.data.objects.edges.map((e) => [e.node.nameSingular, e.node]));

const filled = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'object') return Object.values(v).some(filled);
  return true;
};

// ---- fill rates for custom fields ----
for (const [obj, plural, extra] of [
  ['company', 'companies', 'name domainName { primaryLinkUrl }'],
  ['person', 'people', 'name { firstName lastName } emails { primaryEmail } companyId'],
  ['termSheet', 'termSheets', 'name companyId'],
]) {
  const customs = objects[obj].fieldsList.filter((f) => f.isCustom && f.type !== 'RELATION').map((f) => f.name);
  const sel = customs.join(' ');
  const r = await gql(`{ ${plural}(first: 60) { edges { node { id ${extra} ${sel} } } } }`);
  if (r.errors) { console.error(obj, 'query error:', r.errors[0].message.slice(0, 200)); continue; }
  const rows = r.data[plural].edges.map((e) => e.node);
  console.log(`\n=== ${obj} (${rows.length} records) — custom field fill rates ===`);
  const empty = [];
  for (const f of customs) {
    const n = rows.filter((row) => filled(row[f])).length;
    const pct = Math.round((100 * n) / rows.length);
    if (n === 0) empty.push(f);
    else console.log(`  ${f}: ${n}/${rows.length} (${pct}%)`);
  }
  if (empty.length) console.log('  ZERO-FILL: ' + empty.join(', '));
  await sleep(650);
}

// ---- relationships ----
console.log('\n=== relationships ===');
const p = await gql('{ people(first: 60) { edges { node { id companyId referredByPartnerId } } } }');
const prows = p.data.people.edges.map((e) => e.node);
console.log(`person->company: ${prows.filter((r) => r.companyId).length}/${prows.length}`);
console.log(`person->referredByPartner: ${prows.filter((r) => r.referredByPartnerId).length}/${prows.length}`);
const t = await gql('{ termSheets(first: 60) { edges { node { id companyId } } } }');
const trows = t.data.termSheets.edges.map((e) => e.node);
console.log(`termSheet->company: ${trows.filter((r) => r.companyId).length}/${trows.length}`);
const c = await gql('{ companies(first: 60) { edges { node { id name people { edges { node { id } } } termSheets { edges { node { id } } } referredById } } } }');
const crows = c.data.companies.edges.map((e) => e.node);
console.log(`company w/ >=1 person: ${crows.filter((r) => r.people.edges.length).length}/${crows.length}`);
console.log(`company w/ >=1 termSheet: ${crows.filter((r) => r.termSheets.edges.length).length}/${crows.length}`);
console.log(`company->referredBy (self): ${crows.filter((r) => r.referredById).length}/${crows.length}`);
const noPeople = crows.filter((r) => !r.people.edges.length).map((r) => r.name);
if (noPeople.length) console.log('companies WITHOUT people: ' + noPeople.join(', '));
await sleep(650);
const tk = await gql('{ tasks(first: 30) { edges { node { id title taskTargets { edges { node { companyId personId } } } } } } }');
const tkrows = tk.data.tasks.edges.map((e) => e.node);
console.log(`tasks w/ target: ${tkrows.filter((r) => r.taskTargets.edges.length).length}/${tkrows.length}`);
const nt = await gql('{ notes(first: 30) { edges { node { id title noteTargets { edges { node { companyId personId } } } } } } }');
const ntrows = nt.data.notes.edges.map((e) => e.node);
console.log(`notes w/ target: ${ntrows.filter((r) => r.noteTargets.edges.length).length}/${ntrows.length}`);

// ---- record-page visibility: every custom field has a visible viewField ----
console.log('\n=== record-page visibility ===');
const views = await gql('{ getViews { id name objectMetadataId } }', undefined, '/metadata');
for (const obj of ['company', 'person', 'termSheet', 'task']) {
  const v = views.data.getViews.find((x) => x.objectMetadataId === objects[obj].id && /Record Page Fields/i.test(x.name));
  if (!v) { console.log(`${obj}: NO record-page-fields view`); continue; }
  const vf = await gql('query V($id: String!) { getView(id: $id) { viewFields { fieldMetadataId isVisible } } }', { id: v.id }, '/metadata');
  const visible = new Set(vf.data.getView.viewFields.filter((f) => f.isVisible).map((f) => f.fieldMetadataId));
  const missing = objects[obj].fieldsList.filter((f) => f.isCustom && f.type !== 'RELATION' && !visible.has(f.id)).map((f) => f.name);
  console.log(`${obj}: ${missing.length ? 'MISSING visible viewField: ' + missing.join(', ') : 'all custom fields visible'}`);
  await sleep(650);
}
console.log('\nVERIFY COMPLETE');
