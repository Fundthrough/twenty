# FT Salesforce Migration app

Twenty SDK app that replaces Salesforce for FundThrough's sales and client-success teams. It owns
the data model, views, dashboards, and the Dialpad, Outreach and Marketo integrations.

Jira epic **EE-4774**. Outreach is **EE-5069**. Dashboards are **EE-4991**.

This file explains how the app is put together. For step-by-step commands — first-time bring-up,
deploying, integration wiring, recovery when something breaks — see
[`docs/SETUP-AND-DEPLOY.md`](docs/SETUP-AND-DEPLOY.md).

---

## Read this first: two workspaces, never crossed

There are two Twenty workspaces and two apps. They must never touch each other.

| | Workspace | App | Remote | Key |
| --- | --- | --- | --- | --- |
| Sales | `fundthrough-sales.twenty.com` | **ft-salesforce** (this one) | `sales` | `TWENTY_BO_API_KEY` |
| Partner | `fundthrough-uz0tn18a.twenty.com` | `hubspot-partner` | `partner` | `TWENTY_PARTNER_KEY` |

Sales workspace id: `3ae378c2-3871-4fff-8c69-b4dff2bd5501`

**Twenty routes writes by the token's `workspaceId` claim, not by the URL.** A sales key pointed at
the partner URL writes to sales, and vice versa. Every script in `scripts/` therefore decodes the
JWT and aborts if the claim is not the sales workspace. Keep that guard when you add a script:

```js
const claim = JSON.parse(Buffer.from(cfg.apiKey.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== SALES_WORKSPACE_ID) { console.error('not the sales workspace'); process.exit(1); }
```

Work on this app happens on `feature/EE-4774-ft-salesforce-app`, in a git worktree so the partner
branch can stay checked out separately. Never commit ft-salesforce changes onto a partner branch.

---

## Deploying

From **this directory** (`packages/twenty-apps/ft-salesforce`):

```bash
node_modules/.bin/twenty apply -r sales --force .      # deploy the manifest
TWENTY_REMOTE=sales node scripts/setup-workspace.mjs   # then always run this
```

Both steps, in that order, every time. `twenty apply` syncs the manifest;
`setup-workspace.mjs` asserts everything the manifest cannot express (see next section).

Gotchas that will bite you:

- **Run `twenty` from a directory with real `node_modules`.** `npx twenty` elsewhere silently
  fetches an unrelated npm package. Use `node_modules/.bin/twenty`.
- **Uploads fail transiently** with SSL/TLS errors. Just re-run; `apply` is idempotent.
- **`apply` does not change an existing view's `type` or its fields.** It renames, but a view that
  is already a TABLE stays a TABLE even if the definition says KANBAN. This silently broke the
  leads board. `setup-workspace.mjs` now forces type, group-by and card fields on every run.
- **Deploying does not restart anything.** Logic functions pick up new code on next invocation.

### What `setup-workspace.mjs` owns

The manifest cannot express these, so the script asserts them idempotently. Re-running should
report zero changes:

1. Record-page **Fields panels** — SDK-synced fields get no `viewField` rows, and a `viewField`
   with no group never renders.
2. **Kanban columns** (`viewGroups`) — a kanban with `mainGroupByFieldMetadataId` alone renders an
   empty board. Also prunes stale groups: the leads board once carried 19 `accountType` columns
   while grouping by `leadStatus`, so only `PROSPECT` overlapped and every other card had nowhere
   to land.
3. **Company Profile tab** with the Flow iframe — must be created with `layoutMode: GRID`;
   `VERTICAL_LIST` ignores `gridPosition` and iframes collapse to 150px.
4. **Navigation** order and the Leads item.
5. **Dashboard records** — a `DASHBOARD` page layout is metadata; what a user clicks is a
   `dashboard` *record* pointing at it, which is data the manifest cannot create.

---

## Layout

```
src/
  application-config.ts     app manifest
  default-role.ts           app permissions — includes canUpdateAllSettings (see Outreach tokens)
  objects/                  custom objects: call, termSheet
  fields/                   107 field definitions, one per file
  views/                    Company Leads kanban, Lead Pipeline, Term Sheets
  page-layouts/             AM Workload & Activity dashboard + its two tabs
  logic-functions/          integrations and crons (table below)
  front-components/         Flow company-profile embed
  utils/                    outreach-token.ts (OAuth rotation)
  constants/                universal identifiers — never change one that is deployed
docs/                       design docs, setup guides, import reports
scripts/                    40 operational scripts (import, backfills, setup, simulators)
```

### Logic functions

