import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '175fcce3-ed3c-4fa1-8463-e982f6a96b63',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'sfContactId',
  label: "SF Contact Id",
  description: "Imported: key — Contact.Id",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
