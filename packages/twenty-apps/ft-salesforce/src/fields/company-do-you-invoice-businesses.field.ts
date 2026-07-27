import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '06ec3d1c-a433-4ad1-a2d1-df57f5649764',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'doYouInvoiceBusinesses',
  label: "Do You Invoice Businesses",
  description: "Imported: Lead.Do_you_invoice_businesses__c",
  icon: 'IconList',
  options: [
    { id: '316d4292-472e-4dc3-81da-ac83e51e2333', value: 'YES', label: "Yes", position: 0, color: 'blue' },
    { id: 'ddc18f4a-8373-4b20-9eb9-08a22eb08053', value: 'NO', label: "No", position: 1, color: 'green' },
    { id: '745af2e0-c9b8-4b10-a882-4487761c3a14', value: 'UNSURE', label: "Unsure", position: 2, color: 'turquoise' },
  ],
  isNullable: true,
  defaultValue: null,
});
