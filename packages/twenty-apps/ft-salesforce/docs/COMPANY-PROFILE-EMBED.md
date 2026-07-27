# Company Profile Embed — where it lives and how to edit it

The "Company Profile" tab on every Company record embeds the Flow dashboard. This doc maps
every file/metadata object involved, how to change each one, and the current limitations.

## What renders the tab

| Piece | What it is | Where it's defined |
|---|---|---|
| **"Company Profile" tab** | GRID-mode tab on the *Default Company Layout* | Created by `scripts/setup-workspace.mjs` (section 3) — lives as workspace metadata, not in app source |
| **IFRAME widget** (rows 0–12) | Loads `flow-handover/embed.html` (clean FlowWidget mount) via the relay's `/go` redirect | URL set in `scripts/setup-workspace.mjs` → `FLOW_DASHBOARD_URL` |
| **embed.html** | The widget host page — FlowWidget.init with the record's company preselected | `flow-handover/embed.html`, served by Live Server on `localhost:5500` |
| **Company id relay** | Carries the record's Company Id from Twenty into the iframe (`/set` ← component, `/get` ← embed.html, `/go` = redirect for the URL validator) | `scripts/flow-embed-relay.mjs` on `127.0.0.1:5511` |
| **Validation banner** (rows 13–14, below the fold) | Reports the record's Company Id to the relay; warns when missing/non-numeric | `src/front-components/flow-company-profile.tsx` |

**Local demo runbook** (two processes):
1. Live Server on the `flow-handover/` folder (port 5500)
2. `node scripts/flow-embed-relay.mjs`
3. Sign in to the widget once at `http://localhost:5500/embed.html` in a normal tab
   (popups inside the Twenty iframe are sandbox-blocked; the iframe reuses this origin's token)

Caveat: the relay is last-write-wins across browser tabs — fine for a single-user demo. The
Flow-hosted version (`?company_id=` param) replaces it at deploy.

## How to change things

### 1. Change the embedded URL (most common edit)

The URL is workspace metadata on the IFRAME widget. Two ways to change it:

**a) For fresh workspaces (cloud deploy):** edit the constant in `scripts/setup-workspace.mjs`:

```js
// staging for local dev; switch to https://flow.fundthrough.com/... at cloud deploy
const FLOW_DASHBOARD_URL = 'https://flow-staging.fundthrough.com/hitl/dashboards/company_profile';
```

then run `TWENTY_REMOTE=<remote> node scripts/setup-workspace.mjs` after `npx twenty dev --once`.

**b) On a live workspace (immediate):** update the existing widget via the metadata API:

```bash
API_KEY=<workspace api key>
curl -s http://localhost:2020/metadata \
  -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" \
  -d '{"query":"mutation U($id: String!, $input: UpdatePageLayoutWidgetInput!) { updatePageLayoutWidget(id: $id, input: $input) { id } }",
       "variables":{"id":"<WIDGET_ID>","input":{"configuration":{"configurationType":"IFRAME","url":"<NEW_URL>"}}}}'
```

Find `<WIDGET_ID>` with:

```bash
curl -s http://localhost:2020/metadata -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"{ getPageLayouts { name tabs { title widgets { id type } } } }"}' \
  | jq '.data.getPageLayouts[] | select(.name=="Default Company Layout") | .tabs[] | select(.title=="Company Profile")'
```

Gotchas baked into the validator/renderer (all hard-learned):
- the URL validator rejects hostnames without a TLD (`localhost` fails; `127.0.0.1` passes)
- widget titles can't be empty at **create** — create with a title, then update `title: ""`
  to remove the heading
- the tab must be **GRID** layoutMode (set at tab creation only — updates are silently
  ignored). VERTICAL_LIST collapses iframes to the browser's 150 px default.

### 2. Change the validation messages / record logic

Edit `src/front-components/flow-company-profile.tsx`, then sync:

```bash
cd packages/twenty-apps/ft-salesforce
npx twenty dev --once          # builds + uploads the component to the active remote
```

Hard refresh the browser afterwards (the SPA caches component modules by checksum).

Front-component sandbox rules (violating any renders the widget as a "No Data" pill):
- always return a visible, full-width element — a bare `<div />` or empty output = "No Data"
- only plain elements render: `<script>` injection is neutered, `<iframe>`s are
  force-sandboxed (origin `null`), `<object>`/`<style>` are stripped
- `import()` executes inside the sandbox compartment — its DOM shim is incomplete
  (`getElementById`, `classList`, …), so third-party UI bundles cannot mount here
- record queries use a filter arg: `company: { __args: { filter: { id: { eq: recordId } } } }`

### 3. Rebuild the whole tab from scratch

`scripts/setup-workspace.mjs` is idempotent — it creates the GRID tab, both widgets, blank
titles, and replaces a wrong-mode tab. Run it after any app sync (local or cloud):

```bash
TWENTY_REMOTE=local node scripts/setup-workspace.mjs
```

## Auth model

