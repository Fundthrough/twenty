import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '0296a1ba-06bb-4798-827a-91bd9ff937cd',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'businessRegisteredIn',
  label: "Business Registered In",
  description: "Imported: Lead.Where_is_your_business_registered__c (Marketo form)",
  icon: 'IconWorld',
  isNullable: true,
  options: [
    { id: 'a3a6904e-78ce-4bfd-92a2-4efe0c8e3126', value: 'CANADA', label: "Canada", position: 0, color: 'blue' },
    { id: '50212975-72b0-4e3d-a2fc-ca9c4a695ebc', value: 'UNITED_STATES', label: "United States", position: 1, color: 'green' },
    { id: '47d9bf7f-27b7-4fe0-a8f7-0401eee32ba0', value: 'OUTSIDE_NORTH_AMERICA', label: "Outside North America", position: 2, color: 'turquoise' },
  ],
  defaultValue: null,
});
