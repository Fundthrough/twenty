// Completes the legacy industry field from naicsSector.
//
// The industry field already carries all 20 NAICS sector names among its 55 options, so this is
// a 1:1 fold with no judgement calls -- unlike mapping the raw Salesforce labels, which is what
// made this field 1.7% populated in the first place.
//
// Only fills where industry is empty. The ~135 records holding classic values (TECHNOLOGY,
// RETAIL) are left alone: rewriting them would mean re-deciding whether TECHNOLOGY is sector 51
// or 54, which is exactly the guesswork NAICS removed. Consequence, stated rather than hidden:
// industry temporarily holds two vocabularies, so group by naicsSector for reporting.
//
// Idempotent. DRY_RUN=1 reports without writing.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const DRY_RUN = process.env.DRY_RUN === '1';
const CHUNK = 200;

const SECTOR_TO_INDUSTRY = {
  NAICS_11: 'AGRICULTURE_FORESTRY_FISHING_AND_HUNTING',
  NAICS_21: 'MINING_QUARRYING_AND_OIL_AND_GAS_EXTRACTION',
  NAICS_22: 'UTILITIES',
  NAICS_23: 'CONSTRUCTION',
  NAICS_31_33: 'MANUFACTURING',
  NAICS_42: 'WHOLESALE_TRADE',
  NAICS_44_45: 'RETAIL_TRADE',
  NAICS_48_49: 'TRANSPORTATION_AND_WAREHOUSING',
  NAICS_51: 'INFORMATION_AND_CULTURAL_INDUSTRIES',
  NAICS_52: 'FINANCE_AND_INSURANCE',
  NAICS_53: 'REAL_ESTATE_AND_RENTAL_AND_LEASING',
  NAICS_54: 'PROFESSIONAL_SCIENTIFIC_AND_TECHNICAL_SERVICES',
  NAICS_55: 'MANAGEMENT_OF_COMPANIES_AND_ENTERPRISES',
  NAICS_56: 'ADMINISTRATIVE_AND_SUPPORT_WASTE_MANAGEMENT_AND_REMEDIATION_SER',
  NAICS_61: 'EDUCATIONAL_SERVICES',
  NAICS_62: 'HEALTH_CARE_AND_SOCIAL_ASSISTANCE',
  NAICS_71: 'ARTS_ENTERTAINMENT_AND_RECREATION',
  NAICS_72: 'ACCOMMODATION_AND_FOOD_SERVICES',
  NAICS_81: 'OTHER_SERVICES',
  NAICS_92: 'PUBLIC_ADMINISTRATION',
};

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

const run = async (plural, mutationName) => {
  const pending = new Map();
  let cursor = null;
  let scanned = 0;
  for (;;) {
    const d = await gql(
      `query P($after: String) { ${plural}(filter: { and: [{ naicsSector: { is: "NOT_NULL" } }, { industry: { is: "NULL" } }] }, first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id naicsSector } } } }`,
      { after: cursor },
    );
    const conn = d?.[plural];
    if (!conn) break;
    for (const { node } of conn.edges) {
      scanned++;
      const industry = SECTOR_TO_INDUSTRY[node.naicsSector];
      if (!industry) continue;
      if (!pending.has(industry)) pending.set(industry, []);
      pending.get(industry).push(node.id);
    }
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  let written = 0;
  const lines = [];
  for (const [industry, ids] of [...pending.entries()].sort((a, b) => b[1].length - a[1].length)) {
    let done = 0;
    if (DRY_RUN) {
      done = ids.length;
    } else {
      for (let i = 0; i < ids.length; i += CHUNK) {
        done += await gql(
          `mutation U($ids: [UUID!], $industry: String!) {
            ${mutationName}(filter: { id: { in: $ids } }, data: { industry: $industry }) { id }
          }`,
          { ids: ids.slice(i, i + CHUNK), industry },
        ).then((d) => d?.[mutationName]?.length ?? 0);
      }
    }
    written += done;
    lines.push(`    ${industry}: ${done}`);
  }
  console.log(`${DRY_RUN ? '[dry run] ' : ''}${plural}: ${scanned} with a sector and no industry, ${written} filled`);
  if (lines.length) console.log(lines.join('\n'));
};

await run('companies', 'updateCompanies');
await run('people', 'updatePeople');
