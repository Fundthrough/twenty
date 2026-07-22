#!/usr/bin/env node
// Full paginated HubSpot → Twenty import (replaces seed.mjs).
//
// Usage:
//   HUBSPOT_PAT=$HUBSPOT_PAT TWENTY_API_KEY=$TWENTY_BO_API_KEY \
//   TWENTY_API_URL=https://fundthrough-uz0tn18a.twenty.com \
//   node scripts/import.mjs [options]
//
// Options:
//   --dry-run           Print what would be imported, no writes to Twenty
//   --object=companies  Import only one object type (companies|contacts|deals)
//   --limit=50          Cap records per object (useful for testing)

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const HUBSPOT_PAT = process.env.HUBSPOT_PAT;
const TWENTY_API_KEY = process.env.TWENTY_API_KEY;
const TWENTY_API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:2020';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const OBJECT_FILTER = args.find((a) => a.startsWith('--object='))?.split('=')[1];
const LIMIT = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10) || Infinity;

if (!HUBSPOT_PAT) {
  console.error('Error: HUBSPOT_PAT is not set.');
  process.exit(1);
}
if (!TWENTY_API_KEY) {
  console.error('Error: TWENTY_API_KEY is not set.');
  process.exit(1);
}

if (DRY_RUN) console.log('🔍 DRY RUN — no records will be written to Twenty\n');

const HS_BASE = 'https://api.hubapi.com';
const HS_HEADERS = { Authorization: `Bearer ${HUBSPOT_PAT}`, 'Content-Type': 'application/json' };
const TW_HEADERS = { Authorization: `Bearer ${TWENTY_API_KEY}`, 'Content-Type': 'application/json' };

// ── HubSpot helpers ───────────────────────────────────────────────────────────

