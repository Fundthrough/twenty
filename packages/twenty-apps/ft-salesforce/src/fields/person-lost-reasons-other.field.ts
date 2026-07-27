import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '259021cc-98de-44e8-9ba3-78b6cb86f035',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'lostReasonsOther',
  label: "Lost Reasons Other",
  description: "Imported: Lead.Lost_Reasons_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
