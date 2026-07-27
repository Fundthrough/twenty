import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'ce95ca35-e8d6-4f8a-b177-4a2c183b4cfa',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'disqualifiedReasonOther',
  label: "Disqualified Reason Other",
  description: "Imported: Lead.Disqualified_Reason_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
