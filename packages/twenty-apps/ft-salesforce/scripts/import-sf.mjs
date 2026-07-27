// PRODUCTION Salesforce → Twenty sales-workspace importer (EE-4970/71).
// True upsert (re-runnable: second run creates nothing), throttled, dry-runnable, batchable.
// Scope (Linesh 2026-07-20): all Client__c with PRO_Company_ID__c (junk names excluded),
// unconverted Leads + converted Leads of imported clients, open Tasks. Owners land as
// sfOwnerEmail (relation backfilled by backfill-owners.mjs as AMs get seats).
//
// Usage:
//   node scripts/import-sf.mjs                      # full run
//   IMPORT_DRY_RUN=1 node scripts/import-sf.mjs     # pull + transform + report only
//   SF_BATCH_LIMIT=25 node scripts/import-sf.mjs    # first-batch mode: N companies + their leads
// SF auth: bearer token in $SF_TOKEN_FILE (default $SCRATCH/.sf-token) or $SF_TOKEN.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const DRY = !!process.env.IMPORT_DRY_RUN;
const BATCH = process.env.SF_BATCH_LIMIT ? Number(process.env.SF_BATCH_LIMIT) : Infinity;

// ---- Twenty (sales cloud) ----
const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const API_KEY = cfg.apiKey;
const BASE = 'https://fundthrough-sales.twenty.com';
const claims = JSON.parse(Buffer.from(API_KEY.split('.')[1], 'base64url').toString());
if (claims.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('ABORT: sales remote key is not the sales workspace:', claims.workspaceId);
  process.exit(1);
}

// ---- Salesforce ----
// Preferred auth: Connected App client-credentials (SALESFORCE_CLIENT_ID/SECRET/INSTANCE_URL
// in the shell) — self-renewing, no session-token expiry. Fallback: SF_TOKEN / SF_TOKEN_FILE.
const SF = (process.env.SALESFORCE_INSTANCE_URL ?? 'https://fundthroughinc.my.salesforce.com').replace(/\/$/, '');
let SF_TOKEN = '';
if (process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET) {
  const res = await fetch(`${SF}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SALESFORCE_CLIENT_ID,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET,
    }),
  });
  const body = await res.json().catch(() => null);
  if (res.ok && body?.access_token) { SF_TOKEN = body.access_token; console.log('SF auth: connected-app client credentials'); }
  else console.error('connected-app token failed:', res.status, JSON.stringify(body).slice(0, 200), '— falling back to SF_TOKEN');
}
if (!SF_TOKEN) {
  const tokenFile = process.env.SF_TOKEN_FILE ?? join(process.env.SCRATCH ?? '.', '.sf-token');
  SF_TOKEN = process.env.SF_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : '');
  if (!SF_TOKEN) { console.error(`No SF auth: set SALESFORCE_CLIENT_ID/SECRET, SF_TOKEN, or a bearer token in ${tokenFile}`); process.exit(1); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = 400;
async function soql(query) {
  const records = [];
  let url = `${SF}/services/data/v59.0/query?q=${encodeURIComponent(query)}`;
  let attempts = 0;
  while (url) {
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${SF_TOKEN}` } });
    } catch (e) {
      if (++attempts < 8) { await sleep(Math.min(5000 * attempts, 30000)); continue; }
      throw e;
    }
    if (res.status === 401) { console.error('SF token expired/invalid (401) — mint a fresh one'); process.exit(1); }
    const body = await res.json();
    if (!res.ok) throw new Error(`SOQL ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
    records.push(...(body.records ?? []));
    url = body.nextRecordsUrl ? SF + body.nextRecordsUrl : null;
    attempts = 0;
  }
  return records;
}
async function gql(query, variables, attempt = 1) {
  let res;
  try {
    res = await fetch(`${BASE}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    // ECONNRESET & friends happen on multi-hour runs — retry with backoff, never die
    if (attempt < 8) { await sleep(Math.min(5000 * attempt, 30000)); return gql(query, variables, attempt + 1); }
    throw e;
  }
  const body = await res.json().catch(() => null);
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 10) {
    await sleep(62000); return gql(query, variables, attempt + 1);
  }
  return body;
}

