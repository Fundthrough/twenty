import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '41fe9ea9-4ebb-43e9-9b6e-99f8a5bcd972',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'description',
  label: "Description",
  description: "Imported: Account.Description",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
