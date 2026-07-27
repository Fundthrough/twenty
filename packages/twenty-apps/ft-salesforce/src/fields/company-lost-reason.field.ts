import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'a26c7cfc-73f7-47c9-84af-e58fbd6eb964',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'lostReason',
  label: "Lost Reason",
  description: "Imported: Lead.Lost_Reason__c",
  icon: 'IconList',
  options: [
    { id: '1c3b2302-be49-49a0-9315-a68f8c5643c4', value: 'MISUNDERSTANDING_OF_PRODUCT_OFFERING_I_E_THOUGHT_IT_WAS_BANK', label: "Misunderstanding of product offering (i.e. thought it was bank", position: 0, color: 'blue' },
    { id: '1f1c73a3-6007-40fa-b90b-abc25b4290f3', value: 'SIGNED_UP_BY_MISTAKE', label: "Signed up by mistake", position: 1, color: 'green' },
    { id: 'c31ab1f7-7d94-4ef4-b5cc-c42dfbcb6d21', value: 'FOUND_FUNDING_ELSEWHERE_I_E_WENT_TO_A_COMPETITOR_EARLY_PAY', label: "Found funding elsewhere (i.e. went to a competitor - early pay", position: 2, color: 'turquoise' },
    { id: '903070c9-91f0-43c6-ab47-9142a3072240', value: 'UNCOMFORTABLE_WITH_FACTORING', label: "Uncomfortable with factoring", position: 3, color: 'yellow' },
    { id: 'e32e12f3-eef1-4708-bfda-251cf2ea1c9e', value: 'OBJECTIONS_WITH_PRICING', label: "Objections with pricing", position: 4, color: 'orange' },
    { id: '69b85653-de5b-477c-ae87-76825fd52d92', value: 'OBJECTIONS_WITH_PROCESS_I_E_TOO_COMPLICATED', label: "Objections with process (i.e. too complicated)", position: 5, color: 'red' },
    { id: 'c5022d13-5d66-4b0c-8d3a-cfcf1258a471', value: 'OBJECTIONS_WITH_MPSA_AND_OR_SECURITY_REQUIREMENTS', label: "Objections with MPSA and/or security requirements", position: 6, color: 'purple' },
    { id: '03ac9ec4-ec32-49d3-8073-c0c05a56bcdc', value: 'PAYOR_REJECTED_NOA', label: "Payor rejected NoA", position: 7, color: 'pink' },
    { id: 'c5e0f900-7ba5-44ec-8ac1-390dcdcc8482', value: 'OTHER', label: "Other", position: 8, color: 'sky' },
  ],
  isNullable: true,
  defaultValue: null,
});
