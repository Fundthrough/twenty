import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '62d7501d-30c9-47dd-b81c-c2f258aee7f7',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'partnerSource',
  label: "Partner Source",
  description: "Imported: Lead.Partner_Source__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