async function hsFetch(path) {
  const res = await fetch(`${HS_BASE}${path}`, { headers: HS_HEADERS });
  if (!res.ok) throw new Error(`HubSpot ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchAllHubSpot(objectType, properties, batchSize = 100) {
  const records = [];
  let after = undefined;
  const propsParam = properties.join(',');
  const assocParam = ['contacts', 'deals', 'tasks', 'notes', 'meetings'].includes(objectType) ? '&associations=companies,contacts' : '';

  while (records.length < LIMIT) {
    const cursorParam = after ? `&after=${after}` : '';
    const data = await hsFetch(
      `/crm/v3/objects/${objectType}?limit=${Math.min(batchSize, LIMIT - records.length)}&properties=${propsParam}${assocParam}${cursorParam}`
    );

    records.push(...(data.results ?? []));
    process.stdout.write(`  fetched ${records.length}...\r`);

    if (!data.paging?.next?.after || records.length >= LIMIT) break;
    after = data.paging.next.after;
  }

  console.log(`  fetched ${records.length} ${objectType}`);
  return records;
}

// ── Twenty helpers ─────────────────────────────────────────────────────────────

const DELAY_MS = 650; // ~90 requests/min stays under 100/min rate limit
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gql(query, variables = {}) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`${TWENTY_API_URL}/graphql`, {
      method: 'POST',
      headers: TW_HEADERS,
      body: JSON.stringify({ query, variables }),
    });

    const text = await res.text();

    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      await sleep(2000 * attempt);
      continue;
    }

    const json = JSON.parse(text);

    // Rate limit — wait 60s and retry
    if (json.errors?.[0]?.message?.includes('Limit reached')) {
      console.log(`\n  ⏳ Rate limited — waiting 62s...`);
      await sleep(62000);
      continue;
    }

    if (json.errors?.length) throw new Error(`GraphQL: ${json.errors[0].message}`);
    return json.data;
  }
  throw new Error('Max retries exceeded');
}

function isDuplicateError(e) {
  return e.message?.toLowerCase().includes('duplicate');
}

// ── Value converters ───────────────────────────────────────────────────────────

const STAGE_MAP = {
  appointmentscheduled: 'APPOINTMENT_SCHEDULED',
  qualifiedtobuy: 'QUALIFIED_TO_BUY',
  presentationscheduled: 'PRESENTATION_SCHEDULED',
  decisionmakerboughtin: 'DECISION_MAKER_BOUGHT_IN',
  contractsent: 'CONTRACT_SENT',
  closedwon: 'CLOSED_WON',
  closedlost: 'CLOSED_LOST',
  '1268133602': 'KEEP_WARM',
  '1277000404': 'DISQUALIFIED',
};

const LIFECYCLE_MAP = {
  subscriber: 'SUBSCRIBER', lead: 'LEAD',
  marketingqualifiedlead: 'MARKETING_QUALIFIED_LEAD',
  salesqualifiedlead: 'SALES_QUALIFIED_LEAD',
  opportunity: 'OPPORTUNITY', customer: 'CUSTOMER',
  evangelist: 'EVANGELIST', other: 'OTHER',
};

const LEAD_STATUS_MAP = {
  new: 'NEW', open: 'OPEN', 'in progress': 'IN_PROGRESS',
  'open deal': 'OPEN_DEAL', unqualified: 'UNQUALIFIED',
  'attempted to contact': 'ATTEMPTED_TO_CONTACT',
  connected: 'CONNECTED', 'bad timing': 'BAD_TIMING',
};

const INDUSTRY_MAP = {
  technology: 'TECHNOLOGY', financial_services: 'FINANCIAL_SERVICES',
  healthcare: 'HEALTHCARE', manufacturing: 'MANUFACTURING',
  retail: 'RETAIL', real_estate: 'REAL_ESTATE',
  education: 'EDUCATION', consulting: 'CONSULTING',
};

const INVOICE_FINANCING_MAP = { true: 'YES', false: 'NO', yes: 'YES', no: 'NO' };

function mapStage(id) { return STAGE_MAP[id?.toLowerCase()] ?? 'APPOINTMENT_SCHEDULED'; }
function mapLifecycle(v) { return LIFECYCLE_MAP[v?.toLowerCase()] ?? null; }
function mapLeadStatus(v) { return LEAD_STATUS_MAP[v?.toLowerCase()] ?? null; }
function mapIndustry(v) {
  if (!v) return null;
  const k = v.toLowerCase().replace(/[^a-z0-9]/g, '_');
  for (const [key, val] of Object.entries(INDUSTRY_MAP)) {
    if (k.includes(key)) return val;
  }
  return 'OTHER';
}
function mapInvoiceFinancing(v) { return INVOICE_FINANCING_MAP[v?.toString().toLowerCase()] ?? null; }
function toMicros(v) {
  const n = Number(v);
  return isNaN(n) || n === 0 ? null : String(Math.round(n * 1_000_000));
}
function mapPriority(v) {
  if (!v) return null;
  const m = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
  return m[v.toLowerCase()] ?? null;
}
function mapIcpTier(v) {
  if (!v) return null;
  const m = { tier_1: 'TIER_1', 'tier 1': 'TIER_1', tier1: 'TIER_1',
               tier_2: 'TIER_2', 'tier 2': 'TIER_2', tier2: 'TIER_2',
               tier_3: 'TIER_3', 'tier 3': 'TIER_3', tier3: 'TIER_3', none: 'NONE' };
  return m[v.toLowerCase()] ?? null;
}
function mapCompanyType(v) {
  if (!v) return null;
  const m = { prospect: 'PROSPECT', partner: 'PARTNER', reseller: 'RESELLER',
               vendor: 'VENDOR', other: 'OTHER' };
  return m[v.toLowerCase()] ?? null;
}
function mapCsmSentiment(v) {
  if (!v) return null;
  const m = { good: 'GOOD', neutral: 'NEUTRAL', bad: 'BAD', at_risk: 'AT_RISK', 'at risk': 'AT_RISK' };
  return m[v.toLowerCase()] ?? null;
}
function mapBuyingRole(v) {
  if (!v) return null;
  const m = { 'decision maker': 'DECISION_MAKER', decision_maker: 'DECISION_MAKER',
               champion: 'CHAMPION', 'economic buyer': 'ECONOMIC_BUYER', economic_buyer: 'ECONOMIC_BUYER',
               'end user': 'END_USER', end_user: 'END_USER',
               influencer: 'INFLUENCER', other: 'OTHER' };
  return m[v.toLowerCase()] ?? null;
}
function mapSeniority(v) {
  if (!v) return null;
  const m = { 'c-suite': 'C_SUITE', csuite: 'C_SUITE', c_suite: 'C_SUITE',
               vp: 'VP', director: 'DIRECTOR', manager: 'MANAGER',
               'individual contributor': 'INDIVIDUAL_CONTRIBUTOR',
               individual_contributor: 'INDIVIDUAL_CONTRIBUTOR', other: 'OTHER' };
  return m[v.toLowerCase()] ?? null;
}
function mapPartnerTechWin(v) {
  if (!v) return null;
  const m = { yes: 'YES', no: 'NO', true: 'YES', false: 'NO', 'in progress': 'IN_PROGRESS' };
  return m[v.toLowerCase()] ?? null;
}
function mapTaskStatus(v) {
  if (!v) return 'TODO';
  const m = {
    not_started: 'TODO', completed: 'DONE', in_progress: 'IN_PROGRESS',
    waiting: 'IN_PROGRESS', deferred: 'TODO',
  };
  return m[v.toLowerCase()] ?? 'TODO';
}
function mapTaskType(v) {
  if (!v) return null;
  const m = { todo: 'TODO', call: 'CALL', email: 'EMAIL' };
  return m[v.toLowerCase()] ?? 'TODO';
}

// ── Import: Companies ─────────────────────────────────────────────────────────

async function importCompanies() {
  console.log('\n📦 Companies');
  const records = await fetchAllHubSpot('companies', [
    'name', 'domain', 'website', 'industry', 'annualrevenue', 'numberofemployees',
    'lifecyclestage', 'has_invoice_financing_solution', 'phone', 'city', 'country',
    'state', 'zip', 'address', 'description', 'founded_year', 'type',
    'hs_object_id', 'hs_ideal_customer_profile', 'hs_is_target_account',
    'hs_lead_status', 'hs_csm_sentiment', 'linkedin_company_page', 'hs_linkedin_handle',
  ]);

  const idMap = {}; // hsObjectId → twenty company id
  let created = 0, skipped = 0, errors = 0;

  const CREATE_CO = `mutation CreateCompany($data: CompanyCreateInput!) { createCompany(data: $data) { id } }`;

  for (const r of records) {
    const p = r.properties;
    if (!p.name) { skipped++; continue; }

    const linkedinUrl = p.linkedin_company_page?.trim() || (p.hs_linkedin_handle ? `https://www.linkedin.com/company/${p.hs_linkedin_handle}` : null) || null;
    const domainUrl = p.domain ? (p.domain.startsWith('http') ? p.domain : `https://${p.domain}`) : null;
    const arrMicros = toMicros(p.annualrevenue);

    // Build data WITHOUT domainName first (avoids unique constraint failures)
    const baseData = {
      name: p.name,
      ...(linkedinUrl && { linkedinLink: { primaryLinkUrl: linkedinUrl, primaryLinkLabel: 'LinkedIn' } }),
      ...(mapIndustry(p.industry) && { hsIndustry: mapIndustry(p.industry) }),
      ...(p.numberofemployees && { hsNumberOfEmployees: Number(p.numberofemployees) }),
      ...(mapLifecycle(p.lifecyclestage) && { hsLifecycleStage: mapLifecycle(p.lifecyclestage) }),
      ...(mapInvoiceFinancing(p.has_invoice_financing_solution) && { hasInvoiceFinancingSolution: mapInvoiceFinancing(p.has_invoice_financing_solution) }),
      ...(p.hs_object_id && { hsHubspotId: p.hs_object_id }),
      ...(arrMicros && { annualRevenue: { amountMicros: arrMicros, currencyCode: 'CAD' } }),
      // Location
      ...(p.phone && { hsPhone: { primaryPhoneNumber: p.phone, primaryPhoneCountryCode: 'US' } }),
      ...(p.city && { hsCity: p.city }),
      ...(p.country && { hsCountry: p.country }),
      ...(p.state && { hsState: p.state }),
      ...(p.zip && { hsZip: p.zip }),
      ...(p.address && { hsStreetAddress: p.address }),
      // Descriptive
      ...(p.description && { hsDescription: { markdown: p.description, blocknote: '' } }),
      ...(p.founded_year && { hsFounded: p.founded_year }),
      // Classification
      ...(mapIcpTier(p.hs_ideal_customer_profile) && { hsIcpTier: mapIcpTier(p.hs_ideal_customer_profile) }),
      ...(p.hs_is_target_account === 'true' && { hsIsTargetAccount: true }),
      ...(mapLeadStatus(p.hs_lead_status) && { hsCompanyLeadStatus: mapLeadStatus(p.hs_lead_status) }),
      ...(mapCsmSentiment(p.hs_csm_sentiment) && { hsCsmSentiment: mapCsmSentiment(p.hs_csm_sentiment) }),
      ...(mapCompanyType(p.type) && { hsCompanyType: mapCompanyType(p.type) }),
    };

    if (DRY_RUN) {
      idMap[p.hs_object_id] = `dry-run-${p.hs_object_id}`;
      created++;
      continue;
    }

    try {
      // Try with domainName first
      const data = { ...baseData, ...(domainUrl && { domainName: { primaryLinkUrl: domainUrl, primaryLinkLabel: '' } }) };
      const res = await gql(CREATE_CO, { data });
      idMap[p.hs_object_id] = res.createCompany.id;
      created++;
      process.stdout.write(`  ✓ ${created}\r`);
      await sleep(DELAY_MS);
    } catch (e) {
      if (isDuplicateError(e)) {
        // Domain conflict: retry without domainName — still capture all other fields
        try {
          const res = await gql(CREATE_CO, { data: baseData });
          idMap[p.hs_object_id] = res.createCompany.id;
          created++;
          process.stdout.write(`  ✓ ${created}(no-domain)\r`);
          await sleep(DELAY_MS);
        } catch (e2) {
          if (isDuplicateError(e2)) { skipped++; }
          else { errors++; if (errors <= 3) console.error(`\n  ✗ ${p.name}: ${e2.message}`); }
        }
      } else {
        errors++;
        if (errors <= 3) console.error(`\n  ✗ ${p.name}: ${e.message}`);
      }
    }
  }

  console.log(`  ✓ created: ${created}  skipped: ${skipped}  errors: ${errors}`);
  return idMap;
}