| Function | Trigger | What it does |
| --- | --- | --- |
| `dialpad-webhook` | serverRoute | Receives Dialpad events, verifies signature, dispatches |
| `process-dialpad-event` | dispatched | Calls and SMS → Call records, resolves the answering rep |
| `outreach-push` | httpRoute `/outreach-push` | "Push to Outreach" button: creates/links a prospect |
| `outreach-sync` | cron `*/5` | Outreach tasks, mailings, sequence states → Twenty |
| `outreach-webhook` | serverRoute | Deployed but unused, see Outreach section |
| `process-outreach-event` | dispatched | Maps Outreach webhook events (unused) |
| `marketo-intake` | httpRoute `/marketo/intake` | Website form signups → leads |
| `last-activity-sweep` | cron `*/10` | Promotes email/meeting contact into `lastActivity*` |
| `ce-company-link` | database event | Links campaign engagement to a company |
| `ce-company-sweep` | cron `*/15` | Backstop for the above |
| `flow-bridge*` | httpRoute | Same-origin bridge for the Flow company-profile embed |
| `post-install` | install | Backstop layout setup |

---

## Integrations

### Dialpad
Calls and SMS arrive by webhook and become `Call` records with direction, duration, recording and
voicemail transcript. Setup: `docs/DIALPAD-SETUP.md`, behaviour: `docs/DIALPAD-HOW-IT-WORKS.md`.

A ring-group call (`target.type: "coaching_team"`) names the queue, not a person. The answerer is
one level down: `/call/{id}` returns `operator_call_id`, and that call's `target` is the user with
an email. `process-dialpad-event` does this lookup live; `scripts/resolve-ring-group-calls.mjs`
backfills. Needs the `DIALPAD_API_KEY` app variable —
`scripts/set-dialpad-api-key.mjs` writes it from `DIALPAD_FT_API_KEY` in your shell.

### Outreach
Authorisation is OAuth authorization-code only, on the **prod** Outreach app.

- `scripts/outreach-auth.mjs` runs the consent flow. It needs a local HTTPS callback because
  Outreach only accepts `https` redirect URIs; mint a throwaway cert into `.twenty/tmp-cert/`.
- **An unpublished Outreach app fails consent with "The requested scope is invalid, unknown, or
  malformed."** That reads like a bad scope list and is not. Check the app is published first.
- `calls.read` is deliberately not requested: Outreach call syncing was removed because those calls
  are Dialpad twins (`externalVendor: "dialpad"`, same `vendorCallId`).

**Token rotation is automatic and must stay that way.** Access tokens last two hours and refresh
tokens rotate on every use, so a refresh is only durable if the new pair is written back to the app
variables — which is a settings write, hence `canUpdateAllSettings` on the app role.
`outreach-sync` refreshes on **age** (90 minutes, tracked in `OUTREACH_TOKEN_REFRESHED_AT`) so it is
the single owner of the rotation; `outreach-push` refreshes only as a fallback.

> Do **not** run `outreach-auth.mjs --refresh` while the workspace is healthy. It consumes the
> refresh token the app variables still hold, and the next in-function refresh then fails. The
> script refuses by default for this reason. Recovery is `scripts/set-outreach-tokens.mjs`.

Webhooks are **not** used. Outreach posts `application/vnd.api+json`, which Twenty does not
body-parse, so the HMAC over the raw body cannot be verified. URL-token auth would solve
authentication; whether the payload is readable at all is untested. The integration polls instead.

**What a synced task looks like.** Sequence steps become Twenty tasks a rep can act on without
opening Outreach, upserted on `outreachTaskId`:

- **Title** `Call Dan Cannici — 2025 Outreach Campaign`. `humanizeAction` turns Outreach's
  snake_case actions into words (`action_item` → `Action Item`), and sequence names are trimmed
  because Outreach's often carry trailing whitespace.
- **Assignee** the Outreach task owner matched to a workspace member by email, falling back to the
  lead's Twenty owner. Never left empty: an unassigned task appears in nobody's list.
- **Due date** Outreach's `dueAt`, and `status` DONE when Outreach shows it completed.
- **Type** `taskType`, which carries an `EMAIL` option added for this sync — the SF-derived option
  set was CALL / MEETING / OTHER / INTERCOM only, and email is the majority of sequence steps.
- **Body** prospect, company, due date, the Outreach step's own note or script when it has one, a
  link back to the prospect, and a line stating that completing it in Twenty does **not** complete it
  in Outreach. That caveat matters: the sync is one-directional.

Because writes are upserts, widening the lookback is how you retroactively repair tasks after
changing any of the above. See the runbook.

### Marketo
Website "Get Started" submissions POST to `/marketo/intake` and create or update a lead.
See `docs/MARKETO-INTAKE.md`.

---

## Data model notes that are not obvious

Full detail in `docs/DATA-MODEL.md`. The parts that cause bugs:

- **The pipeline is company-centric.** Cards on the leads board are companies, not people.
- **Two owners, deliberately.** `accountOwner` is whoever owns the relationship *now* and hands
  over from Sales to Client Success when a client is Funded. `accountManager` is the CS rep.
  `sfOwnerEmail` keeps the original Sales owner. `sfOwnerEmail` resolves the *Lead* owner, so it is
  not the Account owner despite what its old description claimed.