const valueMaps = JSON.parse(readFileSync(join(APP, 'scripts/value-maps.json'), 'utf8'));
const mapSel = (obj, field, label) => (label ? valueMaps[obj]?.[field]?.[String(label).trim()] : undefined);
const errStr = (r) => String(JSON.stringify(r?.errors ?? r) ?? 'no-response').slice(0, 200);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const normPhone = (raw) => {
  if (!raw) return undefined;
  let d = String(raw).replace(/[^+\d]/g, '');
  if (!d.startsWith('+')) {
    if (d.length === 10) d = '+1' + d;
    else if (d.length === 11 && d.startsWith('1')) d = '+' + d;
    else return undefined;
  }
  return { primaryPhoneNumber: d };
};
const JUNK_NAME = /^\s*(n\/?a|nan?|none|null|-|\.)+\s*$/i;

const report = { startedAt: new Date().toISOString(), dryRun: DRY, batchLimit: BATCH === Infinity ? null : BATCH, companies: {}, people: {}, tasks: {}, junkExcluded: [], errors: [] };

// ---- preload existing Twenty records (paginated) ----
async function pageAll(query, path, sel) {
  const out = []; let cursor;
  for (;;) {
    const r = await gql(`query Q($after: String) { ${path}(first: 60, after: $after) { edges { node { ${sel} } } pageInfo { hasNextPage endCursor } } }`, { after: cursor });
    const conn = r?.data?.[path];
    if (!conn) { report.errors.push(`preload ${path}: ${JSON.stringify(r?.errors).slice(0, 200)}`); break; }
    out.push(...conn.edges.map((e) => e.node));
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
    await sleep(T);
  }
  return out;
}

console.log('Preloading existing Twenty records…');
const twCompanies = await pageAll('companies', 'companies', 'id name companyId sfClientId sfAccountId');
const twPeople = await pageAll('people', 'people', 'id sfLeadId sfContactId leadStatus emails { primaryEmail }');
const companyByCompanyId = new Map(twCompanies.filter((c) => c.companyId).map((c) => [String(c.companyId), c]));
const companyBySfClientId = new Map(twCompanies.filter((c) => c.sfClientId).map((c) => [c.sfClientId, c]));
const personBySfLeadId = new Map(twPeople.filter((p) => p.sfLeadId).map((p) => [p.sfLeadId, p]));
const personByEmail = new Map(twPeople.filter((p) => p.emails?.primaryEmail).map((p) => [p.emails.primaryEmail.toLowerCase(), p]));
console.log(`  ${twCompanies.length} companies, ${twPeople.length} people already in Twenty`);

// ---- pull SF ----
console.log('Pulling Salesforce…');
// Scenario B (default): ALL Funded clients (PRO id or not — no funded client missed) +
// unconverted leads from the last 180 days. IMPORT_SCOPE=full reverts to everything-with-PRO-id.
const FULL = process.env.IMPORT_SCOPE === 'full';
const CLIENT_WHERE = FULL ? "PRO_Company_ID__c != null" : "Application_Status__c = 'Funded'";
const clientsAll = await soql(`SELECT Id, Name, Company_Name__c, PRO_Company_ID__c, Client_ID__c, Application_Status__c, Is_Active__c, Country__c, Business_address_street__c, Business_address_city__c, Business_address_state__c, Business_address_postal_code__c, Referring_Partner__c, First_Name__c, Last_Name__c, Email__c, Phone__c, Lead_LKP__c, OwnerId FROM Client__c WHERE ${CLIENT_WHERE}`);
const junk = clientsAll.filter((c) => JUNK_NAME.test(c.Company_Name__c || c.Name || ''));
report.junkExcluded = junk.map((c) => ({ id: c.Id, name: c.Company_Name__c || c.Name }));
let clients = clientsAll.filter((c) => !JUNK_NAME.test(c.Company_Name__c || c.Name || ''));
if (BATCH !== Infinity) clients = clients.slice(0, BATCH);
console.log(`  clients: ${clientsAll.length} pulled, ${junk.length} junk-named excluded, ${clients.length} in scope${BATCH !== Infinity ? ` (batch limit ${BATCH})` : ''}`);

