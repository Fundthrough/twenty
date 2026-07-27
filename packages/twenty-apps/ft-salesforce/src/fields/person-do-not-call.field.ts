import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '3bd127d3-905e-4380-8395-2caf0a8cd2c0',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.BOOLEAN,
  name: 'doNotCall',
  label: "Do Not Call",
  description: "Imported: Lead.DoNotCall",
  icon: 'IconToggleLeft',
  isNullable: true,
  defaultValue: null,
});
