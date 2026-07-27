import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'c6481ae3-cdf6-4950-ac61-7d75555b2aee',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'clientId',
  label: "Client Id",
  description: "Imported: Account.Client_ID__c — FT backend client UUID",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