const clientIdSet = new Set(clients.map((c) => c.Id));
const leadsUnconverted = await soql(`SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, Title, Company, Status, LeadSource, Industry, Website, DoNotCall, IsConverted, ConvertedContactId, ConvertedAccountId, Type__c, Hot_list__c, Account_Notes__c, Accounting_Software__c, Desired_Funding_Amount__c, How_quickly_do_you_need_the_money__c, Do_you_invoice_businesses__c, Do_you_use_any_of_these_invoice_platform__c, How_Did_You_Hear_About_Us__c, Disqualified_Reason__c, Disqualified_Reason_Other__c, Lost_Reason__c, Lost_Reasons_Other__c, Renurture_Date__c, Renurture_Reason__c, Renurture_Reason_Other__c, Partner_Source__c, Partner_Agent_ID__c, Primary_Partner_Affiliation__c, Promo_Code__c, Client_LKP__c, CreatedDate, OwnerId FROM Lead WHERE IsConverted = false${FULL ? '' : ' AND CreatedDate = LAST_N_DAYS:180'}`);
const leadsConverted = await soql(`SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, Title, Company, Status, LeadSource, Industry, Website, DoNotCall, IsConverted, ConvertedContactId, ConvertedAccountId, Type__c, Hot_list__c, Account_Notes__c, Accounting_Software__c, Desired_Funding_Amount__c, How_quickly_do_you_need_the_money__c, Do_you_invoice_businesses__c, Do_you_use_any_of_these_invoice_platform__c, How_Did_You_Hear_About_Us__c, Disqualified_Reason__c, Disqualified_Reason_Other__c, Lost_Reason__c, Lost_Reasons_Other__c, Renurture_Date__c, Renurture_Reason__c, Renurture_Reason_Other__c, Partner_Source__c, Partner_Agent_ID__c, Primary_Partner_Affiliation__c, Promo_Code__c, Client_LKP__c, CreatedDate, OwnerId FROM Lead WHERE IsConverted = true AND Client_LKP__c != null`);
const convertedInScope = leadsConverted.filter((l) => clientIdSet.has(l.Client_LKP__c));
let leads = [...leadsUnconverted, ...convertedInScope];
if (BATCH !== Infinity) {
  // first-batch mode: only leads linked to the batch companies + a slice of unlinked open leads
  leads = [...convertedInScope, ...leadsUnconverted.filter((l) => l.Client_LKP__c && clientIdSet.has(l.Client_LKP__c)), ...leadsUnconverted.filter((l) => !l.Client_LKP__c).slice(0, BATCH)];
}
console.log(`  leads: ${leadsUnconverted.length} unconverted, ${convertedInScope.length} converted-in-scope, ${leads.length} in this run`);

// Account enrichment (industry, source, type, NOA, persona, commission, risk… + sfAccountId).
// Primary join: Account.Client_ID__c ↔ Client__c.Client_ID__c; fallback: converted lead's
// ConvertedAccountId ↔ Client_LKP__c (enrich-demo pattern).
const ACCOUNT_FIELDS = 'Id, Client_ID__c, Website, Description, Industry, Type, Churn_Date__c, Churn_Reason__c, Commission_Rate__c, Commission_Type__c, Critical_Account__c, Expected_Go_Live_Date__c, Key_Account__c, KYC_Date__c, NOA_Policy__c, Partner_Stage__c, Persona__c, Risk_Notes__c, Source__c, OwnerId';
const accountsByClientKey = new Map(); // Client_ID__c -> account
for (const a of await soql(`SELECT ${ACCOUNT_FIELDS} FROM Account WHERE Client_ID__c != null`)) {
  accountsByClientKey.set(a.Client_ID__c, a);
}
const accountBySfClientId = new Map(); // Client__c.Id -> account
for (const c of clients) {
  if (c.Client_ID__c && accountsByClientKey.has(c.Client_ID__c)) accountBySfClientId.set(c.Id, accountsByClientKey.get(c.Client_ID__c));
}
// fallback via converted leads for clients still unmatched
const missingAccountIds = [...new Set(convertedInScope
  .filter((l) => clientIdSet.has(l.Client_LKP__c) && !accountBySfClientId.has(l.Client_LKP__c) && l.ConvertedAccountId)
  .map((l) => l.ConvertedAccountId))];
