import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '4d54a6a0-0e7c-4f6e-9530-1d765ce9c983',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.DATE,
  name: 'renurtureDate',
  label: "Renurture Date",
  description: "Imported: Lead.Renurture_Date__c",
  icon: 'IconCalendar',
  isNullable: true,
  defaultValue: null,
});
