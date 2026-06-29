#!/usr/bin/env node
// Imports live HubSpot partner data into Twenty.
//
// Run: HUBSPOT_PAT=$HUBSPOT_PAT node scripts/seed.mjs

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const HUBSPOT_PAT = process.env.HUBSPOT_PAT;
// Dev API key for the local Docker instance (tim@apple.dev workspace)
const TWENTY_API_KEY = process.env.TWENTY_API_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMDIwMjAyMC0xYzI1LTRkMDItYmYyNS02YWVjY2Y3ZWE0MTkiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiMjAyMDIwMjAtMWMyNS00ZDAyLWJmMjUtNmFlY2NmN2VhNDE5IiwiaWF0IjoxNzM1Njg5NjAwLCJleHAiOjQ4OTE0NDk2MDAsImp0aSI6IjIwMjAyMDIwLWY0MDEtNGQ4YS1hNzMxLTY0ZDAwN2MyN2JhZCJ9.bfQjfyN0NEtTCLE_xPyNcwonDzlSXFoP8kdCQTdnuDc';
const TWENTY_API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:2020';

if (!HUBSPOT_PAT) {
  console.error('Error: HUBSPOT_PAT is not set. Run: export HUBSPOT_PAT=pat-na1-...');
  process.exit(1);
}

const HS_BASE = 'https://api.hubapi.com';
const HS_HEADERS = {
  Authorization: `Bearer ${HUBSPOT_PAT}`,
  'Content-Type': 'application/json',
};

const TWENTY_HEADERS = {
  Authorization: `Bearer ${TWENTY_API_KEY}`,
  'Content-Type': 'application/json',
};

// ── Stage mapping: HubSpot internal IDs → our SELECT values ───────────────────
// Run discover-schema.mjs first and check scripts/hubspot-schema.json for your
// workspace's actual stage IDs, then update this map if needed.

const STAGE_ID_MAP = {
  appointmentscheduled: 'APPOINTMENT_SCHEDULED',
  qualifiedtobuy: 'QUALIFIED_TO_BUY',
  presentationscheduled: 'PRESENTATION_SCHEDULED',
  decisionmakerboughtin: 'DECISION_MAKER_BOUGHT_IN',
  contractsent: 'CONTRACT_SENT',
  closedwon: 'CLOSED_WON',
  closedlost: 'CLOSED_LOST',
};

const LIFECYCLE_MAP = {
  subscriber: 'SUBSCRIBER',
  lead: 'LEAD',
  marketingqualifiedlead: 'MARKETING_QUALIFIED_LEAD',
  salesqualifiedlead: 'SALES_QUALIFIED_LEAD',
  opportunity: 'OPPORTUNITY',
  customer: 'CUSTOMER',
  evangelist: 'EVANGELIST',
  other: 'OTHER',
};

const INDUSTRY_MAP = {
  technology: 'TECHNOLOGY',
  financial_services: 'FINANCIAL_SERVICES',
  healthcare: 'HEALTHCARE',
  manufacturing: 'MANUFACTURING',
  retail: 'RETAIL',
  real_estate: 'REAL_ESTATE',
  education: 'EDUCATION',
  consulting: 'CONSULTING',
};

const LEAD_STATUS_MAP = {
  new: 'NEW',
  open: 'OPEN',
  'in progress': 'IN_PROGRESS',
  'open deal': 'OPEN_DEAL',
  unqualified: 'UNQUALIFIED',
  'attempted to contact': 'ATTEMPTED_TO_CONTACT',
  connected: 'CONNECTED',
  'bad timing': 'BAD_TIMING',
};

const DEAL_TYPE_MAP = {
  newbusiness: 'NEW_BUSINESS',
  existingbusiness: 'EXISTING_BUSINESS',
};

// ── HubSpot helpers ───────────────────────────────────────────────────────────