// ── Import: Contacts ──────────────────────────────────────────────────────────

async function importContacts(companyIdMap) {
  console.log('\n👤 Contacts');
  const records = await fetchAllHubSpot('contacts', [
    'firstname', 'lastname', 'email', 'phone', 'mobilephone', 'jobtitle',
    'lifecyclestage', 'hs_lead_status', 'hs_object_id', 'associatedcompanyid',
    'city', 'country', 'state', 'zip',
    'hs_buying_role', 'hs_seniority', 'seniority',
    'linkedin_account', 'hs_linkedin_url',
  ]);

  const idMap = {};
  let created = 0, skipped = 0, errors = 0;

  for (const r of records) {
    const p = r.properties;
    if (!p.firstname && !p.lastname) { skipped++; continue; }

    if (!DRY_RUN && !p.email && !p.firstname && !p.lastname) { skipped++; continue; }

    const hsCompanyId = p.associatedcompanyid
      ?? r.associations?.companies?.results?.[0]?.id;
    const twentyCompanyId = hsCompanyId ? companyIdMap[hsCompanyId] : undefined;

    const linkedinUrl = p.hs_linkedin_url || p.linkedin_account || null;

    const data = {
      name: { firstName: p.firstname ?? '', lastName: p.lastname ?? '' },
      ...(p.email && { emails: { primaryEmail: p.email } }),
      ...(p.phone && { phones: { primaryPhoneNumber: p.phone, primaryPhoneCountryCode: 'US' } }),
      ...(p.jobtitle && { jobTitle: p.jobtitle }),
      ...(linkedinUrl && { linkedinLink: { primaryLinkUrl: linkedinUrl, primaryLinkLabel: 'LinkedIn' } }),
      ...(mapLifecycle(p.lifecyclestage) && { hsLifecycleStage: mapLifecycle(p.lifecyclestage) }),
      ...(mapLeadStatus(p.hs_lead_status) && { hsLeadStatus: mapLeadStatus(p.hs_lead_status) }),
      ...(p.hs_object_id && { hsHubspotId: p.hs_object_id }),
      ...(twentyCompanyId && !twentyCompanyId.startsWith('dry') && { companyId: twentyCompanyId }),
      // New fields
      ...(p.mobilephone && { hsMobilePhone: p.mobilephone }),
      ...(p.city && { hsCity: p.city }),
      ...(p.country && { hsCountry: p.country }),
      ...(p.state && { hsState: p.state }),
      ...(mapBuyingRole(p.hs_buying_role) && { hsBuyingRole: mapBuyingRole(p.hs_buying_role) }),
      ...(mapSeniority(p.hs_seniority || p.seniority) && { hsSeniority: mapSeniority(p.hs_seniority || p.seniority) }),
    };

    if (DRY_RUN) { idMap[p.hs_object_id] = `dry-run-${p.hs_object_id}`; created++; continue; }

    try {
      const res = await gql(`mutation CreatePerson($data: PersonCreateInput!) { createPerson(data: $data) { id } }`, { data });
      idMap[p.hs_object_id] = res.createPerson.id;
      created++;
      process.stdout.write(`  ✓ ${created}\r`);
      await sleep(DELAY_MS);
    } catch (e) {
      if (isDuplicateError(e)) { skipped++; }
      else { errors++; if (errors <= 3) console.error(`\n  ✗ ${p.firstname} ${p.lastname}: ${e.message}`); }
    }
  }

  console.log(`  ✓ created: ${created}  skipped: ${skipped}  errors: ${errors}`);
  return idMap;
}

