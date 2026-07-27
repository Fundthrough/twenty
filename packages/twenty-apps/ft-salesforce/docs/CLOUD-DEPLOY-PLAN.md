# Cloud Deploy Plan — ft-salesforce → SALES workspace (fundthrough.twenty.com)

Status: **PLAN — awaiting Linesh's verification on the gate items below.** Target: EE-4969.
Sequence: deploy app + Marketo intake → verify → **then** SF data import (EE-4970/71).

## Scope guard: two unrelated apps, two unrelated workspaces — NEVER cross

| App (packages/twenty-apps/) | Source system | Workspace | Domain | Key | workspaceId |
|---|---|---|---|---|---|
| **ft-salesforce** (THIS deploy) | Salesforce | **Sales** | fundthrough.twenty.com | `$TWENTY_BO_API_KEY` | `3ae378c2-…5501` |
| hubspot-partner (done, out of scope) | HubSpot | Partner | fundthrough-uz0tn18a.twenty.com | `$TWENTY_PARTNER_KEY` | `1d129a03-…8a05` |

Hard rule (also in repo CLAUDE.md/AGENTS.md): an app syncs ONLY to its own workspace.
Before any cloud sync, decode the key's JWT `workspaceId` claim and check the CLI remote.
The one historical violation is the stale `"cloud"` remote (hubspot registration bound to
the SALES workspaceId — appRegistrationId `11396add-d4a5-4837-8520-ccc9d9c26777`, application
`df2d5a87-a33e-4e7f-99e7-7d4b44dc4e56`; ids preserved here for cleanup step 2b) — that
remote is quarantined in `~/.twenty/config.json` and must never be synced again.

## Known state of the sales workspace (per Linesh + read-only inspection)

⚠️ **The sales workspace likely still carries OLD demo artifacts** — early demo data model
and demo workflows from prior experiments. Inspection confirmed: `hsPartnerDeal` object +
`hs*` fields (from the mis-scoped HubSpot registration on the stale `"cloud"` remote),
`Create company when adding a new person` + `Quick Lead` workflows ACTIVE, 301 companies /
528 people (258 HubSpot-imported), junk `testCurrency14345`, 16 opportunities, and
sales-team-era fields on company (`clientStatus`, `fundingType`, advance dates,
`totalAdvancedCAD`, `creditLimit`, `sfAccountId` w/ 10 values, …).

**Step 0 therefore starts with a full audit + cleanup pass, not just an app sync.**
Cloud API delta confirmed: `isCustom` removed from metadata (scripts already converted to
`applicationId` ownership detection); everything else setup-workspace needs exists.

## What deploys (all built + verified locally 2026-07-14)

- **Data model**: Company std + 21 customs (incl. `companyId`, `clientId` ← Account.Client_ID__c,
  `applicationStatus`) · Person + 36 customs (incl. `leadStatus` kanban field + the 7 Marketo
  fields: `businessRegisteredIn`, `annualRevenueBand`, `desiredFundingBand`,
  `primaryReasonForFunding`(+Other), `invoicePlatformsOther`, `howDidYouHearAboutUsOther`) ·
  TermSheet (23) · Task priority/type · 3 relation pairs · NAICS industry options + Ampla/
  Marketo option additions
- **Views/nav/layout** (via `setup-workspace.mjs`, idempotent, cloud-compatible):
  record-page field groups, Lead Pipeline kanban (11 columns), GRID Company Profile tab
  (Flow embed), Term Sheets panel + nav, Leads nav, **Opportunity deactivated**
- **Marketo intake**: `POST /s/marketo/intake` logic function — upserts Person by email,
  maps all form answers (live-form values verified), find-or-creates Company by name
  (controlled replacement for the deleted stock auto-create workflow). Simulator:
  **31/31 checks, repeatable, self-cleaning** (`scripts/simulate-marketo.mjs`)

## ⛔ NEEDS LINESH'S VERIFICATION (the gate)

