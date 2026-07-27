// Replays Marketo webhook payloads at the marketo-intake endpoint to test the full
// intake logic locally (create, dedupe re-submit, existing-company link, bad payload).
// Marketo can't reach localhost — this stands in for it until the cloud webhook exists.
// Usage: TWENTY_REMOTE=local node scripts/simulate-marketo.mjs
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const REMOTE = process.env.TWENTY_REMOTE ?? 'local';
const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes[REMOTE];
const BASE = cfg.apiUrl ?? 'http://localhost:2020';
const API_KEY = cfg.apiKey;

const call = async (payload) => {
  const res = await fetch(`${BASE}/s/marketo/intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};
const gql = async (query, variables) => {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
};

// exactly what the Marketo webhook template will send (lead tokens → JSON)
const LEAD = {
  email: 'marketo.test+intake@fundthrough.com',
  firstName: 'Marketo',
  lastName: 'Testlead',
  jobTitle: 'Owner',
  company: 'Simulated Paving Co',
  phone: '4165551234',
  invoicePlatforms: 'FreshBooks;Xero',
  doYouInvoiceBusinesses: 'Yes',
  businessRegisteredIn: 'Canada',
  industry: 'Construction',
  annualRevenueBand: '<$1M',
  desiredFundingBand: 'Under $100k',
  howDidYouHearAboutUs: 'Ampla',
  primaryReasonForFunding: 'Payroll;Paying Suppliers',
  howQuicklyDoYouNeedTheMoney: 'Immediately',
};

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : ' — ' + String(JSON.stringify(detail)).slice(0, 300)}`);
  if (!cond) failures++;
};

// ---- cleanup from previous runs ----
// soft-deleted rows still occupy the unique-email index — must delete AND destroy
const scrubPerson = async (email) => {
  // pass 1: soft-delete active matches; pass 2: destroy soft-deleted matches
  // (default queries EXCLUDE soft-deleted rows — they need their own deletedAt filter)
  const active = await gql('query P($email: String!) { people(first: 5, filter: { emails: { primaryEmail: { ilike: $email } } }) { edges { node { id } } } }', { email });
  const activeIds = (active.data?.people?.edges ?? []).map((e) => e.node.id);
  if (activeIds.length) await gql('mutation D($filter: PersonFilterInput!) { deletePeople(filter: $filter) { id } }', { filter: { id: { in: activeIds } } });
  const trashed = await gql('query P($email: String!) { people(first: 5, filter: { emails: { primaryEmail: { ilike: $email } }, deletedAt: { is: "NOT_NULL" } }) { edges { node { id } } } }', { email });
  const trashedIds = (trashed.data?.people?.edges ?? []).map((e) => e.node.id);
  if (trashedIds.length) await gql('mutation X($filter: PersonFilterInput!) { destroyPeople(filter: $filter) { id } }', { filter: { id: { in: trashedIds }, deletedAt: { is: 'NOT_NULL' } } });
};
const scrubCompany = async (name) => {
  const active = await gql('query C($name: String!) { companies(first: 5, filter: { name: { ilike: $name } }) { edges { node { id } } } }', { name });
  const activeIds = (active.data?.companies?.edges ?? []).map((e) => e.node.id);
  if (activeIds.length) await gql('mutation D($filter: CompanyFilterInput!) { deleteCompanies(filter: $filter) { id } }', { filter: { id: { in: activeIds } } });
  const trashed = await gql('query C($name: String!) { companies(first: 5, filter: { name: { ilike: $name }, deletedAt: { is: "NOT_NULL" } }) { edges { node { id } } } }', { name });
  const trashedIds = (trashed.data?.companies?.edges ?? []).map((e) => e.node.id);
  if (trashedIds.length) await gql('mutation X($filter: CompanyFilterInput!) { destroyCompanies(filter: $filter) { id } }', { filter: { id: { in: trashedIds }, deletedAt: { is: 'NOT_NULL' } } });
};
await scrubPerson(LEAD.email);
await scrubPerson('marketo.test+second@fundthrough.com');
await scrubPerson('marketo.test+live@fundthrough.com');
await scrubCompany(LEAD.company);
await scrubCompany('Live Values Logistics Inc');

