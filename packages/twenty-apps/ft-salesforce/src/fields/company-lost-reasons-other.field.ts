import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '119f7095-0af7-4dd3-8346-63d64a6ec4ca',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'lostReasonsOther',
  label: "Lost Reasons Other",
  description: "Imported: Lead.Lost_Reasons_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
