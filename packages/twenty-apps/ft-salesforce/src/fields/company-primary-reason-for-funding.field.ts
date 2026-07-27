import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '0e4a4905-73e3-43bd-8bba-81aeae2ad167',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.MULTI_SELECT,
  name: 'primaryReasonForFunding',
  label: "Primary Reason for Funding",
  description: "Imported: Lead.Primary_Reason_for_Funding__c (Marketo form)",
  icon: 'IconTargetArrow',
  isNullable: true,
  options: [
    { id: 'cb008ae1-98af-4d42-b046-f8eac566cd19', value: 'EQUIPMENT_PURCHASE_RENTAL', label: "Equipment Purchase/Rental", position: 0, color: 'blue' },
    { id: 'e58c17c4-f038-498c-b485-c1436b841671', value: 'EXPANSION_PROJECT', label: "Expansion Project", position: 1, color: 'green' },
    { id: '2f2fffca-cb22-4b39-a5c8-4befebb43be8', value: 'GENERAL_EXPENSES', label: "General Expenses", position: 2, color: 'turquoise' },
    { id: '2a8a813a-b7d7-410f-81a8-dabbe124e7f6', value: 'HIRING', label: "Hiring", position: 3, color: 'yellow' },
    { id: 'f5735e70-6947-4fa7-bd42-f7eb16f28711', value: 'INVENTORY', label: "Inventory", position: 4, color: 'orange' },
    { id: 'a851a8a6-c0c9-46a1-89d6-3e6e5b22b71f', value: 'OTHER', label: "Other", position: 5, color: 'red' },
    { id: 'bd5129fc-d1ac-475b-b99e-56478994c34e', value: 'PAYING_SUPPLIERS', label: "Paying Suppliers", position: 6, color: 'purple' },
    { id: '0ac6feb3-c676-4485-a19a-6b6d88843528', value: 'PAYMENT_COLLECTION', label: "Payment Collection", position: 7, color: 'pink' },
    { id: '2de1da1f-f92e-4ac1-b185-7397549b58f7', value: 'PAYROLL', label: "Payroll", position: 8, color: 'sky' },
    { id: 'd777d263-dd3f-422e-a83f-f67b42366e0e', value: 'PEACE_OF_MIND', label: "Peace of Mind", position: 9, color: 'gray' },
  ],
  defaultValue: null,
});
