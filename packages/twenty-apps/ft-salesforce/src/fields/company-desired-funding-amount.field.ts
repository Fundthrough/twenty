import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '91b35d3f-9628-4410-b3ca-300b0f448973',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.NUMBER,
  name: 'desiredFundingAmount',
  label: "Desired Funding Amount",
  description: "Imported: Lead.Desired_Funding_Amount__c",
  icon: 'IconNumber',
  isNullable: true,
  defaultValue: null,
});
