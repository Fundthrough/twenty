import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'c4d7b8f1-1983-4694-b1c3-421545373d2a',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'accountNotes',
  label: "Account Notes",
  description: "Imported: Lead.Account_Notes__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