const accountById = new Map();
for (let i = 0; i < missingAccountIds.length; i += 200) {
  const chunk = missingAccountIds.slice(i, i + 200);
  for (const a of await soql(`SELECT ${ACCOUNT_FIELDS} FROM Account WHERE Id IN ('${chunk.join("','")}')`)) accountById.set(a.Id, a);
}
for (const l of convertedInScope) {
  if (l.Client_LKP__c && !accountBySfClientId.has(l.Client_LKP__c) && accountById.has(l.ConvertedAccountId)) {
    accountBySfClientId.set(l.Client_LKP__c, accountById.get(l.ConvertedAccountId));
  }
}
console.log(`  accounts joined: ${accountBySfClientId.size} of ${clients.length} clients`);

// owner emails
const ownerIds = [...new Set([...clients, ...leads, ...accountBySfClientId.values()].map((r) => r.OwnerId).filter(Boolean))];
// the LEAD's owner is the company's account owner (Linesh 2026-07-22): converted lead's
// owner wins over Client__c/Account owner (those are often integration/system users)
const leadOwnerByClient = new Map();
const leadByClient = new Map(); // latest converted lead per client — source of company pipeline fields
for (const l of [...convertedInScope].sort((a, b) => String(b.CreatedDate).localeCompare(String(a.CreatedDate)))) {
  if (!l.Client_LKP__c) continue;
  if (l.OwnerId && !leadOwnerByClient.has(l.Client_LKP__c)) leadOwnerByClient.set(l.Client_LKP__c, l.OwnerId);
  if (!leadByClient.has(l.Client_LKP__c)) leadByClient.set(l.Client_LKP__c, l);
}
// reverse join (Databricks schema insight, Linesh 2026-07-22): Client__c.Lead_LKP__c points
// client→lead; catches funded clients whose lead lacks the forward Client_LKP__c backlink
const LEAD_FULL_FIELDS = 'Id, FirstName, LastName, Email, Phone, MobilePhone, Title, Company, Status, LeadSource, Industry, Website, DoNotCall, IsConverted, ConvertedContactId, ConvertedAccountId, Type__c, Hot_list__c, Account_Notes__c, Accounting_Software__c, Desired_Funding_Amount__c, How_quickly_do_you_need_the_money__c, Do_you_invoice_businesses__c, Do_you_use_any_of_these_invoice_platform__c, How_Did_You_Hear_About_Us__c, Disqualified_Reason__c, Disqualified_Reason_Other__c, Lost_Reason__c, Lost_Reasons_Other__c, Renurture_Date__c, Renurture_Reason__c, Renurture_Reason_Other__c, Partner_Source__c, Partner_Agent_ID__c, Primary_Partner_Affiliation__c, Promo_Code__c, Client_LKP__c, CreatedDate, OwnerId';
const knownLeadIds = new Set([...leadsUnconverted, ...leadsConverted].map((l) => l.Id));
const reverseLeadIds = [...new Set(clients.filter((c) => c.Lead_LKP__c && !leadByClient.has(c.Id) && !knownLeadIds.has(c.Lead_LKP__c)).map((c) => c.Lead_LKP__c))];
const reverseLeadById = new Map();
for (let i = 0; i < reverseLeadIds.length; i += 200) {
  const chunk = reverseLeadIds.slice(i, i + 200);
  for (const l of await soql(`SELECT ${LEAD_FULL_FIELDS} FROM Lead WHERE Id IN ('${chunk.join("','")}')`)) reverseLeadById.set(l.Id, l);
}
const leadByIdAll = new Map([...leadsUnconverted, ...leadsConverted].map((l) => [l.Id, l]));
let reverseJoined = 0;
for (const c of clients) {
  if (leadByClient.has(c.Id) || !c.Lead_LKP__c) continue;
  const l = leadByIdAll.get(c.Lead_LKP__c) ?? reverseLeadById.get(c.Lead_LKP__c);
  if (!l) continue;
  leadByClient.set(c.Id, l);
  if (l.OwnerId && !leadOwnerByClient.has(c.Id)) leadOwnerByClient.set(c.Id, l.OwnerId);
  reverseJoined++;
}
for (const l of reverseLeadById.values()) if (l.OwnerId && !ownerIds.includes(l.OwnerId)) ownerIds.push(l.OwnerId);
console.log(`  reverse-joined leads (Client__c.Lead_LKP__c): ${reverseJoined} clients gained a lead`);
const users = ownerIds.length ? await soql(`SELECT Id, Email, Name FROM User WHERE Id IN ('${ownerIds.join("','")}')`) : [];
const ownerEmail = Object.fromEntries(users.map((u) => [u.Id, u.Email]));
console.log(`  owners: ${users.length} SF users resolved`);

