// FULL-FIELD post-import reconciliation (Linesh 2026-07-23): "no data loss".
// Scope: ALL Client__c with PRO ids (any status) + their leads + accounts, and every
// Twenty person carrying an sfLeadId. For each matched record, computes the complete
// mapped field set (same mappings as import-sf.mjs) and fills any Twenty-BLANK field
// where SF has a value — never overwrites non-blank (manual edits respected).
// Default = CHECK ONLY (per-field ledger + samples). RECON_APPLY=1 writes.
// Company matching: sfClientId → lead linkage (Lead_LKP__c / Client_LKP__c ↔
// person.sfLeadId → person's company) → unique normalized-name.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const APPLY = !!process.env.RECON_APPLY;

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const API_KEY = cfg.apiKey;
const BASE = 'https://fundthrough-sales.twenty.com';
const claims = JSON.parse(Buffer.from(API_KEY.split('.')[1], 'base64url').toString());
if (claims.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('ABORT: not the sales workspace:', claims.workspaceId); process.exit(1);
}
const SF = (process.env.SALESFORCE_INSTANCE_URL ?? 'https://fundthroughinc.my.salesforce.com').replace(/\/$/, '');
const tokRes = await fetch(`${SF}/services/oauth2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.SALESFORCE_CLIENT_ID, client_secret: process.env.SALESFORCE_CLIENT_SECRET }),
});
const SF_TOKEN = (await tokRes.json()).access_token;
if (!SF_TOKEN) { console.error('SF connected-app auth failed'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function soql(query) {
  const records = []; let url = `${SF}/services/data/v59.0/query?q=${encodeURIComponent(query)}`; let tries = 0;
  while (url) {
    let res;
    try { res = await fetch(url, { headers: { Authorization: `Bearer ${SF_TOKEN}` } }); }
    catch (e) { if (++tries < 6) { await sleep(5000 * tries); continue; } throw e; }
    const body = await res.json();
    if (!res.ok) throw new Error(`SOQL ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
    records.push(...(body.records ?? []));
    url = body.nextRecordsUrl ? SF + body.nextRecordsUrl : null;
    tries = 0;
  }
  return records;
}
async function gql(query, variables, attempt = 1) {
  let res;
  try {
    res = await fetch(`${BASE}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` }, body: JSON.stringify({ query, variables }) });
  } catch (e) {
    if (attempt < 8) { await sleep(Math.min(5000 * attempt, 30000)); return gql(query, variables, attempt + 1); }
    throw e;
  }
  const body = await res.json().catch(() => null);
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 10) { await sleep(62000); return gql(query, variables, attempt + 1); }
  return body;
}
async function pageAll(path, sel) {
  const out = []; let cursor;
  for (;;) {
    const r = await gql(`query Q($after: String) { ${path}(first: 60, after: $after) { edges { node { ${sel} } } pageInfo { hasNextPage endCursor } } }`, { after: cursor });
    const conn = r?.data?.[path];
    if (!conn) break;
    out.push(...conn.edges.map((e) => e.node));
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
    await sleep(250);
  }
  return out;
}