// ── Import: Deals ─────────────────────────────────────────────────────────────

async function importDeals(companyIdMap, contactIdMap) {
  console.log('\n💰 Deals');
  const records = await fetchAllHubSpot('deals', [
    'dealname', 'amount', 'dealstage', 'closedate', 'dealtype', 'pipeline',
    'hs_next_step', 'hs_priority', 'hs_deal_score', 'description',
    'deal_currency_code', 'hs_object_id', 'associatedcompanyid',
    'closed_lost_reason', 'closed_won_reason', 'hs_deal_stage_probability',
    'hs_partner_tech_win', 'hs_next_meeting_name', 'hs_arr', 'hs_mrr',
  ]);

  let created = 0, skipped = 0, errors = 0;

  for (const r of records) {
    const p = r.properties;
    if (!p.dealname) { skipped++; continue; }

    const hsCompanyId = p.associatedcompanyid
      ?? r.associations?.companies?.results?.[0]?.id;
    const twentyCompanyId = hsCompanyId ? companyIdMap[hsCompanyId] : undefined;
    const hsContactId = r.associations?.contacts?.results?.[0]?.id;
    const twentyContactId = hsContactId ? contactIdMap?.[hsContactId] : undefined;
    const amountMicros = toMicros(p.amount);
    const priority = mapPriority(p.hs_priority);

    const data = {
      name: p.dealname,
      stage: mapStage(p.dealstage),
      ...(amountMicros && { amount: { amountMicros, currencyCode: p.deal_currency_code ?? 'CAD' } }),
      ...(p.closedate && { closeDate: p.closedate.split('T')[0] }),
      ...(p.dealtype && {
        dealType: p.dealtype === 'newbusiness' ? 'NEW_BUSINESS'
          : p.dealtype === 'existingbusiness' ? 'EXISTING_BUSINESS' : null,
      }),
      ...(p.hs_next_step && { nextStep: p.hs_next_step }),
      ...(priority && { priority }),
      ...(p.hs_deal_score && { dealScore: Number(p.hs_deal_score) }),
      ...(twentyCompanyId && !twentyCompanyId.startsWith('dry') && { primaryCompany: { connect: { id: twentyCompanyId } } }),
      ...(twentyContactId && !twentyContactId.startsWith('dry') && { primaryContact: { connect: { id: twentyContactId } } }),
      // New fields
      ...(p.closed_lost_reason && { closedLostReason: p.closed_lost_reason }),
      ...(p.closed_won_reason && { closedWonReason: p.closed_won_reason }),
      ...(p.hs_deal_stage_probability && { dealProbability: Number(p.hs_deal_stage_probability) }),
      ...(mapPartnerTechWin(p.hs_partner_tech_win) && { partnerTechWin: mapPartnerTechWin(p.hs_partner_tech_win) }),
      ...(p.hs_next_meeting_name && { nextMeetingName: p.hs_next_meeting_name }),
      ...(toMicros(p.hs_arr) && { arr: { amountMicros: toMicros(p.hs_arr), currencyCode: 'CAD' } }),
      ...(toMicros(p.hs_mrr) && { mrr: { amountMicros: toMicros(p.hs_mrr), currencyCode: 'CAD' } }),
    };

    // Remove null values
    Object.keys(data).forEach((k) => { if (data[k] === null) delete data[k]; });

    if (DRY_RUN) { created++; continue; }

    try {
      await gql(`mutation CreateHsPartnerDeal($data: HsPartnerDealCreateInput!) { createHsPartnerDeal(data: $data) { id } }`, { data });
      created++;
      process.stdout.write(`  ✓ ${created}\r`);
      await sleep(DELAY_MS);
    } catch (e) {
      if (isDuplicateError(e)) { skipped++; }
      else { errors++; if (errors <= 3) console.error(`\n  ✗ ${p.dealname}: ${e.message}`); }
    }
  }

  console.log(`  ✓ created: ${created}  skipped: ${skipped}  errors: ${errors}`);
}

