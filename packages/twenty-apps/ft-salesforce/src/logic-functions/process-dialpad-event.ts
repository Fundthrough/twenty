import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { PROCESS_DIALPAD_EVENT_UID } from 'src/constants/universal-identifiers';
import { normalizePhoneE164 } from 'src/utils/norm-phone';

// Dispatched by dialpad-webhook (signature already verified); runs workspace-scoped.
// Classifies the call event, matches the external number to a Person, and upserts a
// Call record by dialpadCallId. Unmatched numbers additionally get ONE open review
// task ("Unmatched call: +1…") — the Call record itself is always kept so no call is lost.
// Field names/assumptions here are validated against real payloads via DIALPAD_LOG_ONLY
// before go-live (docs/DIALPAD-SETUP.md).

type DialpadCallEvent = {
  call_id?: number | string;
  master_call_id?: number | string;
  entry_point_call_id?: number | string;
  state?: string;
  direction?: string; // 'inbound' | 'outbound'
  external_number?: string;
  internal_number?: string;
  contact?: { phone?: string; name?: string; email?: string; type?: string };
  target?: { name?: string; email?: string; type?: string };
  date_started?: number | string;
  date_connected?: number | string | null;
  date_ended?: number | string;
  duration?: number; // milliseconds (confirmed against real payloads 2026-07-20)
  was_recorded?: boolean;
  recording_url?: string | string[];
  admin_call_recording_urls?: string[];
  admin_recording_urls?: string | string[]; // real field name on call payloads (confirmed 2026-07-20)
  recording_details?: Array<{ url?: string; recording_url?: string }>;
  voicemail_link?: string;
  transcription_text?: string;
  // SMS event fields (separate Dialpad subscription; no `state`/`call_id`)
  id?: number | string;
  from_number?: string;
  to_number?: string;
  text?: string; // present only with the Message content export scope
  text_content?: string;
  created_date?: number | string;
};

// late/duplicate deliveries must never regress a call that already completed
const OUTCOME_RANK: Record<string, number> = { MISSED: 1, VOICEMAIL: 2, COMPLETED: 3, SMS: 3 };

const toIso = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return undefined;
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return new Date(ms).toISOString();
};

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return undefined;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
};

const firstUrl = (...candidates: Array<string | string[] | undefined>) => {
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c;
    if (Array.isArray(c) && c.length > 0) return c[0];
  }
  return undefined;
};

const classify = (event: DialpadCallEvent): 'COMPLETED' | 'MISSED' | 'VOICEMAIL' | 'RECORDING' | 'SMS' | undefined => {
  const state = (event.state ?? '').toLowerCase();
  if (state === 'voicemail' || state === 'voicemail_uploaded') return 'VOICEMAIL';
  if (state === 'recording') return 'RECORDING';
  if (state === 'hangup') return toIso(event.date_connected) ? 'COMPLETED' : 'MISSED';
  // SMS events come from the separate /subscriptions/sms channel: no state/call_id,
  // identified by from/to numbers + message id
  if (!state && !event.call_id && (event.from_number ?? event.to_number)) return 'SMS';
  return undefined; // intermediate states (calling/ringing/connected/…) — not subscribed, ignore if delivered
};

