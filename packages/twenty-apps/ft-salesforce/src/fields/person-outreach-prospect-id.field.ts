import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'c7be4041-b26f-45f4-978e-10ff70d7c172',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'outreachProspectId',
  label: 'Outreach Prospect Id',
  description: 'Outreach prospect id matched by email (EE-5069) — join key for webhook events',
  icon: 'IconKey',
  isNullable: true,
  defaultValue: null,
});
