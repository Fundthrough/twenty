// Fills company.naicsSector and person.naicsSector for records already in Twenty.
//
// Two sources, better one first:
//   1. Salesforce Credit_Industry_Code__c -- credit's own classification. Only its leading pair
//      is used. The 4-digit detail is deliberately not stored: a third of those values are SIC
//      codes or junk (7373, 4131, 1234), so it stays in credit's systems and surfaces through
//      the Flow company profile instead.
//   2. The Salesforce Industry label, via value-maps.json naicsSector. Covers the records credit
//      has not classified, including the ZoomInfo and LinkedIn vocabularies mixed into that field.
//
// Reads SF directly so it does not need a full import run. Idempotent: only writes where the
// value would change. DRY_RUN=1 reports without writing.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';
const CHUNK = 200;

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const valueMaps = JSON.parse(readFileSync(join(APP, 'scripts/value-maps.json'), 'utf8'));

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

const SECTOR_BY_PREFIX = {
  11: 'NAICS_11', 21: 'NAICS_21', 22: 'NAICS_22', 23: 'NAICS_23',
  31: 'NAICS_31_33', 32: 'NAICS_31_33', 33: 'NAICS_31_33', 42: 'NAICS_42',
  44: 'NAICS_44_45', 45: 'NAICS_44_45', 48: 'NAICS_48_49', 49: 'NAICS_48_49',
  51: 'NAICS_51', 52: 'NAICS_52', 53: 'NAICS_53', 54: 'NAICS_54', 55: 'NAICS_55',
  56: 'NAICS_56', 61: 'NAICS_61', 62: 'NAICS_62', 71: 'NAICS_71', 72: 'NAICS_72',
  81: 'NAICS_81', 92: 'NAICS_92',
};
const fromCode = (raw) => {
  const m = /(\d{2,6})\s*$/.exec(String(raw ?? '').trim());
  return m ? SECTOR_BY_PREFIX[m[1].slice(0, 2)] : undefined;
};
const fromLabel = (label) => (label ? valueMaps.naicsSector?.[String(label).trim()] : undefined);

// keyed by the identifiers Twenty already stores, so no extra joins are needed
const byClientId = new Map();
const byLeadId = new Map();
const stats = { code: 0, label: 0 };
for (const c of await soql('SELECT Client_ID__c, Credit_Industry_Code__c FROM Client__c WHERE Client_ID__c != null')) {
  const s = fromCode(c.Credit_Industry_Code__c);
  if (s && c.Client_ID__c) byClientId.set(c.Client_ID__c, s);
}
for (const a of await soql('SELECT Client_ID__c, Credit_Industry_Code__c, Industry FROM Account WHERE Client_ID__c != null')) {
  if (!a.Client_ID__c || byClientId.has(a.Client_ID__c)) continue;
  const s = fromCode(a.Credit_Industry_Code__c) ?? fromLabel(a.Industry);
  if (s) byClientId.set(a.Client_ID__c, s);
}
for (const l of await soql('SELECT Id, Credit_Industry_Code__c, Industry FROM Lead')) {
  const s = fromCode(l.Credit_Industry_Code__c) ?? fromLabel(l.Industry);
  if (s) byLeadId.set(l.Id, s);
}
console.log(`SF sectors resolved: ${byClientId.size} by clientId, ${byLeadId.size} by leadId`);

const run = async (label, plural, keyField, lookup, mutation) => {
  const pending = new Map();
  let cursor = null;
  let scanned = 0;
  let already = 0;
  for (;;) {
    const d = await gql(
      `query P($after: String) { ${plural}(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id ${keyField} naicsSector } } } }`,
      { after: cursor },
    );
    const conn = d?.[plural];
    if (!conn) break;
    for (const { node } of conn.edges) {
      scanned++;
      const sector = lookup(node);
      if (!sector) continue;
      if (node.naicsSector === sector) { already++; continue; }
      if (!pending.has(sector)) pending.set(sector, []);
      pending.get(sector).push(node.id);
    }
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  let written = 0;
  const perSector = [];
  for (const [sector, ids] of [...pending.entries()].sort((a, b) => b[1].length - a[1].length)) {
    let done = 0;
    if (DRY_RUN) {
      done = ids.length;
    } else {
      for (let i = 0; i < ids.length; i += CHUNK) {
        done += await gql(mutation, { ids: ids.slice(i, i + CHUNK), sector }).then(
          (d) => d?.[Object.keys(d ?? {})[0]]?.length ?? 0,
        );
      }
    }
    written += done;
    perSector.push(`    ${sector}: ${done}`);
  }
  console.log(`${DRY_RUN ? '[dry run] ' : ''}${label}: scanned ${scanned}, set ${written}, already correct ${already}`);
  if (perSector.length) console.log(perSector.join('\n'));
};

await run(
  'companies',
  'companies',
  'clientId',
  (n) => (n.clientId ? byClientId.get(n.clientId) : undefined),
  `mutation U($ids: [UUID!], $sector: String!) {
    updateCompanies(filter: { id: { in: $ids } }, data: { naicsSector: $sector }) { id }
  }`,
);
await run(
  'people',
  'people',
  'sfLeadId',
  (n) => (n.sfLeadId ? byLeadId.get(n.sfLeadId) : undefined),
  `mutation U($ids: [UUID!], $sector: String!) {
    updatePeople(filter: { id: { in: $ids } }, data: { naicsSector: $sector }) { id }
  }`,
);

// Third pass: a person whose own lead carried no industry signal still works at a company that
// now has a sector, and a contact's sector is their employer's. Runs last so a person-specific
// value always wins over the inherited one.
const inheritFromCompany = async () => {
  const pending = new Map();
  let cursor = null;
  let candidates = 0;
  for (;;) {
    const d = await gql(
      `query P($after: String) { people(filter: { naicsSector: { is: "NULL" } }, first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id company { naicsSector } } } } }`,
      { after: cursor },
    );
    const conn = d?.people;
    if (!conn) break;
    for (const { node } of conn.edges) {
      const sector = node.company?.naicsSector;
      if (!sector) continue;
      candidates++;
      if (!pending.has(sector)) pending.set(sector, []);
      pending.get(sector).push(node.id);
    }
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  let written = 0;
  for (const [sector, ids] of pending) {
    if (DRY_RUN) { written += ids.length; continue; }
    for (let i = 0; i < ids.length; i += CHUNK) {
      written += await gql(
        `mutation U($ids: [UUID!], $sector: String!) {
          updatePeople(filter: { id: { in: $ids } }, data: { naicsSector: $sector }) { id }
        }`,
        { ids: ids.slice(i, i + CHUNK), sector },
      ).then((d) => d?.updatePeople?.length ?? 0);
    }
  }
  console.log(`${DRY_RUN ? '[dry run] ' : ''}people inheriting their company's sector: ${written} of ${candidates} candidates`);
};
await inheritFromCompany();
