import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';
import { MARKETO_INTAKE_UID } from 'src/constants/universal-identifiers';
import { normalizePhoneE164 } from 'src/utils/norm-phone';
import valueMaps from '../../scripts/value-maps.json';

// Marketo "Get Started" form intake — the CONTROLLED replacement for Twenty's stock
// "Create company when adding a new person" workflow (deleted: it guessed companies from
// email domains). Marketo Smart Campaign calls this endpoint on form fill; we upsert the
// Person by email, map picklist answers, and find-or-create the Company by name.
// See docs/MARKETO-INTAKE.md for the field mapping and Marketo admin setup.

type MarketoPayload = {
  email?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  company?: string;
  phone?: string;
  invoicePlatforms?: string;          // semicolon-separated multipicklist
  invoicePlatformsOther?: string;
  doYouInvoiceBusinesses?: string;
  businessRegisteredIn?: string;
  industry?: string;                  // NAICS-style label from the form
  annualRevenueBand?: string;
  desiredFundingBand?: string;
  howDidYouHearAboutUs?: string;
  howDidYouHearAboutUsOther?: string;
  primaryReasonForFunding?: string;   // semicolon-separated multipicklist
  primaryReasonForFundingOther?: string;
  howQuicklyDoYouNeedTheMoney?: string;
};

const mm = valueMaps as Record<string, Record<string, Record<string, string>>>;
const sel = (map: Record<string, string> | undefined, label?: string) =>
  label ? map?.[label.trim()] : undefined;
const multi = (map: Record<string, string> | undefined, raw?: string) => {
  const vals = (raw ?? '').split(';').map((s) => sel(map, s)).filter(Boolean);
  return vals.length ? vals : undefined;
};
const normPhone = (raw?: string) => {
  const digits = normalizePhoneE164(raw);
  return digits ? { primaryPhoneNumber: digits } : undefined;
};
const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

const handler = async (route: RoutePayload<MarketoPayload>) => {
  const payload: MarketoPayload =
    typeof route.body === 'string' ? JSON.parse(route.body) : (route.body ?? {});
  const serverUrl = process.env.TWENTY_API_URL;
  const token = process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;
  const gql = async (query: string, variables?: Record<string, unknown>) => {
    const res = await fetch(serverUrl + '/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ query, variables }),
    });
    return (await res.json()) as { data?: any; errors?: any };
  };

  const email = payload.email?.trim().toLowerCase();
  if (!email) return { ok: false, error: 'email is required' };

  // ---- map form answers → person fields ----
  const p = mm.person ?? {};
  const mk = mm.marketo ?? {};
  const personData = clean({
    jobTitle: payload.jobTitle,
    companyName: payload.company,
    phones: normPhone(payload.phone),
    invoicePlatforms: multi({ ...p.invoicePlatforms, ...mk.invoicePlatforms }, payload.invoicePlatforms),
    invoicePlatformsOther: payload.invoicePlatformsOther,
    doYouInvoiceBusinesses: sel(p.doYouInvoiceBusinesses, payload.doYouInvoiceBusinesses),
    businessRegisteredIn: sel(mk.businessRegisteredIn, payload.businessRegisteredIn),
    industry: sel(mk.industry, payload.industry) ?? sel(p.industry, payload.industry),
    annualRevenueBand: sel(mk.annualRevenueBand, payload.annualRevenueBand),
    desiredFundingBand: sel(mk.desiredFundingBand, payload.desiredFundingBand),
    howDidYouHearAboutUs: sel(p.howDidYouHearAboutUs, payload.howDidYouHearAboutUs),
    howDidYouHearAboutUsOther: payload.howDidYouHearAboutUsOther,
    primaryReasonForFunding: multi(mk.primaryReasonForFunding, payload.primaryReasonForFunding),
    primaryReasonForFundingOther: payload.primaryReasonForFundingOther,
    howQuicklyDoYouNeedTheMoney: sel(p.howQuicklyDoYouNeedTheMoney, payload.howQuicklyDoYouNeedTheMoney),
    leadSource: p.leadSource?.['Marketo'] ?? undefined,
  });

  // ---- find-or-create company by name (never by email domain) ----
  let companyId: string | undefined;
  const companyName = payload.company?.trim();
  if (companyName) {
    const found = await gql(
      'query C($name: String!) { companies(first: 1, filter: { name: { ilike: $name } }) { edges { node { id } } } }',
      { name: companyName },
    );
    companyId = found.data?.companies?.edges?.[0]?.node?.id;
    if (!companyId) {
      const country = payload.businessRegisteredIn === 'Canada' ? 'CA'
        : payload.businessRegisteredIn === 'United States' ? 'US' : undefined;
      const created = await gql(
        'mutation C($data: CompanyCreateInput!) { createCompany(data: $data) { id } }',
        { data: clean({
            name: companyName,
            industry: sel(mm.company?.industry, payload.industry) ?? sel(mk.industry, payload.industry),
            source: 'Marketo',
            address: country ? { addressCountry: country } : undefined,
        }) },
      );
      companyId = created.data?.createCompany?.id;
      if (!companyId) console.warn('company create failed:', JSON.stringify(created.errors)?.slice(0, 300));
    }
  }

  // ---- upsert person by email ----
  const existing = await gql(
    'query P($email: String!) { people(first: 1, filter: { emails: { primaryEmail: { ilike: $email } } }) { edges { node { id leadStatus companyId } } } }',
    { email },
  );
  const person = existing.data?.people?.edges?.[0]?.node;

  if (person) {
    // update — never downgrade an existing leadStatus, never unlink an existing company
    const update = clean({ ...personData, companyId: person.companyId ? undefined : companyId });
    const r = await gql('mutation U($id: UUID!, $data: PersonUpdateInput!) { updatePerson(id: $id, data: $data) { id } }',
      { id: person.id, data: update });
    if (r.errors) return { ok: false, error: JSON.stringify(r.errors).slice(0, 300) };
    return { ok: true, action: 'updated', personId: person.id, companyId: person.companyId ?? companyId };
  }

  const createData = clean({
    ...personData,
    name: { firstName: payload.firstName ?? '', lastName: payload.lastName ?? '' },
    emails: { primaryEmail: email },
    leadStatus: 'NEW_SIGN_UP',
    lifecycleStage: 'LEAD',
    companyId,
  });
  const r = await gql('mutation C($data: PersonCreateInput!) { createPerson(data: $data) { id } }', { data: createData });
  if (r.errors) return { ok: false, error: JSON.stringify(r.errors).slice(0, 300) };
  return { ok: true, action: 'created', personId: r.data?.createPerson?.id, companyId };
};

export default defineLogicFunction({
  universalIdentifier: MARKETO_INTAKE_UID,
  name: 'marketo-intake',
  description: 'Marketo Get Started form webhook: upserts the Person by email and find-or-creates the Company by name (controlled replacement for the stock domain-guess workflow).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/marketo/intake',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
