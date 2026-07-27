import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '7a045c6e-6c5d-4b61-b679-1a467766edf5',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'companyId',
  label: "Company Id",
  description: "Imported: Client__c.PRO_Company_ID__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
