import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'd51466ce-17ab-4a62-8ceb-bd940cd7f0c9',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'businessRegisteredIn',
  label: "Business Registered In",
  description: "Imported: Lead.Where_is_your_business_registered__c (Marketo form)",
  icon: 'IconWorld',
  isNullable: true,
  options: [
    { id: '53b1b2de-08d5-423a-8906-f3bd31464ae5', value: 'CANADA', label: "Canada", position: 0, color: 'blue' },
    { id: 'd7d29146-caf1-4f69-a1b9-b5615e5a06d7', value: 'UNITED_STATES', label: "United States", position: 1, color: 'green' },
    { id: '90d5d8d4-b76e-4abb-97b0-90d9ebf988ba', value: 'OUTSIDE_NORTH_AMERICA', label: "Outside North America", position: 2, color: 'turquoise' },
  ],
  defaultValue: null,
});
