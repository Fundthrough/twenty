import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '5bb1fe32-5c77-40b9-bac4-b8962fbde01e',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'sfClientId',
  label: "SF Client Id",
  description: "Imported: key — Client__c.Id",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
