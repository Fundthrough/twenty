import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '518c2e53-d780-4491-a08a-2c5a97eaec06',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'partnerAgentId',
  label: "Partner Agent Id",
  description: "Imported: Lead.Partner_Agent_ID__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
