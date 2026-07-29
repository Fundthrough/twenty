import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

// No defaultValue on purpose. Twenty auto-creates a person for every email and calendar
// participant and a company for every email domain, so a default here stamps notification
// senders and meeting rooms as real records -- it is why leadStatus read 96.6% NEW_SIGN_UP and
// why clientType and accountingSoftware looked fully populated. The importer sets these
// explicitly from Salesforce; anything it cannot map should stay empty rather than be invented.
export default defineField({
  universalIdentifier: 'fa2df234-74ce-4e8f-8a72-15af1e5fc5c3',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'clientType',
  label: "Client Type",
  description: "Imported: Lead.Type__c",
  icon: 'IconList',
  options: [
    { id: '3f15e1f7-95b7-468d-a806-ab12c8755c68', value: 'FTX', label: "FTX", position: 0, color: 'blue' },
    { id: 'bd69af09-017e-43b8-ae9c-57746304ab12', value: 'PRO', label: "PRO", position: 1, color: 'green' },
    { id: 'efb6de6a-abdc-48ec-8b24-a26fd2efa332', value: 'VELOCITY', label: "Velocity", position: 2, color: 'turquoise' },
    { id: 'd15288dc-5a01-42b5-b348-ffc4f3e946aa', value: 'PREMIUM', label: "Premium", position: 3, color: 'yellow' },
    { id: '0acc42cb-a348-4598-8c18-d30785247948', value: 'NETZERO', label: "NetZero", position: 4, color: 'purple' },
  ],
  defaultValue: null,
});
