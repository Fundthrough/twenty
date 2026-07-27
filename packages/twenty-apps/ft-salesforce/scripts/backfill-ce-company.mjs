// Campaign Engagements → company aggregation (Linesh 2026-07-24).
// campaignEngagement (Marketo admin's app) only has a person relation; view filters
// can't traverse person→company, so we materialize a workspace-level `company` relation
// (owned by neither app) and derive it from person.companyId. Idempotent; re-run any time
// to backfill records created since (until a workflow auto-sets it).
// Usage: node scripts/backfill-ce-company.mjs
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const BASE = cfg.apiUrl ?? cfg.url;
const KEY = cfg.apiKey;

// workspace guard: this script must only ever touch the sales workspace
const claim = JSON.parse(Buffer.from(KEY.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('API key is not the sales workspace — aborting');
  process.exit(1);
}

const q = async (query, variables, ep = '/metadata') => {
  const res = await fetch(BASE + ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  return res.json().catch(() => null);
};

const meta = await q('{ objects(paging: {first: 500}) { edges { node { id nameSingular fieldsList { id name type } } } } }');
const objs = meta.data.objects.edges.map((e) => e.node);
const company = objs.find((o) => o.nameSingular === 'company');
const ce = objs.find((o) => o.nameSingular === 'campaignEngagement');

let compField = ce.fieldsList.find((f) => f.name === 'company' && f.type === 'RELATION');
if (!compField) {
  const m = await q('mutation C($input: CreateOneFieldMetadataInput!) { createOneField(input: $input) { id name } }',
    { input: { field: { name: 'company', label: 'Company', type: 'RELATION', objectMetadataId: ce.id, icon: 'IconBuildingSkyscraper', isNullable: true,
      relationCreationPayload: { type: 'MANY_TO_ONE', targetObjectMetadataId: company.id, targetFieldLabel: 'Campaign Engagements', targetFieldIcon: 'IconSpeakerphone' } } } });
  if (!m?.data?.createOneField) { console.log('field create FAILED:', String(JSON.stringify(m?.errors)).slice(0, 400)); process.exit(1); }
  compField = m.data.createOneField;
  console.log('relation created:', compField.id);
} else {
  console.log('relation already exists:', compField.id);
}

let cursor = null;
let updated = 0;
let skipped = 0;
for (;;) {
  const page = await q('query P($after: String) { campaignEngagements(first: 60, after: $after) { pageInfo { hasNextPage endCursor } edges { node { id companyId person { companyId } } } } }', { after: cursor }, '/graphql');
  if (!page?.data) { console.log('backfill query err', String(JSON.stringify(page?.errors)).slice(0, 200)); break; }
  const { edges, pageInfo } = page.data.campaignEngagements;
  for (const { node } of edges) {
    const want = node.person?.companyId;
    if (!want || node.companyId === want) { skipped++; continue; }
    const u = await q('mutation U($id: UUID!, $data: CampaignEngagementUpdateInput!) { updateCampaignEngagement(id: $id, data: $data) { id } }',
      { id: node.id, data: { companyId: want } }, '/graphql');
    if (u?.data?.updateCampaignEngagement) updated++;
    else console.log('upd fail', node.id, String(JSON.stringify(u?.errors)).slice(0, 120));
  }
  if (!pageInfo.hasNextPage) break;
  cursor = pageInfo.endCursor;
}
console.log(`backfill: ${updated} set, ${skipped} already ok / no person-company`);