Users must be signed into Flow (flow.fundthrough.com / flow-staging) **in a normal browser
tab**; the embedded iframe shares that origin's session and renders without sign-in.
Do **not** use the sign-in button inside the embed: popups opened from the iframe inherit
Twenty's sandbox and Google blocks them (`ERR_BLOCKED_BY_RESPONSE`). Off the FundThrough
VPN, Flow's load balancer answers 503 — connect VPN before demoing.

## Known limitations (current Twenty, cloud included)

1. **No per-record preselect.** The iframe URL is static — Twenty has no record variables
   for iframe widgets (verified against upstream `twentyhq/twenty`; feature request filed
   2026-07-20: https://github.com/twentyhq/twenty/issues/23073), and the front-component
   sandbox cannot host the FlowWidget JS mount. The dashboard opens on whatever Flow last
   showed **in that browser session** (it restores its own last-viewed/pinned company), so
   different Twenty records can show the same Flow company. Use the dashboard's own search /
   "Back to search"; the record's Company Id is pinned at the top of the Fields panel.
2. **Full portal chrome.** The embed shows the HITL app (sidebar, pin, search) rather than
   the clean widget look of `widget.html` — that look comes from `FlowWidget.init`, which
   only Flow-origin pages can run today.

## Why the embed looks different from widget.html

`widget.html` calls `FlowWidget.init()` — a JS mount that renders **only the dashboard
component** into a div. The Twenty tab can only iframe a **URL**, and the only company-profile
URL Flow hosts is the full HITL portal (`/hitl/dashboards/company_profile`) — sidebar, pin,
lookup header and all. The clean widget look requires either running `FlowWidget.init` inside
Twenty (blocked by the front-component sandbox) or Flow hosting a chrome-less widget page.

**→ `flow-handover/embed.html` in this package is that page, ready for Frans to host** next to
`bundle.js` (e.g. `https://flow.fundthrough.com/embed.html`). It is widget.html minus the Acme
demo chrome — and **fully URL-parameter driven**, so once hosted it never needs a Flow-side
redeploy to change embed behavior. Twenty controls everything via its iframe URL:

| Param | Effect | Default |
|---|---|---|
| `?company_id=NNN` | preload that company's profile | absent → widget's own search (`allowSearch`) |
| `?tabs=Profile,Invoices,…` | `enabledTabs` (comma-separated) | Profile, Cash Events, Customers, Invoices, Risk, Pipefy Cards |
| `?header=0` / `?title=1` | `showHeader` / `showTitle` | header on, title off |
| `?env=staging` | staging BFF | production BFF |

Changing tabs later = one `updatePageLayoutWidget` on the IFRAME widget's URL (or
`FLOW_EMBED_URL=… node scripts/setup-workspace.mjs`) — Twenty-side only, no Frans.
⚠️ Note: `flow.fundthrough.com/embed.html` returning HTTP 200 does NOT mean the page is
hosted — Flow's server answers every unknown path with its SPA shell (the generic app
index that boots the Flow portal). Verify hosting by checking the response contains
`flow-company-profile`, not by status code.

## Unlock paths (EE-4992)

> **Status 2026-07-20 (evening): PER-RECORD PRESELECT LIVE** — same-origin bridge pattern
> (credit Frans): widget → `https://fundthrough-sales.twenty.com/s/flow-bridge` (app logic
> function serving HTML on Twenty's origin) → reads `window.parent.location` for the record
> UUID → `/s/flow-bridge/resolve` → companyId → `location.replace()` to Flow's `/embed`.
> Verified on the Kcm record (auto-loads 27995). Falls back to embed search mode when the
> record has no Company Id. twentyhq/twenty#23073 is now an optimization, not a blocker.

| Path | Who | What it unlocks |
|---|---|---|
| **Host `flow-handover/embed.html` on the Flow origin** | Frans (10-min change) | The widget.html look inside the tab now — clean chrome, widget search; per-record preselect still pending the next rows |
| Upstream Twenty: record variables in iframe URLs (`{{record.companyId}}`) | **filed: [twentyhq/twenty#23073](https://github.com/twentyhq/twenty/issues/23073)** (2026-07-20); PR offer included | Per-record URL → `?company_id=` preselect through the hosted embed page |
| Serve `/bundle.js` with `Access-Control-Allow-Origin` **and** Twenty matures the front-component sandbox | Frans + Twenty upstream | FlowWidget mounted directly in the front component — preselect + full `dashboardArguments` control without any iframe |

## File map

```
packages/twenty-apps/ft-salesforce/
├── docs/COMPANY-PROFILE-EMBED.md          ← this file
├── docs/DATA-MODEL.md                     ← full build/verification history
├── flow-handover/
│   └── embed.html                         ← chrome-less widget page for Frans to host on the Flow origin
├── scripts/setup-workspace.mjs            ← tab + widgets + URL (edit FLOW_DASHBOARD_URL)
├── src/front-components/
│   └── flow-company-profile.tsx           ← validation banner (edit messages/logic)
├── widget.html                            ← Frans's reference FlowWidget embed (target UX)
└── EmbeddedDashboards.md                  ← Flow-side embed documentation
```
