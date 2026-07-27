import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '8ffc94e6-f2ab-46fc-b978-2088e8bc4f5c',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'promoCode',
  label: "Promo Code",
  description: "Imported: Lead.Promo_Code__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
