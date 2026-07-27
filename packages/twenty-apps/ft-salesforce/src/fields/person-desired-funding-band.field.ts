import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'a6aed3fc-7379-4bee-92b9-bd186dda1bb3',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'desiredFundingBand',
  label: "Desired Funding Band",
  description: "Imported: Lead.How_much_funding_are_you_looking_for__c (Marketo form)",
  icon: 'IconCoin',
  isNullable: true,
  options: [
    { id: '4376420e-2b22-4b92-b7d3-81a8d1562b1f', value: 'UNDER_50K', label: "Under $50k", position: 0, color: 'blue' },
    { id: 'b9070022-47db-436f-9456-fa85fb332551', value: 'FROM_50K_TO_100K', label: "$50k-$100k", position: 1, color: 'green' },
    { id: '56735cc7-e61c-4d20-984a-2b374d950d31', value: 'UNDER_100K', label: "Under $100k", position: 2, color: 'turquoise' },
    { id: '1f3b67cb-a555-4b17-910b-330dd5398fa3', value: 'FROM_100K_TO_200K', label: "$100k-$200k", position: 3, color: 'yellow' },
    { id: '2db524f4-8059-4d95-a416-59970f214ba4', value: 'FROM_200K_TO_500K', label: "$200k-$500k", position: 4, color: 'orange' },
    { id: '00619695-b100-467a-b28e-26da78af18d5', value: 'FROM_100K_TO_500K', label: "$100k-$500k", position: 5, color: 'red' },
    { id: '42bb8eef-d6fb-4ec4-b24f-413e21b91508', value: 'FROM_500K_TO_1M', label: "$500k-$1M", position: 6, color: 'purple' },
    { id: '6e2896e8-f4c8-4b82-8e53-40fa6b75b28b', value: 'OVER_1M', label: "Over $1M", position: 7, color: 'pink' },
  ],
  defaultValue: null,
});