// ── Import: Tasks ─────────────────────────────────────────────────────────────

async function importTasks(companyIdMap, contactIdMap) {
  console.log('\n📋 Tasks');
  const records = await fetchAllHubSpot('tasks', [
    'hs_task_subject', 'hs_task_status', 'hs_task_type', 'hs_task_priority',
    'hs_task_body', 'hs_timestamp', 'hs_object_id',
  ]);

  let created = 0, skipped = 0, errors = 0;
  const CREATE_TASK = `mutation CreateTask($data: TaskCreateInput!) { createTask(data: $data) { id } }`;
  const CREATE_TARGET = `mutation CreateTarget($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }`;

  for (const r of records) {
    const p = r.properties;
    if (!p.hs_task_subject) { skipped++; continue; }

    const hsCompanyId = r.associations?.companies?.results?.[0]?.id;
    const hsContactId = r.associations?.contacts?.results?.[0]?.id;
    const twCompanyId = hsCompanyId ? companyIdMap[hsCompanyId] : undefined;
    const twContactId = hsContactId ? contactIdMap?.[hsContactId] : undefined;

    const data = {
      title: p.hs_task_subject,
      status: mapTaskStatus(p.hs_task_status),
      ...(p.hs_timestamp && { dueAt: p.hs_timestamp }),
      ...(p.hs_task_body && { bodyV2: { markdown: p.hs_task_body, blocknote: '' } }),
      ...(p.hs_object_id && { hsHubspotId: p.hs_object_id }),
      ...(mapTaskType(p.hs_task_type) && { hsTaskType: mapTaskType(p.hs_task_type) }),
    };

    if (DRY_RUN) { created++; continue; }

    try {
      const res = await gql(CREATE_TASK, { data });
      const taskId = res.createTask.id;
      created++;
      process.stdout.write(`  ✓ ${created}\r`);
      await sleep(DELAY_MS);

      // Link to company via taskTarget (field is targetCompanyId, not companyId)
      if (twCompanyId && !twCompanyId.startsWith('dry')) {
        await gql(CREATE_TARGET, { data: { taskId, targetCompanyId: twCompanyId } }).catch(e => {
          if (e.message && !e.message.includes('duplicate')) console.error('  target err:', e.message);
        });
        await sleep(DELAY_MS);
      }
      // Link to contact via taskTarget (field is targetPersonId, not personId)
      if (twContactId && !twContactId.startsWith('dry')) {
        await gql(CREATE_TARGET, { data: { taskId, targetPersonId: twContactId } }).catch(e => {
          if (e.message && !e.message.includes('duplicate')) console.error('  target err:', e.message);
        });
        await sleep(DELAY_MS);
      }
    } catch (e) {
      if (isDuplicateError(e)) { skipped++; }
      else { errors++; if (errors <= 3) console.error(`\n  ✗ ${p.hs_task_subject}: ${e.message}`); }
    }
  }

  console.log(`  ✓ created: ${created}  skipped: ${skipped}  errors: ${errors}`);
}

