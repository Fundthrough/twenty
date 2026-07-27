import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { PROCESS_OUTREACH_EVENT_UID } from 'src/constants/universal-identifiers';

// Dispatched by outreach-webhook (signature already verified); runs workspace-scoped.
// Maps Outreach events onto the company-centric model (EE-5069 Phase 1, one-way):
//   call.*                          → Call (upsert by dialpadCallId 'outreach-<id>', callSource OUTREACH)
//   mailing.* / sequenceState.*     → person outreach engagement fields
//   task.created/completed          → Task (upsert by outreachTaskId)
// Prospect→person matching: outreachProspectId first, then prospect emails via the
// Outreach API (OUTREACH_ACCESS_TOKEN app variable, pushed by scripts/outreach-auth.mjs
// --refresh wiring; expired token → event logged as skipped, backfill reconciles).
//
// OUTREACH_LOG_ONLY (default '1'): log the classified event, write NOTHING. Flip to '0'
// only after payload shapes are validated against real deliveries (docs/OUTREACH-SETUP.md).

type OutreachEvent = {
  data?: {
    type?: string;
    id?: number | string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, { data?: { type?: string; id?: number | string } | null }>;
  };
  meta?: { eventName?: string; deliveredAt?: string };
};

const API = 'https://api.outreach.io/api/v2';

const relId = (event: OutreachEvent, name: string): string | undefined => {
  const rel = event.data?.relationships?.[name]?.data;
  return rel?.id !== undefined && rel?.id !== null ? String(rel.id) : undefined;
};

const outreachGet = async (path: string): Promise<Record<string, unknown> | undefined> => {
  const token = process.env.OUTREACH_ACCESS_TOKEN;
  if (!token) return undefined;
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.api+json' },
  });
  if (!res.ok) {
    console.log(`outreach GET ${path} → ${res.status} (token expired? backfill will reconcile)`);
    return undefined;
  }
  return (await res.json()) as Record<string, unknown>;
};

type MatchedPerson = { id: string; companyId?: string | null };

const findPersonForProspect = async (
  client: CoreApiClient,
  prospectId: string | undefined,
): Promise<MatchedPerson | undefined> => {
  if (!prospectId) return undefined;
  // 1. previously-linked person
  const byId = await client.query({
    people: {
      __args: { filter: { outreachProspectId: { eq: prospectId } }, first: 1 },
      edges: { node: { id: true, companyId: true } },
    },
  }) as { people?: { edges?: Array<{ node: MatchedPerson }> } };
  const known = byId.people?.edges?.[0]?.node;
  if (known) return known;

  // 2. match by prospect emails (needs API token)
  const prospect = await outreachGet(`/prospects/${prospectId}`);
  const attrs = (prospect?.data as { attributes?: { emails?: string[] } } | undefined)?.attributes;
  const emails = (attrs?.emails ?? []).filter(Boolean).map((e) => e.toLowerCase());
  if (emails.length === 0) return undefined;
  const byEmail = await client.query({
    people: {
      __args: { filter: { or: emails.map((e) => ({ emails: { primaryEmail: { eq: e } } })) }, first: 1 },
      edges: { node: { id: true, companyId: true } },
    },
  }) as { people?: { edges?: Array<{ node: MatchedPerson }> } };
  const person = byEmail.people?.edges?.[0]?.node;
  if (person) {
    await client.mutation({
      updatePerson: { __args: { id: person.id, data: { outreachProspectId: prospectId } }, id: true },
    });
  }
  return person;
};

const setEngagement = async (
  client: CoreApiClient,
  person: MatchedPerson,
  eventName: string,
  occurredAt: string | undefined,
  sequenceName?: string,
) => {
  const data: Record<string, unknown> = {
    outreachLastEvent: eventName,
    outreachLastEventAt: occurredAt ?? new Date().toISOString(),
  };
  if (sequenceName) data.outreachSequence = sequenceName;
  await client.mutation({ updatePerson: { __args: { id: person.id, data }, id: true } });
};

