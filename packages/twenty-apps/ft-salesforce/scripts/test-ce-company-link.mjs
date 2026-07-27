// One-shot test for the ce-company-link trigger: creates a synthetic engagement with
// person only, polls for the trigger to set companyId, then soft-deletes the test record.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const BASE = cfg.apiUrl ?? cfg.url;
const KEY = cfg.apiKey;
const claim = JSON.parse(Buffer.from(KEY.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('not the sales workspace — aborting');
  process.exit(1);
}
const q = async (query, variables) => {
  const res = await fetch(BASE + '/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  return res.json().catch(() => null);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PERSON_ID = 'PERSON_ID_ARG'.startsWith('PERSON') ? process.argv[2] : null;
if (!PERSON_ID) { console.log('usage: node test-ce-company-link.mjs <personId>'); process.exit(1); }

const created = await q('mutation C($data: CampaignEngagementCreateInput!) { createCampaignEngagement(data: $data) { id companyId } }',
  { data: { name: 'Trigger test — auto cleanup', personId: PERSON_ID, eventType: 'Opened' } });
const ce = created?.data?.createCampaignEngagement;
if (!ce) { console.log('create failed:', String(JSON.stringify(created?.errors)).slice(0, 300)); process.exit(1); }
console.log('created engagement', ce.id, 'companyId:', ce.companyId);

let linked = null;
for (let i = 0; i < 12; i++) {
  await sleep(5000);
  const check = await q('query G($id: UUID!) { campaignEngagement(filter: { id: { eq: $id } }) { id companyId company { name } } }', { id: ce.id });
  const node = check?.data?.campaignEngagement;
  if (node?.companyId) { linked = node; break; }
  console.log(`poll ${i + 1}: companyId still null`);
}
console.log(linked ? `LINKED → ${linked.company?.name} (${linked.companyId})` : 'NOT LINKED after 60s');

await q('mutation D($id: UUID!) { deleteCampaignEngagement(id: $id) { id } }', { id: ce.id });
console.log('test record soft-deleted');
process.exit(linked ? 0 : 1);
