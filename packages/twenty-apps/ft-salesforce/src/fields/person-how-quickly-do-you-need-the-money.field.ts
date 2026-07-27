import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'e841b0de-fe58-4adb-95b8-ddf9f69b985c',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'howQuicklyDoYouNeedTheMoney',
  label: "How Quickly Do You Need The Money",
  description: "Imported: Lead.How_quickly_do_you_need_the_money__c",
  icon: 'IconList',
  options: [
    { id: 'fd9f5ef1-6805-492a-bc2c-e54026a35c9b', value: 'NOW', label: "Now", position: 0, color: 'blue' },
    { id: 'a8030b44-661d-4022-b09b-f30c02dff9c3', value: 'WITHIN_A_MONTH', label: "Within a Month", position: 1, color: 'green' },
    { id: 'bbfca56d-641e-44d9-8054-cbdf670bdcc7', value: 'IN_2_4_MONTHS', label: "In 2-4 Months", position: 2, color: 'turquoise' },
    { id: 'cd0eb278-d86a-40b8-b462-0f74f323be3c', value: 'MORE_THAN_4_MONTHS', label: "More than 4 Months", position: 3, color: 'yellow' },
    { id: 'a26683d2-8a91-4515-844e-39c625076ee6', value: 'JUST_LOOKING_FOR_MORE_INFO', label: "Just Looking for More Info", position: 4, color: 'orange' },
  ],
  isNullable: true,
  defaultValue: null,
});
