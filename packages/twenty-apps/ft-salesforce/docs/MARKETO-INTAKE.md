# Marketo → Twenty Intake — lead + controlled company creation

> **Status 2026-07-14: BUILT + VERIFIED locally.** Endpoint `/s/marketo/intake` live in the
> app; all 4 new fields + 3 Other fields + NAICS/Ampla options synced; payload contract
> confirmed against the live form (input names = SF `__c` names; modern bands only);
> simulator 31/31 checks, repeatable, self-cleaning (`scripts/simulate-marketo.mjs`).
> Remaining: cloud deploy → mint dedicated API key → Marketo admin webhook + smart campaign
> (see docs/CLOUD-DEPLOY-PLAN.md step 6). Decisions 1–3 below were resolved as: faithful
> SELECT bands + all fields added.

Replaces two things at once:
1. the SF path these forms feed today (Marketo → SF Lead), and
2. Twenty's stock "Create company when adding a new person" workflow (already deleted —
   it guessed companies from email domains and silently rewired links).

Source forms: the **Get Started pre-qualifier** (invoice platforms, invoices businesses/
governments, business registration country, industry, annual revenue band, funding amount
band, how-did-you-hear) + **"Just a few more questions"** (first/last name, job title,
company name, email, phone, primary reason for funding, how quickly).

## Architecture (recommended): Marketo webhook → app HTTP logic function

```
Marketo Smart Campaign ──[Call Webhook]──▶ POST https://<twenty-host>/s/marketo/intake
  trigger: Fills Out Form                    (ft-salesforce logic function, auth header)
                                                    │
                                    1. upsert Person by email (idempotent)
                                    2. map picklist answers via value-maps
                                    3. find-or-create Company by name (+country)
                                       — the CONTROLLED replacement for the
                                         stock domain-guess workflow
                                    4. link person → company, stamp
                                       leadStatus=NEW_SIGN_UP, leadSource/source=Marketo
```

The proven mechanism (SDK pattern only — cited from the separate hubspot-partner app's
ZoomInfo route; no partner-workspace involvement): a `defineLogicFunction` with
`httpRouteTriggerSettings: { path: '/marketo/intake', httpMethod: 'POST', isAuthRequired: true }`,
served at `/s/marketo/intake`. Marketo webhooks support custom headers, so the request
carries `Authorization: Bearer <dedicated Twenty API key>`.

**Why not a native Twenty workflow** (trigger: person created → create company)?
It can't dedupe companies by name, can't map Marketo picklist labels to our SELECT values,
can't decide "company already exists → link instead of create", and it triggers on *every*
person creation (imports included). One webhook handler does the whole transaction
idempotently, and only for Marketo traffic. (A native workflow stays an option for later
in-CRM automations — not for intake.)

**Why not Marketo REST polling?** Real-time push beats a poller; no extra infra; the
handler's idempotent upsert covers Marketo's retry behavior. If webhook reliability ever
bites (Marketo has no durable retry), a nightly reconciliation pull via Marketo's bulk
lead export can backstop — noted as v2, not needed to start.

## Field mapping (form → SF Lead `__c` → Twenty) — verified against Lead describe 2026-07-14

