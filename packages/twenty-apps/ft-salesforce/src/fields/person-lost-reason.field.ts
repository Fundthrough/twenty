import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '721cc156-1e28-4ffd-b152-ee02e424d796',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'lostReason',
  label: "Lost Reason",
  description: "Imported: Lead.Lost_Reason__c",
  icon: 'IconList',
  options: [
    { id: '20b8bddb-1283-48a7-97e1-fcf0d5748400', value: 'MISUNDERSTANDING_OF_PRODUCT_OFFERING_I_E_THOUGHT_IT_WAS_BANK', label: "Misunderstanding of product offering (i.e. thought it was bank", position: 0, color: 'blue' },
    { id: 'a3e7832a-d836-48c0-a8ca-59aef6682918', value: 'SIGNED_UP_BY_MISTAKE', label: "Signed up by mistake", position: 1, color: 'green' },
    { id: '1395ade3-e3d6-4dd6-b8be-0905140e72be', value: 'FOUND_FUNDING_ELSEWHERE_I_E_WENT_TO_A_COMPETITOR_EARLY_PAY', label: "Found funding elsewhere (i.e. went to a competitor - early pay", position: 2, color: 'turquoise' },
    { id: 'ac886075-20f8-46d1-83d8-0672369e990e', value: 'UNCOMFORTABLE_WITH_FACTORING', label: "Uncomfortable with factoring", position: 3, color: 'yellow' },
    { id: 'fa82afb2-212a-4413-a9d9-6343f20214af', value: 'OBJECTIONS_WITH_PRICING', label: "Objections with pricing", position: 4, color: 'orange' },
    { id: '97e396cc-65a5-4777-8a12-04b7fe44bf7e', value: 'OBJECTIONS_WITH_PROCESS_I_E_TOO_COMPLICATED', label: "Objections with process (i.e. too complicated)", position: 5, color: 'red' },
    { id: 'd67a555a-5a99-42ef-ba6f-e91d9e92b3a1', value: 'OBJECTIONS_WITH_MPSA_AND_OR_SECURITY_REQUIREMENTS', label: "Objections with MPSA and/or security requirements", position: 6, color: 'purple' },
    { id: 'ea837fc5-a09e-4538-9424-d5c3123cfdbb', value: 'PAYOR_REJECTED_NOA', label: "Payor rejected NoA", position: 7, color: 'pink' },
    { id: '442b820f-31d2-43b5-9e3a-2e340a5a32b6', value: 'OTHER', label: "Other", position: 8, color: 'sky' },
  ],
  isNullable: true,
  defaultValue: null,
});