// ── Import: Notes & Meetings ──────────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toISOString().split('T')[0];
}

async function importNotesAndMeetings(companyIdMap, contactIdMap) {
  console.log('\n📝 Notes & Meetings');
  const CREATE_NOTE = `mutation CreateNote($data: NoteCreateInput!) { createNote(data: $data) { id } }`;
  const CREATE_TARGET = `mutation CreateTarget($data: NoteTargetCreateInput!) { createNoteTarget(data: $data) { id } }`;

  let created = 0, skipped = 0, errors = 0;

  // Helper to create a note + targets
  const createNote = async (title, markdown, timestamp, hsCoId, hsCtId) => {
    if (!markdown && !title) { skipped++; return; }
    const data = {
      title: title || `Note — ${fmtDate(timestamp)}`,
      bodyV2: { markdown: markdown || '', blocknote: '' },
    };
    if (DRY_RUN) { created++; return; }
    try {
      const res = await gql(CREATE_NOTE, { data });
      const noteId = res.createNote.id;
      created++;
      process.stdout.write(`  ✓ ${created}\r`);
      await sleep(DELAY_MS);

      const twCoId = hsCoId ? companyIdMap[hsCoId] : undefined;
      const twCtId = hsCtId ? contactIdMap?.[hsCtId] : undefined;
      if (twCoId && !twCoId.startsWith('dry')) {
        await gql(CREATE_TARGET, { data: { noteId, targetCompanyId: twCoId } }).catch(() => {});
        await sleep(DELAY_MS);
      }
      if (twCtId && !twCtId.startsWith('dry')) {
        await gql(CREATE_TARGET, { data: { noteId, targetPersonId: twCtId } }).catch(() => {});
        await sleep(DELAY_MS);
      }
    } catch (e) {
      if (isDuplicateError(e)) skipped++;
      else { errors++; if (errors <= 3) console.error(`\n  ✗ note: ${e.message}`); }
    }
  };

  // 1. Import Notes
  console.log('  Fetching notes...');
  const notes = await fetchAllHubSpot('notes', [
    'hs_note_body', 'hs_timestamp', 'hs_object_id',
  ]);
  for (const r of notes) {
    const p = r.properties;
    const body = stripHtml(p.hs_note_body);
    const hsCoId = r.associations?.companies?.results?.[0]?.id;
    const hsCtId = r.associations?.contacts?.results?.[0]?.id;
    await createNote(`Note — ${fmtDate(p.hs_timestamp)}`, body, p.hs_timestamp, hsCoId, hsCtId);
  }

  // 2. Import Meetings as notes
  console.log('\n  Fetching meetings...');
  const meetings = await fetchAllHubSpot('meetings', [
    'hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time',
    'hs_meeting_outcome', 'hs_object_id',
  ]);
  for (const r of meetings) {
    const p = r.properties;
    const rawTitle = p.hs_meeting_title || 'Meeting';
    const title = `[Meeting] ${rawTitle} — ${fmtDate(p.hs_meeting_start_time)}`;
    const outcome = p.hs_meeting_outcome ? `**Outcome:** ${p.hs_meeting_outcome}\n\n` : '';
    const body = outcome + stripHtml(p.hs_meeting_body);
    const hsCoId = r.associations?.companies?.results?.[0]?.id;
    const hsCtId = r.associations?.contacts?.results?.[0]?.id;
    await createNote(title, body, p.hs_meeting_start_time, hsCoId, hsCtId);
  }

  console.log(`\n  ✓ created: ${created}  skipped: ${skipped}  errors: ${errors}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`HubSpot → Twenty import`);
  console.log(`Target: ${TWENTY_API_URL}`);
  if (OBJECT_FILTER) console.log(`Object filter: ${OBJECT_FILTER}`);
  if (LIMIT !== Infinity) console.log(`Record limit: ${LIMIT} per object`);

  // Health check
  try {
    const res = await fetch(`${TWENTY_API_URL}/healthz`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch (e) {
    console.error(`\nCannot reach Twenty at ${TWENTY_API_URL}: ${e.message}`);
    process.exit(1);
  }

  let companyIdMap = {};
  let contactIdMap = {};

  if (!OBJECT_FILTER || OBJECT_FILTER === 'companies') {
    companyIdMap = await importCompanies();
  }

  if (!OBJECT_FILTER || OBJECT_FILTER === 'contacts') {
    contactIdMap = await importContacts(companyIdMap);
  }

  // For object-only runs (tasks/notes), build maps from existing workspace data
  if (OBJECT_FILTER && ['tasks', 'notes', 'deals'].includes(OBJECT_FILTER) && !OBJECT_FILTER.match(/companies|contacts/)) {
    if (Object.keys(companyIdMap).length === 0) {
      console.log('\nBuilding company map from workspace...');
      let cursor = null;
      while(true){
        const r = await gql('{ companies(first:100'+(cursor?',after:\"'+cursor+'\"':'')+'){edges{node{id hsHubspotId}}pageInfo{hasNextPage endCursor}}}');
        (r.companies?.edges??[]).forEach(e=>{if(e.node.hsHubspotId)companyIdMap[e.node.hsHubspotId]=e.node.id;});
        if(!r.companies?.pageInfo?.hasNextPage)break;
        cursor=r.companies.pageInfo.endCursor;
        await sleep(DELAY_MS/2);
      }
      console.log('  Company map:', Object.keys(companyIdMap).length, 'entries');
    }
    if (Object.keys(contactIdMap).length === 0) {
      console.log('Building contact map from workspace...');
      let cursor = null;
      while(true){
        const r = await gql('{ people(first:100'+(cursor?',after:\"'+cursor+'\"':'')+'){edges{node{id hsHubspotId}}pageInfo{hasNextPage endCursor}}}');
        (r.people?.edges??[]).forEach(e=>{if(e.node.hsHubspotId)contactIdMap[e.node.hsHubspotId]=e.node.id;});
        if(!r.people?.pageInfo?.hasNextPage)break;
        cursor=r.people.pageInfo.endCursor;
        await sleep(DELAY_MS/2);
      }
      console.log('  Contact map:', Object.keys(contactIdMap).length, 'entries');
    }
  }

  if (!OBJECT_FILTER || OBJECT_FILTER === 'deals') {
    await importDeals(companyIdMap, contactIdMap);
  }

  if (!OBJECT_FILTER || OBJECT_FILTER === 'tasks') {
    await importTasks(companyIdMap, contactIdMap);
  }

  if (!OBJECT_FILTER || OBJECT_FILTER === 'notes') {
    await importNotesAndMeetings(companyIdMap, contactIdMap);
  }

  console.log(`\n${DRY_RUN ? '🔍 Dry run complete' : '✓ Import complete!'}`);
  console.log(`Open: ${TWENTY_API_URL}`);
}

main().catch((e) => {
  console.error('\nImport failed:', e.message);
  process.exit(1);
});
