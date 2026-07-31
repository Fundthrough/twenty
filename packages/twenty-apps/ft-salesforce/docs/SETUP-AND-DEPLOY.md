# Setup and deploy runbook

Companion to `README.md`. That file explains the app; this one is the step-by-step for standing it
up, deploying changes, and recovering when something breaks.

Scope: the **sales** workspace only. Nothing here should ever be pointed at the partner workspace —
see the isolation rule in the README.

---

## 1. Local prerequisites

```bash
# from the repo root, once
yarn install

# the CLI lives in the app's own node_modules
cd packages/twenty-apps/ft-salesforce
node_modules/.bin/twenty --version
```

`~/.twenty/config.json` must have both remotes:

```json
{
  "remotes": {
    "sales":   { "apiUrl": "https://fundthrough-sales.twenty.com",     "apiKey": "<sales key>" },
    "partner": { "apiUrl": "https://fundthrough-uz0tn18a.twenty.com",  "apiKey": "<partner key>" }
  }
}
```

Confirm which workspace a key actually belongs to before using it — the URL proves nothing:

```bash
node -e 'const k=process.env.TWENTY_BO_API_KEY;
console.log(JSON.parse(Buffer.from(k.split(".")[1],"base64url").toString()).workspaceId)'
# must print 3ae378c2-3871-4fff-8c69-b4dff2bd5501
```

Shell variables belong in `~/.zshrc.local`. Two traps:

- A **backtick inside a double-quoted secret** starts command substitution and silently swallows the
  following exports. Single-quote every secret.
- Non-interactive shells do not source `.zshrc.local`. If a script needs a shell variable, invoke it
  as `zsh -ic '...'` or pass the value explicitly.

---

## 2. Deploying a change

```bash
cd packages/twenty-apps/ft-salesforce
node_modules/.bin/twenty apply -r sales --force .
TWENTY_REMOTE=sales node scripts/setup-workspace.mjs
```

Always both, always in that order. `apply` prints a plan (`N to add, N to change, N to destroy`) —
read it. `0 to destroy` is expected; anything else deserves a pause.

Then verify against the user-facing surface. For a field, open a record. For a view, open the view.
For a dashboard, open the dashboard — not the metadata API.

### When `apply` will not do what you expect

| Symptom | Cause | Fix |
| --- | --- | --- |
| View renamed but still the old type | `apply` does not change `type` on an existing view | `setup-workspace.mjs` forces it |
| Card fields unchanged after editing the definition | same, for `viewFields` | forced in `setup-workspace.mjs` |
| Kanban renders empty | no `viewGroups` | `syncKanbanGroups` in `setup-workspace.mjs` |
| Dashboard nowhere in the UI | no `dashboard` *record* | `setup-workspace.mjs` creates it |
| `FIELD_METADATA_NOT_FOUND` on a relation | missing inverse field | add the inverse field file |
| `Option label exceeds 63 characters` / `must not contain a comma` | SELECT label rules | shorten, drop commas |
| SSL / `bad record mac` mid-upload | transient | re-run |

---

## 3. First-time workspace bring-up

Only for a fresh workspace. **Do not run the reset scripts against a live one.**

```bash
# 1. deploy the app
node_modules/.bin/twenty apply -r sales --force .
TWENTY_REMOTE=sales node scripts/setup-workspace.mjs

# 2. import Salesforce data — dry run first, the flag is IMPORT_DRY_RUN
IMPORT_DRY_RUN=1 node scripts/import-sf.mjs
node scripts/import-sf.mjs

# 3. ownership
node scripts/backfill-owners.mjs              # Sales owners from sfOwnerEmail
node scripts/backfill-account-manager.mjs      # CS owners + the funding handover

# 4. classification and activity
node scripts/backfill-naics-sector.mjs
node scripts/backfill-lead-status-from-signup.mjs
node scripts/backfill-last-activity.mjs
node scripts/backfill-call-handled-by.mjs
```

Order matters in two places: `backfill-owners` before `backfill-account-manager`, because the first
only fills nulls and the second hands funded companies to CS; and NAICS before
`backfill-industry-from-naics`, which derives from it.

`IMPORT_DRY_RUN=1` is the **only** dry-run flag the importer honours. `DRY_RUN=1` does nothing there
and the run will be live — that mistake has been made.

---

## 4. Integration setup

### Dialpad

```bash
DIALPAD_API_KEY="$DIALPAD_FT_API_KEY" node scripts/check-dialpad.mjs   # read-only probe
node scripts/setup-dialpad.mjs                                          # webhook + subscriptions
DIALPAD_API_KEY="$DIALPAD_FT_API_KEY" node scripts/set-dialpad-api-key.mjs
```

The last step matters: without the `DIALPAD_API_KEY` app variable the webhook cannot resolve the
answering rep on ring-group calls and they land unowned.

Test without a real call: `scripts/simulate-dialpad.mjs`.

### Outreach

