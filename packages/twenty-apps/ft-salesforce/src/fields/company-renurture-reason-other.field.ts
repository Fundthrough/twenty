import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'b414c946-4c9f-4546-a36b-4bdaaa531891',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'renurtureReasonOther',
  label: "Renurture Reason Other",
  description: "Imported: Lead.Renurture_Reason_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
