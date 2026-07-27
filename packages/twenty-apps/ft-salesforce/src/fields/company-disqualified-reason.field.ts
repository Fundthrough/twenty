import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'ac57db0f-5dc1-42b9-8a87-fb1b7f5b024e',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'disqualifiedReason',
  label: "Disqualified Reason",
  description: "Imported: Lead.Disqualified_Reason__c",
  icon: 'IconList',
  options: [
    { id: 'a53217b4-cc73-4c0d-bd2e-4ec6f452e2b7', value: 'DUMMY_TEST_FT_ACCOUNT', label: "Dummy/test FT account", position: 0, color: 'blue' },
    { id: 'f6f08a09-4067-4a57-86af-3e0061067ebe', value: 'DUPLICATE_PROFILE', label: "Duplicate profile", position: 1, color: 'green' },
    { id: 'a688b1ef-4df7-4e85-a7aa-79f9479e13c2', value: 'NOT_A_PRODUCT_FIT_I_E_DOES_NOT_INVOICE_DOESN_T_HAVE_A_BUSINE', label: "Not a product fit (i.e. does not invoice - doesn't have a busi", position: 2, color: 'turquoise' },
    { id: 'c42e07c2-34b4-4265-ac04-62186972fe44', value: 'SUPPLIER_CREDIT_RATING_REJECTED', label: "Supplier credit rating rejected", position: 3, color: 'yellow' },
    { id: '011f9aac-d554-4fbd-b801-f5d7a6470857', value: 'LIEN_POSITION', label: "Lien position", position: 4, color: 'orange' },
    { id: '42acdb1c-adf6-48ee-8263-df3cdfb03647', value: 'INDUSTRY_REJECTED_I_E_CONSTRUCTION', label: "Industry rejected (i.e. construction)", position: 5, color: 'red' },
    { id: 'a42309d6-cdcd-4054-affd-ed09e80b5393', value: 'SOLE_PROPRIETOR', label: "Sole proprietor", position: 6, color: 'purple' },
    { id: 'e7ff09de-28fb-480c-aa6c-d41f9578e170', value: 'NOT_DOING_BUSINESS_IN_CA_US', label: "Not doing business in CA/US", position: 7, color: 'pink' },
    { id: '8f250366-4d21-4dd3-9b38-acf8eea2310a', value: 'FRAUD_MALICIOUS_INTENT', label: "Fraud / malicious intent", position: 8, color: 'sky' },
    { id: '74eac8c4-b581-4dc3-8d75-0bb3ed5fca16', value: 'OTHER', label: "Other", position: 9, color: 'gray' },
  ],
  isNullable: true,
  defaultValue: null,
});
