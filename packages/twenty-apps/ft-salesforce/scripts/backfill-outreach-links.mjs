// Import completion (Linesh 2026-07-24): link ALL existing Outreach prospects to their
// Twenty people by exact email — fills person.outreachProspectId + outreachUrl where
// blank, so the Outreach link works for prospects created before the Push button.
// Fill-blanks-only and idempotent; re-run any time.
// Usage: node scripts/backfill-outreach-links.mjs
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ENV = process.env.OUTREACH_ENV === 'prod' ? 'prod' : 'dev';
const outreachTokens = JSON.parse(readFileSync(join(homedir(), `.outreach-tokens-${ENV}.json`), 'utf8'));
const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const claim = JSON.parse(Buffer.from(cfg.apiKey.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') { console.error('not sales — abort'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const twenty = async (query, variables, attempt = 1) => {
  const res = await fetch((cfg.apiUrl ?? cfg.url) + '/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ query, variables }),
  }).catch(() => null);
  const body = await res?.json().catch(() => null);
  // 100 req/min workspace rate limit — wait out the window and retry
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 20) {
    await sleep(62000);
    return twenty(query, variables, attempt + 1);
  }
  return body;
};

// ---- 1. pull all Outreach prospects (id + emails) ----
const prospectByEmail = new Map();
let url = 'https://api.outreach.io/api/v2/prospects?page[limit]=100&sort=id';
let pulled = 0;
while (url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${outreachTokens.access_token}` } });
  if (!res.ok) { console.error(`prospects pull failed (${res.status}) — token expired? run setup-outreach.mjs`); process.exit(1); }
  const json = await res.json();
  for (const p of json.data ?? []) {
    pulled++;
    for (const email of p.attributes.emails ?? []) {
      const key = String(email).trim().toLowerCase();
      // first prospect wins on duplicate emails (lowest id = oldest)
      if (key && !prospectByEmail.has(key)) prospectByEmail.set(key, String(p.id));
    }
  }
  url = json.links?.next ?? null;
}
console.log(`outreach: ${pulled} prospects, ${prospectByEmail.size} unique emails`);

// ---- 2. walk Twenty people, fill blanks ----
let cursor = null;
let linked = 0;
let already = 0;
let scanned = 0;
for (;;) {
  const page = await twenty(
    `query P($after: String) { people(first: 100, after: $after) { pageInfo { hasNextPage endCursor } edges { node { id outreachProspectId emails { primaryEmail } } } } }`,
    { after: cursor },
  );
  if (!page?.data) { console.error('people page failed:', JSON.stringify(page?.errors).slice(0, 200)); process.exit(1); }
  const { edges, pageInfo } = page.data.people;
  for (const { node } of edges) {
    scanned++;
    if (node.outreachProspectId) { already++; continue; }
    const email = node.emails?.primaryEmail?.trim().toLowerCase();
    if (!email) continue;
    const prospectId = prospectByEmail.get(email);
    if (!prospectId) continue;
    const u = await twenty(
      `mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }`,
      { id: node.id, data: {
        outreachProspectId: prospectId,
        outreachUrl: { primaryLinkUrl: `https://web.outreach.io/prospects/${prospectId}/overview`, primaryLinkLabel: `Prospect ${prospectId}` },
      } },
    );
    if (u?.data?.updatePerson) linked++;
    else console.log('update failed', node.id, String(JSON.stringify(u?.errors)).slice(0, 120));
  }
  if (!pageInfo.hasNextPage) break;
  cursor = pageInfo.endCursor;
}
console.log(`twenty: ${scanned} people scanned — ${linked} newly linked, ${already} already linked`);