const handler = async (event: DialpadCallEvent) => {
  const kind = classify(event);
  if (!kind) return { ok: true, skipped: `state "${event.state}" not logged` };

  // SMS records share the Call object; ids prefixed so they can never collide with call_ids.
  // Calls dedupe on master_call_id: queue-routed calls fire one event per LEG (call center
  // leg + answering-user leg, distinct call_ids) — the master id groups them into one record.
  const callKey = event.master_call_id ?? event.call_id;
  const dialpadCallId = kind === 'SMS'
    ? (event.id !== undefined && event.id !== null ? `sms-${event.id}` : undefined)
    : (callKey !== undefined && callKey !== null ? String(callKey) : undefined);
  if (!dialpadCallId) return { ok: false, error: 'event has no call_id / message id' };

  const externalRaw = kind === 'SMS'
    ? ((event.direction ?? '').toLowerCase() === 'outbound' ? event.to_number : event.from_number) ?? event.contact?.phone
    : event.external_number ?? event.contact?.phone;
  const externalNumber = normalizePhoneE164(externalRaw) ?? externalRaw;
  const direction = (event.direction ?? '').toLowerCase() === 'outbound' ? 'OUTBOUND' : 'INBOUND';
  const durationSeconds = typeof event.duration === 'number' && event.duration > 0
    ? Math.round(event.duration / 1000)
    : undefined;
  const recordingUrl = firstUrl(
    event.recording_url,
    event.admin_recording_urls, // the field name real payloads actually use
    event.admin_call_recording_urls,
    (event.recording_details ?? []).map((r) => r.url ?? r.recording_url).filter((u): u is string => !!u),
  );

  if (process.env.DIALPAD_LOG_ONLY) {
    console.log('[dialpad-log-only]', JSON.stringify({ dialpadCallId, kind, direction, externalRaw, externalNumber, durationMsRaw: event.duration, state: event.state, hasVoicemail: !!event.voicemail_link, hasRecording: !!recordingUrl, contact: event.contact, target: event.target }));
    return { ok: true, logOnly: true, dialpadCallId, kind };
  }

  const client = new CoreApiClient();

  // ---- match Person by phone ----
  // Stored phones are SPLIT on read: primaryPhoneNumber holds the national number
  // ("4165550111") with the calling code separate ("+1") — so match the national form
  // first, with the full E.164 as fallback for any unnormalized imports.
  let person: { id: string; name?: { firstName?: string; lastName?: string }; companyId?: string | null } | undefined;
  if (externalNumber?.startsWith('+')) {
    const national = externalNumber.startsWith('+1') && externalNumber.length === 12
      ? externalNumber.slice(2)
      : undefined;
    const candidates = [national, externalNumber].filter((c): c is string => !!c);
    const found = await client.query({
      people: {
        __args: { filter: { or: candidates.map((c) => ({ phones: { primaryPhoneNumber: { eq: c } } })) }, first: 1 },
        edges: { node: { id: true, companyId: true, name: { firstName: true, lastName: true } } },
      },
    }) as { people?: { edges?: Array<{ node: { id: string; companyId?: string | null; name?: { firstName?: string; lastName?: string } } }> } };
    person = found.people?.edges?.[0]?.node;

    // SF imports store phone numbers in inconsistent shapes, so fall back to the last ten
    // digits and only trust it when exactly one person comes back.
    if (!person) {
      const last10 = externalNumber.replace(/\D/g, '').slice(-10);
      const suffixMatch = await client.query({
        people: {
          __args: { filter: { phones: { primaryPhoneNumber: { ilike: `%${last10}` } } }, first: 2 },
          edges: { node: { id: true, companyId: true, name: { firstName: true, lastName: true } } },
        },
      }) as { people?: { edges?: Array<{ node: { id: string; companyId?: string | null; name?: { firstName?: string; lastName?: string } } }> } };
      const hits = suffixMatch.people?.edges ?? [];
      if (hits.length === 1) person = hits[0].node;
    }
  }

  // ---- resolve the internal handler to a workspace member ----
  // A ring-group leg names the queue (target.type "coaching_team"), not a person, so the answerer
  // has to be fetched: /call/{id} carries operator_call_id, and that call's target is the user
  // who picked up, with an email. Without this the call lands owned by nobody.
  let handlerName = event.target?.name;
  let handlerEmail: string | undefined = event.target?.email || undefined;
  const dialpadKey = process.env.DIALPAD_API_KEY;
  if (event.target?.type && event.target.type !== 'user' && dialpadKey && dialpadCallId) {
    const dp = async (path: string) => {
      const res = await fetch(`https://dialpad.com/api/v2${path}`, {
        headers: { Authorization: `Bearer ${dialpadKey}`, Accept: 'application/json' },
      }).catch(() => null);
      if (!res?.ok) return undefined;
      return res.json().catch(() => undefined) as Promise<Record<string, unknown> | undefined>;
    };
    const parent = await dp(`/call/${dialpadCallId}`);
    const legId = parent?.operator_call_id;
    const leg = legId ? await dp(`/call/${String(legId)}`) : undefined;
    const legTarget = leg?.target as { email?: string; name?: string; type?: string } | undefined;
    if (legTarget?.type === 'user' && legTarget.email) {
      handlerEmail = legTarget.email;
      handlerName = legTarget.name ?? handlerName;
      console.log(`ring-group call ${dialpadCallId} answered by ${handlerEmail}`);
    }
  }

  let handledById: string | undefined;
  if (handlerEmail) {
    const members = await client.query({
      workspaceMembers: {
        __args: { first: 200 },
        edges: { node: { id: true, userEmail: true } },
      },
    }) as { workspaceMembers?: { edges?: Array<{ node: { id: string; userEmail?: string } }> } };
    const wantedEmail = handlerEmail.trim().toLowerCase();
    handledById = (members.workspaceMembers?.edges ?? []).find(
      (e) => e.node.userEmail?.toLowerCase() === wantedEmail,
    )?.node.id;
  }
  if (!handledById && handlerName) {
    const members = await client.query({
      workspaceMembers: {
        __args: { first: 200 },
        edges: { node: { id: true, name: { firstName: true, lastName: true } } },
      },
    }) as { workspaceMembers?: { edges?: Array<{ node: { id: string; name?: { firstName?: string; lastName?: string } } }> } };
    const wanted = handlerName.trim().toLowerCase();
    handledById = (members.workspaceMembers?.edges ?? []).find(
      (e) => [e.node.name?.firstName, e.node.name?.lastName].filter(Boolean).join(' ').toLowerCase() === wanted,
    )?.node.id;
  }
  const personName = person ? [person.name?.firstName, person.name?.lastName].filter(Boolean).join(' ') : undefined;
  const who = personName || externalNumber || 'unknown number';

  // ---- upsert Call by dialpadCallId (unique index; duplicates/retries land here) ----
  const existing = await client.query({
    calls: {
      __args: { filter: { dialpadCallId: { eq: dialpadCallId } }, first: 1 },
      edges: { node: { id: true, outcome: true } },
    },
  }) as { calls?: { edges?: Array<{ node: { id: string; outcome?: string | null } }> } };
  const existingCall = existing.calls?.edges?.[0]?.node;

  const outcome = kind === 'RECORDING'
    ? existingCall?.outcome ?? 'COMPLETED' // recording events arrive after hangup; default sanely if first
    : kind;
  const keptOutcome = existingCall?.outcome && (OUTCOME_RANK[existingCall.outcome] ?? 0) > (OUTCOME_RANK[outcome] ?? 0)
    ? existingCall.outcome
    : outcome;

  const label = keptOutcome === 'SMS' ? `SMS ${direction === 'INBOUND' ? 'from' : 'to'} ${who}`
    : keptOutcome === 'VOICEMAIL' ? `Voicemail from ${who}`
    : keptOutcome === 'MISSED' ? `Missed ${direction === 'INBOUND' ? 'call from' : 'outbound call to'} ${who}`
    : `${direction === 'INBOUND' ? 'Inbound' : 'Outbound'} call with ${who}`;
  const durationSuffix = formatDuration(durationSeconds);

  const data: Record<string, unknown> = {
    name: durationSuffix ? `${label} · ${durationSuffix}` : label,
    direction,
    outcome: keptOutcome,
    dialpadCallId,
    startedAt: toIso(event.date_started) ?? (kind === 'SMS' ? toIso(event.created_date) : undefined),
    endedAt: toIso(event.date_ended),
    messageText: kind === 'SMS' ? (event.text ?? event.text_content) : undefined,
    durationSeconds,
    externalNumber,
    dialpadUser: handlerName ?? handlerEmail,
    handledById,
    personId: person?.id,
    companyId: person?.companyId ?? undefined,
    recordingUrl: recordingUrl ? { primaryLinkLabel: 'Recording', primaryLinkUrl: recordingUrl } : undefined,
    voicemailUrl: event.voicemail_link ? { primaryLinkLabel: 'Voicemail', primaryLinkUrl: event.voicemail_link } : undefined,
    voicemailTranscript: event.transcription_text,
  };
  // A queue leg must never overwrite the answering user's name on an existing record -- unless we
  // resolved the answerer ourselves from the operator leg, in which case it is the better value.
  if (existingCall && event.target?.type && event.target.type !== 'user' && !handledById) {
    delete data.dialpadUser;
    delete data.handledById;
  }
  for (const key of Object.keys(data)) {
    if (data[key] === undefined || data[key] === null || data[key] === '') delete data[key];
  }

  let callId: string | undefined;
  if (existingCall) {
    const updated = await client.mutation({
      updateCall: { __args: { id: existingCall.id, data }, id: true },
    }) as { updateCall?: { id?: string } };
    callId = updated.updateCall?.id;
  } else {
    const created = await client.mutation({
      createCall: { __args: { data }, id: true },
    }) as { createCall?: { id?: string } };
    callId = created.createCall?.id;
  }

  // ---- last activity: calls and SMS count as a touch, alongside email and meetings ----
  if (person && callId) {
    const startedAt = (data.startedAt as string | undefined) ?? new Date().toISOString();
    const activity: Record<string, unknown> = {
      lastActivityAt: startedAt,
      lastActivityType: keptOutcome === 'SMS' ? 'SMS' : 'CALL',
      lastActivityItemCallId: callId,
    };
    if (handledById) activity.lastActivityById = handledById;

    const current = await client.query({
      person: { __args: { filter: { id: { eq: person.id } } }, lastActivityAt: true },
    }) as { person?: { lastActivityAt?: string | null } };
    if (!current.person?.lastActivityAt || new Date(startedAt) >= new Date(current.person.lastActivityAt)) {
      await client.mutation({ updatePerson: { __args: { id: person.id, data: activity }, id: true } });
    }

    if (person.companyId) {
      const currentCompany = await client.query({
        company: { __args: { filter: { id: { eq: person.companyId } } }, lastActivityAt: true },
      }) as { company?: { lastActivityAt?: string | null } };
      if (!currentCompany.company?.lastActivityAt || new Date(startedAt) >= new Date(currentCompany.company.lastActivityAt)) {
        await client.mutation({ updateCompany: { __args: { id: person.companyId, data: activity }, id: true } });
      }
    }
  }

  // ---- unmatched → ONE open review task per number (view: "Dialpad — Unmatched") ----
  let reviewTaskId: string | undefined;
  if (!person && externalNumber) {
    const taskTitle = `Unmatched call: ${externalNumber}`;
    const openTasks = await client.query({
      tasks: {
        __args: { filter: { title: { eq: taskTitle }, status: { neq: 'DONE' } }, first: 1 },
        edges: { node: { id: true } },
      },
    }) as { tasks?: { edges?: Array<{ node: { id: string } }> } };
    reviewTaskId = openTasks.tasks?.edges?.[0]?.node?.id;
    if (!reviewTaskId) {
      const createdTask = await client.mutation({
        createTask: {
          __args: {
            data: {
              title: taskTitle,
              status: 'TODO',
              ...(handledById ? { assigneeId: handledById } : {}),
              bodyV2: {
                markdown: `Dialpad logged ${keptOutcome === 'SMS' ? `an ${direction.toLowerCase()} SMS` : `a ${keptOutcome.toLowerCase()} ${direction.toLowerCase()} call`} from an unknown number.\n\n- Number: ${externalNumber}\n- Handled by: ${event.target?.name ?? 'unknown'}\n- When: ${toIso(event.date_started) ?? toIso(event.created_date) ?? 'unknown'}${event.voicemail_link ? `\n- Voicemail: ${event.voicemail_link}` : ''}\n\nMatch or create the Person, then link the Call record and close this task.`,
              },
            },
          },
          id: true,
        },
      }) as { createTask?: { id?: string } };
      reviewTaskId = createdTask.createTask?.id;
    }
  }

  return { ok: true, callId, matchedPersonId: person?.id, reviewTaskId, outcome: keptOutcome };
};

export default defineLogicFunction({
  universalIdentifier: PROCESS_DIALPAD_EVENT_UID,
  name: 'process-dialpad-event',
  description: 'Upserts a Call record (and unmatched-number review task) from a verified Dialpad call event.',
  timeoutSeconds: 30,
  handler,
});
