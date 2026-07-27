import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '4db0db8a-d28a-4ae9-b48e-9f18fd8a95e6',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'annualRevenueBand',
  label: "Annual Revenue Band",
  description: "Imported: Lead.Annual_Revenue_Range__c (Marketo form)",
  icon: 'IconChartBar',
  isNullable: true,
  options: [
    { id: 'a60442dc-e8bd-4a3f-8d6f-c9a2d0e663ac', value: 'UNDER_1M', label: "<$1M", position: 0, color: 'blue' },
    { id: '0fcd3212-637a-406e-befb-bd7af3db9791', value: 'FROM_1M_TO_5M', label: "$1M - $5M", position: 1, color: 'green' },
    { id: '662fc0e4-df8c-4c4b-b274-1fdec6a2d055', value: 'FROM_5M_TO_10M', label: "$5M - $10M", position: 2, color: 'turquoise' },
    { id: '031852e7-fd96-4ccc-9ec0-0e83fe9411cc', value: 'OVER_10M', label: ">$10M", position: 3, color: 'yellow' },
  ],
  defaultValue: null,
});
