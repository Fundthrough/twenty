import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '11b06044-38ee-4e3f-94bf-be6ac8412e5f',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.NUMBER,
  name: 'desiredFundingAmount',
  label: "Desired Funding Amount",
  description: "Imported: Lead.Desired_Funding_Amount__c",
  icon: 'IconNumber',
  isNullable: true,
  defaultValue: null,
});
