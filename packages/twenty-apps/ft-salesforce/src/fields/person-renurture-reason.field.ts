import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'e851bee0-dda7-4b82-a045-297ca6a67759',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'renurtureReason',
  label: "Renurture Reason",
  description: "Imported: Lead.Renurture_Reason__c",
  icon: 'IconList',
  options: [
    { id: '77757e3c-f245-45bf-8260-c865924e023e', value: 'NOT_THE_RIGHT_TIMING_I_E_NO_NEED_FOR_FUNDS_RIGHT_NOW', label: "Not the right timing (i.e. no need for funds right now)", position: 0, color: 'blue' },
    { id: '4e68dc93-2bfa-47e1-8fc4-a4df0be33452', value: 'NEVER_GOT_IN_TOUCH', label: "Never got in touch", position: 1, color: 'green' },
    { id: 'c2225fb3-827f-4ceb-b9a5-f1b1a9c889bf', value: 'WENT_COLD_UNRESPONSIVE', label: "Went cold/unresponsive", position: 2, color: 'turquoise' },
    { id: '9e88887a-1b38-44e3-8829-c38c84701fa2', value: 'NOT_YET_CONVINCED', label: "Not yet convinced", position: 3, color: 'yellow' },
    { id: '62d3f9db-0b88-4edf-8d3b-90d2b6699849', value: 'NO_APPROVED_PAYORS_AT_THE_MOMENT', label: "No approved payors at the moment", position: 4, color: 'orange' },
    { id: '7fc2eb27-342c-444b-ba99-a877eecb05ae', value: 'DOESN_T_MEET_FUNDING_THRESHOLD', label: "Doesn't meet funding threshold", position: 5, color: 'red' },
    { id: 'c9362bf6-7397-437b-8f7b-b76dee9bdf5e', value: 'BUSINESS_TOO_NEW', label: "Business too new", position: 6, color: 'purple' },
    { id: '436ea042-fe53-4812-b11e-c30bf71c4c21', value: 'AUTO_DQ_LEAD_SCORE_TOO_LOW', label: "Auto DQ - Lead score too low", position: 7, color: 'pink' },
    { id: '34e1d728-fd24-43ec-8d61-0c2f63756680', value: 'OTHER', label: "Other", position: 8, color: 'sky' },
  ],
  isNullable: true,
  defaultValue: null,
});
