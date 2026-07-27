# Agents: twenty

## Repo Overview

Twenty is an open-source CRM that FundThrough is customizing for internal CRM needs. The codebase is an Nx monorepo. Work here involves adapting upstream Twenty for FundThrough's business domain rather than contributing back to the OSS project.

## Tech Stack

- **Frontend**: React 18, TypeScript 5, Jotai (atoms/selectors), Linaria CSS-in-JS, Vite, Apollo Client (GraphQL)
- **Backend**: NestJS, TypeORM, PostgreSQL, Redis (sessions/cache), BullMQ (job queue), GraphQL Yoga
- **Tooling**: Nx 22.5.4, Yarn 4, Jest, Playwright (E2E), Storybook, oxlint
- **AI integrations**: Vercel AI SDK with Anthropic, OpenAI, Azure, Bedrock, Mistral, xAI, Google adapters
- **Other**: ClickHouse (analytics), AWS S3, SES, Lambda

## Architecture

### Monorepo packages (key ones)
- `twenty-front` — React SPA, lives at `packages/twenty-front/src/modules/` organized by feature domain
- `twenty-server` — NestJS API, `src/modules/` for CRM domain objects (company, person, opportunity, messaging, workflow, etc.) + `src/engine/` for platform infrastructure
- `twenty-ui` — shared design system components
- `twenty-shared` — common types/utilities (`isDefined`, `isNonEmptyString`, `isNonEmptyArray`)
- `twenty-sdk` — public SDK for building apps on Twenty (`defineObject`, `defineViewField`, etc.)
- `twenty-cli` — `create-twenty-app` scaffolding tool
- `twenty-emails` — React Email templates
- `twenty-new-ui` — in-progress next-gen UI (scaffolded in #21236)

### Backend layers
- **Modules** (`src/modules/`): CRM domain objects — company, person, opportunity, messaging, workflow, call-recording, etc.
- **Engine** (`src/engine/`): platform infrastructure — metadata, workspace isolation, permissions, caching
- **Commands** (`src/command/`): instance commands (schema migrations) and workspace commands (per-workspace data upgrades)
- **Queue worker** (`src/queue-worker/`): BullMQ-powered background processing

### Frontend structure
- Feature modules under `src/modules/` (activities, auth, companies, objects, settings, workflow, ai, etc.)
- GraphQL types auto-generated via `npx nx run twenty-front:graphql:generate`
- State: Jotai atoms for global state, Apollo cache for server data

### Database model
- Multi-tenant: each workspace gets its own Postgres schema
- Core schema: auth, workspace config, billing
- Metadata schema: object definitions, field definitions, views
- Workspace schemas: actual CRM data per tenant

## Patterns

### Instance commands (schema migrations)
- Generated via `npx nx run twenty-server:database:migrate:generate --name <name> --type <fast|slow>`
- Auto-registered in `instance-commands.constant.ts` — never edit manually
- Fast commands: schema changes, run immediately on upgrade
- Slow commands: add `runDataMigration` step for backfills, only run with `--include-slow`
- Both must implement `up` and `down` logic

### Workspace commands
- Use `@RegisteredWorkspaceCommand` decorator
- Iterate all active/suspended workspaces
- Used for per-workspace data migrations during upgrade

### GraphQL code-first
- Define resolvers/types in NestJS with decorators
- Run `graphql:generate` after any schema changes to regenerate frontend types

### App extensibility (Twenty SDK)
- Apps define objects/fields/views via `defineObject`, `defineViewField`
- Published via `npx twenty app:publish --private`
- Logic functions run in the server for automation

## Anti-Patterns

- **Default exports** — named exports only throughout the codebase
- **Class components** — functional only
- **`any` type** — zero tolerance, will fail typecheck
- **Editing `instance-commands.constant.ts` manually** — always use the generator
- **Rewriting committed instance command `up`/`down` logic** — immutable once committed
- **Interface over type** — use `type` unless extending a third-party interface
- **Enums for non-GraphQL values** — use string literals instead
- **`useEffect` for state updates** — use event handlers
- **Abbreviations in variable names** — `fieldMetadata` not `fm`

## Gotchas

- **Linaria not styled-components** — architecture.mdc says "Styled Components" but CLAUDE.md is correct: it's Linaria (zero-runtime CSS-in-JS with same API surface)
- **`twenty-new-ui`** — scaffolded recently (PR #21236), currently empty; don't confuse with `twenty-ui`
- **GraphQL changes require regeneration** — `npx nx run twenty-front:graphql:generate` must run after any backend schema change
- **`twenty-shared` must build first** — build order: `twenty-shared` → `twenty-front` → `twenty-server`
- **Test login** — UI E2E: click "Continue with Email" and use prefilled credentials
- **Linting** — prefer `lint:diff-with-main` over full `lint` (much faster)
- **PR base branch** — global CLAUDE.md says `staging`, but check repo-specific convention; Twenty OSS uses `main`

## Key Commands

```bash
# Dev
yarn start                                          # full stack (front + server + worker)
npx nx start twenty-front                           # frontend only
npx nx start twenty-server                          # backend only
npx nx run twenty-server:worker                     # background worker

# Test
npx jest path/to/test.test.ts --config=packages/PROJECT/jest.config.mjs
cd packages/{workspace} && npx jest "pattern"
npx nx test twenty-front
npx nx test twenty-server
npx nx run twenty-server:test:integration:with-db-reset

# Quality
npx nx lint:diff-with-main twenty-front             # preferred
npx nx lint:diff-with-main twenty-server
npx nx typecheck twenty-front
npx nx typecheck twenty-server

# DB
npx nx database:reset twenty-server
npx nx run twenty-server:database:migrate:generate --name <name> --type <fast|slow>
npx nx run twenty-server:database:migrate:prod

# GraphQL
npx nx run twenty-front:graphql:generate
npx nx run twenty-front:graphql:generate --configuration=metadata
```

## Architecture Decisions

- **Nx workspace** chosen for monorepo tooling — task caching, dependency graph, affected commands
- **Jotai over Redux** — lighter weight, component-colocated atoms with selector composition
- **GraphQL code-first** — TypeScript types are source of truth, not SDL files
- **Per-workspace Postgres schemas** — strong tenant isolation at the DB level
- **Instance commands over TypeORM migrations** — gives fine-grained control over fast vs slow paths during upgrades


## ⛔ App ↔ Workspace Isolation (MANDATORY — Linesh 2026-07-14)

Two FundThrough apps, two cloud workspaces, **zero overlap**. Never sync, import, clean, or
plan across this boundary — an accidental cross-sync corrupts a production workspace.

| App | Source system | Workspace | Domain | Key env var | workspaceId (JWT claim) |
|---|---|---|---|---|---|
| `packages/twenty-apps/ft-salesforce` | Salesforce | **Sales** | fundthrough.twenty.com | `TWENTY_BO_API_KEY` | `3ae378c2-3871-4fff-8c69-b4dff2bd5501` |
| `packages/twenty-apps/hubspot-partner` | HubSpot | **Partner** | fundthrough-uz0tn18a.twenty.com | `TWENTY_PARTNER_KEY` | `1d129a03-6077-4541-8366-f4bdbed18a05` |

Rules:
1. **Before ANY cloud sync/import**: decode the API key's JWT `workspaceId` claim and confirm
   it matches the app's row above. Check `~/.twenty/config.json` remote + `defaultRemote`.
2. Reading the OTHER app's **source code** for SDK patterns is fine; touching its workspace is not.
3. The remote `QUARANTINED-do-not-sync-hubspot-misregistration-on-sales` in
   `~/.twenty/config.json` is the historical violation (hubspot registration bound to the
   sales workspaceId). NEVER sync it — it exists only until the sales cleanup uninstalls
   that registration (CLOUD-DEPLOY-PLAN step 2b).
4. HubSpot data/metadata found in the sales workspace is contamination to be REMOVED, never
   a data source. Salesforce concepts never enter the partner workspace.

## Session Log

<!-- Sessions append here automatically via Stop hook -->

### 2026-06-19 — hubspot-partner app: full build, cloud deploy, data import, ZoomInfo, tasks

**SDK / API Gotchas (v2.9.1 vs v2.14.x cloud):**
- **[Gotcha]:** `twenty-sdk/define` subpath only in v2.9.1+; v0.9.0 exports from root. Match SDK to server version or builds fail.
- **[Gotcha]:** Single company query `company(id:"...")` removed in v2.14.x — use `companies(filter:{id:{eq:"..."}})`.
- **[Gotcha]:** Task body field is `bodyV2` (RICH_TEXT `{markdown, blocknote}`) in v2.14.x, not `body`.
- **[Gotcha]:** Task status valid values: `TODO`, `IN_PROGRESS`, `DONE` — NOT `WAITING`. HubSpot `NOT_STARTED` → `TODO`.
- **[Anti-pattern]:** `company:{connect:{id}}` fails for `Person.companyId` in v2.14.x cloud — use `companyId: id` directly.
- **[Gotcha]:** `TaskTargetCreateInput` fields are `targetCompanyId`/`targetPersonId` NOT `companyId`/`personId`.
- **[Gotcha]:** Phone country code must be ISO 2-letter (`"US"`) not `"+1"` — cloud server validation is strict.

**Layout / SDK Architecture:**
- **[Anti-pattern]:** `definePageLayout` creates a SEPARATE invisible layout. To add a tab to the standard Company/Person record, use `post-install` + metadata API: `createPageLayoutTab` + `createPageLayoutWidget` on the Default layout.
- **[Gotcha]:** Kanban board shows 0 columns until `createViewGroup` is called for each SELECT option after install. `mainGroupByFieldMetadataUniversalIdentifier` alone is not enough.
- **[Pattern]:** HTTP logic functions served at `/s/{path}` (NestJS controller prefix). Front components call them with `${TWENTY_API_URL}/s/{path}` + `Bearer ${TWENTY_APP_ACCESS_TOKEN}`.

**Data Import:**
- **[Gotcha]:** `domainName.primaryLinkUrl` has a unique constraint. On duplicate: retry CREATE without `domainName` to preserve all other fields (ARR, description, type, etc.).
- **[Gotcha]:** Twenty custom text fields have NO unique constraint — dedup by `hsHubspotId` must be done manually after multi-run imports.
- **[Gotcha]:** Two remotes with same URL but different API keys → "Failed to rotate client secret". Fix: clear `appRegistrationId` from `~/.twenty/config.json` for the conflicting remote.

**ZoomInfo Integration:**
- **[Pattern]:** ZoomInfo app credentials set via `createApplicationRegistrationVariable(input:{applicationRegistrationId, key, value, isSecret})`. Partner app reg ID: `453eed54-7c5d-43e0-b130-facb1a23670a`.
- **[Gotcha]:** ZoomInfo `/gtm/data/v1/companies/enrich` → 403 PFAPI0013 = account plan doesn't include Enrich product (NOT a scope issue). Contact ZoomInfo to enable.

**Deployment:**
- **[Decision]:** Repo stays on `twentyhq/twenty` remote — never push FT customizations upstream. Fork to FundThrough GitHub org when ready.
- **[Gotcha]:** Partner workspace `fundthrough-uz0tn18a.twenty.com` key = `$TWENTY_PARTNER_KEY`; FundThrough main = `$TWENTY_BO_API_KEY`. Keep separate — wrong key silently imports to wrong workspace.

### 2026-06-05 — Bootstrap
- Bootstrapped twenty repo into agentic memory system
- Confirmed: FundThrough customization (not upstream OSS contribution)
- Multi-tenant architecture: core + metadata + per-workspace Postgres schemas
- Linaria (not styled-components) for CSS-in-JS
- Instance commands are the migration system — generator must be used, never edit constant file manually
- `twenty-new-ui` package is newly scaffolded and currently empty

### 2026-07-14 17:01 — ft-salesforce: demo verification, Flow embed, cloud deploy prep

**Record-page UI metadata (all consolidated in `ft-salesforce/scripts/setup-workspace.mjs` — run after every app sync):**
- **[Gotcha]:** SDK-synced custom fields don't render on record pages — they need `createViewField` rows on the per-object "… Record Page Fields" view AND a `viewFieldGroupId` (group-less viewFields never render). **Why:** the Fields panel is a FIELDS widget driven by that view's groups.
- **[Gotcha]:** Record-page tabs must be created with `layoutMode: GRID` for widget heights — `updatePageLayoutTab` silently ignores layoutMode changes; VERTICAL_LIST ignores gridPosition (iframes collapse to the 150px browser default).
- **[Gotcha]:** A FRONT_COMPONENT widget renders a "No Data" pill whenever its output is empty or clipped (bare `<div/>`, stripped elements, message taller than its grid rows). Always render a visible full-width wrapper.
- **[Gotcha]:** Widget titles can't be empty at create — create with a title, then update to `""`. IFRAME widget URLs reject TLD-less hostnames (`localhost` fails; `127.0.0.1` passes).
- **[Gotcha]:** `deleteOneField` input is `{input:{id}}` NOT `{idToDelete}`. When admin mutations 403 (e.g. `deactivateWorkflowVersion`), deleting the workflow record via core CRUD (`deleteWorkflow(id)`) works.
- **[Gotcha]:** Twenty ships an ACTIVE "Create company when adding a new person" workflow that auto-creates domain companies from person emails, silently overriding explicit company links during imports — delete it before seeding.
- **[Gotcha]:** `updateOneObject(input:{id, update:{isActive:false}})` hides an object (nav/panels/search) but preserves its rows — used to retire Opportunity for sales.

**Front-component sandbox (embedding external apps):**
- **[Anti-pattern]:** Mounting a third-party JS widget (FlowWidget) inside a front component — impossible on 2.9.x: `<script>` injection neutered, `import()` runs in a compartment with an incomplete DOM shim (`getElementById`/`classList` missing), component-rendered `<iframe>`s force-sandboxed without `allow-same-origin` (origin `null`), `<object>`/`<style>` stripped.
- **[Pattern]:** External embeds = native IFRAME widget (keeps `allow-same-origin`) → same-origin host page running the widget JS. Per-record context via local relay: validator component on the HOME tab (side panel — runs on record open, any tab) posts the record id to `scripts/flow-embed-relay.mjs`; `flow-handover/embed.html` polls and re-mounts. **Caveat:** last-write-wins across browsers — single-presenter only.
- **[Gotcha]:** OAuth popups inside embedded iframes inherit the sandbox and Google blocks them (`ERR_BLOCKED_BY_RESPONSE`) — sign in top-level on the host page's origin once; the iframe reuses that origin's token.
- **[Gotcha]:** Flow hosts answer 503 via `awselb` when off the FundThrough VPN.

**Cloud deploy prep (sales workspace):**
- **[Gotcha]:** Newer cloud builds REMOVED `isCustom` from metadata Object/Field. Detect app-owned fields via `applicationId` resolved from `{ frontComponents { name applicationId } }` — filter `f.applicationId === ourAppId` (verified: matches exactly our fields, none of the workspace's own).
- **[Pattern]:** Verify which workspace an API key targets BEFORE any cloud operation: decode the JWT payload (`workspaceId` claim). BO key → sales `3ae378c2…`; partner key → `1d129a03…`. The stale `"cloud"` remote in `~/.twenty/config.json` binds a HubSpot registration to the SALES workspaceId — the wrong-key accident; hs artifacts observed in sales need separate triage.
- **[Decision]:** `company.clientId` (TEXT) ← `Account.Client_ID__c` (FT backend client UUID, 5,744 accounts filled) added per Linesh — key set now companyId (PRO numeric, upsert) · clientId (UUID) · sfClientId/sfAccountId. Opportunity dropped from the sales model entirely.
- **[Decision]:** Company Profile embed = GRID tab + single full-height IFRAME → `flow-handover/embed.html` (widget.html minus demo chrome, prod env), record id via relay; validator on side panel. Rejected: in-component mount (sandbox), `<object>`/srcdoc tricks (stripped), HITL portal URL (full chrome + session-stale company). Cloud path: Frans hosts embed.html on the Flow origin (`flow-handover/` ready) + Twenty record-variables-in-iframe-URL feature request. See docs/COMPANY-PROFILE-EMBED.md + docs/CLOUD-DEPLOY-PLAN.md.

**Tooling / SF:**
- **[Gotcha]:** Long-running `twenty dev` watcher goes stale (re-uploads the same checksum). Use `npx twenty dev --once`; hard-refresh after (SPA caches component modules by checksum).
- **[Gotcha]:** Local Docker runs the published `twentycrm/twenty-app-dev` image — patching the fork's frontend source does NOT affect it.
- **[Gotcha]:** SF org picklists (Industry at least) are unrestricted — stored data exceeds `describe()` values. Build SELECT options from `GROUP BY field` on real data, not describe. Import decision pending: bucket-map long tail vs TEXT.

### 2026-07-20 — Upstream issue filed: iframe record-context variables
- **[Reference]:** twentyhq/twenty#23073 — feature request to interpolate `{{record.id}}`/`{{record.<fieldName>}}` in IFRAME page-layout widget URLs (https://github.com/twentyhq/twenty/issues/23073). Filed after verifying no alternative exists on current main (iframe config is `{url}` only; no postMessage bridge; no related open issue/discussion). Unblocks Flow-embed per-record preselect when shipped; PR offer included. Linked from docs/COMPANY-PROFILE-EMBED.md.

### 2026-07-20 — Live Chrome debug: Flow /embed IS deployed to prod; param honored end-to-end
- **[Discovery]:** Frans's `https://flow.fundthrough.com/embed` route is LIVE in production (was 404 on 07-15). Widget renders the clean chrome-less profile with session auth.
- **[Discovery]:** Rewriting the widget iframe's `?companyId=` from the console (30612→27995 on the Kcm Holdings record) loads the correct company instantly — the embed honors the param; the ONLY missing link is Twenty injecting the record's field value (twentyhq/twenty#23073). The validator component's GraphQL fetch of companyId (visible in DevTools) runs in the front-component Web Worker — no DOM handle, cannot reach the sibling iframe.
- **[Gotcha]:** `fundthrough.twenty.com` now REDIRECTS to `fundthrough-sales.twenty.com` — webhook/endpoint URLs (Marketo intake, Dialpad webhook) should use the canonical `fundthrough-sales.twenty.com` host directly; redirects can downgrade POSTs.
- **[Fixed 2026-07-20]:** widget URL no longer pins companyId=30612 — now `/embed?...&allowSearch=true` (search mode) until #23073 ships. Applied live via updatePageLayoutWidget (needs `configurationType: 'IFRAME'` in the input or BAD_USER_INPUT); setup-workspace.mjs cloud default updated to match. Verified: Company Profile tab shows Flow's 'Find a company' search.

### 2026-07-20 — Dialpad integration DEPLOYED to sales ws (simulator 14/14)
- **[Discovery]:** FT Dialpad activity lives on USER lines — all sales departments dormant (30d: only Factoring Operations dept line had calls). Subscriptions target 7 named sales users (Moksh, Lyle, Alvaro, Vincent, Shivani, Allie, Francisco); add AMs via SALES_USERS in setup-dialpad.mjs.
- **[Gotcha]:** Dialpad list-calls API max limit=50 — limit=100 returns an error body that reads as "0 calls" if you swallow non-200s. Always check res.status.
- **[Gotcha]:** twenty-server only body-parses json/urlencoded/text-plain (main.ts useBodyParser). A JWT posted as application/jwt or bare-JWT-as-application/json NEVER reaches a serverRoute function (no body, no rawBody). text/plain works: body={raw:jwt} + rawBody. Real Dialpad delivery content-type TBD in log-only validation.
- **[Gotcha]:** Relation fields in SDK apps need BOTH sides defined as .field.ts files (inverse ONE_TO_MANY on the target object) — else FIELD_METADATA_NOT_FOUND at sync.
- **[Gotcha]:** person.phones on READ is split: primaryPhoneNumber=national ("4165550111") + primaryPhoneCallingCode ("+1") — phone matching must query the national form (OR e164 fallback).
- **[Pattern]:** App server variables settable via metadata API: createApplicationRegistrationVariable / updateApplicationRegistrationVariable (registration id from findManyApplicationRegistrations). Enabled full API-driven wiring incl. secret (never printed to transcript).

### 2026-07-20 — Dialpad delivery content-type resolved: JSON+token mode live
- **[Discovery/CONFIRMED]:** Dialpad JWT-mode webhooks POST with `Content-Type: application/jwt` — twenty-server never body-parses it (no body, no rawBody) → serverRoute functions cannot receive them. Seen in APPLICATION_LOG (eventLogs query, table APPLICATION_LOG — that's how to read app/function logs via API).
- **[Fix]:** webhook recreated WITHOUT secret (Dialpad JSON mode) + random `?token=` in the hook URL; dialpad-webhook resolver is dual-mode (JWT preferred when parseable someday; JSON+constant-time URL-token now). Webhook id 6360483906658304; DIALPAD_URL_TOKEN app variable (secret).
- **[Gotcha]:** Deleting a Dialpad webhook ORPHANS its subscriptions (disabled, webhook undefined) — it does not cascade-delete. PATCH /subscriptions/call/{id} requires the FULL config (call_states AND target_type/target_id) — a partial PATCH silently resets the target to company-wide, which then 409s every other subscription as "overlapping".
- **[TODO]:** file upstream twentyhq/twenty issue: accept `application/jwt` in the text body parser (one line in main.ts) so signed webhook JWTs (Dialpad et al.) can reach serverRoute functions — then flip back to JWT mode (DIALPAD_USE_JWT=1 path in setup-dialpad.mjs).

### 2026-07-20 — SMS capture live + how-it-works doc; no per-call Dialpad deep link
- **[Feature]:** SMS events now captured — 7 per-user /subscriptions/sms subs on webhook 6360483906658304; Call outcome SMS + messageText field; ids prefixed `sms-<id>`. Body text needs Message content export scope (not on current key — scopes fixed at mint; re-key to get bodies).
- **[Fix]:** recording capture used wrong field name — real call payloads use `admin_recording_urls` (not admin_call_recording_urls); handler now checks both + recording_details.
- **[Confirmed]:** Dialpad exposes NO per-call web/share link in the API (full field surface checked); nearest = recording URL + dialpadCallId (searchable in Dialpad). Stats API 401s on our key (scope); Meetings audit needs Dialpad Meetings read scope. Users are `agents` license.
- **[Doc]:** docs/DIALPAD-HOW-IT-WORKS.md (team-facing) alongside DIALPAD-SETUP.md (ops).

### 2026-07-20 — Meetings/SMS audit (full-scope key) + SMS subs re-minted
- **[Data]:** Dialpad Meetings UNUSED at FT (13 rooms, 0 meetings/90d) — meetings track = Twenty Call Recorder app, not Dialpad. SMS heavy: Vincent Grassa ~200+/mo (65/day peak), Allie 10-25/day; also texting (non-synced): Kelli Mclean, Ellyn Edwards, Gabriel Werkhaizer. Stats API works with full-scope key (POST /stats texts export, group_by user).
- **[Change]:** 7 SMS subscriptions deleted + recreated under the new all-scopes key (Message content export) so event deliveries can include text bodies. New sub ids 5332…/4831…/6237…/4881…/4755…/5630…/6707…. Pending: test SMS to confirm text arrives.

### 2026-07-20 — Workspace layout cleanup (setup-workspace.mjs §7)
- **[Change]:** Nav deduped (People ×3, Companies ×2 removed) + Leads-first order (Leads kanban = login landing); pipeline view renamed "Leads"; HS Companies/HS Contacts + opportunity views deactivated; All Calls INDEX view + Call/TermSheet record-page field groups created; All Companies/All People columns curated (customs forward, empty noise hidden).
- **[Gotcha]:** metadata API shapes: updateNavigationMenuItem takes UpdateOneNavigationMenuItemInput {id, update}; updateView takes (id: String!, input: UpdateViewInput) — not {id} inside input; createView REQUIRES icon; FIELDS_WIDGET is a view type (record-page fields panel).
- **[Gotcha]:** deleteView = deactivate (isActive:false, removed from UI); destroyView returns true but is a NO-OP on active rows; getViews keeps returning inactive views — idempotency checks must filter isActive.
- **[Gotcha]:** freshly created views lag several seconds before getView/child mutations see them — retry loops needed.

### 2026-07-20 — Flow per-record embed SOLVED via same-origin bridge (Frans's pattern, ported)
- **[Breakthrough]:** `/s/flow-bridge` logic function serves an HTML page on TWENTY's origin → IFRAME widget (static URL, allow-same-origin) loads it → page reads `window.parent.location.pathname` (legal, same-origin) → record UUID → `/s/flow-bridge/resolve` (CoreApiClient) → companyId → `location.replace(flow.fundthrough.com/embed?companyId=X)`. Iframe ends up first-party on Flow's origin → Google session works, remounts re-run the bridge. VERIFIED: Kcm record auto-loads KCM (27995).
- **[Insight]:** every prior "blocker" tried to push the record id INTO a cross-origin iframe URL. The bridge PULLS it from the parent while same-origin, then jumps origins. httpRoute logic functions returning text/html = a page host on the CRM origin — the overlooked primitive.
- Files: src/logic-functions/flow-bridge{,-html,-resolve}.ts; widget b5e6db1b → https://fundthrough-sales.twenty.com/s/flow-bridge; setup-workspace cloud default updated. #23073 remains nice-to-have (native = no hop/flash), not a blocker. Search-mode fallback when companyId missing.

### 2026-07-24 — Session log (import completion, table tabs, fork crons)
- **FIELD widget `fieldDisplayMode: TABLE` recipe (person Calls / Campaign Engagements tabs):** the widget renders NOTHING unless its configuration carries a `viewId` pointing to a **`TABLE_WIDGET`-type view on the TARGET object** that has (a) viewFields (first ~6 visible, size 180, label-identifier first) and (b) a viewFilter on the target's `person` RELATION field with operand `IS` and value `{"isCurrentRecordSelected":true,"isCurrentWorkspaceMemberSelected":false,"selectedRecordIds":[]}` — that filter is what scopes rows to the open record (frontend `FieldWidgetRelationTable` + `RecordFilterValueDependenciesContext`). Encoded idempotently in setup-workspace §8d; §6c person Calls sidebar panel retired.
- Metadata API gotchas: `createManyViewFields(inputs:)` (plural arg), `fieldsList` no longer exposes `relationDefinition`; data GraphQL endpoint is `/graphql` not `/api/graphql` (405 otherwise).
- Orphaned empty `TABLE_WIDGET` views ("Campaign Engagements Table" ×2, zero fields/filters) exist from earlier UI attempts — reuse only non-empty ones; shells are harmless but skipped.
- **Fork cron workflows:** upstream twenty ships scheduled workflows (docs-i18n-pull, i18n-pull, website-i18n-pull, ci-ai-catalog-sync, ci-dpa-subprocessors-sync) that fire in Fundthrough/twenty and fail without upstream secrets. docs-i18n-pull.yaml disabled via `gh workflow disable`; rest pending manual disable.
- Dialpad Chrome CTI allowlist: only leading `*.` wildcards; mid-hostname patterns silently fail → exact `https://fundthrough-sales.twenty.com`.
- Outreach API (EE-5069 prep): OAuth2 auth-code only (2h access/14d rotating refresh), JSON:API, webhooks POST /api/v2/webhooks {url,resource,action,secret}, HMAC-SHA256 hexdigest in `Outreach-Webhook-Signature` over raw JSON body, NO retries → reconciliation pull required, 10k req/hr.
- `campaignEngagement` object (id owner app 22b80fe4, Marketo admin) — never touch its metadata; layout/view-level only.
- Import failure taxonomy: Twenty native duplicate detection rejects creates ("A duplicate entry was detected" — dual-currency name twins, same-email leads); INVALID_URL on Website kills the whole company create → sanitize before retry.
- macOS Maintenance Sleep/DarkWake kills long background jobs; `caffeinate -is` + pmset -g log recency gate = babysitter pattern.
- Misc: pip3 needs --break-system-packages (PEP668); `JSON.stringify(undefined).slice` crashes error handlers → errStr helper.

### 2026-07-24 (later) — Outreach Phase 1 wiring (EE-5069)
- **OAuth gotchas:** Outreach dev portal REJECTS http redirect URIs → local listener must serve HTTPS (throwaway self-signed cert in .twenty/tmp-cert/, `outreach-auth.mjs`). User consent clicks from a different machine LOOK successful (Outreach shows its own completion page) while the code goes nowhere — always confirm the "authorization complete" page is served by OUR listener, and drive consent in the local Chrome when in doubt. zshrc.local secrets with backticks inside double quotes swallow all following export lines (`unmatched "`), single-quote with '\'' escaping.
- **App registration variables:** secret vars are write-only — querying `value` returns null and GraphQL null-propagation nukes the whole list (mis-routes ensure-logic to CREATE → duplicate-key). Query id/key only; push values unconditionally. `findApplicationRegistrationVariables(applicationRegistrationId:)` arg is String! not UUID!. Canonical webhook secret lives in ~/.outreach-webhook-secret-<env> (600) so the simulator can sign; setup-outreach re-pushes it to BOTH Twenty var and the 5 Outreach webhooks every run.
- **Chain validated:** simulate-outreach.mjs signed event → 202 queued → process-outreach-event classified+logged (LOG_ONLY); bad signature → 500 rejected. Webhooks #1-#5 (prospect/call/mailing/sequenceState/task, action *) active in Outreach dev app against prod org data.
- **Pending before LOG_ONLY=0:** real payload shape check (attrs/relationships names), access-token refresh cadence (fold into outreach-backfill.mjs cron), Outreach stage list → 11-stage map.
- Outreach Everywhere Chrome ext: hardcoded to Gmail/GCal/Salesforce/LinkedIn/ZoomInfo — cannot embed in Twenty (unlike Dialpad CTI); guide steers Gmail-side usage.
- Fable/CE note: campaignEngagement.company auto-link = native UI workflow (API workflow-version mutations are permission-gated for API keys); app db-event + cron triggers registered but cloud does not dispatch them (platform gap).
- **Twenty GraphQL relation depth caps at 2** — person→company→accountOwner silently resolves null (accountOwnerId still present). Fetch deep relations with a second depth-1 query (bug class found via outreach-push owner mapping 2026-07-24). Backfill: ~685 people linked to Outreach prospects by email (backfill-outreach-links.mjs, rate-limit-aware 100 req/min → 62s backoff).
- **Outreach account auto-creation (Push to Outreach)** — ⚠️ CHECK WITH TEAM before wide rollout: confirm how sales actually uses Outreach accounts and whether account volume affects Outreach pricing/plan limits. Org had only 54 accounts (stale since Feb) vs 6,274 prospects, yet active prospects all carry account links (Outreach auto-associates by email domain when an account exists). Duplicate guards in outreach-push: prospects deduped by email search-first; accounts deduped by domain search → exact-name search → only then create. Test artifacts: prospects #6650-#6653 (Push *Test*) in Outreach — delete via UI (app deliberately holds no delete scope).