// ---- mappings (mirrors import-sf.mjs — keep in sync; TODO extract shared lib) ----
const valueMaps = JSON.parse(readFileSync(join(APP, 'scripts/value-maps.json'), 'utf8'));
const mapSel = (obj, field, label) => (label ? valueMaps[obj]?.[field]?.[String(label).trim()] : undefined);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const normPhone = (raw) => {
  if (!raw) return undefined;
  let d = String(raw).replace(/[^+\d]/g, '');
  if (!d.startsWith('+')) { if (d.length === 10) d = '+1' + d; else if (d.length === 11 && d.startsWith('1')) d = '+' + d; else return undefined; }
  return { primaryPhoneNumber: d };
};
const day = (v) => (v ? String(v).slice(0, 10) : undefined);
const norm = (s) => (s ?? '').trim().toLowerCase();
const JUNK = /^\s*(n\/?a|nan?|none|null|-|\.)+\s*$/i;
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
    industry: mapSel('company', 'industry', l.Industry) ?? mapSel('person', 'industry', l.Industry),
    domainName: l.Website ? { primaryLinkUrl: l.Website.startsWith('http') ? l.Website : `https://${l.Website}` } : undefined,
  });
};
const accountFieldsForCompany = (a) => (a ? clean({
  sfAccountId: a.Id,
  domainName: a.Website ? { primaryLinkUrl: a.Website.startsWith('http') ? a.Website : `https://${a.Website}` } : undefined,
  description: a.Description,
  industry: mapSel('company', 'industry', a.Industry),
  accountType: mapSel('company', 'accountType', a.Type),
  churnDate: day(a.Churn_Date__c),
  churnReason: mapSel('company', 'churnReason', a.Churn_Reason__c),
  persona: mapSel('company', 'persona', a.Persona__c),
  source: a.Source__c,
}) : {});
const clientCoreFields = (c) => clean({
  companyId: c.PRO_Company_ID__c,
  clientId: c.Client_ID__c,
  sfClientId: c.Id,
  applicationStatus: c.Application_Status__c,
  referringPartner: c.Referring_Partner__c,
  address: clean({
    addressStreet1: c.Business_address_street__c,
    addressCity: c.Business_address_city__c,
    addressState: c.Business_address_state__c,
    addressPostcode: c.Business_address_postal_code__c,
    addressCountry: c.Country__c,
  }),
});
const LEAD_FIELDS = 'Id, FirstName, LastName, Email, Phone, MobilePhone, Title, Company, Status, LeadSource, Industry, Website, DoNotCall, IsConverted, ConvertedContactId, ConvertedAccountId, Type__c, Hot_list__c, Account_Notes__c, Accounting_Software__c, Desired_Funding_Amount__c, How_quickly_do_you_need_the_money__c, Do_you_invoice_businesses__c, Do_you_use_any_of_these_invoice_platform__c, How_Did_You_Hear_About_Us__c, Disqualified_Reason__c, Disqualified_Reason_Other__c, Lost_Reason__c, Lost_Reasons_Other__c, Renurture_Date__c, Renurture_Reason__c, Renurture_Reason_Other__c, Partner_Source__c, Partner_Agent_ID__c, Primary_Partner_Affiliation__c, Promo_Code__c, Client_LKP__c, CreatedDate, OwnerId';

// ---- pulls ----
console.log('Pulling SF: all clients w/ PRO ids, accounts…');
const sfClients = (await soql(`SELECT Id, Name, Company_Name__c, PRO_Company_ID__c, Client_ID__c, Application_Status__c, Referring_Partner__c, Lead_LKP__c, Country__c, Business_address_street__c, Business_address_city__c, Business_address_state__c, Business_address_postal_code__c, First_Name__c, Last_Name__c, Email__c, Phone__c, OwnerId FROM Client__c WHERE PRO_Company_ID__c != null`))
  .filter((c) => !JUNK.test(c.Company_Name__c || c.Name || ''));
const accounts = await soql('SELECT Id, Client_ID__c, Website, Description, Industry, Type, Churn_Date__c, Churn_Reason__c, Persona__c, Source__c, OwnerId FROM Account WHERE Client_ID__c != null');
const accountByClientKey = new Map(accounts.map((a) => [a.Client_ID__c, a]));
console.log(`  ${sfClients.length} clients, ${accounts.length} accounts`);

console.log('Pulling Twenty companies + people…');
const COMPANY_SEL = 'id name companyId clientId sfClientId sfAccountId applicationStatus referringPartner sfOwnerEmail leadStatus lifecycleStage clientType accountingSoftware invoicePlatforms doYouInvoiceBusinesses desiredFundingAmount howQuicklyDoYouNeedTheMoney accountNotes leadSource howDidYouHearAboutUs partnerSource partnerAgentId primaryPartnerAffiliation promoCode hotList disqualifiedReason lostReason renurtureDate industry accountType description persona source churnDate churnReason domainName { primaryLinkUrl } address { addressStreet1 addressCity } createdBy { source }';
const twCompanies = await pageAll('companies', COMPANY_SEL);
const twPeople = await pageAll('people', 'id sfLeadId sfContactId companyId jobTitle doNotCall sfOwnerEmail emails { primaryEmail } phones { primaryPhoneNumber } name { firstName lastName }');
console.log(`  ${twCompanies.length} companies, ${twPeople.length} people`);

