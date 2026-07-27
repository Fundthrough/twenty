import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'f89d5fb3-cc5b-4f73-8e80-98a2627d83b7',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.BOOLEAN,
  name: 'hotList',
  label: "Hot List",
  description: "Imported: Lead.Hot_list__c",
  icon: 'IconToggleLeft',
  isNullable: true,
  defaultValue: null,
});
