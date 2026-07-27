import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '3a0a3028-6565-4112-93b1-5d69ae31e147',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'annualRevenueBand',
  label: "Annual Revenue Band",
  description: "Imported: Lead.Annual_Revenue_Range__c (Marketo form)",
  icon: 'IconChartBar',
  isNullable: true,
  options: [
    { id: '98d66761-5c22-4d5f-8d9a-850f08cdc36e', value: 'UNDER_1M', label: "<$1M", position: 0, color: 'blue' },
    { id: '851e5321-cf06-47bb-b981-79aeb93b86e6', value: 'FROM_1M_TO_5M', label: "$1M - $5M", position: 1, color: 'green' },
    { id: '7b3adcd7-2415-4d92-b739-00bea3d69ac7', value: 'FROM_5M_TO_10M', label: "$5M - $10M", position: 2, color: 'turquoise' },
    { id: '2c322b07-f91b-4d26-8c34-4038bdc21559', value: 'OVER_10M', label: ">$10M", position: 3, color: 'yellow' },
  ],
  defaultValue: null,
});
