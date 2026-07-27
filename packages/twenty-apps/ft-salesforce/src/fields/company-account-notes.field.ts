import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '4cf3f26a-5e85-46c1-96de-0f85023bc8be',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'accountNotes',
  label: "Account Notes",
  description: "Imported: Lead.Account_Notes__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