console.log('Pulling leads referenced by Twenty people + client links…');
const leadIds = [...new Set(twPeople.map((p) => p.sfLeadId).filter(Boolean))];
const leadById = new Map();
for (let i = 0; i < leadIds.length; i += 200) {
  const chunk = leadIds.slice(i, i + 200);
  for (const l of await soql(`SELECT ${LEAD_FIELDS} FROM Lead WHERE Id IN ('${chunk.join("','")}')`)) leadById.set(l.Id, l);
}
const clientLeadIds = [...new Set(sfClients.map((c) => c.Lead_LKP__c).filter((id) => id && !leadById.has(id)))];
for (let i = 0; i < clientLeadIds.length; i += 200) {
  const chunk = clientLeadIds.slice(i, i + 200);
  for (const l of await soql(`SELECT ${LEAD_FIELDS} FROM Lead WHERE Id IN ('${chunk.join("','")}')`)) leadById.set(l.Id, l);
}
const ownerIds = [...new Set([...sfClients, ...leadById.values(), ...accounts].map((r) => r.OwnerId).filter(Boolean))];
const users = [];
for (let i = 0; i < ownerIds.length; i += 200) {
  users.push(...await soql(`SELECT Id, Email FROM User WHERE Id IN ('${ownerIds.slice(i, i + 200).join("','")}')`));
}
const ownerEmail = Object.fromEntries(users.map((u) => [u.Id, u.Email]));
console.log(`  ${leadById.size} leads, ${users.length} owners`);

// ---- matching indexes ----
const clientBySfId = new Map(sfClients.map((c) => [c.Id, c]));
const clientByLeadId = new Map(sfClients.filter((c) => c.Lead_LKP__c).map((c) => [c.Lead_LKP__c, c]));
for (const l of leadById.values()) if (l.Client_LKP__c && clientBySfId.has(l.Client_LKP__c) && !clientByLeadId.has(l.Id)) clientByLeadId.set(l.Id, clientBySfId.get(l.Client_LKP__c));
const clientsByName = new Map();
for (const c of sfClients) {
  const k = norm(c.Company_Name__c || c.Name);
  if (!clientsByName.has(k)) clientsByName.set(k, []);
  clientsByName.get(k).push(c);
}
const leadIdsByCompany = new Map();
for (const p of twPeople) {
  if (!p.sfLeadId || !p.companyId) continue;
  if (!leadIdsByCompany.has(p.companyId)) leadIdsByCompany.set(p.companyId, []);
  leadIdsByCompany.get(p.companyId).push(p.sfLeadId);
}

const isBlank = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => !x));
const report = { at: new Date().toISOString(), applied: APPLY, companies: { checked: 0, needingFill: 0, filled: 0, fieldGaps: {} }, people: { checked: 0, needingFill: 0, filled: 0, fieldGaps: {} }, unmatchedSpawns: [], fundedMissing: [], errors: [] };

