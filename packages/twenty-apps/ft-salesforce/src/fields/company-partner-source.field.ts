import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '381c5b75-71df-4cc0-92e0-ab1855095c16',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'partnerSource',
  label: "Partner Source",
  description: "Imported: Lead.Partner_Source__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