// open tasks (client-side scoping to imported records)
const tasksOpen = await soql(`SELECT Id, Subject, Description, ActivityDate, Status, Priority, WhoId, WhatId FROM Task WHERE IsClosed = false`);
console.log(`  open tasks org-wide: ${tasksOpen.length}`);

// ---- upsert companies ----
console.log(DRY ? '\nDRY RUN — no writes' : '\nUpserting companies…');
let cCreated = 0, cUpdated = 0, cFailed = 0;
const companyTwentyIdBySfClient = new Map();
const day = (v) => (v ? String(v).slice(0, 10) : undefined);
// A+B+C fields (Linesh 2026-07-22): pipeline/business/attribution live on COMPANY.
// Company SELECT options share the person option VALUES, so person value-maps apply.
const leadFieldsForCompany = (l) => {
  if (!l) return {};
  const multi = (l.Do_you_use_any_of_these_invoice_platform__c || '').split(';').map((x) => mapSel('person', 'invoicePlatforms', x.trim())).filter(Boolean);
  return clean({
    leadStatus: mapSel('person', 'leadStatus', l.Status),
    lifecycleStage: l.IsConverted ? 'CONVERTED' : 'LEAD',
    clientType: mapSel('person', 'clientType', l.Type__c),
    accountingSoftware: mapSel('person', 'accountingSoftware', l.Accounting_Software__c),
    invoicePlatforms: multi.length ? multi : undefined,
    doYouInvoiceBusinesses: mapSel('person', 'doYouInvoiceBusinesses', l.Do_you_invoice_businesses__c),
    desiredFundingAmount: l.Desired_Funding_Amount__c ?? undefined,
    howQuicklyDoYouNeedTheMoney: mapSel('person', 'howQuicklyDoYouNeedTheMoney', l.How_quickly_do_you_need_the_money__c),
    accountNotes: l.Account_Notes__c,
    leadSource: mapSel('person', 'leadSource', l.LeadSource),
    howDidYouHearAboutUs: mapSel('person', 'howDidYouHearAboutUs', l.How_Did_You_Hear_About_Us__c),
    partnerSource: l.Partner_Source__c,
    partnerAgentId: l.Partner_Agent_ID__c,
    primaryPartnerAffiliation: mapSel('person', 'primaryPartnerAffiliation', l.Primary_Partner_Affiliation__c),
    promoCode: l.Promo_Code__c,
    hotList: l.Hot_list__c ?? undefined,
    disqualifiedReason: mapSel('person', 'disqualifiedReason', l.Disqualified_Reason__c),
    disqualifiedReasonOther: l.Disqualified_Reason_Other__c,
    lostReason: mapSel('person', 'lostReason', l.Lost_Reason__c),
    lostReasonsOther: l.Lost_Reasons_Other__c,
    renurtureDate: l.Renurture_Date__c,
    renurtureReason: mapSel('person', 'renurtureReason', l.Renurture_Reason__c),
    renurtureReasonOther: l.Renurture_Reason_Other__c,
  });
};
for (const c of clients) {
  const a = accountBySfClientId.get(c.Id);
  const data = clean({
    name: c.Company_Name__c || c.Name,
    companyId: c.PRO_Company_ID__c,
    clientId: c.Client_ID__c ?? a?.Client_ID__c,
    sfClientId: c.Id,
    applicationStatus: c.Application_Status__c,
    sfOwnerEmail: ownerEmail[leadOwnerByClient.get(c.Id)] ?? ownerEmail[c.OwnerId] ?? (a ? ownerEmail[a.OwnerId] : undefined),
    ...(a ? clean({
      sfAccountId: a.Id,
      domainName: a.Website ? { primaryLinkUrl: a.Website.startsWith('http') ? a.Website : `https://${a.Website}` } : undefined,
      description: a.Description,
      industry: mapSel('company', 'industry', a.Industry),
      accountType: mapSel('company', 'accountType', a.Type),
      churnDate: day(a.Churn_Date__c),
      churnReason: mapSel('company', 'churnReason', a.Churn_Reason__c),
      persona: mapSel('company', 'persona', a.Persona__c),
      source: a.Source__c,
    }) : {}),
    ...(() => {
      const lf = leadFieldsForCompany(leadByClient.get(c.Id));
      // Linesh 2026-07-23: "New Sign up" is only real when the company has a PRO id
      if (lf.leadStatus === 'NEW_SIGN_UP' && !c.PRO_Company_ID__c) lf.leadStatus = 'PROSPECT';
      return lf;
    })(),
    referringPartner: c.Referring_Partner__c,
    address: clean({
      addressStreet1: c.Business_address_street__c,
      addressCity: c.Business_address_city__c,
      addressState: c.Business_address_state__c,
      addressPostcode: c.Business_address_postal_code__c,
      addressCountry: c.Country__c,
    }),
  });
  if (!Object.keys(data.address ?? {}).length) delete data.address;
  const existing = companyByCompanyId.get(String(c.PRO_Company_ID__c)) ?? companyBySfClientId.get(c.Id);
  if (DRY) { existing ? cUpdated++ : cCreated++; companyTwentyIdBySfClient.set(c.Id, existing?.id ?? 'dry'); continue; }
  if (existing) {
    const r = await gql('mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }', { id: existing.id, data });
    if (r?.data?.updateCompany?.id) { cUpdated++; companyTwentyIdBySfClient.set(c.Id, existing.id); }
    else { cFailed++; if (cFailed <= 5) report.errors.push(`company update ${data.name}: ${errStr(r)}`); }
  } else {
    const r = await gql('mutation C($data: CompanyCreateInput!) { createCompany(data: $data) { id } }', { data });
    const id = r?.data?.createCompany?.id;
    if (id) { cCreated++; companyTwentyIdBySfClient.set(c.Id, id); }
    else { cFailed++; if (cFailed <= 5) report.errors.push(`company create ${data.name}: ${errStr(r)}`); }
  }
  await sleep(T);
}
report.companies = { created: cCreated, updated: cUpdated, failed: cFailed };
console.log(`companies: ${cCreated} created, ${cUpdated} updated, ${cFailed} failed`);

