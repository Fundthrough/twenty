import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '5094b7a2-e8de-4186-8632-63f0f9fecc27',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.BOOLEAN,
  name: 'hotList',
  label: "Hot List",
  description: "Imported: Lead.Hot_list__c",
  icon: 'IconToggleLeft',
  isNullable: true,
  defaultValue: null,
});
