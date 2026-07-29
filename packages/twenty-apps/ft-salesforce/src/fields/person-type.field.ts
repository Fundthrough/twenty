import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'cd30939b-0770-45f4-b533-4f3873208b92',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'clientType',
  label: "Client Type",
  description: "Imported: Lead.Type__c",
  icon: 'IconList',
  options: [
    { id: '08498fa4-e900-4f5b-ad8c-ea1d347d9a9f', value: 'FTX', label: "FTX", position: 0, color: 'blue' },
    { id: 'f76de6be-4a8c-4362-a143-3b30cdfc7340', value: 'PRO', label: "PRO", position: 1, color: 'green' },
    { id: '29f33173-c8ff-4026-8046-6f337d52fa21', value: 'VELOCITY', label: "Velocity", position: 2, color: 'turquoise' },
    { id: '4024ae2d-2e5a-4454-9813-af7fb1e708e2', value: 'PREMIUM', label: "Premium", position: 3, color: 'yellow' },
    { id: '6edd846f-232b-485a-88a4-53e542ba2e9b', value: 'NETZERO', label: "NetZero", position: 4, color: 'purple' },
  ],
  defaultValue: `'FTX'`,
});