| # | Decision | Recommendation |
|---|---|---|
| 1 | ~~HubSpot cleanup scope~~ **RESOLVED (Linesh 2026-07-14): ZERO HubSpot anything in sales** — all hs metadata and HS-imported records wiped | — |
| 2 | ~~Existing records~~ **RESOLVED (Linesh 2026-07-14): "I don't need any data in the sales workspace" → FULL RECORD WIPE** — all companies, people, opportunities, tasks, notes (delete + destroy). Clean slate; content arrives only via Marketo intake + the SF import | — |
| 3 | ~~sfAccountId collision~~ **RESOLVED — dissolved by decision 2**: the old demo `sfAccountId` field (and its 10 values) is deleted in cleanup; the app ships its own field unchanged | — |
| 4 | ~~Workflows~~ **RESOLVED — both demo workflows deleted** (`Create company when adding a new person` — replaced by Marketo intake; `Quick Lead` — demo leftover, no data retained) | — |
| 5 | ~~Opportunity records~~ **RESOLVED — wiped with everything else**; object deactivated by setup-workspace | — |
| 6 | ~~Embed URL~~ **RESOLVED: the embed page is final** — `flow-handover/embed.html` with production URLs (prod bundle + prod BFF), verified working locally. Cloud needs the one static file hosted on the Flow origin (hand `flow-handover/embed.html` + `diff.html` to Frans; note: `flow.fundthrough.com/embed.html` currently answers 200 but that's the SPA catch-all shell, NOT a hosted page). Until hosted, `FLOW_EMBED_URL` falls back to the HITL dashboard URL — swappable post-deploy without a resync | — |
| 7 | ~~Marketo cutover~~ **RESOLVED (Linesh): dual-write** — Marketo→SF stays on; Marketo→Twenty added in parallel; cutover later = disable the SF campaign | — |

**All gate decisions resolved — remaining input is only the final "go" (+ forwarding
`flow-handover/embed.html` to Frans, non-blocking).**

## Execution steps (after sign-off)

1. **Audit** (read-only script vs sales workspace): full inventory of app registrations,
   non-standard fields/objects, views, nav items, workflows, page layouts + record counts
   → recorded as the pre-wipe manifest (for the record; nothing is being kept).
2. **Cleanup — full reset** (records first, then metadata):
   a. wipe ALL records: tasks, notes, opportunities, people, companies — delete + destroy
      both passes (soft-deleted rows keep unique indexes occupied); same pattern as the
      local `wipe-records` script, throttled to cloud rate limits
   b. uninstall the mis-scoped HubSpot app registration (ids in the scope-guard section),
      then delete surviving hs* fields (`{input:{id}}`), hsPartnerDeal object, HS views/nav
   c. delete old demo fields on company/person (incl. the old `sfAccountId`,
      `testCurrency14345`, `clientStatus`-era set) — everything not standard-Twenty
   d. delete demo workflows (`Create company when adding a new person`, `Quick Lead`;
      core `deleteWorkflow(id)` if deactivate 403s).
   End state: standard Twenty objects only, zero records — content arrives exclusively via
   Marketo intake and the SF import.
3. **Remote + app sync**: add remote `sales` (BO key, NO appRegistrationId — fresh
   registration; never reuse the quarantined entry), then `npx twenty -r sales dev --once`
   (app ships unchanged, incl. its own `sfAccountId`).
4. **Workspace setup**: `TWENTY_REMOTE=sales [FLOW_EMBED_URL=…] node scripts/setup-workspace.mjs`
   (low-usage window; all additive except the Opportunities swap + deactivation).
5. **Verify** — with a phased embed URL (the iframe URL is workspace metadata; swapping it
   is one `updatePageLayoutWidget` mutation or a `FLOW_EMBED_URL=… setup-workspace` rerun,
   never an app resync):
   - **Phase A — Linesh-only validation (before contacting Frans):** set the iframe URL to
     `http://127.0.0.1:5500/embed.html`. Iframes render in the viewer's browser, so on
     Linesh's machine (Live Server + relay running) the cloud tab shows the FULL local
     experience — clean widget, per-record preselect via the relay. Validate: scratch
     company with companyId+clientId, Client Details group, kanban 11 columns, Marketo
     simulator smoke (`TWENTY_REMOTE=sales node scripts/simulate-marketo.mjs`).
     Caveats: works only on the machine running the local servers (anyone else sees a
     broken frame — fine for a validation window); Chrome may show a one-time
     "allow access to local network" permission prompt for the https→localhost frame.
   - **Phase B — swap to shared URL:** HITL dashboard URL (works for everyone, portal
     chrome) until Frans hosts `flow-handover/embed.html`.
   - **Phase C — final:** `https://flow.fundthrough.com/embed.html?tabs=…` once hosted
     (clean widget for all users; params adjustable from the Twenty side anytime).
6. **Marketo wiring** (needs the public URL — only possible now):
   a. Mint a dedicated `marketo-intake` API key in the sales workspace (Settings → API),
      share with the Marketo admin as the webhook `Authorization` header.
   b. Admin: webhook (URL `https://fundthrough.twenty.com/s/marketo/intake`, POST, JSON
      template of lead tokens per docs/MARKETO-INTAKE.md field table) + smart campaign
      (*Fills Out Form* → *Call Webhook*) on a TEST form first.
   c. Submit test lead → verify person+company in sales workspace → enable on the real
      Get Started form (dual-write with SF per decision 7).
   d. Simulator re-run against cloud as smoke test: `TWENTY_REMOTE=sales node scripts/simulate-marketo.mjs`
      (self-cleaning; uses marketo.test+ emails).
7. **→ SF data import (EE-4970/71, separate gate)**: companies before people, upsert by
   `companyId`/`clientId`, dedupe against the existing 301 companies (merge-vs-replace
   decision), auto-create workflow already gone, throttle per cloud rate limits.

## Rollback
`app:uninstall` removes the registration; metadata persists — reversal needs the delete
path (deleteOneField/deleteOneObject/deleteView/destroyPageLayoutTab). Keep setup-workspace
output. Marketo: pause the smart campaign (SF path still live under dual-write). Reactivate
opportunity/workflows if missed.

## Out of scope
Partner workspace (untouched) · Flow-side work (Frans: embed.html hosting, bundle.js CORS,
Google origins) · sales-team field sunsetting · Opportunity record migration.
