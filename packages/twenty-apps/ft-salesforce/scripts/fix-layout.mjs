// 1. delete leftover hs* metadata fields (correct {input:{id}} shape)
// 2. add missing custom fields as visible viewFields on every "Record Page Fields" view
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API_KEY = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.local.apiKey;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gql(query, variables, attempt = 1) {
  const res = await fetch('http://localhost:2020/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 8) {
    await sleep(62000); return gql(query, variables, attempt + 1);
  }
  return body;
}

const meta = await gql('{ objects(paging: { first: 200 }) { edges { node { id nameSingular fieldsList { id name isCustom type } } } } }');
const objects = meta?.data?.objects?.edges?.map((e) => e.node) ?? [];

// ---- 1. delete hs* fields ----
let hsDeleted = 0;
for (const obj of objects) {
  for (const f of obj.fieldsList ?? []) {
    if (f.isCustom && /^hs[A-Z]/.test(f.name)) {
      const r = await gql('mutation D($input: DeleteOneFieldInput!) { deleteOneField(input: $input) { id } }', { input: { id: f.id } });
      if (r?.data?.deleteOneField?.id) hsDeleted++;
      else console.error('hs del fail:', obj.nameSingular + '.' + f.name, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 140));
      await sleep(650);
    }
  }
}
console.log('hs fields deleted:', hsDeleted);

// ---- 2. record-page field visibility ----
// relation panels render separately; only non-relation customs need viewField rows
const views = await gql('{ getViews { id name objectMetadataId } }');
const fieldViews = (views?.data?.getViews ?? []).filter((v) => /Record Page Fields/i.test(v.name));
console.log('record-page field views:', fieldViews.map((v) => v.name).join(', '));

for (const view of fieldViews) {
  const obj = objects.find((o) => o.id === view.objectMetadataId);
  if (!obj) continue;
  const vRes = await gql('query V($id: String!) { getView(id: $id) { viewFields { fieldMetadataId isVisible } } }', { id: view.id });
  const existing = new Set((vRes?.data?.getView?.viewFields ?? []).map((f) => f.fieldMetadataId));
  const missing = (obj.fieldsList ?? []).filter((f) =>
    f.isCustom && !existing.has(f.id) && !/^hs[A-Z]/.test(f.name) && f.type !== 'RELATION');
  // priority fields go to the top of the panel
  const priority = ['companyId', 'applicationStatus', 'leadStatus', 'sfClientId', 'clientType'];
  missing.sort((a, b) => (priority.indexOf(a.name) + 1 || 99) - (priority.indexOf(b.name) + 1 || 99));
  let pos = 3; let created = 0;
  for (const f of missing) {
    const r = await gql('mutation C($input: CreateViewFieldInput!) { createViewField(input: $input) { id } }',
      { input: { viewId: view.id, fieldMetadataId: f.id, isVisible: true, position: pos++ } });
    if (r?.data?.createViewField?.id) created++;
    else console.error('viewField fail:', obj.nameSingular + '.' + f.name, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 140));
    await sleep(650);
  }
  console.log(`${view.name}: +${created} visible custom fields`);
}
console.log('LAYOUT FIX COMPLETE');
