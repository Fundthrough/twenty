import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '575015a9-cc09-4262-bc8e-63564065cac7',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'doYouInvoiceBusinesses',
  label: "Do You Invoice Businesses",
  description: "Imported: Lead.Do_you_invoice_businesses__c",
  icon: 'IconList',
  options: [
    { id: 'cdf0b710-6c19-4a7b-a36b-528b6fbf73cc', value: 'YES', label: "Yes", position: 0, color: 'blue' },
    { id: '2e00092d-59d6-456b-b2e5-35cab17cef4a', value: 'NO', label: "No", position: 1, color: 'green' },
    { id: '92b83e21-746b-4b98-8226-2e9ac44eb95c', value: 'UNSURE', label: "Unsure", position: 2, color: 'turquoise' },
  ],
  isNullable: true,
  defaultValue: null,
});
