import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import {
  type DatabaseEventPayload,
  type ObjectRecordCreateEvent,
} from 'twenty-sdk/logic-function';

import { ZOOMINFO_ENRICH_CONTACT_UID } from 'src/constants/universal-identifiers';
import { enrichContact } from 'src/utils/zoominfo-client';

type PersonRecord = {
  id: string;
  name?: { firstName?: string; lastName?: string };
  emails?: { primaryEmail?: string };
  phones?: { primaryPhoneNumber?: string };
  jobTitle?: string;
  linkedinLink?: { primaryLinkUrl?: string };
};

type PersonCreateEvent = DatabaseEventPayload<
  ObjectRecordCreateEvent<PersonRecord>
>;

const handler = async (
  event: PersonCreateEvent,
): Promise<object | undefined> => {
  const person = event.properties.after;
  const email = person.emails?.primaryEmail;

  if (!email) {
    return { skipped: true, reason: 'no_email', personId: person.id };
  }

  const result = await enrichContact(email);

  if (!result) {
    return { skipped: true, reason: 'no_match', email, personId: person.id };
  }

  const { jobTitle, directPhoneNumber, linkedInUrl } = result.attributes;
  const updates: Record<string, unknown> = {};

  if (jobTitle && !person.jobTitle) {
    updates['jobTitle'] = jobTitle;
  }

  if (directPhoneNumber && !person.phones?.primaryPhoneNumber) {
    updates['phones'] = {
      primaryPhoneNumber: directPhoneNumber,
      primaryPhoneCountryCode: '+1',
    };
  }

  if (linkedInUrl && !person.linkedinLink?.primaryLinkUrl) {
    updates['linkedinLink'] = {
      primaryLinkUrl: linkedInUrl,
      primaryLinkLabel: 'LinkedIn',
    };
  }

  if (Object.keys(updates).length === 0) {
    return { skipped: true, reason: 'fields_already_set', personId: person.id };
  }

  const client = new CoreApiClient();
  await client.mutation({
    updatePerson: {
      __args: { id: person.id, data: updates },
      id: true,
    },
  });

  return {
    enriched: true,
    matchStatus: result.meta.matchStatus,
    fieldsUpdated: Object.keys(updates),
    personId: person.id,
  };
};

export default defineLogicFunction({
  universalIdentifier: ZOOMINFO_ENRICH_CONTACT_UID,
  name: 'zoominfo-enrich-contact',
  description:
    'Enriches a newly created Contact/Person with ZoomInfo data (job title, direct phone, LinkedIn).',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'person.created',
  },
});
