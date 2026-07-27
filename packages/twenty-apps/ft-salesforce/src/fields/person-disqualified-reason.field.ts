import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'e0859e2c-1942-4524-8eff-95666206d87d',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'disqualifiedReason',
  label: "Disqualified Reason",
  description: "Imported: Lead.Disqualified_Reason__c",
  icon: 'IconList',
  options: [
    { id: '64beefa2-31a5-4ffc-a098-506deb2e8e76', value: 'DUMMY_TEST_FT_ACCOUNT', label: "Dummy/test FT account", position: 0, color: 'blue' },
    { id: '07273ee8-bd30-4e69-b538-8ec295131332', value: 'DUPLICATE_PROFILE', label: "Duplicate profile", position: 1, color: 'green' },
    { id: '9a40a706-8843-4669-9bb8-a11e5d86c988', value: 'NOT_A_PRODUCT_FIT_I_E_DOES_NOT_INVOICE_DOESN_T_HAVE_A_BUSINE', label: "Not a product fit (i.e. does not invoice - doesn't have a busi", position: 2, color: 'turquoise' },
    { id: 'aed01975-c724-41b4-a9bc-76c604274507', value: 'SUPPLIER_CREDIT_RATING_REJECTED', label: "Supplier credit rating rejected", position: 3, color: 'yellow' },
    { id: '118fd170-beab-4304-b9b6-030da679f0cb', value: 'LIEN_POSITION', label: "Lien position", position: 4, color: 'orange' },
    { id: '12553b1f-74c6-4044-82b6-607a6dd4a1ab', value: 'INDUSTRY_REJECTED_I_E_CONSTRUCTION', label: "Industry rejected (i.e. construction)", position: 5, color: 'red' },
    { id: 'f68201f2-d0e1-4e48-948c-daee19802eaa', value: 'SOLE_PROPRIETOR', label: "Sole proprietor", position: 6, color: 'purple' },
    { id: 'b745ec5e-5dec-4c80-bc9d-6d7b133c9f31', value: 'NOT_DOING_BUSINESS_IN_CA_US', label: "Not doing business in CA/US", position: 7, color: 'pink' },
    { id: 'd6d0a555-961b-4204-a1e4-3a0cbef73de4', value: 'FRAUD_MALICIOUS_INTENT', label: "Fraud / malicious intent", position: 8, color: 'sky' },
    { id: '77f5a47c-c74a-4864-b696-bb907d015cc9', value: 'OTHER', label: "Other", position: 9, color: 'gray' },
  ],
  isNullable: true,
  defaultValue: null,
});
