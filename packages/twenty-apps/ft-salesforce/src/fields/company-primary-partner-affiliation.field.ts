import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'ddbf236a-a6db-4411-8a28-182ef44ce636',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'primaryPartnerAffiliation',
  label: "Primary Partner Affiliation",
  description: "Imported: Lead.Primary_Partner_Affiliation__c",
  icon: 'IconList',
  options: [
    { id: 'fab138d5-bc00-4994-a132-f7f5552194cc', value: 'SPS_COMMERCE', label: "SPS Commerce", position: 0, color: 'blue' },
    { id: 'd1632680-de63-4f0a-87f7-1abe2a74304a', value: 'ENVERUS', label: "Enverus", position: 1, color: 'green' },
    { id: '1c642e80-cf61-4887-aa96-d96c1f640756', value: 'INTUIT_CA', label: "Intuit CA", position: 2, color: 'turquoise' },
    { id: 'ecfa1d0f-9376-40f6-aac5-c34b86d807e9', value: 'INTUIT_USA', label: "Intuit USA", position: 3, color: 'yellow' },
    { id: '3bb0ccbf-6e86-4dba-9b73-71bd9a5f8e4e', value: 'BLUEVINE', label: "Bluevine", position: 4, color: 'orange' },
  ],
  isNullable: true,
  defaultValue: null,
});
