// DEMO SEED — curated, presentation-ready dataset:
//  ~21 funded clients (all with PRO companyId) + their real leads + stage-filler
//  leads (10 of 11 kanban stages) + 24 TermSheets from the Facility-Fee Audit +
//  payor-reachout Tasks + Notes.
// Run AFTER wipe-records; idempotent by sfClientId/sfLeadId.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:2020';
const API_KEY = process.env.TWENTY_API_KEY ??
  JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.local.apiKey;
const valueMaps = JSON.parse(readFileSync(join(HERE, 'value-maps.json'), 'utf8'));
const mapSel = (obj, field, label) => (label && valueMaps[obj]?.[field]?.[label]) || undefined;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gql(query, variables, attempt = 1) {
  const res = await fetch(`${API_URL}/graphql`, {
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
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const jsonl = (f) => readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const DATA = process.env.DEMO_DATA_DIR; // scratchpad dir with demo-*.jsonl + audit-rows.json
const auditClients = jsonl(join(DATA, 'demo-audit-clients.jsonl'));
const auditLeads = jsonl(join(DATA, 'demo-audit-leads.jsonl'));
const extraLeads = jsonl(join(DATA, 'demo-extra-leads.jsonl'));
const recentLeads = jsonl(join(HERE, 'data', 'seed-leads.jsonl'));
const auditRows = JSON.parse(readFileSync(join(DATA, 'audit-rows.json'), 'utf8'));

// ---- dedupe clients by company name, prefer Funded ----
const byName = {};
for (const c of auditClients) {
  const key = (c.Company_Name__c || c.Name).toLowerCase();
  if (!byName[key] || c.Application_Status__c === 'Funded') byName[key] = c;
}
const clients = Object.values(byName);

const normPhone = (raw) => {
  if (!raw) return undefined;
  let d = raw.replace(/[^+\d]/g, '');
  if (!d.startsWith('+')) {
    if (d.length === 10) d = '+1' + d;
    else if (d.length === 11 && d.startsWith('1')) d = '+' + d;
    else return undefined;
  }
  return { primaryPhoneNumber: d };
};

const leadData = (l) => clean({
  name: clean({ firstName: l.FirstName || '-', lastName: l.LastName || '-' }),
  emails: l.Email ? { primaryEmail: l.Email } : undefined,
  phones: normPhone(l.Phone),
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
  companyName: l.Company,
  hotList: l.Hot_list__c ?? undefined,
  desiredFundingAmount: l.Desired_Funding_Amount__c ?? undefined,
  partnerSource: l.Partner_Source__c,
  sfLeadId: l.Id,
  sfContactId: l.ConvertedContactId,
});

// currency parser: "$60,000 USD" -> {amountMicros, currencyCode}
const parseCurrency = (s) => {
  const m = (s || '').match(/\$([\d,]+)\s*(USD|CAD)/);
  if (!m) return undefined;
  return { amountMicros: String(Number(m[1].replace(/,/g, '')) * 1_000_000), currencyCode: m[2] };
};
const bucketValue = (letter) => {
  const map = valueMaps.termSheet?.disclosureBucket ?? {};
  const label = Object.keys(map).find((k) => k.startsWith(letter + ' '));
  return label ? map[label] : undefined;
};
const matchValue = (s) => {
  const map = valueMaps.termSheet?.disclosureChargeMatch ?? {};
  if (/CONFLICT|MISMATCH/i.test(s)) return map['Conflict'];
  if (/^Match|^Partial|^Weak match/i.test(s)) return map['Match'];
  return map['None'];
};
const confValue = (s) => valueMaps.termSheet?.auditConfidence?.[s] ?? undefined;
const metValue = (s) => {
  const map = valueMaps.termSheet?.minRequirementMet ?? {};
  if (/NOT MET/i.test(s)) return map['Not Met'];
  if (/^Met/i.test(s)) return map['Met'];
  if (/Review/i.test(s)) return map['Review'];
  return map['N/A'];
};
const statusValue = (docCol) => {
  const map = valueMaps.termSheet?.status ?? {};
  return /SIGNED/i.test(docCol || '') ? map['Signed'] : map['Sent'];
};

async function main() {
  console.log(`DEMO SEED: ${clients.length} companies, ${auditLeads.length + extraLeads.length}+ leads, ${auditRows.length} audit rows`);

  // ---- Companies ----
  const companyBySfId = {}; const companyByName = {};
  for (const c of clients) {
    const name = c.Company_Name__c || c.Name;
    const data = clean({
      name,
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
    const r = await gql('mutation C($data: CompanyCreateInput!) { createCompany(data: $data) { id } }', { data });
    const id = r?.data?.createCompany?.id;
    if (id) { companyBySfId[c.Id] = id; companyByName[name.toLowerCase()] = id; }
    else console.error('company fail:', name, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 150));
    await sleep(650);
  }
  console.log(`companies: ${Object.keys(companyBySfId).length}`);

  // ---- People ----
  // stage-diverse selection from recent leads: 2 per stage w/ reasons populated
  const wantStages = ['New Sign up', 'Reached Out', 'Credit Clearance', 'Renurture', 'Closed Lost', 'Disqualified'];
  const picked = [];
  for (const st of wantStages) {
    const pool = recentLeads.filter((l) => l.Status === st && l.Email)
      .sort((a, b) => (b.Disqualified_Reason__c || b.Lost_Reason__c || b.Renurture_Reason__c ? 1 : 0) - (a.Disqualified_Reason__c || a.Lost_Reason__c || a.Renurture_Reason__c ? 1 : 0));
    picked.push(...pool.slice(0, 2));
  }
  const allLeads = [...auditLeads, ...extraLeads, ...picked];
  const seenEmail = new Set(); let pC = 0;
  for (const l of allLeads) {
    if (l.Email && seenEmail.has(l.Email)) continue;
    if (l.Email) seenEmail.add(l.Email);
    const data = leadData(l);
    const cid = companyBySfId[l.Client_LKP__c];
    if (cid) data.company = { connect: { id: cid } };
    const r = await gql('mutation P($data: PersonCreateInput!) { createPerson(data: $data) { id } }', { data });
    if (r?.data?.createPerson?.id) pC++;
    else console.error('person fail:', l.Email, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 150));
    await sleep(650);
  }
  console.log(`people: ${pC}`);

  // ---- TermSheets from audit rows ----
  let tC = 0;
  for (const row of auditRows) {
    const [client, onboard, bucket, quote, sourceDoc, link, chargedNote, chargedAmt, match, conf, , , , minReq, , met, notes] = row;
    const cid = companyByName[(client || '').toLowerCase()];
    if (!cid) continue; // only for seeded companies
    const data = clean({
      name: `Facility Terms — ${client}`,
      status: statusValue(sourceDoc),
      onboardDate: onboard,
      disclosureBucket: bucketValue(bucket),
      facilityFeeQuote: (quote || '').slice(0, 500),
      disclosureSourceDoc: sourceDoc,
      documentLink: link && link.startsWith('http') ? { primaryLinkUrl: link, primaryLinkLabel: 'Source doc' } : undefined,
      facilityFeeCharged: parseCurrency(chargedAmt),
      facilityFeeChargedNote: chargedNote,
      disclosureChargeMatch: matchValue(match || ''),
      auditConfidence: confValue(conf),
      minRequirement: minReq,
      minRequirementMet: metValue(met || ''),
      notes: notes ? { markdown: notes, blocknote: '' } : undefined,
      company: { connect: { id: cid } },
    });
    const r = await gql('mutation T($data: TermSheetCreateInput!) { createTermSheet(data: $data) { id } }', { data });
    if (r?.data?.createTermSheet?.id) tC++;
    else console.error('termsheet fail:', client, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 200));
    await sleep(650);
  }
  console.log(`termSheets: ${tC}`);

  // ---- Payor-reachout Tasks (the agreed interim convention) ----
  const reachouts = [
    ['Amtrend Corporation', 'Starbucks', '$450,000', '2026-08-15'],
    ['Amtrend Corporation', 'Marriott', '$300,000', '2026-08-30'],
    ['Skydweller Us Inc', 'US Air Force (prime contractor)', '$1,200,000', '2026-09-15'],
    ['Stat Inc.', 'HCA Healthcare', '$250,000', '2026-08-01'],
    ['Navigator Srt, Llc', 'Union Pacific', '$500,000', '2026-09-01'],
  ];
  let taskC = 0;
  for (const [companyName, payor, size, close] of reachouts) {
    const cid = companyByName[companyName.toLowerCase()];
    if (!cid) continue;
    const r = await gql('mutation T($data: TaskCreateInput!) { createTask(data: $data) { id } }', {
      data: {
        title: `Payor reachout: ${payor}`,
        bodyV2: { markdown: `**Opportunity size:** ${size}\n**Expected close:** ${close}\n\nNew payor not yet in production — working setup with the client.`, blocknote: '' },
        status: 'TODO',
        dueAt: `${close}T17:00:00.000Z`,
      },
    });
    const tid = r?.data?.createTask?.id;
    if (tid) {
      await sleep(650);
      await gql('mutation TT($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }', { data: { taskId: tid, companyId: cid } });
      taskC++;
    }
    await sleep(650);
  }
  console.log(`payor-reachout tasks: ${taskC}`);

  // ---- Notes on headline companies ----
  const notes = [
    ['Skydweller Us Inc', 'Facility fee audit — CONFLICT', 'Signed TS states 1.5% fee with NO cadence; framed one-time in Slack but charged again on facility increases. $60k USD charged. Escalated in the disclosure audit (Callout #2).'],
    ['Stat Inc.', 'Minimum balance covenant NOT MET', 'Signed ARPSA amendment 3.4 requires $750k min avg monthly balance; running ~$122k. Also charged $7.5k vs $15k disclosed facility fee. Top risk from the audit.'],
  ];
  let nC = 0;
  for (const [companyName, title, body] of notes) {
    const cid = companyByName[companyName.toLowerCase()];
    if (!cid) continue;
    const r = await gql('mutation N($data: NoteCreateInput!) { createNote(data: $data) { id } }', {
      data: { title, bodyV2: { markdown: body, blocknote: '' } },
    });
    const nid = r?.data?.createNote?.id;
    if (nid) {
      await sleep(650);
      await gql('mutation NT($data: NoteTargetCreateInput!) { createNoteTarget(data: $data) { id } }', { data: { noteId: nid, companyId: cid } });
      nC++;
    }
    await sleep(650);
  }
  console.log(`notes: ${nC}`);
  console.log('DEMO SEED COMPLETE');
}

main().catch((e) => { console.error(e); process.exit(1); });