- **`NEW_SIGN_UP` means a real platform signup**, i.e. the company has a PRO `companyId`
  (`Client__c.PRO_Company_ID__c`). Everything else is `PROSPECT`. Enforced in the field default,
  the importer and `backfill-lead-status-from-signup.mjs`.
- **No `defaultValue` on `leadStatus`, `clientType` or `accountingSoftware` beyond PROSPECT.**
  Twenty auto-creates a person per email participant and a company per email domain, so a default
  stamps notification senders as real leads. That is why those fields once read as 100% populated.
- **Industry is `naicsSector`** (NAICS 2017 2-digit, 20 options), inferred from
  `Client__c.Credit_Industry_Code__c`. The legacy `industry` field mixed three vocabularies.
- **Provenance matters for any lead metric.** Filter `createdBy.source = API` to exclude contacts
  Twenty auto-created from email. Chart filters can reach it with `type: 'ACTOR'`,
  `subFieldName: 'source'`.

---

## Working on this app

### Adding a field
1. New file in `src/fields/`, following an existing one. Give it a fresh `universalIdentifier`
   (`uuidgen`) and **never change a deployed one** — that is the sync's identity key.
2. A `RELATION` needs an explicit inverse field file on the target object, or the sync fails with
   `FIELD_METADATA_NOT_FOUND`.
3. `SELECT` option labels **cannot contain commas** and are capped at 63 characters.
4. Map it in `scripts/import-sf.mjs` if Salesforce supplies it, and add value-map entries.
5. Deploy, then add it to a layout in `setup-workspace.mjs` if users should see it.

### Adding a mapped picklist value
`scripts/value-maps.json` keys are the exact Salesforce labels. `mapSel()` tallies anything missing
and the import report lists it under `unmappedPicklistValues` — check that after every import
rather than assuming a field arrived.

### Writing a backfill script
Copy an existing one. The conventions exist because each was a bug:

- Workspace guard on the JWT claim (above).
- 62-second backoff on `Limit reached` — the API allows 100 requests/minute.
- `DRY_RUN=1` support, and always dry-run first.
- Bulk updates cap at **200 rows** and reject the whole call, so chunk by id.
- If your filter is `field IS NULL`, **re-query per chunk**. Paging a cursor through a filter you
  are writing into makes rows shift into visited pages and get skipped.
- Prefer service keys for integration writes: `DIALPAD_TWENTY_KEY`, `OUTREACH_TWENTY_KEY`.

### Dashboards and charts
Learned the hard way, see `docs/AM-DASHBOARD-DESIGN.md`:

- Chart widgets are `type: 'GRAPH'`; the kind goes in `configurationType`.
- Field references use `...UniversalIdentifier`, not `...Id`.
- Bar charts require an explicit `layout`.
- The grid is **12 columns**.
- Grouping by a relation without `subFieldName` falls back to the join column: it renders raw UUIDs
  and fails outright when combined with an `orderBy`. Use `name.firstName`.

### Verifying
Check the thing a user touches, not the layer you built. Deploying metadata successfully does not
mean the feature works — a dashboard with perfect widgets is invisible without its record, and a
kanban with the right group-by shows nothing without `viewGroups`.

---

## Environment

Shell variables (in `~/.zshrc.local`, never committed):

| Variable | Used for |
| --- | --- |
| `TWENTY_BO_API_KEY` | Sales workspace admin |
| `DIALPAD_TWENTY_KEY`, `OUTREACH_TWENTY_KEY` | Service-scoped writes |
| `DIALPAD_FT_API_KEY` | Dialpad API |
| `PROD_OUTREACH_CLIENT_ID` / `_SECRET` | Outreach OAuth (prod) |
| `SALESFORCE_CLIENT_ID` / `_SECRET` / `_INSTANCE_URL` | Salesforce connected app |

`~/.twenty/config.json` holds the `sales` and `partner` remotes. Most scripts read the `sales`
remote from there and override with a service key when one is set.

App variables live on the registration (`0cdeaad6-03e8-456d-ae94-f372b9b2439e`) and are injected as
`process.env` at invocation. **Never select `value` when listing them** — secrets read back `null`
and GraphQL null-propagation empties the whole list, which routes every upsert to CREATE and fails
on duplicate keys. Select `id` and `key` only.

---

## Current state and open items

Tracked in `.claude/PLAN.md` (gitignored). At the time of writing:

- Salesforce runs in parallel through **Aug 31**; Twenty is where new work happens.
- 8,682 unowned leads are reported on the dashboard, not solved — redistribution needs a rule, and
  `backoffice@` alone owns 3,419 so it must never be folded into an individual's book.
- `cleanup-auto-created-inactive.mjs` is committed but unrun, pending a threshold decision.
- Term sheets and per-AM "My Leads" views were promised in training and do not exist.
