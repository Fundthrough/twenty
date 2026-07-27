import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '3fad6c04-6ae2-4359-9f38-8b606e556a54',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'outreachSequence',
  label: 'Outreach Sequence',
  description: 'Name of the most recent Outreach sequence this person was enrolled in',
  icon: 'IconListNumbers',
  isNullable: true,
  defaultValue: null,
});
