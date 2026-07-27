// Demo enrichment to meet success criteria:
// 1. companies: fill the 17 empty custom fields from SF Account (+ referredBy self-relation from Client__c)
// 2. people: fill the 13 empty custom fields from SF Lead
// 3. termSheets: fill documentLink / facilityFeeCharged / notes from audit rows
// 4. tasks/notes: create morph targets (targetCompanyId) so they show on company records
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SCRATCH = process.env.SCRATCH;
const APP = process.env.APP; // ft-salesforce dir
const API_KEY = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.local.apiKey;
const SF_TOKEN = readFileSync(join(SCRATCH, '.sf-token'), 'utf8').trim();
const SF = 'https://fundthroughinc.my.salesforce.com';
const valueMaps = JSON.parse(readFileSync(join(APP, 'scripts/value-maps.json'), 'utf8'));
const auditRows = JSON.parse(readFileSync(join(SCRATCH, 'audit-rows.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gql(query, variables, attempt = 1) {
  const res = await fetch('http://localhost:2020/graphql', {
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
async function soql(q) {
  let url = `${SF}/services/data/v59.0/query?q=${encodeURIComponent(q)}`;
  const out = [];
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${SF_TOKEN}` } });
    const body = await res.json();
    if (!body.records) { console.error('SOQL error:', JSON.stringify(body).slice(0, 300)); return out; }
    out.push(...body.records);
    url = body.nextRecordsUrl ? SF + body.nextRecordsUrl : null;
  }
  return out;
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const sel = (map, label) => (label ? map?.[label] : undefined);
const day = (d) => (d ? String(d).slice(0, 10) : undefined);
const url = (u) => (u ? (/^https?:/i.test(u) ? u : 'https://' + u) : undefined);

// ---- current server records ----
const cRes = await gql('{ companies(first: 60) { edges { node { id name sfClientId } } } }');
const companies = cRes.data.companies.edges.map((e) => e.node);
const companyBySf = Object.fromEntries(companies.map((c) => [c.sfClientId, c]));
const companyByName = Object.fromEntries(companies.map((c) => [c.name.toLowerCase(), c.id]));
const pRes = await gql('{ people(first: 60) { edges { node { id sfLeadId } } } }');
const people = pRes.data.people.edges.map((e) => e.node).filter((p) => p.sfLeadId);

// ---- SF pulls ----
const leadIds = people.map((p) => `'${p.sfLeadId}'`).join(',');
const leads = await soql(`SELECT Id, ConvertedAccountId, Client_LKP__c, DoNotCall, Industry, Website,
  Account_Notes__c, Disqualified_Reason_Other__c, Do_you_use_any_of_these_invoice_platform__c,
  Lost_Reasons_Other__c, Partner_Agent_ID__c, Partner_Source__c, Primary_Partner_Affiliation__c,
  Promo_Code__c, Renurture_Date__c, Renurture_Reason_Other__c FROM Lead WHERE Id IN (${leadIds})`);
console.log('SF leads:', leads.length);

const clientIds = Object.keys(companyBySf).map((id) => `'${id}'`).join(',');
const sfClients = await soql(`SELECT Id, referred_by_company_id__c FROM Client__c WHERE Id IN (${clientIds})`);
const accountIds = [...new Set(leads.map((l) => l.ConvertedAccountId).filter(Boolean))].map((id) => `'${id}'`).join(',');
const accounts = accountIds
  ? await soql(`SELECT Id, Description, Industry, Type, Churn_Date__c, Churn_Reason__c, Commission_Rate__c,
      Commission_Type__c, Critical_Account__c, Expected_Go_Live_Date__c, Key_Account__c, KYC_Date__c,
      NOA_Policy__c, Partner_Stage__c, Persona__c, Risk_Notes__c, Source__c FROM Account WHERE Id IN (${accountIds})`)
  : [];
console.log('SF clients:', sfClients.length, '| SF accounts:', accounts.length);
const accountById = Object.fromEntries(accounts.map((a) => [a.Id, a]));
// client sfId -> account (via the converted lead that points at that client)
const accountByClient = {};
for (const l of leads) {
  if (l.Client_LKP__c && l.ConvertedAccountId && accountById[l.ConvertedAccountId]) {
    accountByClient[l.Client_LKP__c] = accountById[l.ConvertedAccountId];
  }
}

// ---- 1. enrich companies ----
let cUpd = 0;
const vm = valueMaps.company;
for (const [sfId, company] of Object.entries(companyBySf)) {
  const a = accountByClient[sfId];
  const refSf = sfClients.find((c) => c.Id === sfId)?.referred_by_company_id__c;
  const data = clean({
    ...(a ? {
      description: a.Description,
      industry: sel(vm.industry, a.Industry),
      accountType: sel(vm.accountType, a.Type),
      churnDate: day(a.Churn_Date__c),
      churnReason: sel(vm.churnReason, a.Churn_Reason__c),
      commissionRate: a.Commission_Rate__c,
      commissionType: sel(vm.commissionType, a.Commission_Type__c),
      criticalAccount: a.Critical_Account__c || undefined,
      expectedGoLiveDate: day(a.Expected_Go_Live_Date__c),
      keyAccount: a.Key_Account__c || undefined,
      kycDate: day(a.KYC_Date__c),
      noaPolicy: sel(vm.noaPolicy, a.NOA_Policy__c),
      partnerStage: sel(vm.partnerStage, a.Partner_Stage__c),
      persona: sel(vm.persona, a.Persona__c),
      riskNotes: a.Risk_Notes__c,
      source: a.Source__c,
    } : {}),
    referredById: refSf && companyBySf[refSf] ? companyBySf[refSf].id : undefined,
  });
  if (!Object.keys(data).length) continue;
  const r = await gql('mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }',
    { id: company.id, data });
  if (r?.data?.updateCompany?.id) cUpd++;
  else console.error('company enrich fail:', company.name, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160));
  await sleep(650);
}
console.log(`companies enriched: ${cUpd}`);

// ---- 2. enrich people ----
const pm = valueMaps.person;
const leadById = Object.fromEntries(leads.map((l) => [l.Id, l]));
let pUpd = 0;
for (const p of people) {
  const l = leadById[p.sfLeadId];
  if (!l) continue;
  const multi = (s) => (s ? s.split(';').map((x) => sel(pm.invoicePlatforms, x.trim())).filter(Boolean) : undefined);
  const data = clean({
    doNotCall: l.DoNotCall || undefined,
    industry: sel(pm.industry, l.Industry),
    website: l.Website ? { primaryLinkUrl: url(l.Website) } : undefined,
    accountNotes: l.Account_Notes__c,
    disqualifiedReasonOther: l.Disqualified_Reason_Other__c,
    invoicePlatforms: multi(l.Do_you_use_any_of_these_invoice_platform__c),
    lostReasonsOther: l.Lost_Reasons_Other__c,
    partnerAgentId: l.Partner_Agent_ID__c,
    partnerSource: l.Partner_Source__c,
    primaryPartnerAffiliation: sel(pm.primaryPartnerAffiliation, l.Primary_Partner_Affiliation__c),
    promoCode: l.Promo_Code__c,
    renurtureDate: day(l.Renurture_Date__c),
    renurtureReasonOther: l.Renurture_Reason_Other__c,
  });
  if (!Object.keys(data).length) continue;
  const r = await gql('mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }',
    { id: p.id, data });
  if (r?.data?.updatePerson?.id) pUpd++;
  else console.error('person enrich fail:', p.sfLeadId, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160));
  await sleep(650);
}
console.log(`people enriched: ${pUpd}`);

// ---- 3. enrich termSheets ----
const parseCurrency = (s) => {
  const m = /\$?\s*([\d,]+(?:\.\d+)?)\s*(USD|CAD)?/i.exec(s || '');
  if (!m) return undefined;
  return { amountMicros: Math.round(parseFloat(m[1].replace(/,/g, '')) * 1e6), currencyCode: (m[2] || 'USD').toUpperCase() };
};
const tRes = await gql('{ termSheets(first: 60) { edges { node { id name } } } }');
let tUpd = 0;
for (const t of tRes.data.termSheets.edges.map((e) => e.node)) {
  const client = t.name.replace('Facility Terms — ', '');
  const row = auditRows.find((r) => (r[0] || '').toLowerCase() === client.toLowerCase());
  if (!row) { console.warn('no audit row for', client); continue; }
  const data = clean({
    documentLink: row[5]?.startsWith('http') ? { primaryLinkUrl: row[5], primaryLinkLabel: 'Source doc' } : undefined,
    facilityFeeCharged: parseCurrency(row[7]),
    notes: row[16] ? { markdown: row[16], blocknote: '' } : undefined,
  });
  if (!Object.keys(data).length) continue;
  const r = await gql('mutation U($id: UUID!, $data: TermSheetUpdateInput!) { updateTermSheet(id: $id, data: $data) { id } }',
    { id: t.id, data });
  if (r?.data?.updateTermSheet?.id) tUpd++;
  else console.error('termsheet enrich fail:', client, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160));
  await sleep(650);
}
console.log(`termSheets enriched: ${tUpd}`);

// ---- 4. task/note morph targets ----
const taskCompany = {
  'Payor reachout: Starbucks': 'amtrend corporation',
  'Payor reachout: Marriott': 'amtrend corporation',
  'Payor reachout: US Air Force (prime contractor)': 'skydweller us inc',
  'Payor reachout: HCA Healthcare': 'stat inc.',
  'Payor reachout: Union Pacific': 'navigator srt, llc',
};
const tk = await gql('{ tasks(first: 30) { edges { node { id title taskTargets { edges { node { id } } } } } } }');
let ttC = 0;
for (const t of tk.data.tasks.edges.map((e) => e.node)) {
  if (t.taskTargets.edges.length) continue;
  const cid = companyByName[taskCompany[t.title]];
  if (!cid) { console.warn('no company for task', t.title); continue; }
  const r = await gql('mutation TT($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }',
    { data: { taskId: t.id, targetCompanyId: cid } });
  if (r?.data?.createTaskTarget?.id) ttC++;
  else console.error('taskTarget fail:', t.title, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160));
  await sleep(650);
}
console.log(`taskTargets created: ${ttC}`);

const noteCompany = {
  'Facility fee audit — CONFLICT': 'skydweller us inc',
  'Minimum balance covenant NOT MET': 'stat inc.',
};
const nt = await gql('{ notes(first: 30) { edges { node { id title noteTargets { edges { node { id } } } } } } }');
let ntC = 0;
for (const n of nt.data.notes.edges.map((e) => e.node)) {
  if (n.noteTargets.edges.length) continue;
  const cid = companyByName[noteCompany[n.title]];
  if (!cid) { console.warn('no company for note', n.title); continue; }
  const r = await gql('mutation NT($data: NoteTargetCreateInput!) { createNoteTarget(data: $data) { id } }',
    { data: { noteId: n.id, targetCompanyId: cid } });
  if (r?.data?.createNoteTarget?.id) ntC++;
  else console.error('noteTarget fail:', n.title, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160));
  await sleep(650);
}
console.log(`noteTargets created: ${ntC}`);
console.log('ENRICH COMPLETE');
