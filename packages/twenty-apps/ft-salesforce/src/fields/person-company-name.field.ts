import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '4dbe93a6-86b5-4e56-a1c5-f70ca95cfc50',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'companyName',
  label: "Company Name",
  description: "Imported: Lead.Company",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
