import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'a9ba7d20-62e0-4325-af8e-ff951725aaf9',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'primaryReasonForFundingOther',
  label: "Primary Reason for Funding - Other",
  description: "Imported: Lead.Primary_Reason_for_Funding_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