async function hsGet(path) {
  const res = await fetch(`${HS_BASE}${path}`, { headers: HS_HEADERS });
  if (!res.ok) {
    throw new Error(`HubSpot ${path} failed ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchHsObjects(objectType, properties, limit = 20) {
  const propsParam = properties.join(',');
  const data = await hsGet(
    `/crm/v3/objects/${objectType}?limit=${limit}&properties=${propsParam}&associations=companies`,
  );
  return data.results ?? [];
}

// ── Twenty GraphQL helpers ────────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch(`${TWENTY_API_URL}/graphql`, {
    method: 'POST',
    headers: TWENTY_HEADERS,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// ── Field value converters ────────────────────────────────────────────────────

function toMicros(value) {
  if (!value || isNaN(Number(value))) return null;
  return Math.round(Number(value) * 1_000_000);
}

function mapStage(hsStageId) {
  return STAGE_ID_MAP[hsStageId?.toLowerCase()] ?? 'APPOINTMENT_SCHEDULED';
}

function mapLifecycle(val) {
  return LIFECYCLE_MAP[val?.toLowerCase()] ?? null;
}

function mapIndustry(val) {
  return INDUSTRY_MAP[val?.toLowerCase()] ?? 'OTHER';
}

function mapLeadStatus(val) {
  return LEAD_STATUS_MAP[val?.toLowerCase()] ?? null;
}

function mapDealType(val) {
  return DEAL_TYPE_MAP[val?.toLowerCase().replace(/[^a-z]/g, '')] ?? null;
}

// ── Seed: Companies ───────────────────────────────────────────────────────────

async function seedCompanies(limit = 15) {
  console.log(`\nFetching ${limit} companies from HubSpot...`);
  const hsCompanies = await fetchHsObjects('companies', [
    'name', 'domain', 'industry', 'annualrevenue', 'numberofemployees',
    'lifecyclestage', 'phone', 'city', 'country', 'description', 'hs_object_id',
  ], limit);

  const companyIdMap = {}; // hs_object_id → twenty_id

  for (const c of hsCompanies) {
    const p = c.properties;
    if (!p.name) continue;

    const annualRevenueMicros = toMicros(p.annualrevenue);

    const data = {
      name: p.name,
      ...(p.domain && {
        domainName: { primaryLinkUrl: p.domain.startsWith('http') ? p.domain : `https://${p.domain}`, primaryLinkLabel: '' },
      }),
      ...(annualRevenueMicros !== null && {
        annualRevenue: { amountMicros: String(annualRevenueMicros), currencyCode: 'USD' },
      }),
      ...(p.industry && { hsIndustry: mapIndustry(p.industry) }),
      ...(p.numberofemployees && { hsNumberOfEmployees: Number(p.numberofemployees) }),
      ...(p.lifecyclestage && { hsLifecycleStage: mapLifecycle(p.lifecyclestage) }),
      ...(p.hs_object_id && { hsHubspotId: p.hs_object_id }),
    };

    try {
      const result = await gql(
        `mutation CreateCompany($data: CompanyCreateInput!) {
          createCompany(data: $data) { id }
        }`,
        { data },
      );
      companyIdMap[p.hs_object_id] = result.createCompany.id;
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n  ✗ Company "${p.name}": ${err.message}`);
    }
  }

  console.log(`\n  Created ${Object.keys(companyIdMap).length} companies`);
  return companyIdMap;
}

// ── Seed: Contacts ────────────────────────────────────────────────────────────

async function seedContacts(companyIdMap, limit = 20) {
  console.log(`\nFetching ${limit} contacts from HubSpot...`);
  const hsContacts = await fetchHsObjects('contacts', [
    'firstname', 'lastname', 'email', 'phone', 'jobtitle',
    'lifecyclestage', 'hs_lead_status', 'hs_object_id', 'associatedcompanyid',
  ], limit);

  const contactIdMap = {}; // hs_object_id → twenty_id

  for (const contact of hsContacts) {
    const p = contact.properties;
    const firstName = p.firstname ?? '';
    const lastName = p.lastname ?? '';
    if (!firstName && !lastName) continue;

    // Resolve company association
    const hsCompanyId = p.associatedcompanyid
      ?? contact.associations?.companies?.results?.[0]?.id;
    const twentyCompanyId = hsCompanyId ? companyIdMap[hsCompanyId] : undefined;

    const data = {
      name: { firstName, lastName },
      ...(p.email && { emails: { primaryEmail: p.email } }),
      ...(p.phone && {
        phones: { primaryPhoneNumber: p.phone, primaryPhoneCountryCode: '+1' },
      }),
      ...(p.jobtitle && { jobTitle: p.jobtitle }),
      ...(p.lifecyclestage && { hsLifecycleStage: mapLifecycle(p.lifecyclestage) }),
      ...(p.hs_lead_status && { hsLeadStatus: mapLeadStatus(p.hs_lead_status) }),
      ...(p.hs_object_id && { hsHubspotId: p.hs_object_id }),
      ...(twentyCompanyId && { company: { connect: { id: twentyCompanyId } } }),
    };

    try {
      const result = await gql(
        `mutation CreatePerson($data: PersonCreateInput!) {
          createPerson(data: $data) { id }
        }`,
        { data },
      );
      contactIdMap[p.hs_object_id] = result.createPerson.id;
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n  ✗ Contact "${firstName} ${lastName}": ${err.message}`);
    }
  }

  console.log(`\n  Created ${Object.keys(contactIdMap).length} contacts`);
  return contactIdMap;
}

