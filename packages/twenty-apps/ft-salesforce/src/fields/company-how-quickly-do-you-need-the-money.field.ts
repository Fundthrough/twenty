import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '5b8702e0-51f1-4123-b1d9-65c7c954e3a3',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'howQuicklyDoYouNeedTheMoney',
  label: "How Quickly Do You Need The Money",
  description: "Imported: Lead.How_quickly_do_you_need_the_money__c",
  icon: 'IconList',
  options: [
    { id: '39d10097-9c9d-4644-8e4f-81bb112ca507', value: 'NOW', label: "Now", position: 0, color: 'blue' },
    { id: '6e180a04-a919-442d-9481-13e0418aab5f', value: 'WITHIN_A_MONTH', label: "Within a Month", position: 1, color: 'green' },
    { id: '5198e64d-ac2d-4018-8e11-f219012ce47a', value: 'IN_2_4_MONTHS', label: "In 2-4 Months", position: 2, color: 'turquoise' },
    { id: '5c5a4514-8ab9-401c-82c6-176ccfc5316b', value: 'MORE_THAN_4_MONTHS', label: "More than 4 Months", position: 3, color: 'yellow' },
    { id: '7fb504f7-007b-4bb1-9e5a-830c37ac5c03', value: 'JUST_LOOKING_FOR_MORE_INFO', label: "Just Looking for More Info", position: 4, color: 'orange' },
  ],
  isNullable: true,
  defaultValue: null,
});
