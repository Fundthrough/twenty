import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '2e806c04-acfe-4cad-aca2-fa6bd193fcb8',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.DATE,
  name: 'renurtureDate',
  label: "Renurture Date",
  description: "Imported: Lead.Renurture_Date__c",
  icon: 'IconCalendar',
  isNullable: true,
  defaultValue: null,
});
