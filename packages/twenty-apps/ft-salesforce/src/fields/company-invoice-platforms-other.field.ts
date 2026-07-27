import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '615d3ad7-5fbb-488a-9f65-1d40e766ffd5',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'invoicePlatformsOther',
  label: "Invoice Platforms - Other",
  description: "Imported: Lead.Invoice_Platforms_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
