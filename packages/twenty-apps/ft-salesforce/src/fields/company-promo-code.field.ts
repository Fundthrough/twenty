import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '6f814357-58b7-44ef-9dd4-718487f5600b',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'promoCode',
  label: "Promo Code",
  description: "Imported: Lead.Promo_Code__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