// ---- upsert people (+ spawn companies from unconverted leads — Linesh 2026-07-22) ----
const companyByName = new Map(twCompanies.filter((c) => c.name).map((c) => [c.name.trim().toLowerCase(), c.id]));
for (const [sfId, twId] of companyTwentyIdBySfClient) {
  const c = clients.find((x) => x.Id === sfId);
  if (c && twId !== 'dry') companyByName.set((c.Company_Name__c || c.Name).trim().toLowerCase(), twId);
}
let spawned = 0, spawnFailed = 0, noCompanyName = 0;
// most recent lead first: it sets a spawned company's pipeline fields; older ones just attach
const orderedLeads = [...leads].sort((a, b) => String(b.CreatedDate ?? '').localeCompare(String(a.CreatedDate ?? '')));
const spawnCompanyFor = async (l) => {
  const rawName = (l.Company ?? '').trim();
  if (!rawName || JUNK_NAME.test(rawName)) { noCompanyName++; return undefined; }
  const key = rawName.toLowerCase();
  if (companyByName.has(key)) return companyByName.get(key);
  const data = clean({
    name: rawName,
    sfOwnerEmail: ownerEmail[l.OwnerId],
    domainName: l.Website ? { primaryLinkUrl: l.Website.startsWith('http') ? l.Website : `https://${l.Website}` } : undefined,
    industry: mapSel('company', 'industry', l.Industry),
    ...leadFieldsForCompany(l),
  });
  if (data.leadStatus === 'NEW_SIGN_UP') data.leadStatus = 'PROSPECT'; // spawns have no companyId
  if (DRY) { companyByName.set(key, 'dry'); spawned++; return 'dry'; }
  const r = await gql('mutation C($data: CompanyCreateInput!) { createCompany(data: $data) { id } }', { data });
  const id = r?.data?.createCompany?.id;
  await sleep(T);
  if (!id) { spawnFailed++; if (spawnFailed <= 5) report.errors.push(`spawn company ${rawName}: ${errStr(r)}`); return undefined; }
  companyByName.set(key, id);
  spawned++;
  return id;
};
let pCreated = 0, pUpdated = 0, pFailed = 0, pLinked = 0;
for (const l of orderedLeads) {
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
    sfOwnerEmail: ownerEmail[l.OwnerId],
  });
  let companyTwentyId = companyTwentyIdBySfClient.get(l.Client_LKP__c);
  if (!companyTwentyId && !l.IsConverted) companyTwentyId = await spawnCompanyFor(l);
  if (companyTwentyId && companyTwentyId !== 'dry') { data.companyId = companyTwentyId; pLinked++; }

  // company-centric model: NEW people carry contact fields only (D-set) — the company
  // owns pipeline/business/attribution. Existing people keep their legacy copies (audit).
  const D_KEEP = new Set(['name', 'emails', 'phones', 'jobTitle', 'doNotCall', 'website', 'sfLeadId', 'sfContactId', 'sfOwnerEmail', 'companyId']);

  const bySf = personBySfLeadId.get(l.Id);
  const byEmail = !bySf && l.Email ? personByEmail.get(l.Email.toLowerCase()) : undefined;
  const existing = bySf ?? byEmail;
  // Marketo coexistence: an email-matched record (no sfLeadId) keeps its Twenty leadStatus
  if (byEmail && !bySf) delete data.leadStatus;
  if (DRY) { existing ? pUpdated++ : pCreated++; continue; }
  if (existing) {
    delete data.emails; // unique index on email — don't churn it
    const r = await gql('mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }', { id: existing.id, data });
    if (r?.data?.updatePerson?.id) pUpdated++;
    else { pFailed++; if (pFailed <= 8) report.errors.push(`person update ${l.Email}: ${errStr(r)}`); }
  } else {
    for (const k of Object.keys(data)) if (!D_KEEP.has(k)) delete data[k];
    const r = await gql('mutation P($data: PersonCreateInput!) { createPerson(data: $data) { id } }', { data });
    if (r?.data?.createPerson?.id) { pCreated++; personBySfLeadId.set(l.Id, { id: r.data.createPerson.id }); }
    else { pFailed++; if (pFailed <= 8) report.errors.push(`person create ${l.Email}: ${errStr(r)}`); }
  }
  await sleep(T);
}
report.people = { created: pCreated, updated: pUpdated, failed: pFailed, linkedToCompany: pLinked };
report.spawnedCompanies = { created: spawned, failed: spawnFailed, leadsWithoutCompanyName: noCompanyName };
console.log(`people: ${pCreated} created, ${pUpdated} updated, ${pFailed} failed, ${pLinked} linked`);
console.log(`spawned companies: ${spawned} created, ${spawnFailed} failed, ${noCompanyName} leads without usable company name`);

