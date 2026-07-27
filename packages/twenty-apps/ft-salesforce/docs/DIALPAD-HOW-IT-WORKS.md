# Dialpad ↔ Twenty — how it works

*Audience: FT sales team + admins. Ops/setup detail lives in [DIALPAD-SETUP.md](./DIALPAD-SETUP.md).*
*Status: LIVE on the sales workspace since 2026-07-20.*

## What gets captured, for whom

Dialpad pushes events for **7 sales users** — Moksh Chaddha, Lyle O'Neill, Alvaro Cu,
Vincent Grassa, Shivani Anand, Allie Bacon, Francisco Cancino — to Twenty in real time.
(Targeting is per user because that's where FT's call traffic actually happens: the
sales *department* lines are dormant; ~950 calls/30d across these 7 user lines.)

| You do this in Dialpad | Twenty records this |
|---|---|
| Answer or make a call | **Call** — outcome *Completed*, direction, duration, timestamps |
| Miss an inbound call | **Call** — outcome *Missed* |
| Caller leaves a voicemail | **Call** — outcome *Voicemail* + audio link + Dialpad's transcription |
| Call is recorded | Recording link attached to the Call (arrives moments after hangup) |
| Send/receive an SMS | **Call** — outcome *SMS*, direction, number (body text: see caveat below) |

Every record lands in the **Calls** nav item, and — when the number matches a person —
on that **person's record page and their company's** (Calls panel), stamped with which
FT user handled it.

## Matching, and what happens when it fails

The external number is normalized to E.164 and matched against each person's phone in
Twenty. No match → the Call is still kept (nothing is lost), **plus** one open task
`Unmatched call: +1…` appears in the **Dialpad — Unmatched** task view. One task per
number, however often they call. Working the queue: identify the caller, create/fix the
Person (with the phone number so future calls auto-match), then close the task.

Duplicate webhook deliveries can't create duplicates (unique index on the Dialpad call
id) and a call's outcome never downgrades (Completed beats Voicemail beats Missed).

## Known behaviors & caveats

- **Voicemail pickups count as "connected"** — a call answered by voicemail may log as
  *Completed* (~short duration); the voicemail link/transcript still attaches when
  Dialpad sends the voicemail event. Watch during pilot; we can reclassify short-connect
  calls if it bothers reporting.
- **SMS body text**: the key was re-minted 2026-07-20 with *Message content export* and
  the SMS subscriptions recreated under it — bodies land in the Call's **Message Text**
  field (verify with a test text; if still empty, Dialpad withholds content at delivery
  and only metadata is available).
- **No per-call deep link into Dialpad exists** — verified against the full API surface:
  a call exposes no share/review URL. The nearest things, both captured: the recording
  URL (plays in browser) and the Dialpad Call Id on the record (searchable in Dialpad's
  call history). If Dialpad ever ships call-review links, it's a one-line handler change.
- **Meetings (Dialpad Meetings) are not monitored** — different product/API scope; the
  Twenty **Call Recorder** app (Recall.ai-based) is the natural fit for meeting recording
  if wanted later.
- **Click-to-call**: nothing to build — install the **Dialpad Chrome extension**; it
  makes every phone number in Twenty click-to-callable.

## What the 7 users actually use (30-day API audit, 2026-07-20)

- **Calls**: heavy — Moksh 300 (261 out), Lyle 261 (224 out), Alvaro 106, Vincent 82,
  Shivani 81, Allie 76, Francisco 50. All on personal lines; `agents` license tier.
- **Recording**: active — real calls carry `admin_recording_urls` (auto-recording on).
- **SMS**: heavy, all external — Vincent Grassa is a power user (65 texts in one day,
  ~200+/mo); Allie Bacon 10–25/day; Shivani, Moksh, Lyle steady. (Non-synced users who
  also text: Kelli Mclean, Ellyn Edwards, Gabriel Werkhaizer — add to `SALES_USERS` if
  they're sales.)
- **Meetings**: Dialpad Meetings is UNUSED — 13 rooms, zero meetings in 90 days (audited
  2026-07-20 with a full-scope key). Meetings-in-CRM belongs to Twenty's Call Recorder
  app (Google Meet), not Dialpad.

## Plumbing (one paragraph)

Dialpad posts JSON events (webhook `6360483906658304`, auth = secret URL token) to a
Twenty server route → `dialpad-webhook` verifies the token constant-time and dispatches →
`process-dialpad-event` classifies, matches, and upserts. Two-stage pattern copied from
Twenty's own call-recorder app. Signed-JWT mode exists in the code but is parked until
Twenty's server accepts `application/jwt` bodies (upstream gap found 2026-07-20). App
logs are queryable via the metadata API (`eventLogs`, table `APPLICATION_LOG`).

## Ops quick reference

| Task | How |
|---|---|
| Add/remove a synced user | Edit `SALES_USERS` in `scripts/setup-dialpad.mjs`, re-run (idempotent) |
| Pause everything | Dialpad → disable the webhook's subscriptions (Twenty data untouched) |
| Debug "call didn't appear" | Read app logs (`eventLogs` / APPLICATION_LOG); check the number's format on the Person |
| Dry-run mode | Set app variable `DIALPAD_LOG_ONLY=1` (parse + log, no writes) |
| Secrets | `DIALPAD_URL_TOKEN` + retired `DIALPAD_WEBHOOK_SECRET` — in 1Password + app variables |
