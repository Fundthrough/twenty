# ft-salesforce — Data Model v3.1 (Lean Final · FlowWidget Embed)

> **v3.1, 2026-07-09** — payor objects removed (decision w/ Shivani's CS input): payor reachouts are **Tasks**; production payor/customer data via the Flow widget. **v3, 2026-07-08.** Supersedes v2 (git history). ⛔ TWO gates before build/import:
> (1) **field-validation gate — ✅ PASSED 2026-07-09** (Linesh validated the Field Mapping v3 tab row-by-row; the Keep set is the build spec);
> (2) local seed-data verification + walkthrough sign-off before cloud deploy.
> Field tables below reflect the VALIDATED mapping (source of truth: "Field Mapping v3" sheet tab).

## Object Model

| Twenty Object | Kind | Sources | Draft fields | Notes |
|---|---|---|---|---|
| Person | standard (ext) | SF Lead + Contact (dedup) | 56 | conversion semantics; lifecycleStage LEAD/CONVERTED; leadStatus kanban |
| Company | **standard Twenty Company** (reverted from custom 2026-07-09) | SF Account + Client__c | 22 customs + natives | Company IS the client; native name/domainName/address/employees/linkedin/ARR; key `companyId` = `Client__c.PRO_Company_ID__c` (TEXT; FlowWidget arg cast to number) |
| ~~PayorCompany / ClientPayorLink~~ | — | — | — | **REMOVED (2026-07-09)**: AM payor reachouts capture only payor name + opportunity size + expected close date tied to a client (Shivani) → handled as **Tasks** on the Company; production payors/customers shown live by the Flow widget Customers tab; structured workflow later via the case-mgmt tool (EE-4930). SF `Payor__c` is NOT migrated |
| TermSheet | custom | Facility-Fee Audit sheet (93 rows) | 24 | client facility terms + fee-disclosure audit |
| Task / Note | standard | SF Task / Event | 7 | TaskTargets → Person/Company/PayorCompany |
| ~~Opportunity / Invoice_Group / Invoice~~ | — | (87 req fields) | — | **DROPPED (resolved 2026-07-08)** — Flow dashboards own deal/invoice data |
| ~~Case / Client_Snapshot~~ | — | (95) | — | dropped |

## ERD

```mermaid
erDiagram
  Person }o--o| Company : worksAt (native)
  Person }o--o| Company : referredByPartner
  Company }o--o| Company : referredBy
  TermSheet }o--|| Company : company
```

## Relations

| Relation | Cardinality | Source |
|---|---|---|
| Person.company → Company | MANY_TO_ONE (NATIVE worksAt — std objects both sides) | `Lead.Client_LKP__c (pre-conversion) OR Contact.AccountId → Account.Client_LKP__c` |
| Person.referredByPartner → Company | MANY_TO_ONE | `Lead.Broker_Referral_Override__c / Lead.Payor_Account__c` |
| Company.referredBy → Company | MANY_TO_ONE (self) | `Account.Broker_Referral_Override__c (Cathleen)` |
| TermSheet.company → Company | MANY_TO_ONE | `audit-sheet client-name match` |

Special: OwnerId → workspaceMember (email map) · Task WhoId/WhatId → TaskTarget · Lead conversion → merge into Contact Person.

## Views & Nav

- **Lead Pipeline** — KANBAN on Person by `leadStatus` (11 SF stages, funnel order; post-install createViewGroup per column), filter lifecycleStage=LEAD; nav "Leads"
- **Clients** — Company table view
- **Payor Reachouts** — Task view filtered to "Payor reachout:" subjects (convention) — interim until the case-mgmt tool (EE-4930)
- **Term Sheets** — TermSheet table (by disclosureBucket)

## FlowWidget Embed (per EmbeddedDashboards.md)

Front component `flow-company-profile` on the Company record page ("Company Profile" tab, lazy-mounted):

```js
// <script src="https://<flow-host>/bundle.js">
window.FlowWidget.init({
  targetElementId: "flow-company-profile",
  dashboardId: "company_profile",
  // Company Profile resolves companyId -> {id,name,uuid} in its InitApp and
  // opens directly on that company's detail view.
  dashboardArguments: {
    companyId: record.companyId,   // = PRO_Company_ID (numeric)
    // UX options (Frans 2026-07-08, EmbeddedDashboards.md §9) — these belong INSIDE dashboardArguments:
    allowSearch: false,            // disables the "back to search" button (lock to this record's company)
    showTitle: false,              // top area with the refresh button — hide inside a record tab
    showHeader: true,              // header area with the key stats — keep
    enabledTabs: ["Profile", "Invoices", "Risk", "Customers"],  // tabs by name to include (array or CSV)
  },
  apiBaseUrl: "https://<bff-host>",        // optional — falls back to build-time VITE_BFF_API_URL
  googleClientId: "<BFF GOOGLE_CLIENT_ID>", // optional — falls back to meta tag / build-time value
});
```

**Local testing (available NOW, pre-build):** serve `widget.html` (Flow repo `apps/hitl-frontend/public/widget.html`, points at staging) on `http://localhost:5500` (`python3 -m http.server 5500`) and tune the CONFIG block — the validated `dashboardArguments` combination becomes the Twenty front-component config verbatim.

- JS bundle mounted into a div (NOT an iframe); Google sign-in button in-widget; JWT per-origin in localStorage; re-init re-renders
- Layout: post-install createPageLayoutTab + widget on Company Default layout
- **Flow-side config (Linesh):** (1) Direct app access ON for company_profile (+ /apps/ path, access control); (2) Google OAuth Authorized JS origins += https://fundthrough.twenty.com + http://localhost:3000; (3) BFF CORS_ALLOWED_ORIGINS += both (Variables UI, ~5 min)
- **Twenty-side risk:** page CSP must allow script-src flow-host + accounts.google.com/gsi/client, connect-src bff + accounts.google.com, frame-src accounts.google.com, style-src unsafe-inline; COOP absent or same-origin-allow-popups. **Fallback if Twenty Cloud CSP immovable:** iframe to https://<flow-host>/widget.html
- Viewers must be provisioned Flow HITL users (doc §10) — note for training (EE-4973)

## Field Recommendation — READY FOR REVIEW (2026-07-09)

Net-net keep-set (AM-filled + functionally required only), marked in the **"Field Mapping v3" sheet tab** column F with live SF picklist options + defaults in column G:

| Object | Keep / Drop | Kept |
|---|---|---|
| Person | 36 / 20 | identity+contact, `status` (kanban, DEFAULT: New Sign up), leadSource, type (DEFAULT: FTX), hotList, DQ/lost/renurture reasons (+Other), accountNotes, prospective-business basics, funding-intent questions, partner attribution, doNotCall, keys |
| Company | 23 / 82 | name + companyId + **applicationStatus** (DWH-synced but functionally required; refresh via future integration), native domainName/address, keys, 16 genuine Account CRM fields |
| TermSheet | 24 / 0 | all |
| Task | 7 / 0 | all |
| **Total** | **90 / 102** | |

Notable option decisions:
- `invoicePlatforms`: genuine SF multipicklist → MULTI_SELECT
- SELECT defaults carried from SF: status=New Sign up · type=FTX · accountingSoftware=Not Connected · Task priority=Normal · Task status=Open
- Build-time pruning candidates: leadSource (39 values, many dead campaigns), Company accountType (18 values incl. Payor/Broker legacy)

## Native-Field Mapping & Type Corrections (2026-07-09)

Of the 89 kept fields, **12 map into Twenty NATIVE fields — no custom field is created for them**:

| Kept field | Twenty native target |
|---|---|
| Person.firstName / lastName / name | `name` FULL_NAME composite (name row dropped — derived) |
| Person.email | `emails` |
| Person.phone / mobilePhone | `phones` (primary / additional) |
| Person.title | `jobTitle` |
| Company.name | auto name field on the custom object (labelIdentifier) |
| Task.subject | `title` |
| Task.description | `body` (RICH_TEXT) |
| Task.activityDate | `dueAt` |
| Task.status | `status` — value map: Open→TODO, Completed→DONE |

Remaining true custom fields: **Person 28 · Company 20 (std object: name/domainName/address native; +applicationStatus) · TermSheet 23 · Task 2 (priority, type)** ≈ **73 customs** (+ relations). Person.website stays custom (Twenty Person has no generic website field); Company domainName/address are intended std-shape copies on a custom object.

**Type corrections (SF describe is authoritative):**
- `Company.companyId` — SF `PRO_Company_ID__c` is a **STRING** → TEXT in Twenty (was drafted NUMBER); cast to number when passing to FlowWidget `dashboardArguments.companyId`
- All other kept fields verified: proposed Twenty types match SF types (picklist→SELECT, multipicklist→MULTI_SELECT, currency→CURRENCY, double→NUMBER, boolean→BOOLEAN, date/datetime→DATE/DATE_TIME)
- `disqualifiedReason` stays a single SELECT matching SF (decision reverted 2026-07-09) — no type divergences remain

## DWH→SF Sync Analysis (2026-07-09 — ai-batch-jobs evidence)

`ai-batch-jobs/dags/sql_scripts/redshift/dml/Client__c.sql` syncs **~85 fields** from `business.v_fact_clients_summary` (Redshift) into SF `Client__c` on a schedule — SF was only a *display layer* for this data. Per Linesh: these fields should NOT be re-synced into Twenty; the Flow widget surfaces them.

Cross-reference against the Company draft candidates:
- **77 of 83 Client__c-sourced fields are DWH-synced → recommend DROP** (annotated 🔄 in the Field Mapping v3 tab)
- **2 synced fields kept anyway**: `name` (record label) and `companyId` (= `pro_company_id__c`, the FlowWidget key) — stored + refreshed via a future integration
- **22 Account-sourced fields are genuine CRM data** (no DWH sync exists for Lead/Account/Contact) — the real keep-candidates: industry, description, type, churnDate/Reason, KYC, NOA policy, key/critical account, riskNotes, commission, partnerStage, persona, expectedGoLiveDate, source, inDefault
- 4 unmatched (verify source): ftxUserId, recommendedCreditLimit, sourceSystem, totalAdvancedUsd

**Resulting lean Company ≈ 30 fields** (std shape + keys + Account CRM fields) instead of 105. Same evidence applies to `Invoice__c.sql` / `Invoice_Group__c.sql` / `Payor__c.sql` — those objects are already excluded from migration.

## Import Mapping Rules (gated on field validation)

### Source 1 — Salesforce API
- Company upsert by `companyId` (= Client__c.PRO_Company_ID__c); sfClientId secondary; Account (via Client_LKP__c) enriches; Client value wins overlaps; non-client Accounts do NOT become companies
- Person: unconverted Lead → one Person (incl. prospective-business fields); converted Lead + its Contact merge into ONE Person; Person.company from Lead.Client_LKP__c else converted Account
- Excluded: Case, Client_Snapshot__c, **Payor__c**, Opportunity, Invoice_Group__c, Invoice__c

### Source 2 — Facility-Fee Audit sheet → TermSheet (AFTER Company import)
- Rows 2–94 (93 clients; skip footer totals; callout tabs not imported); dual-currency rows = separate TermSheets
- Client-name matching w/ normalization; unmatched → manual-mapping report
- Parse "$60,000 USD" / "Y - amt (dates)" / "-"/"n/a" → null

## DRAFT Field Tables (pending Linesh row-by-row validation — mirror of the "Field Mapping v3" sheet tab)

### Person (56)

| Twenty Field | Type | Import Source | Notes |
|---|---|---|---|
| `lifecycleStage` | SELECT LEAD/CONVERTED | net-new (derived from Lead.IsConverted at import) |  |
| `sfLeadId` | TEXT | key — Lead.Id |  |
| `sfContactId` | TEXT | key — Contact.Id | converted people |
| `annualRevenue` | CURRENCY | Lead.AnnualRevenue | prospective business |
| `company` | TEXT | Lead.Company | prospective business name (pre-Company) |
| `doNotCall` | BOOLEAN | Lead.DoNotCall |  |
| `email` | EMAILS | Lead.Email |  |
| `firstName` | TEXT | Lead.FirstName |  |
| `industry` | SELECT | Lead.Industry | prospective business |
| `lastName` | TEXT | Lead.LastName |  |
| `leadSource` | SELECT | Lead.LeadSource |  |
| `mobilePhone` | PHONES | Lead.MobilePhone |  |
| `name` | TEXT | Lead.Name |  |
| `numberOfEmployees` | NUMBER | Lead.NumberOfEmployees | prospective business |
| `phone` | PHONES | Lead.Phone |  |
| `rating` | SELECT | Lead.Rating |  |
| `status` | SELECT | Lead.Status | THE KANBAN FIELD (11 stages) |
| `title` | TEXT | Lead.Title |  |
| `website` | LINKS | Lead.Website | prospective business |
| `accountNotes` | TEXT | Lead.Account_Notes__c | quick info for future calls (Lyle) |
| `accountingSoftware` | SELECT | Lead.Accounting_Software__c |  |
| `applicationStatus` | TEXT | Lead.Application_status__c |  |
| `autoDisqualified` | BOOLEAN | Lead.Auto_Disqualified__c |  |
| `clientRatingForMarketo` | TEXT | Lead.client_rating_for_marketo__c | consider dropping (Marketo internals) |
| `creditLimit` | NUMBER | Lead.Credit_Limit__c | consider dropping — lives on Company |
| `desiredFundingAmount` | NUMBER | Lead.Desired_Funding_Amount__c |  |
| `disqualifiedReason` | SELECT | Lead.Disqualified_Reason__c |  |
| `disqualifiedReasonOther` | TEXT | Lead.Disqualified_Reason_Other__c |  |
| `doYouInvoiceBusinesses` | SELECT | Lead.Do_you_invoice_businesses__c |  |
| `invoicePlatforms` | MULTI_SELECT | Lead.Do_you_use_any_of_these_invoice_platform__c |  |
| `engagementScore` | NUMBER | Lead.Engagement_Score__c |  |
| `hotList` | BOOLEAN | Lead.Hot_list__c |  |
| `howDidYouHearAboutUs` | SELECT | Lead.How_Did_You_Hear_About_Us__c |  |
| `howMuchFundingAreYouLookingFor` | SELECT | Lead.How_much_funding_are_you_looking_for__c | overlaps desiredFundingAmount |
| `howQuicklyDoYouNeedTheMoney` | SELECT | Lead.How_quickly_do_you_need_the_money__c |  |
| `isSql` | BOOLEAN | Lead.is_SQL__c |  |
| `kycComplete` | BOOLEAN | Lead.KYC_Complete__c |  |
| `lostReason` | SELECT | Lead.Lost_Reason__c |  |
| `lostReasonsOther` | TEXT | Lead.Lost_Reasons_Other__c |  |
| `partnerAgentId` | TEXT | Lead.Partner_Agent_ID__c |  |
| `partnerSource` | TEXT | Lead.Partner_Source__c |  |
| `pipefyCardUrl` | TEXT | Lead.pipefy_card_url__c | consider dropping (Pipefy internals) |
| `preQualDecision` | SELECT | Lead.Pre_Qual_Decision__c |  |
| `primaryPartnerAffiliation` | SELECT | Lead.Primary_Partner_Affiliation__c |  |
| `promoCode` | TEXT | Lead.Promo_Code__c |  |
| `reasonForAutoDq` | SELECT | Lead.Reason_for_Auto_DQ__c |  |
| `renurtureDate` | DATE | Lead.Renurture_Date__c |  |
| `renurtureReason` | SELECT | Lead.Renurture_Reason__c |  |
| `renurtureReasonOther` | TEXT | Lead.Renurture_Reason_Other__c |  |
| `riskLeadScore` | NUMBER | Lead.Risk_Lead_Score__c |  |
| `sqlToSAL` | DATE | Lead.SQL_to_SAL__c |  |
| `system` | TEXT | Lead.System__c |  |
| `systemSource` | TEXT | Lead.System_Source__c |  |
| `type` | SELECT | Lead.Type__c |  |
| `department` | TEXT | Contact.Department |  |
| `salutation` | SELECT | Contact.Salutation |  |

### Company (105)

| Twenty Field | Type | Import Source | Notes |
|---|---|---|---|
| `name` | TEXT | Client__c.Name (fallback Account.Name) | std shape |
| `domainName` | LINKS | Account.Website | std shape |
| `address` | ADDRESS | Client__c.Business_address_* + Account.Billing* fallback | std shape composite |
| `employees` | NUMBER | Account.NumberOfEmployees | std shape |
| `linkedinLink` | LINKS | std shape — no SF source |  |
| `annualRecurringRevenue` | CURRENCY | Client__c.Revenue_Amount_CAD__c (or leave empty) | std shape |
| `companyId` | NUMBER | Client__c.PRO_Company_ID__c | UPSERT KEY + FlowWidget dashboardArguments.companyId |
| `sfClientId` | TEXT | key — Client__c.Id |  |
| `sfAccountId` | TEXT | key — Account.Id | secondary |
| `clientId` | TEXT | Account.Client_ID__c | FT backend client UUID (5,744 accounts filled) — added 2026-07-14 per Linesh |
| `accountingSoftware` | TEXT | Client__c.Accounting_Software__c |  |
| `aiFTXCreditLimit` | CURRENCY | Client__c.AI_FTX_Credit_Limit__c |  |
| `aiFTXOrigination` | TEXT | Client__c.AI_FTX_Origination__c |  |
| `aiFTXPremiumCreditLimit` | CURRENCY | Client__c.AI_FTX_Premium_Credit_Limit__c |  |
| `aiVelocityEligible` | BOOLEAN | Client__c.AI_Velocity_Eligible__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `annualBalanceTocad` | CURRENCY | Client__c.Annual_Balance_TOCAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `applicationStatus` | TEXT | Client__c.Application_Status__c |  |
| `approvedCreditLimit` | CURRENCY | Client__c.Approved_Credit_Limit__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `businessAddressCity` | TEXT | Client__c.Business_address_city__c |  |
| `businessAddressPostalCode` | TEXT | Client__c.Business_address_postal_code__c |  |
| `businessAddressState` | TEXT | Client__c.Business_address_state__c |  |
| `businessAddressStreet` | TEXT | Client__c.Business_address_street__c |  |
| `businessNumber` | TEXT | Client__c.business_number__c |  |
| `clientId` | TEXT | Client__c.Client_ID__c |  |
| `companyName` | TEXT | Client__c.Company_Name__c | duplicate of name — consider dropping |
| `country` | TEXT | Client__c.Country__c |  |
| `signupDate` | DATE_TIME | Client__c.Created_At__c |  |
| `creditAdditionalDocuments` | TEXT | Client__c.Credit_Additional_Documents__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditAutoCompanyIdentity` | TEXT | Client__c.Credit_Auto_Company_Identity__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditAutoIndividualIdentity` | TEXT | Client__c.Credit_Auto_Individual_Identity__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditBankDetails` | TEXT | Client__c.Credit_Bank_Details__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditBureau` | TEXT | Client__c.Credit_Bureau__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditCompanyIdentity` | TEXT | Client__c.Credit_Company_Identity__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditFinancials` | TEXT | Client__c.Credit_Financials__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditFraudCheck` | TEXT | Client__c.Credit_Fraud_Check__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditIndividualIdentity` | TEXT | Client__c.Credit_Individual_Identity__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditIndustryCode` | TEXT | Client__c.Credit_Industry_Code__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditLegalDocuments` | TEXT | Client__c.Credit_Legal_Documents__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditLienPosition` | TEXT | Client__c.Credit_Lien_Position__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditLimit` | NUMBER | Client__c.Credit_Limit__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `creditRedFlag` | TEXT | Client__c.Credit_Red_Flag__c | ⚠ compliance status — shown in Flow dashboard. |
| `creditTaxStatus` | TEXT | Client__c.Credit_Tax_Status__c | ⚠ compliance status — shown in Flow dashboard. |
| `currency` | TEXT | Client__c.Currency__c |  |
| `daysSinceLastAdvance` | NUMBER | Client__c.Days_Since_Last_Advance__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `drLimitPostCredit` | CURRENCY | Client__c.DR_Limit_Post_Credit__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `drLimitTemp` | CURRENCY | Client__c.DR_Limit_Temp__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `email` | EMAILS | Client__c.Email__c | primary contact email — consider Person instead |
| `expectedLifetimeMonths` | NUMBER | Client__c.Expected_Lifetime_Months__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `expectedLifetimeValueCad` | CURRENCY | Client__c.Expected_Lifetime_Value_CAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `expectedRevenueAmountCad` | CURRENCY | Client__c.Expected_Revenue_Amount_CAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `firstAdvanceDate` | DATE_TIME | Client__c.First_Advance_Date__c |  |
| `firstName` | TEXT | Client__c.First_Name__c | person data — consider dropping (lives on Person) |
| `ftxUserID` | TEXT | Client__c.FTX_User_ID__c |  |
| `fundingType` | TEXT | Client__c.Funding_Type__c |  |
| `hasEverBeenInDefault` | BOOLEAN | Client__c.Has_Ever_Been_In_Default__c |  |
| `howDidYouHearAboutUs` | TEXT | Client__c.How_Did_You_Hear_About_Us__c |  |
| `isActive` | BOOLEAN | Client__c.Is_Active__c |  |
| `isProActivated` | BOOLEAN | Client__c.Is_PRO_Activated__c |  |
| `jobTitle` | TEXT | Client__c.Job_title__c | person data — consider dropping |
| `lastAdvanceDate` | DATE_TIME | Client__c.Last_Advance_Date__c |  |
| `lastBalanceDate` | DATE_TIME | Client__c.Last_Balance_Date__c |  |
| `lastName` | TEXT | Client__c.Last_Name__c | person data — consider dropping |
| `lifetimeMonths` | NUMBER | Client__c.Lifetime_Months__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `marketingSource` | TEXT | Client__c.Marketing_Source__c |  |
| `marketingSourceCategory` | TEXT | Client__c.Marketing_Source_Category__c |  |
| `migrationPartner` | TEXT | Client__c.Migration_Partner__c |  |
| `numAdvances` | NUMBER | Client__c.Num_Advances__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `numOutstandingInvoices` | NUMBER | Client__c.Num_Outstanding_Invoices__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `outstandingAmountCad` | CURRENCY | Client__c.Outstanding_Amount_CAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `phone` | PHONES | Client__c.Phone__c |  |
| `preApprovalCreditLimit` | CURRENCY | Client__c.Pre_Approval_Credit_Limit__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `preApprovalDecision` | TEXT | Client__c.pre_approval_decision__c |  |
| `prequalifiedLimit` | TEXT | Client__c.Prequalified_Limit__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `profileApproval` | BOOLEAN | Client__c.Profile_Approval__c |  |
| `provisionAmountCad` | CURRENCY | Client__c.Provision_Amount_CAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `recommendedCreditLimit` | CURRENCY | Client__c.Recommended_Credit_Limit__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `referringPartner` | TEXT | Client__c.Referring_Partner__c |  |
| `revenueAmountCad` | CURRENCY | Client__c.Revenue_Amount_CAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `score` | TEXT | Client__c.Score__c |  |
| `sourceSystem` | TEXT | Client__c.Source_System__c |  |
| `totalAdvancedCad` | CURRENCY | Client__c.Total_Advanced_CAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `totalAdvancedUsd` | CURRENCY | Client__c.Total_Advanced_USD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `totalOutstandingAmountCad` | CURRENCY | Client__c.Total_Outstanding_Amount_CAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `totalOutstandingAmountTocad` | CURRENCY | Client__c.Total_Outstanding_Amount_TOCAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `totalOutstandingAmountUsd` | CURRENCY | Client__c.Total_Outstanding_Amount_USD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `triageProduct` | TEXT | Client__c.Triage_Product__c |  |
| `updatedAt` | DATE_TIME | Client__c.Updated_At__c |  |
| `writeOffAmountCad` | CURRENCY | Client__c.Write_Off_Amount_CAD__c | ⚠ backend metric — live in Flow dashboard; keep only if list-view filtering needed. |
| `description` | TEXT | Account.Description |  |
| `industry` | SELECT | Account.Industry |  |
| `type` | SELECT | Account.Type |  |
| `churnDate` | DATE | Account.Churn_Date__c |  |
| `churnReason` | SELECT | Account.Churn_Reason__c |  |
| `commissionRate` | NUMBER | Account.Commission_Rate__c |  |
| `commissionType` | SELECT | Account.Commission_Type__c |  |
| `criticalAccount` | BOOLEAN | Account.Critical_Account__c |  |
| `default` | BOOLEAN | Account.Default__c |  |
| `expectedGoLiveDate` | DATE | Account.Expected_Go_Live_Date__c |  |
| `keyAccount` | BOOLEAN | Account.Key_Account__c |  |
| `kyc` | BOOLEAN | Account.KYC__c |  |
| `kycDate` | DATE | Account.KYC_Date__c |  |
| `noaPolicy` | SELECT | Account.NOA_Policy__c | also pair-level on ClientPayorLink — decide level |
| `partnerStage` | SELECT | Account.Partner_Stage__c |  |
| `persona` | SELECT | Account.Persona__c |  |
| `riskNotes` | TEXT | Account.Risk_Notes__c |  |
| `source` | TEXT | Account.Source__c |  |

### TermSheet (24)

| Twenty Field | Type | Import Source | Notes |
|---|---|---|---|
| `name` | TEXT | derived: Facility Terms — {Client} |  |
| `status` | SELECT DRAFT/SENT/NEGOTIATING/SIGNED/EXPIRED/DECLINED | derived (SIGNED if source doc says SIGNED) |  |
| `onboardDate` | DATE | audit col: Onboard date |  |
| `facilityFeeQuote` | TEXT | audit col: Exact quote disclosing the fee |  |
| `disclosureBucket` | SELECT A/B/C/D | audit col: Disclosure bucket |  |
| `disclosureSourceDoc` | TEXT | audit col: Disclosure source doc |  |
| `documentLink` | LINKS | audit col: Source link (Drive) |  |
| `facilityFeeCharged` | CURRENCY | parsed from audit col: Facility fee charged (native ccy) |  |
| `facilityFeeChargedNote` | TEXT | audit col: Charged a facility fee? (raw) |  |
| `disclosureChargeMatch` | SELECT MATCH/CONFLICT/NONE | audit col: Disclosure-vs-charge match? |  |
| `auditConfidence` | SELECT HIGH/MED/LOW | audit col: Confidence |  |
| `minRequirement` | TEXT | audit col: Min funding/balance requirement |  |
| `minRequirementMet` | SELECT MET/NOT_MET/REVIEW/NA | audit col: Met minimum requirement? |  |
| `notes` | RICH_TEXT | audit col: Notes |  |
| `creditLimit` | CURRENCY | no source yet — doc-extracted later |  |
| `advanceRate` | NUMBER | no source yet — doc-extracted later |  |
| `fundingFeeRate` | NUMBER | no source yet — doc-extracted later |  |
| `transactionFeeRate` | NUMBER | no source yet — doc-extracted later |  |
| `currency` | SELECT CAD/USD | no source yet — doc-extracted later |  |
| `termDays` | NUMBER | no source yet — doc-extracted later |  |
| `validUntil` | DATE | no source yet — doc-extracted later |  |
| `sentAt` | DATE | no source yet — doc-extracted later |  |
| `signedAt` | DATE | no source yet — doc-extracted later |  |
| `(relation) company` | MANY_TO_ONE → Company | client-name match at import |  |

### Task (7)

| Twenty Field | Type | Import Source | Notes |
|---|---|---|---|
| `activityDate` | DATE | Task.ActivityDate |  |
| `description` | TEXT | Task.Description |  |
| `priority` | SELECT | Task.Priority |  |
| `status` | SELECT | Task.Status |  |
| `subject` | TEXT | Task.Subject |  |
| `type` | SELECT | Task.Type |  |
| `(targets)` | TaskTarget | Task.WhoId / Task.WhatId | → Person / Company |

## Build Status (2026-07-09)

- ✅ App **built and synced to local Docker** (`localhost:2020`, twenty-sdk 2.9.1, CLI remote `local`): Person 29 customs (incl. leadStatus kanban field) · Company 21 customs (incl. applicationStatus — added back per Linesh) · TermSheet object (23 fields) · Task priority/taskType · 3 relation pairs · Lead Pipeline KANBAN view · Term Sheets view · nav items · flow-company-profile front component · post-install (Company Profile tab on Default Company Layout)
- **Model corrections applied at build**: Company = standard Twenty object (reverted from custom ClientCompany); reserved names renamed (`type`→clientType/accountType/taskType, `currency`→termCurrency); option labels sanitized (commas stripped, ≤62 chars); `companyId` TEXT
- 🔄 **Seeding with real SF data**: 366 clients signed up 2026-05-09→2026-07-09 + 389 linked leads (from live SF API), throttled to the local 100 req/min limit, idempotent by sfClientId/sfLeadId

## Demo Verification (2026-07-10) — success criteria pass

Curated demo re-seed: **21 funded companies (all with PRO companyId) · 47 people across kanban stages · 18 term sheets (18/18 linked to companies) · 5 payor-reachout tasks (targeted) · 2 audit notes (targeted)**. Verified in the UI via Playwright.

**Post-sync fixes that `twenty app sync` cannot express — consolidated in `scripts/setup-workspace.mjs` (idempotent, run after every sync incl. cloud deploy):**
1. **Record-page Fields panel**: SDK-synced custom fields get NO viewField rows on the per-object "… Record Page Fields" view, and viewFields without a `viewFieldGroupId` never render. Fix = createViewField + createViewFieldGroup ("Client Details" / "Lead Details" / "Details") + assign.
2. **Kanban columns**: `mainGroupByFieldMetadataUniversalIdentifier` alone renders an EMPTY board — one `createViewGroup` per SELECT option (+ hidden `''` group) is required.
3. **Company Profile tab**: post-install originally queried `findManyApplicationRegistrations { frontComponents }` which is invalid on server 2.9.2 → silently no tab. Fixed to top-level `{ frontComponents }`; setup script is the backstop.
4. **Term Sheets relation panel** replaces the default Opportunities panel on the Company Home tab; **Leads nav** = VIEW-type nav item pointing at the Lead Pipeline view.
5. **Task/Note targets** use morph inputs (`targetCompanyId`, not `companyId`) on this server version.

**Data-truth notes (verified against SF):**
- Company partner-oriented fields (commissionRate/Type, partnerStage, persona, noaPolicy, keyAccount, criticalAccount, kycDate, expectedGoLiveDate, riskNotes, source, accountType) are **genuinely empty in SF** for these 21 client accounts — empty in Twenty is correct. They stay in the model for the fuller import.
- TermSheet creditLimit/advanceRate/fee rates/termDays/validUntil/sentAt/signedAt have **no source yet** (doc-extracted later per audit-sheet plan) — expected empty.
- ⚠️ **SF Industry picklist is UNRESTRICTED**: stored Account/Lead values (e.g. "Oil & Gas Exploration & Services", "Business Services") are outside the 32 defined picklist values. Demo fix: 6 extra options appended to company/person `industry` SELECTs (source files updated). **Full-import decision needed**: bucket-map the long tail vs convert industry to TEXT.
- Flow hosts answer **503 via the AWS ALB when off the FundThrough VPN** — connect VPN before demoing the embed.

**Embed architecture (final for demo — 2026-07-10):** the FlowWidget JS mount from EmbeddedDashboards.md CANNOT run inside a Twenty front component on this server version:
1. the front-component sandbox neuters `document.head` script injection (script tag never lands),
2. dynamic `import()` of bundle.js fails — Flow serves it **without an `Access-Control-Allow-Origin` header** (module imports require CORS; classic scripts don't),
3. iframes rendered BY front components are force-sandboxed without `allow-same-origin` (origin `null` → Flow can't boot or auth),
4. `client.query` singular record queries take a `filter` arg, not `id` (`{ company: { __args: { filter: { id: { eq } } } } }`).

Final layout on the "Company Profile" tab (cloud-deploy ready — no local helpers) — **a GRID-mode tab** (rowSpan drives height; VERTICAL_LIST collapses iframes to the 150px browser default, and `updatePageLayoutTab` silently ignores layoutMode — GRID must be set at tab creation):
- rows 0-1: FRONT_COMPONENT `flow-company-profile` — invisible when the record has a valid numeric companyId; warning when the id is missing (not productionized), error when it's non-numeric ("not found in Flow" for a wrong-but-numeric id can't be checked client-side)
- rows 2-13: native IFRAME widget → the Flow dashboard URL (staging locally, `https://flow.fundthrough.com/hitl/dashboards/company_profile` at deploy), title blanked via update (create rejects empty titles; the URL validator also rejects `localhost` hostnames — no TLD)

**Auth model:** AMs are signed into Flow in their browser anyway; the iframe shares the Flow origin's session, so the dashboard renders without any embedded sign-in. (Popups launched from inside the iframe are sandbox-inherited and Google blocks them — if a user is not signed into Flow, they sign in at flow.fundthrough.com in a normal tab first, then the embed works.)

**Per-record preselect — not possible on current Twenty (cloud or self-hosted), by elimination:**
- IFRAME widget URLs are static (no record variables; verified against upstream twentyhq/twenty)
- the front-component sandbox cannot host the FlowWidget JS mount: `<script>` injection is neutered, `import()` executes inside a compartment whose DOM shim is incomplete (`getElementById`, `classList`, …), rendered `<iframe>`s are force-sandboxed without `allow-same-origin`, and `<object>`/`<style>` elements are stripped
- so the embedded dashboard opens on Flow's own search; the AM finds the company there (Company Id is pinned at the top of the record's Fields panel)

**Unlock paths (EE-4992, in preference order):**
1. Flow serves `/bundle.js` with `Access-Control-Allow-Origin` **and** Twenty matures the front-component sandbox → mount FlowWidget in the component with record-scoped `dashboardArguments` (companyId preselect, enabledTabs) — the EmbeddedDashboards.md design
2. Upstream Twenty feature: record variables in IFRAME widget URLs (`{{record.companyId}}`) — worth filing/contributing; then the URL carries the id and Flow's dashboard reads `?company_id=` (Frans to confirm param support)

Other sandbox findings: a FRONT_COMPONENT widget renders a "No Data" pill whenever its content is empty or clipped — always render a visible full-width wrapper and size the widget generously. Known platform quirk: deep-linking straight to a #tab-hash URL can race front-component metadata and show "No Data"; normal navigation (open record → click tab) renders.

- Next: Linesh walkthrough → sign-off → EE-4969 cloud deploy (run `setup-workspace.mjs` against the cloud remote after sync)

## SF → Twenty Use-Case Divergences (validated model — known behavioral gaps)

Things SF did that the lean Twenty model deliberately does differently. Flag in training (EE-4973) and revisit only if they bite:

1. **Lead conversion is manual.** SF's Convert button spawned Account+Contact and rewired history. Twenty: AM flips `lifecycleStage` LEAD→CONVERTED and links the Company by hand (or a later Twenty workflow automates it). No auto-created Company.
2. **No stage-change validation.** SF validation rules forced e.g. a Disqualified Reason when Status=Disqualified. Twenty kanban drag enforces nothing — a card can sit in Disqualified with an empty `disqualifiedReason`. Mitigation: Twenty workflow on update, or team convention + a "DQ missing reason" filtered view.
3. **Stage-duration analytics lost with the `*_Start_Date` fields.** SF workflows stamped ~15 per-stage timestamp fields (all dropped). Funnel-velocity reporting must come from Twenty timeline events or the warehouse — not record fields.
4. **List views can't filter on backend metrics anymore.** Dropping the DWH-synced fields means "clients with outstanding > $500k" is a Flow-dashboard question, not a Twenty list filter. Only name/companyId refresh in Twenty.
5. **No field history audit.** SF tracked field history (LeadHistory). Twenty shows timeline activity but no per-field audit trail for arbitrary fields — compliance-style "who changed the NOA policy when" queries need the timeline, which is coarser.
6. **No duplicate rules.** SF matched new Leads on email. Import dedupes once; after cutover, manual entry can create duplicate People/Companies silently. Convention + periodic dedupe pass.
7. **No assignment automation.** SF queues/round-robin don't exist; owner assignment is manual (workspaceMember). Lead routing is a human step or a future workflow.
8. **Payor reachouts have no pipeline.** As Tasks, there's no kanban/reporting on reachout size or close date (free text in body). If AMs want payor-pipeline metrics, that's the trigger to move it into the case-mgmt tool (EE-4930).
9. **Single record layout for everyone.** SF varied layouts by profile (Sales vs CS vs Finance). Twenty's Default layout is shared — all roles see the same record page (widget tab included).
10. **Required fields are soft.** SF enforced required-at-save (e.g. Last_Name, Email on Client__c). Twenty's creation drawer only requires the name field — completeness of email/phone/status relies on convention.

## Gates

1. ⛔ **Field validation** — Linesh marks Keep? per row in "Field Mapping v3" tab → validated list = EE-4966 build spec
2. ⛔ **Local seed verification** — seeded Docker walkthrough (incl. M:N both directions + FlowWidget tab) + sign-off before EE-4969 cloud deploy
3. ⛔ **Import** — only after both gates