// ---- materialize Client__c embedded contacts (First/Last/Email/Phone live ON the client in SF) ----
let mCreated = 0, mSkipped = 0;
for (const c of clients) {
  const email = (c.Email__c ?? '').trim().toLowerCase();
  if (!email) { mSkipped++; continue; }
  if (personByEmail.has(email)) { mSkipped++; continue; }
  const companyTwentyId = companyTwentyIdBySfClient.get(c.Id);
  if (DRY) { mCreated++; personByEmail.set(email, { id: 'dry' }); continue; }
  const r = await gql('mutation P($data: PersonCreateInput!) { createPerson(data: $data) { id } }',
    { data: clean({
        name: clean({ firstName: c.First_Name__c || '-', lastName: c.Last_Name__c || '-' }),
        emails: { primaryEmail: c.Email__c.trim() },
        phones: normPhone(c.Phone__c),
        sfOwnerEmail: ownerEmail[leadOwnerByClient.get(c.Id)] ?? ownerEmail[c.OwnerId],
        companyId: companyTwentyId && companyTwentyId !== 'dry' ? companyTwentyId : undefined,
    }) });
  if (r?.data?.createPerson?.id) { mCreated++; personByEmail.set(email, { id: r.data.createPerson.id }); }
  else { report.errors.push(`materialize ${email}: ${errStr(r)}`); }
  await sleep(T);
}
report.materializedContacts = { created: mCreated, skipped: mSkipped };
console.log(`materialized client contacts: ${mCreated} created (${mSkipped} already present/blank)`);