// ---- 1. bad payload ----
const bad = await call({ firstName: 'NoEmail' });
check('rejects payload without email', bad.body?.ok === false, bad);

// ---- 2. fresh submission: person + company created and linked ----
const first = await call(LEAD);
check('first submission ok', first.status === 200 && first.body?.ok === true && first.body?.action === 'created', first);
check('company created', Boolean(first.body?.companyId), first);

const person = await gql(`query P($email: String!) { people(first: 1, filter: { emails: { primaryEmail: { ilike: $email } } }) { edges { node {
  id companyId leadStatus lifecycleStage leadSource jobTitle companyName industry businessRegisteredIn annualRevenueBand desiredFundingBand
  invoicePlatforms primaryReasonForFunding doYouInvoiceBusinesses howDidYouHearAboutUs howQuicklyDoYouNeedTheMoney phones { primaryPhoneNumber primaryPhoneCallingCode }
} } } }`, { email: LEAD.email });
const node = person.data?.people?.edges?.[0]?.node;
check('person exists', Boolean(node), person);
check('leadStatus NEW_SIGN_UP', node?.leadStatus === 'NEW_SIGN_UP', node);
check('leadSource MARKETO', node?.leadSource === 'MARKETO', node);
check('linked to created company', node?.companyId === first.body?.companyId, node);
check('industry mapped', node?.industry === 'CONSTRUCTION', node?.industry);
check('registeredIn mapped', node?.businessRegisteredIn === 'CANADA', node?.businessRegisteredIn);
check('revenue band mapped', node?.annualRevenueBand === 'UNDER_1M', node?.annualRevenueBand);
check('funding band mapped', node?.desiredFundingBand === 'UNDER_100K', node?.desiredFundingBand);
check('multi platforms mapped', Array.isArray(node?.invoicePlatforms) && node.invoicePlatforms.includes('FRESHBOOKS') && node.invoicePlatforms.includes('XERO'), node?.invoicePlatforms);
check('multi reasons mapped', Array.isArray(node?.primaryReasonForFunding) && node.primaryReasonForFunding.includes('PAYROLL'), node?.primaryReasonForFunding);
check('phone normalized +1', String(node?.phones?.primaryPhoneNumber ?? '').includes('4165551234') || node?.phones?.primaryPhoneCallingCode === '+1', node?.phones);

const company = await gql('query C($id: UUID!) { company(filter: { id: { eq: $id } }) { name industry source address { addressCountry } } }', { id: first.body?.companyId });
const co = company.data?.company;
check('company source Marketo', co?.source === 'Marketo', co);
check('company country CA', co?.address?.addressCountry === 'CA', co);
check('company industry mapped', co?.industry === 'CONSTRUCTION', co?.industry);

// ---- 3. duplicate re-submit: updates, no second person/company ----
const again = await call({ ...LEAD, jobTitle: 'CEO', desiredFundingBand: '$100k-$500k' });
check('re-submit is update', again.body?.action === 'updated', again);
const count = await gql('query P($email: String!) { people(first: 5, filter: { emails: { primaryEmail: { ilike: $email } } }) { edges { node { id jobTitle desiredFundingBand leadStatus } } } }', { email: LEAD.email });
const edges = count.data?.people?.edges ?? [];
check('still exactly one person', edges.length === 1, edges.length);
check('update applied (jobTitle)', edges[0]?.node?.jobTitle === 'CEO', edges[0]?.node);
check('leadStatus not downgraded', edges[0]?.node?.leadStatus === 'NEW_SIGN_UP', edges[0]?.node);
const coCount = await gql('query C($name: String!) { companies(first: 5, filter: { name: { ilike: $name } }) { edges { node { id } } } }', { name: LEAD.company });
check('still exactly one company', (coCount.data?.companies?.edges ?? []).length === 1, coCount.data?.companies?.edges?.length);

