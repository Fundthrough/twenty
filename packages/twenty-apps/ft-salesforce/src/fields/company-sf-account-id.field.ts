import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'a024e48f-f383-49fa-8978-2d447d86cbc6',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'sfAccountId',
  label: "SF Account Id",
  description: "Imported: key — Account.Id",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
