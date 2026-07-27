import { timingSafeEqual } from 'crypto';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload, Response } from 'twenty-sdk/logic-function';
import { OUTREACH_PUSH_UID } from 'src/constants/universal-identifiers';

// "Push to Outreach" action (EE-5069 Phase 2a): invoked by the manual-trigger workflow
// button on person records. Creates (or links) the Outreach prospect for the person's
// email — never duplicates — sets the prospect owner from the company's Account Owner,
// and writes outreachProspectId + the Outreach link back onto the person.
// Auth: static token (?token= / x-push-token) vs OUTREACH_PUSH_TOKEN app variable
// (Dialpad mode-B pattern). Needs prospects.all scope on OUTREACH_ACCESS_TOKEN.

const API = 'https://api.outreach.io/api/v2';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const outreachFetch = async (path: string, init?: RequestInit) => {
  const token = process.env.OUTREACH_ACCESS_TOKEN;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.api+json',
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => null)) as { data?: unknown; errors?: unknown } | null;
  return { status: res.status, json };
};

const handler = async (event: RoutePayload<{ personId?: string }>): Promise<Response> => {
  const expected = process.env.OUTREACH_PUSH_TOKEN;
  if (!expected) return jsonResponse({ error: 'OUTREACH_PUSH_TOKEN app variable not set' }, 500);
  const provided = String(event.queryStringParameters?.token ?? event.headers?.['x-push-token'] ?? '');
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return jsonResponse({ error: 'Invalid token' }, 401);
  }

  const personId = (event.body as { personId?: string } | undefined)?.personId;
  if (!personId) return jsonResponse({ error: 'Missing personId in body' }, 400);

  const client = new CoreApiClient();
  const found = await client.query({
    person: {
      __args: { filter: { id: { eq: personId } } },
      id: true,
      jobTitle: true,
      outreachProspectId: true,
      name: { firstName: true, lastName: true },
      emails: { primaryEmail: true },
      phones: { primaryPhoneNumber: true, primaryPhoneCallingCode: true },
      linkedinLink: { primaryLinkUrl: true },
      city: true,
      company: {
        id: true, name: true, industry: true, leadSource: true, employees: true,
        domainName: { primaryLinkUrl: true },
        address: { addressCity: true, addressState: true },
      },
    },
  }) as {
    person?: {
      id: string;
      jobTitle?: string | null;
      outreachProspectId?: string | null;
      name?: { firstName?: string; lastName?: string };
      emails?: { primaryEmail?: string | null };
      phones?: { primaryPhoneNumber?: string | null; primaryPhoneCallingCode?: string | null };
      linkedinLink?: { primaryLinkUrl?: string | null };
      city?: string | null;
      company?: {
        id: string; name?: string; industry?: string | null; leadSource?: string | null; employees?: number | null;
        domainName?: { primaryLinkUrl?: string | null };
        address?: { addressCity?: string | null; addressState?: string | null };
      } | null;
    };
  };
  const person = found.person;
  if (!person?.id) return jsonResponse({ error: 'Person not found' }, 404);
  const email = person.emails?.primaryEmail?.trim().toLowerCase();
  if (!email) return jsonResponse({ error: 'Person has no email — set one before pushing to Outreach' }, 422);

  // ---- applicable prospect fields from the Twenty person + related company ----
  const titleCase = (v: string) => v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const phone = person.phones?.primaryPhoneNumber
    ? `${person.phones.primaryPhoneCallingCode ?? ''}${person.phones.primaryPhoneNumber}`
    : undefined;
  const mappedAttributes: Record<string, unknown> = {
    firstName: person.name?.firstName || undefined,
    lastName: person.name?.lastName || undefined,
    title: person.jobTitle || undefined,
    occupation: person.jobTitle || undefined,
    workPhones: phone ? [phone] : undefined,
    linkedInUrl: person.linkedinLink?.primaryLinkUrl || undefined,
    addressCity: person.city || person.company?.address?.addressCity || undefined,
    addressState: person.company?.address?.addressState || undefined,
    company: person.company?.name || undefined,
    companyIndustry: person.company?.industry ? titleCase(person.company.industry) : undefined,
    websiteUrl1: person.company?.domainName?.primaryLinkUrl || undefined,
  };
  for (const k of Object.keys(mappedAttributes)) {
    if (mappedAttributes[k] === undefined) delete mappedAttributes[k];
  }

  // ---- resolve the Outreach account (relationship, not just the company string) ----
  // find by domain first, then exact name; create when missing (needs accounts.write —
  // gracefully skipped with a log line until that scope is granted)
  let accountId: number | undefined;
  if (person.company?.name) {
    const domain = person.company.domainName?.primaryLinkUrl?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || undefined;
    if (domain) {
      const byDomain = await outreachFetch(`/accounts?filter[domain]=${encodeURIComponent(domain)}&page[limit]=1`);
      accountId = ((byDomain.json?.data ?? []) as Array<{ id: number }>)[0]?.id;
    }
    if (!accountId) {
      const byName = await outreachFetch(`/accounts?filter[name]=${encodeURIComponent(person.company.name)}&page[limit]=1`);
      accountId = ((byName.json?.data ?? []) as Array<{ id: number }>)[0]?.id;
    }
    if (!accountId) {
      const createAccount = await outreachFetch('/accounts', {
        method: 'POST',
        body: JSON.stringify({ data: { type: 'account', attributes: {
          name: person.company.name,
          ...(domain ? { domain } : {}),
          ...(person.company.industry ? { industry: titleCase(person.company.industry) } : {}),
        } } }),
      });
      if (createAccount.status === 201) {
        accountId = (createAccount.json?.data as { id: number }).id;
        console.log(`outreach-push: created account #${accountId} for ${person.company.name}`);
      } else {
        console.log(`outreach-push: account create skipped (${createAccount.status}${createAccount.status === 403 ? ' — accounts.write scope missing' : ''})`);
      }
    }
  }

  // ---- find or create the prospect (never duplicate) ----
  let prospectId: string | undefined;
  let created = false;
  const search = await outreachFetch(`/prospects?filter[emails]=${encodeURIComponent(email)}&page[limit]=1`);
  if (search.status === 401) return jsonResponse({ error: 'Outreach token expired — run scripts/setup-outreach.mjs' }, 502);
  const hits = (search.json?.data ?? []) as Array<{ id: number; attributes?: Record<string, unknown> }>;
  if (hits.length > 0) {
    prospectId = String(hits[0].id);
    // fill only fields the existing prospect has blank — never clobber Outreach data
    const existing = hits[0].attributes ?? {};
    const gaps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(mappedAttributes)) {
      const current = existing[k];
      const blank = current === null || current === undefined || current === '' || (Array.isArray(current) && current.length === 0);
      if (blank) gaps[k] = v;
    }
    const hasAccount = Boolean((hits[0] as { relationships?: { account?: { data?: unknown } } }).relationships?.account?.data);
    if (Object.keys(gaps).length > 0 || (accountId && !hasAccount)) {
      const patch = await outreachFetch(`/prospects/${prospectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ data: { type: 'prospect', id: Number(prospectId), attributes: gaps,
          ...(accountId && !hasAccount ? { relationships: { account: { data: { type: 'account', id: accountId } } } } : {}) } }),
      });
      console.log(`outreach-push: filled ${Object.keys(gaps).length} blank fields${accountId && !hasAccount ? ' + account link' : ''} (${patch.status})`);
    }
  } else {
    // owner: best-effort match of the company's Account Owner email to an Outreach user
    let ownerId: number | undefined;
    // relation depth is capped at 2 in Twenty's GraphQL — person→company→accountOwner
    // resolves to null, so the owner needs its own depth-1 query on company
    let ownerEmail: string | undefined;
    if (person.company?.id) {
      const companyOwner = await client.query({
        company: {
          __args: { filter: { id: { eq: person.company.id } } },
          accountOwner: { userEmail: true },
        },
      }) as { company?: { accountOwner?: { userEmail?: string | null } | null } };
      ownerEmail = companyOwner.company?.accountOwner?.userEmail?.trim().toLowerCase() ?? undefined;
    }
    if (ownerEmail) {
      const users = await outreachFetch(`/users?filter[email]=${encodeURIComponent(ownerEmail)}&page[limit]=1`);
      const userHits = (users.json?.data ?? []) as Array<{ id: number }>;
      ownerId = userHits[0]?.id;
      console.log(`outreach-push owner lookup: ${ownerEmail} → status ${users.status}, userId ${ownerId ?? 'none'}`);
    } else {
      console.log('outreach-push owner lookup: no account owner email on company');
    }
    const create = await outreachFetch('/prospects', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'prospect',
          attributes: { emails: [email], ...mappedAttributes },
          ...(ownerId || accountId ? { relationships: {
            ...(ownerId ? { owner: { data: { type: 'user', id: ownerId } } } : {}),
            ...(accountId ? { account: { data: { type: 'account', id: accountId } } } : {}),
          } } : {}),
        },
      }),
    });
    if (create.status === 403) return jsonResponse({ error: 'Outreach token lacks prospects.all scope — re-consent needed' }, 502);
    if (create.status !== 201) {
      return jsonResponse({ error: `Outreach create failed (${create.status}): ${JSON.stringify(create.json?.errors ?? '').slice(0, 200)}` }, 502);
    }
    prospectId = String((create.json?.data as { id: number }).id);
    created = true;
  }

  const prospectUrl = `https://web.outreach.io/prospects/${prospectId}/overview`;
  await client.mutation({
    updatePerson: {
      __args: {
        id: person.id,
        data: {
          outreachProspectId: prospectId,
          outreachUrl: { primaryLinkUrl: prospectUrl, primaryLinkLabel: 'Outreach prospect' },
        },
      },
      id: true,
    },
  });

  // pushing to Outreach is an outbound motion — stamp lead source when not already attributed
  let leadSourceSet = false;
  if (person.company?.id && !person.company.leadSource) {
    await client.mutation({
      updateCompany: { __args: { id: person.company.id, data: { leadSource: 'OUTBOUND' } }, id: true },
    });
    leadSourceSet = true;
  }

  console.log(`outreach-push: person ${person.id} → prospect #${prospectId} (${created ? 'created' : 'linked'}), leadSource ${leadSourceSet ? 'set OUTBOUND' : 'kept'}`);
  return jsonResponse({ prospectId, action: created ? 'created' : 'linked', url: prospectUrl });
};

export default defineLogicFunction({
  universalIdentifier: OUTREACH_PUSH_UID,
  name: 'outreach-push',
  description: 'Creates or links the Outreach prospect for a person and writes back the id and link (Push to Outreach button).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/outreach-push',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: false,
  },
});
