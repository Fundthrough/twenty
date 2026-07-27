import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '5428770d-29d0-48d7-8d36-899ca73af990',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.MULTI_SELECT,
  name: 'primaryReasonForFunding',
  label: "Primary Reason for Funding",
  description: "Imported: Lead.Primary_Reason_for_Funding__c (Marketo form)",
  icon: 'IconTargetArrow',
  isNullable: true,
  options: [
    { id: '3c35e210-a67b-41b7-bad6-1dadaec0acbb', value: 'EQUIPMENT_PURCHASE_RENTAL', label: "Equipment Purchase/Rental", position: 0, color: 'blue' },
    { id: '07ef167b-6de5-4f3c-b9aa-14a58fb147cb', value: 'EXPANSION_PROJECT', label: "Expansion Project", position: 1, color: 'green' },
    { id: '610458fe-6819-4eb3-b19c-76d3881e755b', value: 'GENERAL_EXPENSES', label: "General Expenses", position: 2, color: 'turquoise' },
    { id: 'b82975b0-1d31-45e6-9742-a9784362a3aa', value: 'HIRING', label: "Hiring", position: 3, color: 'yellow' },
    { id: '93da46f3-4d91-4c57-9a3d-c04a3e01f576', value: 'INVENTORY', label: "Inventory", position: 4, color: 'orange' },
    { id: '1e9b69cf-dee5-45ce-958a-bba990c1e825', value: 'OTHER', label: "Other", position: 5, color: 'red' },
    { id: '1461f929-d841-4eef-9333-6abdb7d4b368', value: 'PAYING_SUPPLIERS', label: "Paying Suppliers", position: 6, color: 'purple' },
    { id: '2062fb20-ff02-4417-880e-107326add7dc', value: 'PAYMENT_COLLECTION', label: "Payment Collection", position: 7, color: 'pink' },
    { id: '2e78323a-6afa-448d-8407-81964d25cbef', value: 'PAYROLL', label: "Payroll", position: 8, color: 'sky' },
    { id: '9a43b934-031e-40c2-bdd6-102c6efd6cdb', value: 'PEACE_OF_MIND', label: "Peace of Mind", position: 9, color: 'gray' },
  ],
  defaultValue: null,
});
