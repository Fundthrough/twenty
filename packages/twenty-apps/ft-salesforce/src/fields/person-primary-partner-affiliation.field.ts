import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'c4f951c1-de6f-46dd-9151-cfbf2d0977fe',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'primaryPartnerAffiliation',
  label: "Primary Partner Affiliation",
  description: "Imported: Lead.Primary_Partner_Affiliation__c",
  icon: 'IconList',
  options: [
    { id: '71291a6f-555c-4a63-a5d2-fc6f54866d90', value: 'SPS_COMMERCE', label: "SPS Commerce", position: 0, color: 'blue' },
    { id: 'e7b358c7-0313-4050-a5ef-2167260f0c7c', value: 'ENVERUS', label: "Enverus", position: 1, color: 'green' },
    { id: '539fa57b-8a6e-459a-aecd-9ff5cc28f1a8', value: 'INTUIT_CA', label: "Intuit CA", position: 2, color: 'turquoise' },
    { id: '1a9ec52d-0b5b-494d-9b77-85577e00ec32', value: 'INTUIT_USA', label: "Intuit USA", position: 3, color: 'yellow' },
    { id: 'e70cfab5-b793-4f98-95da-8ba64386b3eb', value: 'BLUEVINE', label: "Bluevine", position: 4, color: 'orange' },
  ],
  isNullable: true,
  defaultValue: null,
});