// ---- company pass ----
console.log('\nCompany reconciliation…');
for (const co of twCompanies) {
  // resolve the SF client (and/or best lead) for this company
  let client = co.sfClientId ? clientBySfId.get(co.sfClientId) : undefined;
  let viaLead;
  for (const leadId of leadIdsByCompany.get(co.id) ?? []) {
    if (!client) client = clientByLeadId.get(leadId);
    if (!viaLead && leadById.has(leadId)) viaLead = leadById.get(leadId);
  }
  if (!client) {
    const cands = clientsByName.get(norm(co.name)) ?? [];
    if (cands.length === 1) client = cands[0];
  }
  const lead = client?.Lead_LKP__c ? leadById.get(client.Lead_LKP__c) ?? viaLead : viaLead;
  if (!client && !lead) { if (!co.companyId) report.unmatchedSpawns.push(co.name); continue; }
  report.companies.checked++;

  const account = client?.Client_ID__c ? accountByClientKey.get(client.Client_ID__c) : undefined;
  const desired = {
    ...(lead ? leadFieldsForCompany(lead) : {}),
    ...accountFieldsForCompany(account),
    ...(client ? clientCoreFields(client) : {}),
    sfOwnerEmail: ownerEmail[lead?.OwnerId] ?? ownerEmail[client?.OwnerId] ?? (account ? ownerEmail[account.OwnerId] : undefined),
  };
  if (desired.leadStatus === 'NEW_SIGN_UP' && !desired.companyId && !co.companyId) desired.leadStatus = 'PROSPECT';
  const data = {};
  for (const [k, v] of Object.entries(desired)) {
    if (v === undefined || v === null || v === '') continue;
    if (isBlank(co[k])) { data[k] = v; report.companies.fieldGaps[k] = (report.companies.fieldGaps[k] ?? 0) + 1; }
  }
  if (!Object.keys(data).length) continue;
  report.companies.needingFill++;
  if (APPLY) {
    const r = await gql('mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }', { id: co.id, data });
    if (r?.data?.updateCompany?.id) report.companies.filled++;
    else report.errors.push(`company ${co.name}: ${String(JSON.stringify(r?.errors ?? r)).slice(0, 150)}`);
    await sleep(300);
  }
}

// ---- person pass (D-fields) ----
console.log('Person reconciliation…');
for (const p of twPeople) {
  const l = p.sfLeadId ? leadById.get(p.sfLeadId) : undefined;
  if (!l) continue;
  report.people.checked++;
  const desired = clean({
    jobTitle: l.Title,
    doNotCall: l.DoNotCall ?? undefined,
    sfContactId: l.ConvertedContactId,
    sfOwnerEmail: ownerEmail[l.OwnerId],
    emails: l.Email ? { primaryEmail: l.Email } : undefined,
    phones: normPhone(l.Phone || l.MobilePhone),
    name: (!p.name?.firstName || p.name?.firstName === '-') && l.FirstName ? { firstName: l.FirstName, lastName: l.LastName || '-' } : undefined,
  });
  const data = {};
  for (const [k, v] of Object.entries(desired)) {
    if (isBlank(p[k])) { data[k] = v; report.people.fieldGaps[k] = (report.people.fieldGaps[k] ?? 0) + 1; }
  }
  if (!Object.keys(data).length) continue;
  report.people.needingFill++;
  if (APPLY) {
    if (data.emails) delete data.emails; // unique index — only fill via manual review
    if (!Object.keys(data).length) continue;
    const r = await gql('mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }', { id: p.id, data });
    if (r?.data?.updatePerson?.id) report.people.filled++;
    else report.errors.push(`person ${p.sfLeadId}: ${String(JSON.stringify(r?.errors ?? r)).slice(0, 150)}`);
    await sleep(300);
  }
}

// funded clients entirely missing from Twenty (must be zero)
const twBySfClientId = new Set(twCompanies.filter((c) => c.sfClientId).map((c) => c.sfClientId));
report.fundedMissing = sfClients.filter((c) => c.Application_Status__c === 'Funded' && !twBySfClientId.has(c.Id)).map((c) => ({ id: c.Id, name: c.Company_Name__c || c.Name }));

console.log('\n== LEDGER ==');
console.log(`companies: ${report.companies.checked} matched, ${report.companies.needingFill} with blanks-where-SF-has-data${APPLY ? `, ${report.companies.filled} filled` : ''}`);
console.log('  field gaps:', JSON.stringify(report.companies.fieldGaps));
console.log(`people: ${report.people.checked} matched, ${report.people.needingFill} with gaps${APPLY ? `, ${report.people.filled} filled` : ''}`);
console.log('  field gaps:', JSON.stringify(report.people.fieldGaps));
console.log(`unmatched spawns (no SF identity found): ${report.unmatchedSpawns.length}`);
console.log(`funded SF clients missing from Twenty: ${report.fundedMissing.length}`);
const out = join(APP, `docs/recon-report-${new Date().toISOString().slice(0, 10)}${APPLY ? '' : '-check'}.json`);
writeFileSync(out, JSON.stringify(report, null, 2));
console.log('report:', out);