const handler = async (event: OutreachEvent) => {
  const eventName = event.meta?.eventName ?? 'unknown';
  const resourceId = event.data?.id !== undefined ? String(event.data.id) : undefined;
  console.log(`outreach event: ${eventName} ${event.data?.type ?? ''}#${resourceId ?? '?'}`);

  const logOnly = (process.env.OUTREACH_LOG_ONLY ?? '1') !== '0';
  if (logOnly) {
    console.log('LOG_ONLY payload:', JSON.stringify(event).slice(0, 1500));
    return { logOnly: true, eventName };
  }
  if (!resourceId) return { skipped: 'no resource id' };

  const client = new CoreApiClient();
  const [resource, action] = eventName.split('.');
  const attrs = event.data?.attributes ?? {};

  switch (resource) {
    case 'call': {
      const person = await findPersonForProspect(client, relId(event, 'prospect'));
      const externalId = `outreach-${resourceId}`;
      const existing = await client.query({
        calls: { __args: { filter: { dialpadCallId: { eq: externalId } }, first: 1 }, edges: { node: { id: true } } },
      }) as { calls?: { edges?: Array<{ node: { id: string } }> } };
      const direction = String(attrs.direction ?? '').toLowerCase() === 'inbound' ? 'INBOUND' : 'OUTBOUND';
      const data: Record<string, unknown> = {
        name: `Outreach ${direction === 'INBOUND' ? 'inbound' : 'outbound'} call${person ? '' : ' (unmatched)'}`,
        dialpadCallId: externalId,
        callSource: 'OUTREACH',
        direction,
        startedAt: attrs.completedAt ?? attrs.createdAt ?? new Date().toISOString(),
        personId: person?.id ?? null,
        companyId: person?.companyId ?? null,
      };
      const existingCall = existing.calls?.edges?.[0]?.node;
      if (existingCall) {
        await client.mutation({ updateCall: { __args: { id: existingCall.id, data }, id: true } });
      } else {
        await client.mutation({ createCall: { __args: { data }, id: true } });
      }
      return { handled: eventName, matched: Boolean(person) };
    }

    case 'mailing': {
      // delivered / opened / replied / bounced
      const person = await findPersonForProspect(client, relId(event, 'prospect'));
      if (!person) return { skipped: 'prospect unmatched', eventName };
      const occurredAt = String(attrs.openedAt ?? attrs.repliedAt ?? attrs.deliveredAt ?? attrs.updatedAt ?? '') || undefined;
      await setEngagement(client, person, `mailing_${action}`, occurredAt);
      return { handled: eventName };
    }

    case 'sequenceState': {
      const person = await findPersonForProspect(client, relId(event, 'prospect'));
      if (!person) return { skipped: 'prospect unmatched', eventName };
      let sequenceName: string | undefined;
      const sequenceId = relId(event, 'sequence');
      if (sequenceId) {
        const seq = await outreachGet(`/sequences/${sequenceId}`);
        sequenceName = (seq?.data as { attributes?: { name?: string } } | undefined)?.attributes?.name;
      }
      await setEngagement(client, person, `sequence_${action}`, String(attrs.updatedAt ?? '') || undefined, sequenceName);
      return { handled: eventName };
    }

    case 'task': {
      const person = await findPersonForProspect(client, relId(event, 'prospect'));
      const existing = await client.query({
        tasks: { __args: { filter: { outreachTaskId: { eq: resourceId } }, first: 1 }, edges: { node: { id: true } } },
      }) as { tasks?: { edges?: Array<{ node: { id: string } }> } };
      const data: Record<string, unknown> = {
        title: String(attrs.action ?? 'Outreach task') + (attrs.note ? `: ${String(attrs.note).slice(0, 120)}` : ''),
        outreachTaskId: resourceId,
        status: attrs.completedAt ? 'DONE' : 'TODO',
        dueAt: attrs.dueAt ?? null,
      };
      const existingTask = existing.tasks?.edges?.[0]?.node;
      let taskId: string | undefined = existingTask?.id;
      if (existingTask) {
        await client.mutation({ updateTask: { __args: { id: existingTask.id, data }, id: true } });
      } else {
        const created = await client.mutation({ createTask: { __args: { data }, id: true } }) as { createTask?: { id?: string } };
        taskId = created.createTask?.id;
        if (taskId && person) {
          await client.mutation({
            createTaskTarget: { __args: { data: { taskId, personId: person.id } }, id: true },
          });
        }
      }
      return { handled: eventName };
    }

    default:
      console.log(`unhandled resource: ${eventName}`);
      return { skipped: eventName };
  }
};

export default defineLogicFunction({
  universalIdentifier: PROCESS_OUTREACH_EVENT_UID,
  name: 'process-outreach-event',
  description: 'Maps verified Outreach events onto Calls, person engagement fields, and Tasks (EE-5069 Phase 1).',
  timeoutSeconds: 30,
  handler,
});
