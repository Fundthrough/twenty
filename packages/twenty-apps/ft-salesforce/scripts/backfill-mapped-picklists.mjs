// Populates the picklist fields that mapSel used to drop silently, now that value-maps.json has
// entries and the missing options exist.
//
// Targeted rather than a full import run: it touches five fields on person and nothing else, so
// it cannot create records or disturb anything the importer also owns. Reads Salesforce directly.
//
// Idempotent: only writes where the mapped value differs from what is stored.
// DRY_RUN=1 reports without writing.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';
const CHUNK = 200;

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const valueMaps = JSON.parse(readFileSync(join(APP, 'scripts/value-maps.json'), 'utf8'));

// Salesforce Lead column -> Twenty person field
const FIELDS = [
  ['Disqualified_Reason__c', 'disqualifiedReason'],
  ['Renurture_Reason__c', 'renurtureReason'],
  ['Lost_Reason__c', 'lostReason'],
  ['Type__c', 'clientType'],
  ['LeadSource', 'leadSource'],
];

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
    if (!r.records) break;
    out.push(...r.records);
    if (!r.nextRecordsUrl) break;
    url = `${SF}${r.nextRecordsUrl}`;
  }
  return out;
};

const cols = FIELDS.map(([sf]) => sf).join(', ');
const leads = await soql(`SELECT Id, ${cols} FROM Lead`);
console.log(`Salesforce leads read: ${leads.length}`);

const stillUnmapped = new Map();
const desired = new Map(); // sfLeadId -> { field: option }
for (const l of leads) {
  const wanted = {};
  for (const [sfCol, field] of FIELDS) {
    const raw = l[sfCol];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const target = valueMaps.person?.[field]?.[String(raw).trim()];
    if (target === undefined) {
      const key = `${field}: ${String(raw).trim()}`;
      stillUnmapped.set(key, (stillUnmapped.get(key) ?? 0) + 1);
      continue;
    }
    wanted[field] = target;
  }
  if (Object.keys(wanted).length > 0) desired.set(l.Id, wanted);
}
console.log(`leads with at least one mappable value: ${desired.size}`);
if (stillUnmapped.size > 0) {
  console.log('still unmapped (expected: none for these five fields):');
  for (const [k, n] of [...stillUnmapped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`   ${String(n).padStart(5)}  ${k}`);
  }
}

// group people by the exact patch they need, so identical patches go out as one bulk update
const patches = new Map();
const perField = {};
let cursor = null;
let scanned = 0;
for (;;) {
  const d = await gql(
    `query P($after: String) { people(filter: { sfLeadId: { is: "NOT_NULL" } }, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id sfLeadId disqualifiedReason renurtureReason lostReason clientType leadSource } } } }`,
    { after: cursor },
  );
  const conn = d?.people;
  if (!conn) break;
  for (const { node } of conn.edges) {
    scanned++;
    const wanted = desired.get(node.sfLeadId);
    if (!wanted) continue;
    const patch = {};
    for (const [field, target] of Object.entries(wanted)) {
      if (node[field] !== target) patch[field] = target;
    }
    if (Object.keys(patch).length === 0) continue;
    for (const f of Object.keys(patch)) perField[f] = (perField[f] ?? 0) + 1;
    const key = JSON.stringify(patch);
    if (!patches.has(key)) patches.set(key, []);
    patches.get(key).push(node.id);
  }
  if (!conn.pageInfo.hasNextPage) break;
  cursor = conn.pageInfo.endCursor;
}

let written = 0;
for (const [key, ids] of patches) {
  const patch = JSON.parse(key);
  if (DRY_RUN) { written += ids.length; continue; }
  for (let i = 0; i < ids.length; i += CHUNK) {
    written += await gql(
      `mutation U($ids: [UUID!], $data: PersonUpdateInput!) {
        updatePeople(filter: { id: { in: $ids } }, data: $data) { id }
      }`,
      { ids: ids.slice(i, i + CHUNK), data: patch },
    ).then((d) => d?.updatePeople?.length ?? 0);
  }
}

console.log(`${DRY_RUN ? '[dry run] ' : ''}people scanned ${scanned}, updated ${written} across ${patches.size} distinct patches`);
for (const [f, n] of Object.entries(perField).sort((a, b) => b[1] - a[1])) console.log(`    ${f}: ${n}`);
