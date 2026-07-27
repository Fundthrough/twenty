import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'f61b7e50-14ee-43e1-8afe-58972bea8e83',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'desiredFundingBand',
  label: "Desired Funding Band",
  description: "Imported: Lead.How_much_funding_are_you_looking_for__c (Marketo form)",
  icon: 'IconCoin',
  isNullable: true,
  options: [
    { id: 'aedcabc8-7ab3-413e-a253-3f4206f42e1c', value: 'UNDER_50K', label: "Under $50k", position: 0, color: 'blue' },
    { id: '35426cc0-2a78-436f-b290-a6b39347001a', value: 'FROM_50K_TO_100K', label: "$50k-$100k", position: 1, color: 'green' },
    { id: '24d93f89-9434-4bc0-8b7e-8628ee96c151', value: 'UNDER_100K', label: "Under $100k", position: 2, color: 'turquoise' },
    { id: '4f464f6e-8fb8-45d5-8964-9a3f0a1f73ff', value: 'FROM_100K_TO_200K', label: "$100k-$200k", position: 3, color: 'yellow' },
    { id: '23edfa32-b9fb-4878-b064-50027cfb04d3', value: 'FROM_200K_TO_500K', label: "$200k-$500k", position: 4, color: 'orange' },
    { id: '05aee1e2-c745-49fa-8f40-cfb57ccbf574', value: 'FROM_100K_TO_500K', label: "$100k-$500k", position: 5, color: 'red' },
    { id: '538b54ec-5a80-472c-9682-f65cba7dca3e', value: 'FROM_500K_TO_1M', label: "$500k-$1M", position: 6, color: 'purple' },
    { id: '8021501b-83ea-4b62-be94-ed3c0aad2ec9', value: 'OVER_1M', label: "Over $1M", position: 7, color: 'pink' },
  ],
  defaultValue: null,
});
