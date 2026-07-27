import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '987f0d16-0638-47b9-9ba4-afdf3521c480',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'disqualifiedReasonOther',
  label: "Disqualified Reason Other",
  description: "Imported: Lead.Disqualified_Reason_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
