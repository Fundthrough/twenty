// Seeds the LOCAL Twenty dev server with real SF data:
// clients signed up in the last 2 months (366) + their leads (389).
// Data files: scripts/data/seed-clients.jsonl, scripts/data/seed-leads.jsonl
// Auth: local remote apiKey from ~/.twenty/config.json (or TWENTY_API_KEY env).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:2020';
const API_KEY = process.env.TWENTY_API_KEY ??
  JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.local.apiKey;
const DRY = process.argv.includes('--dry-run');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) ?? '--limit=0').split('=')[1]) || Infinity;

const valueMaps = JSON.parse(readFileSync(join(HERE, 'value-maps.json'), 'utf8'));
const mapSel = (obj, field, label) => (label && valueMaps[obj]?.[field]?.[label]) || undefined;

const jsonl = (f) => readFileSync(join(HERE, 'data', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const clients = jsonl('seed-clients.jsonl');
const leads = jsonl('seed-leads.jsonl');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gql(query, variables, attempt = 1) {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  let body;
  try { body = await res.json(); } catch {
    if (attempt < 4) { await sleep(1500 * attempt); return gql(query, variables, attempt + 1); }
    throw new Error(`non-JSON response ${res.status}`);
  }
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 6) {
    await sleep(62000);
    return gql(query, variables, attempt + 1);
  }
  return body;
}

const normPhone = (raw) => {
  if (!raw) return undefined;
  let d = raw.replace(/[^+\d]/g, '');
  if (!d.startsWith('+')) {
    if (d.length === 10) d = '+1' + d;
    else if (d.length === 11 && d.startsWith('1')) d = '+' + d;
    else return undefined; // unparseable — skip rather than fail the record
  }
  return { primaryPhoneNumber: d };
};

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

async function main() {
  const health = await fetch(`${API_URL}/healthz`).then((r) => r.ok).catch(() => false);
  if (!health) { console.error('local server not healthy at', API_URL); process.exit(1); }
  console.log(`Seeding ${Math.min(clients.length, LIMIT)} companies + linked people ${DRY ? '(DRY RUN)' : ''}`);

  // ---- Idempotency: preload existing records ----
  const existingCompanies = {}; const existingPeople = new Set();
  let cursor = null;
  do {
    const r = await gql(`{ companies(filter: { sfClientId: { is: "NOT_NULL" } }, first: 60${cursor ? `, after: "${cursor}"` : ''}) { edges { node { id sfClientId } cursor } pageInfo { hasNextPage endCursor } } }`);
    for (const e of r?.data?.companies?.edges ?? []) existingCompanies[e.node.sfClientId] = e.node.id;
    cursor = r?.data?.companies?.pageInfo?.hasNextPage ? r.data.companies.pageInfo.endCursor : null;
  } while (cursor);
  do {
    const r = await gql(`{ people(filter: { sfLeadId: { is: "NOT_NULL" } }, first: 60${cursor ? `, after: "${cursor}"` : ''}) { edges { node { sfLeadId } cursor } pageInfo { hasNextPage endCursor } } }`);
    for (const e of r?.data?.people?.edges ?? []) existingPeople.add(e.node.sfLeadId);
    cursor = r?.data?.people?.pageInfo?.hasNextPage ? r.data.people.pageInfo.endCursor : null;
  } while (cursor);
  console.log(`existing: ${Object.keys(existingCompanies).length} companies, ${existingPeople.size} people (will skip)`);

  // ---- Companies (clients) ----
  const companyMap = { ...existingCompanies }; // sfClientId -> twenty id
  let created = 0, failed = 0;
  for (const c of clients.slice(0, LIMIT)) {
    if (existingCompanies[c.Id]) { created++; continue; }
    const data = clean({
      name: c.Company_Name__c || c.Name,
      companyId: c.PRO_Company_ID__c,
      sfClientId: c.Id,
      applicationStatus: c.Application_Status__c,
      address: clean({
        addressStreet1: c.Business_address_street__c,
        addressCity: c.Business_address_city__c,
        addressState: c.Business_address_state__c,
        addressPostcode: c.Business_address_postal_code__c,
        addressCountry: c.Country__c,
      }),
    });
    if (!Object.keys(data.address ?? {}).length) delete data.address;
    if (DRY) { companyMap[c.Id] = 'dry'; created++; continue; }
    const r = await gql('mutation C($data: CompanyCreateInput!) { createCompany(data: $data) { id } }', { data });
    const id = r?.data?.createCompany?.id;
    if (id) { companyMap[c.Id] = id; created++; }
    else { failed++; if (failed <= 5) console.error('company fail:', c.Name, JSON.stringify(r?.errors?.[0]?.message ?? r).slice(0, 200)); }
    await sleep(650);
  }
  console.log(`companies: ${created} created, ${failed} failed`);

  // ---- People (leads) ----
  let pCreated = 0, pFailed = 0, pLinked = 0;
  for (const l of leads.slice(0, LIMIT)) {
    if (existingPeople.has(l.Id)) { pCreated++; continue; }
    const multi = (l.Do_you_use_any_of_these_invoice_platform__c || '').split(';').map((s) => mapSel('person', 'invoicePlatforms', s.trim())).filter(Boolean);
    const data = clean({
      name: clean({ firstName: l.FirstName || '-', lastName: l.LastName || '-' }),
      emails: l.Email ? { primaryEmail: l.Email } : undefined,
      phones: normPhone(l.Phone || l.MobilePhone),
      jobTitle: l.Title,
      lifecycleStage: l.IsConverted ? 'CONVERTED' : 'LEAD',
      leadStatus: mapSel('person', 'leadStatus', l.Status),
      leadSource: mapSel('person', 'leadSource', l.LeadSource),
      industry: mapSel('person', 'industry', l.Industry),
      clientType: mapSel('person', 'clientType', l.Type__c),
      accountingSoftware: mapSel('person', 'accountingSoftware', l.Accounting_Software__c),
      howQuicklyDoYouNeedTheMoney: mapSel('person', 'howQuicklyDoYouNeedTheMoney', l.How_quickly_do_you_need_the_money__c),
      doYouInvoiceBusinesses: mapSel('person', 'doYouInvoiceBusinesses', l.Do_you_invoice_businesses__c),
      howDidYouHearAboutUs: mapSel('person', 'howDidYouHearAboutUs', l.How_Did_You_Hear_About_Us__c),
      disqualifiedReason: mapSel('person', 'disqualifiedReason', l.Disqualified_Reason__c),
      lostReason: mapSel('person', 'lostReason', l.Lost_Reason__c),
      renurtureReason: mapSel('person', 'renurtureReason', l.Renurture_Reason__c),
      primaryPartnerAffiliation: mapSel('person', 'primaryPartnerAffiliation', l.Primary_Partner_Affiliation__c),
      invoicePlatforms: multi.length ? multi : undefined,
      companyName: l.Company,
      hotList: l.Hot_list__c ?? undefined,
      doNotCall: l.DoNotCall ?? undefined,
      accountNotes: l.Account_Notes__c,
      disqualifiedReasonOther: l.Disqualified_Reason_Other__c,
      lostReasonsOther: l.Lost_Reasons_Other__c,
      renurtureDate: l.Renurture_Date__c,
      renurtureReasonOther: l.Renurture_Reason_Other__c,
      partnerSource: l.Partner_Source__c,
      partnerAgentId: l.Partner_Agent_ID__c,
      promoCode: l.Promo_Code__c,
      desiredFundingAmount: l.Desired_Funding_Amount__c ?? undefined,
      website: l.Website ? { primaryLinkUrl: l.Website.startsWith('http') ? l.Website : `https://${l.Website}`, primaryLinkLabel: '' } : undefined,
      sfLeadId: l.Id,
      sfContactId: l.ConvertedContactId,
    });
    const companyTwentyId = companyMap[l.Client_LKP__c];
    if (companyTwentyId && companyTwentyId !== 'dry') { data.company = { connect: { id: companyTwentyId } }; pLinked++; }
    if (DRY) { pCreated++; continue; }
    const r = await gql('mutation P($data: PersonCreateInput!) { createPerson(data: $data) { id } }', { data });
    if (r?.data?.createPerson?.id) pCreated++;
    else { pFailed++; if (pFailed <= 5) console.error('person fail:', l.Email, JSON.stringify(r?.errors?.[0]?.message ?? r).slice(0, 300)); }
    await sleep(650);
  }
  console.log(`people: ${pCreated} created, ${pFailed} failed, ${pLinked} linked to companies`);
}

main().catch((e) => { console.error(e); process.exit(1); });
