# Dialpad → Twenty call logging — setup runbook

Auto-logs the sales team's Dialpad calls into the **sales workspace**
(fundthrough-sales.twenty.com): completed inbound/outbound calls, missed calls, and
voicemails (with links + transcription) become **Call** records related to the matched
Person and their Company. Unknown numbers additionally create one open review task
(view: **Dialpad — Unmatched**). Mirrors the SF↔Dialpad integration's logging features.
Click-to-call needs no build: roll out the **Dialpad Chrome extension** to AMs — it
detects phone numbers on any page, including Twenty.

## Architecture (two-stage, mirrors Twenty's own call-recorder app)

```
Dialpad (sales users) ──JSON webhook (?token=…)──▶ /webhooks/server/8b0356ab-…dcdc28a
                                             dialpad-webhook: constant-time URL-token check
                                             (JWT mode kept for when Twenty parses application/jwt)
                                                       │ dispatch
                                             process-dialpad-event (workspace-scoped):
                                             classify → match person by phone →
                                             upsert Call by dialpadCallId → review task
```

> **Why JSON+token, not signed JWT:** Dialpad's JWT mode posts `Content-Type:
> application/jwt`, which Twenty's server does not body-parse — real deliveries died
> before reaching the function (2026-07-20). Until upstream accepts application/jwt,
> auth = random URL token (`DIALPAD_URL_TOKEN` app variable). To revert later:
> `DIALPAD_USE_JWT=1 node scripts/setup-dialpad.mjs` after deleting the webhook.

- **Idempotent by design**: multi-state events and Dialpad retries upsert the same Call
  (unique index on `dialpadCallId`); an outcome never downgrades (COMPLETED > VOICEMAIL > MISSED).
- Signature failures return non-2xx so Dialpad retries; nothing unauthenticated is processed.

## Setup steps (Linesh / Dialpad admin)

1. **Mint a Dialpad API key** — Dialpad Admin Settings → API keys (presence of this
   menu confirms the plan includes API access). Never commit it; export as `DIALPAD_API_KEY`.
2. **Verify the plan + find the sales department id**:
   `DIALPAD_API_KEY=… node scripts/check-dialpad.mjs > /tmp/dialpad-check.json`
   Read the verdicts: webhook + call-event subscriptions must be YES; SMS/recordings
   verdicts decide optional scope. (Done 2026-07-20: all YES.)
3. **Sync the app + workspace setup** (adds the Call object, webhook functions, views):
   ```
   npx twenty -r sales dev --once
   TWENTY_REMOTE=sales node scripts/setup-workspace.mjs
   ```
4. **Create the webhook + subscriptions in Dialpad**:
   `DIALPAD_API_KEY=… node scripts/setup-dialpad.mjs`
   Targets are PER SALES USER (departments are dormant — verified 2026-07-20): Moksh
   Chaddha, Lyle O'Neill, Alvaro Cu, Vincent Grassa, Shivani Anand, Allie Bacon,
   Francisco Cancino. **To add/remove an AM later**, edit `SALES_USERS` in the script
   (or pass `DIALPAD_TARGET_USERS="…"`) and re-run — it only creates what's missing.
   It prints the three **server variables** to set in Twenty
   (Settings → Applications → FT Salesforce Migration):
   - `DIALPAD_WORKSPACE_ID = 3ae378c2-3871-4fff-8c69-b4dff2bd5501`
   - `DIALPAD_URL_TOKEN = <printed token>` (store in 1Password; also baked into the webhook URL in Dialpad)
   - `DIALPAD_LOG_ONLY = 1` (validation mode — events are parsed + logged, nothing written)
5. **Validate payload shapes with real calls** (log-only): make a test inbound call, a
   missed call, and leave a voicemail on a sales line; read the `[dialpad-log-only]`
   entries in the app's logic-function logs and confirm direction/duration/number fields
   look right. Then **remove `DIALPAD_LOG_ONLY`**.
6. **Run the simulator** (synthetic end-to-end, scrubs after itself):
   `TWENTY_BO_API_KEY=… DIALPAD_WEBHOOK_SECRET=… node scripts/simulate-dialpad.mjs`
7. **Pilot**: real calls now appear under **Calls** (nav), on the person/company record
   pages (Calls panel), and unknown numbers in the **Dialpad — Unmatched** task view.

## Behavior details

| Event | Result |
|---|---|
| Answered call (in/out), `hangup` with connect time | Call, outcome **Completed**, duration + timestamps |
| Inbound `hangup` never connected | Call, outcome **Missed** |
| `voicemail` / `voicemail_uploaded` | Call, outcome **Voicemail**, audio link + transcription text |
| `recording` (arrives after hangup) | Recording link attached to the existing Call |
| Number matches no person | Call kept (no person) + ONE open task `Unmatched call: +1…` per number |
| Duplicate/late deliveries | Upsert by `dialpadCallId`; outcome never downgrades |

Person matching uses the same E.164 normalizer as the Marketo intake
(`src/utils/norm-phone.ts`) against `person.phones.primaryPhoneNumber` — imported numbers
are already normalized to `+1…` by the seed/copy scripts.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Dialpad shows webhook failures | `DIALPAD_WEBHOOK_SECRET` mismatch or unset in Twenty | Re-set the server variable; failures are retried by Dialpad |
| Events arrive but nothing written | `DIALPAD_LOG_ONLY` still set | Remove the variable |
| Calls log but person is empty | Phone on the person record isn't E.164 `+1…` | Fix the phone; the number is preserved on the Call's External Number |
| Two calls for one Dialpad call | (should be impossible) unique index missing | Re-sync app; check `call-dialpad-call-id.index.ts` deployed |
| Voicemail transcript empty | Plan lacks voicemail transcription | Expected — link still logged |
| Wrong calls appearing | Subscription scoped too wide | `setup-dialpad.mjs` targets named users only; check the `SALES_USERS` list |
| New AM's calls missing | Not in the target list | Add to `SALES_USERS` in `setup-dialpad.mjs`, re-run |

## Rollback

Disable the subscription in Dialpad (or delete the webhook). Twenty-side data is
untouched; the Call object can be deactivated like any custom object if needed.
