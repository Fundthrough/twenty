import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '816ac73d-bec8-47d8-8b7e-ab762b79d293',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'source',
  label: "Source",
  description: "Imported: Account.Source__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
