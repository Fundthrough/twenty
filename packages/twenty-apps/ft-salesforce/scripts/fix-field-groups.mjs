// Record-page Fields panel only renders viewFields that belong to a viewFieldGroup.
// Create a group per object view and assign the ungrouped custom-field viewFields,
// with demo-priority fields first.
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

const meta = await gql('{ objects(paging: { first: 200 }) { edges { node { id nameSingular fieldsList { id name } } } } }');
const objects = Object.fromEntries(meta.data.objects.edges.map((e) => [e.node.nameSingular, e.node]));
const views = await gql('{ getViews { id name objectMetadataId } }');

const PLANS = [
  { obj: 'company', group: 'Client Details', priority: ['companyId', 'applicationStatus', 'industry', 'source', 'sfClientId', 'sfAccountId'] },
  { obj: 'person', group: 'Lead Details', priority: ['leadStatus', 'lifecycleStage', 'clientType', 'companyName', 'desiredFundingAmount', 'accountingSoftware', 'leadSource', 'sfLeadId', 'sfContactId'] },
  { obj: 'task', group: 'Details', priority: ['priority', 'taskType'] },
];

for (const plan of PLANS) {
  const obj = objects[plan.obj];
  const view = views.data.getViews.find((v) => v.objectMetadataId === obj.id && /Record Page Fields/i.test(v.name));
  if (!view) { console.log(plan.obj, ': no record-page view'); continue; }
  const vRes = await gql('query V($id: String!) { getView(id: $id) { viewFieldGroups { id name position } viewFields { id fieldMetadataId viewFieldGroupId } } }', { id: view.id });
  const { viewFieldGroups, viewFields } = vRes.data.getView;
  const ungrouped = viewFields.filter((f) => !f.viewFieldGroupId);
  if (!ungrouped.length) { console.log(plan.obj, ': nothing ungrouped'); continue; }

  let group = viewFieldGroups.find((g) => g.name === plan.group);
  if (!group) {
    const maxPos = Math.max(0, ...viewFieldGroups.map((g) => g.position));
    // put the custom group right after General (position 0.5) so demo fields are near the top
    const r = await gql('mutation G($input: CreateViewFieldGroupInput!) { createViewFieldGroup(input: $input) { id } }',
      { input: { viewId: view.id, name: plan.group, position: viewFieldGroups.length ? 0.5 : maxPos + 1, isVisible: true } });
    group = r?.data?.createViewFieldGroup;
    if (!group) { console.error(plan.obj, 'group create fail:', JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 200)); continue; }
    await sleep(650);
  }

  const fieldName = Object.fromEntries(obj.fieldsList.map((f) => [f.id, f.name]));
  ungrouped.sort((a, b) => {
    const pa = plan.priority.indexOf(fieldName[a.fieldMetadataId]); const pb = plan.priority.indexOf(fieldName[b.fieldMetadataId]);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  });
  let pos = 0; let ok = 0;
  for (const f of ungrouped) {
    const r = await gql('mutation U($input: UpdateViewFieldInput!) { updateViewField(input: $input) { id } }',
      { input: { id: f.id, update: { viewFieldGroupId: group.id, position: pos++, isVisible: true } } });
    if (r?.data?.updateViewField?.id) ok++;
    else console.error('vf update fail:', plan.obj, fieldName[f.fieldMetadataId], JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160));
    await sleep(650);
  }
  console.log(`${plan.obj}: ${ok}/${ungrouped.length} viewFields -> group "${plan.group}"`);
}
console.log('FIELD GROUPS COMPLETE');