// ---- 4. existing company by name → link, not create ----
const second = await call({ ...LEAD, email: 'marketo.test+second@fundthrough.com', firstName: 'Second', lastName: 'Lead' });
check('second lead links same company', second.body?.companyId === first.body?.companyId, second);
await gql('mutation D($id: UUID!) { deletePerson(id: $id) { id } }', { id: second.body?.personId });

// ---- 5. live-form values verbatim (scraped from fundthrough.com/getstarted 2026-07-14) ----
// US business, modern funding bands, live tile labels incl. "Enverus Openinvoice"
const LIVE = {
  email: 'marketo.test+live@fundthrough.com',
  firstName: 'Live',
  lastName: 'Formvalues',
  jobTitle: 'CFO',
  company: 'Live Values Logistics Inc',
  phone: '(212) 555-0188',
  invoicePlatforms: 'Enverus Openinvoice;SPS Commerce;QuickBooks Online',
  doYouInvoiceBusinesses: 'Yes',
  businessRegisteredIn: 'United States',
  industry: 'Transportation and warehousing',
  annualRevenueBand: '>$10M',
  desiredFundingBand: '$100k-$500k',
  howDidYouHearAboutUs: 'ChatGPT or other LLM/AI',
  primaryReasonForFunding: 'Expansion Project',
  howQuicklyDoYouNeedTheMoney: 'Immediately',
};
const live = await call(LIVE);
check('live payload ok', live.body?.ok === true && live.body?.action === 'created', live);
const livePerson = await gql(`query P($email: String!) { people(first: 1, filter: { emails: { primaryEmail: { ilike: $email } } }) { edges { node {
  industry businessRegisteredIn annualRevenueBand desiredFundingBand invoicePlatforms howDidYouHearAboutUs primaryReasonForFunding companyId
} } } }`, { email: LIVE.email });
const ln = livePerson.data?.people?.edges?.[0]?.node;
check('live industry (NAICS) mapped', ln?.industry === 'TRANSPORTATION_AND_WAREHOUSING', ln?.industry);
check('live registeredIn US', ln?.businessRegisteredIn === 'UNITED_STATES', ln?.businessRegisteredIn);
check('live revenue band >$10M', ln?.annualRevenueBand === 'OVER_10M', ln?.annualRevenueBand);
check('live funding band', ln?.desiredFundingBand === 'FROM_100K_TO_500K', ln?.desiredFundingBand);
check('live platform aliases (Enverus/SPS/QBO)', Array.isArray(ln?.invoicePlatforms) && ln.invoicePlatforms.includes('OPENINVOICE') && ln.invoicePlatforms.includes('SPS_COMMERCE') && ln.invoicePlatforms.includes('QUICKBOOKS_ONLINE'), ln?.invoicePlatforms);
check('live hear-about-us ChatGPT', ln?.howDidYouHearAboutUs === 'CHATGPT_OR_OTHER_LLM_AI', ln?.howDidYouHearAboutUs);
const liveCo = await gql('query C($id: UUID!) { company(filter: { id: { eq: $id } }) { address { addressCountry } } }', { id: ln?.companyId });
check('live company country US', liveCo.data?.company?.address?.addressCountry === 'US', liveCo.data?.company);

// leave the demo workspace clean (KEEP_RECORDS=1 to inspect the created records)
if (!process.env.KEEP_RECORDS) {
  await scrubPerson(LEAD.email);
  await scrubPerson('marketo.test+second@fundthrough.com');
  await scrubPerson('marketo.test+live@fundthrough.com');
  await scrubCompany(LEAD.company);
  await scrubCompany('Live Values Logistics Inc');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
