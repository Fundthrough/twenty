import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'd9b5ff91-1304-41af-95f9-cbb9d1db02d3',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'partnerAgentId',
  label: "Partner Agent Id",
  description: "Imported: Lead.Partner_Agent_ID__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