// ── Seed: Deals ───────────────────────────────────────────────────────────────

async function seedDeals(companyIdMap, contactIdMap, limit = 15) {
  console.log(`\nFetching ${limit} deals from HubSpot...`);
  const hsDeals = await fetchHsObjects('deals', [
    'dealname', 'amount', 'dealstage', 'closedate', 'dealtype',
    'pipeline', 'description', 'hs_object_id', 'associatedcompanyid',
  ], limit);

  let created = 0;

  for (const deal of hsDeals) {
    const p = deal.properties;
    if (!p.dealname) continue;

    const amountMicros = toMicros(p.amount);
    const hsCompanyId = p.associatedcompanyid
      ?? deal.associations?.companies?.results?.[0]?.id;
    const twentyCompanyId = hsCompanyId ? companyIdMap[hsCompanyId] : undefined;

    // Best-effort: link to a contact associated with the same company
    const twentyContactId = twentyCompanyId
      ? Object.entries(contactIdMap).find(([, _]) => {
          const c = hsDeals.find((d) => d.properties.hs_object_id === p.hs_object_id);
          return !!c;
        })?.[1]
      : undefined;

    const data = {
      name: p.dealname,
      stage: mapStage(p.dealstage),
      ...(amountMicros !== null && {
        amount: { amountMicros: String(amountMicros), currencyCode: 'USD' },
      }),
      ...(p.closedate && { closeDate: p.closedate.split('T')[0] }),
      ...(p.dealtype && { dealType: mapDealType(p.dealtype) }),
      ...(p.description && { description: { markdown: p.description, blocknote: '' } }),
      ...(twentyCompanyId && {
        primaryCompany: { connect: { id: twentyCompanyId } },
      }),
    };

    try {
      await gql(
        `mutation CreateHsPartnerDeal($data: HsPartnerDealCreateInput!) {
          createHsPartnerDeal(data: $data) { id }
        }`,
        { data },
      );
      created++;
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n  ✗ Deal "${p.dealname}": ${err.message}`);
    }
  }

  console.log(`\n  Created ${created} deals`);
  return created;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('HubSpot → Twenty seed script');
  console.log(`Target: ${TWENTY_API_URL}`);

  // Verify Twenty is reachable
  try {
    const res = await fetch(`${TWENTY_API_URL}/healthz`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch (err) {
    console.error(`\nCannot reach Twenty at ${TWENTY_API_URL}: ${err.message}`);
    console.error('Is the Docker server running? Check: docker ps | grep twenty');
    process.exit(1);
  }

  const companyIdMap = await seedCompanies(15);
  const contactIdMap = await seedContacts(companyIdMap, 20);
  await seedDeals(companyIdMap, contactIdMap, 15);

  console.log('\n✓ Seed complete!');
  console.log(`  Open Twenty at: ${TWENTY_API_URL}`);
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