```bash
# 1. consent (prod app must be PUBLISHED first)
mkdir -p .twenty/tmp-cert && openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 3 \
  -keyout .twenty/tmp-cert/localhost.key -out .twenty/tmp-cert/localhost.crt \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
OUTREACH_ENV=prod node scripts/outreach-auth.mjs      # open the URL, click Authorize

# 2. push the tokens and config into the workspace
OUTREACH_ENV=prod node scripts/set-outreach-tokens.mjs
node scripts/setup-outreach.mjs
```

The prod app needs `https://localhost:53682/callback` in its redirect URIs.

`OUTREACH_LOG_ONLY` gates all writes. `1` (default) means the sync classifies and logs but writes
nothing — a safety gate for validating payload shapes. Set it to `0` to go live.

Test without touching Outreach: `scripts/simulate-outreach.mjs`.

### Marketo
`docs/MARKETO-INTAKE.md` for the payload contract, `scripts/simulate-marketo.mjs` to exercise it.

---

## 5. Recovery

### Outreach token chain broken
Symptom: Push to Outreach returns "an automatic refresh did not help", or the sync logs
`proactive refresh failed`.

The workspace normally owns rotation. If its refresh token is genuinely dead:

```bash
OUTREACH_ENV=prod node scripts/outreach-auth.mjs      # fresh consent
OUTREACH_ENV=prod node scripts/set-outreach-tokens.mjs # push the new pair in
```

Then leave it alone. Running `--refresh` locally while the workspace is healthy is what breaks the
chain, which is why the script refuses without an explicit override flag.

### A view drifted
Re-run `setup-workspace.mjs`. It asserts type, group-by, columns, ordering and card fields, and
prunes stale kanban groups. That is the lock — there is no read-only flag on a Twenty view
(`visibility` is only `WORKSPACE` or `UNLISTED`).

### A backfill half-ran
Every backfill is idempotent and safe to re-run. If one was interrupted, run it again; it picks up
where it stopped because each pass re-queries for records still missing the value.

### Deletions
`cleanup-*` scripts use `deletePeople`/`deleteCompanies`, which are **soft** (they set `deletedAt`)
rather than the `destroy*` variants. Recoverable from the UI. Anything they remove is also exported
to `docs/deleted-*.json` first.

---

## 6. Reference: what runs on a schedule

| Cron | Every | Function |
| --- | --- | --- |
| `*/5 * * * *` | 5 min | `outreach-sync` — tasks, mailings, sequence states, token rotation |
| `*/10 * * * *` | 10 min | `last-activity-sweep` — email/meeting into `lastActivity*` |
| `*/15 * * * *` | 15 min | `ce-company-sweep` — campaign engagement backstop |

### Tuning app variables

```bash
node scripts/set-app-variable.mjs --list                             # keys only; secrets never read back
node scripts/set-app-variable.mjs OUTREACH_SYNC_LOOKBACK_MINUTES 20
```

`OUTREACH_SYNC_LOOKBACK_MINUTES` controls how far back the sync looks (default 20). Widen it
temporarily to catch up after an outage, then set it back — a wide window on every 5-minute run is
wasted work.

### Backfilling or repairing synced tasks

Every task write is an upsert keyed on `outreachTaskId`, so widening the window is also how you
repair rows already in Twenty. After changing how a task is titled, typed or described:

```bash
node scripts/set-app-variable.mjs OUTREACH_SYNC_LOOKBACK_MINUTES 10080   # 7 days
# wait one 5-minute tick, verify, then:
node scripts/set-app-variable.mjs OUTREACH_SYNC_LOOKBACK_MINUTES 20
```

Verify against what a rep sees, not the count:

```bash
node -e 'const key=process.env.TWENTY_BO_API_KEY;(async()=>{
  const r=await(await fetch("https://fundthrough-sales.twenty.com/graphql",{method:"POST",
    headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({query:`{ tasks(filter:{outreachTaskId:{is:"NOT_NULL"}},first:200){totalCount edges{node{title taskType dueAt assignee{name{firstName}}bodyV2{markdown}}}}}`})})).json();
  const n=r.data.tasks.edges.map(e=>e.node);
  console.log("total",r.data.tasks.totalCount,"assignee",n.filter(x=>x.assignee).length,
    "due",n.filter(x=>x.dueAt).length,"body",n.filter(x=>x.bodyV2?.markdown).length);})()'
```

All three counts should equal the total. An unassigned task is invisible in every rep's list, which
is why the sync falls back to the lead owner when Outreach has no task owner.

---

## 7. Rate limits and API quirks

- Twenty allows **100 requests/minute**. Scripts back off 62 seconds on `Limit reached`.
- Relation depth in Twenty GraphQL **caps at 2**. `person → company → accountOwner` returns null;
  query the company separately.
- `CoreApiClient.executeGraphqlRequestWithOptionalRefresh` returns the GraphQL envelope
  (`{data, errors}`) directly, not `{payload: {data}}`. Getting this wrong silently returns
  undefined everywhere.
- Cloudflare replaces origin 5xx bodies with its own error page, so **logic functions should return
  200 with an `{error}` payload** rather than a 5xx. A user needs the message, not a Cloudflare page.
- Outreach allows 10k requests/hour and rotates refresh tokens on every use.
- `is: "NOT_NULL"` counts an empty string as populated. TEXT-field coverage measured that way is
  optimistic; check `neq: ""` when it matters.
