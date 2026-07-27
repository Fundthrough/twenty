import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'd3a2bc35-9927-43ae-aef9-b845cf021599',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.LINKS,
  name: 'outreachUrl',
  label: 'Outreach',
  description: 'One-click link to this person’s Outreach prospect (set by Push to Outreach)',
  icon: 'IconExternalLink',
  isNullable: true,
  defaultValue: null,
});
