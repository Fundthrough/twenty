import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'b99c6282-1c49-4b69-9990-ed69b9b96e66',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'referringPartner',
  label: 'Referring Partner',
  description: 'Imported: Client__c.Referring_Partner__c',
  icon: 'IconHeartHandshake',
  isNullable: true,
  defaultValue: null,
});
