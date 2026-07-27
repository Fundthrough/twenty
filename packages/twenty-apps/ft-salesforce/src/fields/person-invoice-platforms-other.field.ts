import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '7aa7602c-6de5-47ff-82e7-c233c5e56900',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'invoicePlatformsOther',
  label: "Invoice Platforms - Other",
  description: "Imported: Lead.Invoice_Platforms_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