| Form answer | SF Lead field (actual) | Twenty today | Gap |
|---|---|---|---|
| First/Last Name, Job Title, Email, Phone | std Lead fields | `person.name/jobTitle/emails/phones` | ✓ (email = upsert key; NANP phone helper) |
| Company Name | `Company` (std) | `person.companyName` + Company find-or-create key | ✓ |
| Invoice platforms (multi) | `Do_you_use_any_of_these_invoice_platform__c` (multipicklist) | `person.invoicePlatforms` MULTI_SELECT | ✓ (+ `Invoice_Platforms_Other__c` textarea → **no field**, minor) |
| Invoice businesses/governments | `Do_you_invoice_businesses__c` | `person.doYouInvoiceBusinesses` | ✓ |
| Where is business registered | `Where_is_your_business_registered__c` — Canada / United States / Outside North America | **nothing** | ❌ new `person.businessRegisteredIn` SELECT (3 opts). Company `address.addressCountry` only at create for CA/US ("Outside North America" isn't a country) |
| Industry | ⚠ **`What_Industry_is_your_business_in__c`** — 20 NAICS-style values — **NOT std `Lead.Industry`** (which feeds `person.industry` today, ZoomInfo-style values) | `person.industry` exists but its option set is std-Industry-derived | ❌ add the 20 NAICS options + `marketo.industry` value-map (company.industry shares the option set) |
| Annual revenue band | `Annual_Revenue_Range__c` (string): `<$1M`, `$1M - $5M`, `$5M - $10M`, `>$10M` | **nothing** (`company.annualRecurringRevenue` is CURRENCY — band would be lossy) | ❌ new `person.annualRevenueBand` SELECT (4 opts) |
| Total funding band | ⚠ **`How_much_funding_are_you_looking_for__c`** (picklist, 8 active values incl. legacy: Under $50k, $50k-$100k, Under $100k, $100k-$200k, $200k-$500k, $100k-$500k, $500k-$1M, Over $1M) — **distinct from** `Desired_Funding_Amount__c` (double → `person.desiredFundingAmount`) | **nothing** | ❌ new `person.desiredFundingBand` SELECT (8 opts) |
| How did you hear about us | `How_Did_You_Hear_About_Us__c` | `person.howDidYouHearAboutUs` | ✓ (+ `_Other__c` textarea → **no field**, minor) |
| Primary reason for funding | `Primary_Reason_for_Funding__c` (**multi**picklist, 10 values: Equipment Purchase/Rental, Expansion Project, General Expenses, Hiring, Inventory, Other, Paying Suppliers, Payment Collection, Payroll, Peace of Mind) | **nothing** | ❌ new `person.primaryReasonForFunding` MULTI_SELECT (+ `_Other` TEXT) |
| How quickly do you need the money | `How_quickly_do_you_need_the_money__c` | `person.howQuicklyDoYouNeedTheMoney` | ✓ |

**Company object check:** intake only needs `name` ✓, `industry` ✓ (after NAICS option
extension), `address.addressCountry` ✓, `source` ✓, `annualRecurringRevenue` ✓ — company is
structurally complete; all gaps are person-side lead attributes (correct per the model:
lead-stage data lives on Person).

**Build list (new person fields):** `businessRegisteredIn` SELECT · `annualRevenueBand`
SELECT · `desiredFundingBand` SELECT · `primaryReasonForFunding` MULTI_SELECT ·
`primaryReasonForFundingOther` TEXT · (minor) `invoicePlatformsOther` TEXT,
`howDidYouHearAboutUsOther` TEXT · +20 NAICS options on person/company `industry`.
These also improve the SF import (the same `__c` fields exist on historical Leads).

## Marketo admin setup — step-by-step (run after the cloud deploy publishes the endpoint)

> **Mode: DUAL-WRITE (decided).** The existing Marketo→SF sync stays untouched. This adds a
> second, independent destination. Nothing below modifies any SF-facing campaign. Cutover
> at SF sunset = deactivate the SF campaign; this one keeps running.

### Prerequisite (from the Twenty side — we provide)
- Endpoint URL: `https://fundthrough.twenty.com/s/marketo/intake`
- A dedicated Twenty API key minted for Marketo (named `marketo-intake`), delivered securely
  — this goes in the webhook's Authorization header. Rotate = mint new key, edit header.

### Step 1 — Create the webhook (Admin → Webhooks → New Webhook)
| Setting | Value |
|---|---|
| Webhook Name | `Twenty CRM — Get Started intake` |
| URL | `https://fundthrough.twenty.com/s/marketo/intake` |
| Request Type | `POST` |
| Request Token Encoding | `JSON` |
| Response Type | `JSON` |

**Template** (paste, then re-insert each `{{…}}` via the token picker so Marketo resolves
the org's actual field names — the right-hand keys must stay EXACTLY as written; they are
the API contract with the endpoint):

```json
{
  "email": "{{lead.Email Address}}",
  "firstName": "{{lead.First Name}}",
  "lastName": "{{lead.Last Name}}",
  "jobTitle": "{{lead.Job Title}}",
  "company": "{{company.Company Name}}",
  "phone": "{{lead.Phone Number}}",
  "invoicePlatforms": "{{lead.<field synced to SF Do_you_use_any_of_these_invoice_platform__c>}}",
  "invoicePlatformsOther": "{{lead.<→ Invoice_Platforms_Other__c>}}",
  "doYouInvoiceBusinesses": "{{lead.<→ Do_you_invoice_businesses__c>}}",
  "businessRegisteredIn": "{{lead.<→ Where_is_your_business_registered__c>}}",
  "industry": "{{lead.<→ What_Industry_is_your_business_in__c>}}",
  "annualRevenueBand": "{{lead.<→ Annual_Revenue_Range__c>}}",
  "desiredFundingBand": "{{lead.<→ How_much_funding_are_you_looking_for__c>}}",
  "howDidYouHearAboutUs": "{{lead.<→ How_Did_You_Hear_About_Us__c>}}",
  "howDidYouHearAboutUsOther": "{{lead.<→ How_Did_You_Hear_About_Us_Other__c>}}",
  "primaryReasonForFunding": "{{lead.<→ Primary_Reason_for_Funding__c>}}",
  "primaryReasonForFundingOther": "{{lead.<→ Primary_Reason_for_Funding_Other__c>}}",
  "howQuicklyDoYouNeedTheMoney": "{{lead.<→ How_quickly_do_you_need_the_money__c>}}"
}
```

Notes for the admin:
- Each `<→ X__c>` placeholder = the Marketo field that syncs to that SF Lead field (the
  live form posts these names directly, so the mapping already exists in Field Management).
- Multi-value fields (invoicePlatforms, primaryReasonForFunding): send Marketo's default
  semicolon-separated string — the endpoint splits on `;`.
- Values are sent as the human-readable labels exactly as on the form (e.g. `Under $100k`,
  `Transportation and warehousing`, `Enverus Openinvoice`) — the endpoint owns the mapping.
- Blank/unanswered fields are fine — empty strings are ignored server-side.

**Custom Header** (Webhooks → select webhook → Webhooks Actions → Set Custom Header):
`Authorization` = `Bearer <the marketo-intake API key>`

### Step 2 — Smart Campaign
1. Marketing Activities → New Smart Campaign, e.g. `Get Started → Twenty CRM`.
2. **Smart List**: trigger *Fills Out Form*, form = the Get Started pre-qualifier
   (+ every variant/landing-page clone that should create CRM leads — same list as the
   existing SF campaign; copy its form list).
3. **Flow**: single step — *Call Webhook* → `Twenty CRM — Get Started intake`.
4. **Schedule**: qualification "every time" (re-submissions update the Twenty person —
   the endpoint is idempotent by email; leadStatus is never downgraded).
5. Activate.

### Step 3 — Test before pointing at the real form
1. Point the smart campaign (or a clone) at a TEST form first.
2. Submit a test lead with a `+test` email (e.g. `yourname+twentytest@fundthrough.com`).
3. Verify in Twenty (sales workspace): person exists with leadStatus *New Sign up*,
   leadSource *Marketo*, all answers populated; company created and linked.
4. Check the webhook call in the lead's Activity Log (Webhook is Called / response 200
   `{"ok":true,…}`). Errors return `{"ok":false,"error":…}` with HTTP 200 — read the body.
