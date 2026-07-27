import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '40740de7-6af0-4799-991e-7ad309da2496',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'applicationStatus',
  label: "Application Status",
  description: "Imported: Client__c.Application_Status__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
