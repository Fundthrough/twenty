import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '7697fef6-51b5-4b73-8fb4-49e38f831333',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'renurtureReason',
  label: "Renurture Reason",
  description: "Imported: Lead.Renurture_Reason__c",
  icon: 'IconList',
  options: [
    { id: '22236359-fbb6-44ce-b329-c0935446d972', value: 'NOT_THE_RIGHT_TIMING_I_E_NO_NEED_FOR_FUNDS_RIGHT_NOW', label: "Not the right timing (i.e. no need for funds right now)", position: 0, color: 'blue' },
    { id: '5e6929ca-6cf6-43dc-a4dd-cbc710910fd3', value: 'NEVER_GOT_IN_TOUCH', label: "Never got in touch", position: 1, color: 'green' },
    { id: '02f6dd54-bc78-4b0a-99d0-ae3fa0b90ecb', value: 'WENT_COLD_UNRESPONSIVE', label: "Went cold/unresponsive", position: 2, color: 'turquoise' },
    { id: '576b986a-9849-43b8-9672-24bb598de009', value: 'NOT_YET_CONVINCED', label: "Not yet convinced", position: 3, color: 'yellow' },
    { id: '97996089-7a8d-4865-b344-643ca349e706', value: 'NO_APPROVED_PAYORS_AT_THE_MOMENT', label: "No approved payors at the moment", position: 4, color: 'orange' },
    { id: 'ee7077f4-87df-48ad-80f0-c9b968e286e1', value: 'DOESN_T_MEET_FUNDING_THRESHOLD', label: "Doesn't meet funding threshold", position: 5, color: 'red' },
    { id: 'ba40ef85-08ef-4faa-9e5d-15ab621142a4', value: 'BUSINESS_TOO_NEW', label: "Business too new", position: 6, color: 'purple' },
    { id: 'f2d1e91f-18c6-4931-a9b1-0934098fa3a9', value: 'AUTO_DQ_LEAD_SCORE_TOO_LOW', label: "Auto DQ - Lead score too low", position: 7, color: 'pink' },
    { id: 'c06f9817-9316-4c27-8004-2401fdd86130', value: 'OTHER', label: "Other", position: 8, color: 'sky' },
  ],
  isNullable: true,
  defaultValue: null,
});
