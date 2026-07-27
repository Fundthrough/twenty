import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'f4ecd746-05b0-440d-8811-b1b25665bd80',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'renurtureReasonOther',
  label: "Renurture Reason Other",
  description: "Imported: Lead.Renurture_Reason_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