5. Swap the trigger to the production form(s). Delete the test person+company in Twenty.

### Behavior contract (what the endpoint guarantees)
- Upsert by email: one person per email, ever; re-fires update fields, never duplicate,
  never downgrade leadStatus, never unlink an existing company.
- Company: find by exact name (case-insensitive) or create with industry/country/source —
  never guessed from the email domain.
- Unknown picklist labels: field left empty rather than failing the lead (watch for gaps
  after form option changes — tell the Twenty side when form options change).

### Ongoing admin asks
- Notify the Twenty side before adding/renaming form fields or picklist options (the
  endpoint's value-maps need the new labels).
- Webhook failures: Marketo has no durable retry — if the endpoint was down, re-run the
  smart campaign against the affected smart list window (idempotent, safe).

## Twenty-side build (all in ft-salesforce app)

1. `src/logic-functions/marketo-intake.ts` — HTTP route, auth required; handler:
   - validate payload + shared-secret header
   - upsert person by email (create or update; never downgrade an existing leadStatus)
   - map picklists via `scripts/value-maps.json` (+ new `marketo` section)
   - find company by exact name (case-insensitive) → else create with
     `{name, industry, address.addressCountry, source:'Marketo'}` → set `person.companyId`
   - stamp `leadSource:'Marketo'`, `leadStatus:'NEW_SIGN_UP'` (new leads only)
   - return `{personId, companyId, created|updated}` for Marketo's webhook log
2. New fields per decisions 1–3 (SELECT files + UIDs + DATA-MODEL rows).
3. `scripts/value-maps.json`: add `marketo.industry` etc. from the admin's option lists.
4. Simulator: `scripts/simulate-marketo.mjs` replaying sample payloads at the local
   endpoint — covers create, duplicate re-submit, existing-company link, bad payload.

## Local first or after cloud deploy? → **Both, in this order**

**Build + test locally NOW** (recommended):
- The handler is app code — it ships with the same `twenty dev --once` as everything else,
  so building it now means the cloud deploy carries it for free.
- Marketo can't reach localhost, but it doesn't need to: the simulator replays exact
  webhook payloads against `http://localhost:2020/s/marketo/intake`, covering the full
  logic (upsert, dedupe, company find-or-create, mapping) — that's 95% of the risk.
- Only blocker: the admin's field inventory (payload shape). Until then, build against
  the SF-derived field set and adjust tokens later.

**Marketo admin config AFTER cloud deploy** (necessarily):
- The webhook needs the public cloud URL and a production API key — neither exists until
  EE-4969 lands. Don't tunnel prod Marketo to a laptop.
- Sequence: cloud deploy → mint a dedicated `marketo-intake` API key → admin creates
  webhook + smart campaign pointed at a TEST form → verify a test submission end-to-end →
  enable on the real form. Add this as step 7 of docs/CLOUD-DEPLOY-PLAN.md's execution.

## Rollout guard
Keep Marketo→SF running in parallel during the pilot (dual-write). Twenty side is
idempotent so re-fires are safe. Cutover = disable the SF sync campaign, not a data change.
