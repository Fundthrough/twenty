import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '2e1537b7-0cd9-4448-82b8-834878f41b41',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'outreachLastEvent',
  label: 'Outreach Last Event',
  description: 'Most recent Outreach engagement event (e.g. mailing_opened, mailing_replied, sequence_finished)',
  icon: 'IconActivity',
  isNullable: true,
  defaultValue: null,
});
