import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '7f97c140-c2b5-4e55-b318-d145b3943de8',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'sfLeadId',
  label: "SF Lead Id",
  description: "Imported: key — Lead.Id",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
