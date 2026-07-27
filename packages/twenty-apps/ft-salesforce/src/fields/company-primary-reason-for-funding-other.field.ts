import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'f8654b00-a62d-4671-a9eb-dd61d2b14d9a',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'primaryReasonForFundingOther',
  label: "Primary Reason for Funding - Other",
  description: "Imported: Lead.Primary_Reason_for_Funding_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