// ---- open tasks (scoped to imported records) ----
const leadIdSet = new Set(leads.map((l) => l.Id));
const scopedTasks = tasksOpen.filter((t) => (t.WhoId && leadIdSet.has(t.WhoId)) || (t.WhatId && clientIdSet.has(t.WhatId)));
let tCreated = 0, tSkipped = 0, tFailed = 0;
for (const t of scopedTasks) {
  const check = await gql('query T($f: TaskFilterInput) { tasks(filter: $f, first: 1) { edges { node { id } } } }', { f: { sfTaskId: { eq: t.Id } } });
  if (check?.data?.tasks?.edges?.length) { tSkipped++; continue; }
  if (DRY) { tCreated++; continue; }
  const r = await gql('mutation T($data: TaskCreateInput!) { createTask(data: $data) { id } }',
    { data: clean({ title: t.Subject || 'SF task', bodyV2: t.Description ? { markdown: t.Description } : undefined, status: 'TODO', dueAt: t.ActivityDate ? new Date(t.ActivityDate).toISOString() : undefined, sfTaskId: t.Id }) });
  const taskId = r?.data?.createTask?.id;
  if (!taskId) { tFailed++; continue; }
  const personId = personBySfLeadId.get(t.WhoId)?.id;
  const companyTwentyId = companyTwentyIdBySfClient.get(t.WhatId);
  if (personId) await gql('mutation($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }', { data: { taskId, targetPersonId: personId } });
  else if (companyTwentyId && companyTwentyId !== 'dry') await gql('mutation($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }', { data: { taskId, targetCompanyId: companyTwentyId } });
  tCreated++;
  await sleep(T);
}
report.tasks = { created: tCreated, skippedExisting: tSkipped, failed: tFailed, scoped: scopedTasks.length };
console.log(`tasks: ${tCreated} created, ${tSkipped} already present, ${tFailed} failed (of ${scopedTasks.length} in scope)`);

report.finishedAt = new Date().toISOString();
const out = join(APP, `docs/import-report-${new Date().toISOString().slice(0, 10)}${DRY ? '-dry' : ''}${BATCH !== Infinity ? `-batch${BATCH}` : ''}.json`);
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`report: ${out}`);
