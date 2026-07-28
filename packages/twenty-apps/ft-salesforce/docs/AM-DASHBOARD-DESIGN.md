# AM Workload & Activity dashboard — design

Date: 2026-07-28
Jira: EE-4991 (supersedes the "Onboarding Funnel" dashboard in that ticket, see Scope note)
Workspace: Sales only — fundthrough-sales.twenty.com

## Goal

Let a manager see, in one page, how much book each AM carries and whether they are working it.

## Scope note

EE-4991 originally scoped four dashboards, one of which was an Onboarding Funnel over lead
status. That is deliberately dropped: funnel and lead-status flow are tracked in Databricks
instead. Twenty's dashboard covers team traction on prospects and reachouts only.

## Data reality this design is built on

Measured 2026-07-28 against the live workspace, not assumed.

| Signal | State | Consequence for the design |
| --- | --- | --- |
| `person.owner` | 1,256 of 9,935 set | 8,679 unowned leads is the single largest fact; it becomes a headline widget rather than a filter |
| `person.lastActivityAt` | 1,456 set | Coverage (touched ÷ owned) is the useful metric, not raw activity volume |
| `call.handledBy` | 430 of 542 set | Per-AM call counts undercount by the 112 ring-group calls until the Dialpad fix lands |
| `call.startedAt` | 2026-07-20 onward | 8 days of history; the per-day trend starts sparse and fills forward |
| `messageParticipant` role FROM + member | 23,940 | Emails per AM is possible, but all-time only (see Limits) |
| `task` | 168 total, 24 with a due date | Task widgets are thin and mostly our own review tasks |
| `campaignEngagement` | 1 record | Unusable; excluded |
| `person.leadStatus` | 96.6% `NEW_SIGN_UP` | No funnel exists on person; another reason the funnel moves to Databricks |

Coverage today, which is what the dashboard exists to surface:

| AM | Leads owned | Leads touched |
| --- | --- | --- |
| Francisco | 462 | 7 |
| Lyle | 328 | 143 |
| Moksh | 282 | 45 |
| Kelli | 110 | 39 |
| Gabriela | 62 | 4 |

## Layout

One dashboard, two tabs, scoped by lifecycle rather than by team, because Sales owns leads and
Client Success owns accounts and the activity objects are shared.

### Tab 1 — Lead coverage

| Widget | Type | Object | Config |
| --- | --- | --- | --- |
| Unowned leads | AGGREGATE | person | `COUNT_EMPTY` on `owner` |
| Leads never touched | AGGREGATE | person | `COUNT_EMPTY` on `lastActivityAt` |
| Leads owned per AM | BAR | person | group by `owner` |
| Coverage per AM | BAR | person | group by `owner`, secondary axis `lastActivityType`, `omitNullValues: false` so untouched stays visible |
| Stalest owned leads | RECORD_TABLE | person | view filtered `owner IS NOT EMPTY`, sorted `lastActivityAt` ascending |
| New leads per week | LINE | person | group by `createdAt`, WEEK granularity |

### Tab 2 — Activity

| Widget | Type | Object | Config |
| --- | --- | --- | --- |
| Calls last 7 days | AGGREGATE | call | `COUNT`, filter `startedAt IS_IN_PAST` 7 days |
| Talk time | AGGREGATE | call | `SUM` of `durationSeconds` |
| Calls per AM | BAR | call | group by `handledBy` |
| Outcome mix per AM | BAR | call | group by `handledBy`, secondary axis `outcome` |
| Calls per day | LINE | call | group by `startedAt` DAY, secondary axis `direction` |
| Emails sent per AM | BAR | messageParticipant | group by `workspaceMember`, filter `role = FROM` |
| Open tasks per assignee | BAR | task | group by `assignee`, filter `status != DONE` |
| Accounts per AM | BAR | company | group by `accountOwner` |

Ring-group calls are left in the "no value" bucket rather than filtered out, so the gap stays
visible instead of silently shrinking the totals.

## Implementation

`definePageLayout` with `PageLayoutType.DASHBOARD` and two `definePageLayoutTab` entries, shipped
as code in the app so it deploys and versions with everything else rather than being hand-built
in the UI. Chart widgets reference `fieldMetadataId` values, so each widget resolves its field
from `src/constants/universal-identifiers.ts`; any field not already there gets a constant added.

Files: `src/page-layouts/am-dashboard.page-layout.ts` plus one tab file per tab, following the
existing `deal-record-page` layout pattern.

## Limits, stated on the dashboard itself

Each of these gets a short `description` on the relevant widget so a viewer is not misled:

1. **Emails per AM is all-time.** `messageParticipant.createdAt` is sync time, not send time, and
   the send date lives on `message.receivedAt` which charts cannot reach across a relation. A
   time-windowed version needs a stamped date field on the participant.
2. **Call history begins 2026-07-20.** Anything earlier predates the Dialpad webhook.
3. **112 calls have no AM.** Ring-group legs; 108 of them were answered with real duration, so the
   answerer exists but is only recoverable through the Dialpad API.
4. **Coverage counts any touch**, including inbound email the AM did not initiate.

## Verification

- Every widget renders non-empty except where the Limits section predicts otherwise.
- Leads owned per AM sums to 1,256 and matches the per-AM table above.
- Calls per AM sums to 430, with 112 in the no-value bucket, totalling 542.
- Re-deploying the app leaves the dashboard unchanged (idempotent manifest sync).
- Spot-check one AM against a manual query before showing it to anyone.

## Follow-ups this design depends on but does not include

- Dialpad answering-user resolution: needs `DIALPAD_API_KEY` for the 114 historical calls, and a
  captured ring-group payload to learn the field name for future ones.
- Industry taxonomy fold, so an industry breakdown becomes possible later.
- Owner coverage: 8,679 unowned leads is reported, not solved. Redistribution needs a rule.
