import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'f07f55ea-a597-4028-8985-f67e07230050',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'leadStatus',
  label: "Lead Status",
  description: "Imported: Lead.Status",
  icon: 'IconList',
  options: [
    { id: '60991529-e69c-43f6-8abd-1e5a4590d5e5', value: 'PROSPECT', label: "Prospect", position: 0, color: 'blue' },
    { id: '08082ef3-b465-4c1d-b8d9-058c14024a7b', value: 'NEW_SIGN_UP', label: "New Sign up", position: 1, color: 'green' },
    { id: '4cd67cc3-62ec-4552-bc71-94658420bd89', value: 'REACHED_OUT', label: "Reached Out", position: 2, color: 'turquoise' },
    { id: '751c676d-49bd-4551-aca8-ac8b9f0709bf', value: 'ENGAGED', label: "Engaged", position: 3, color: 'yellow' },
    { id: '21ed3b9b-0233-41f6-af38-1d39ed289924', value: 'CREDIT_CLEARANCE', label: "Credit Clearance", position: 4, color: 'orange' },
    { id: '572c4d1e-60a7-4600-b0f0-0e367a5e8b46', value: 'CUSTOMER_ONBOARDING_READY_FOR_DOC', label: "Customer Onboarding - Ready for DoC", position: 5, color: 'red' },
    { id: '9ab3caf4-c692-474c-9278-d5bc2996288e', value: 'FIRST_FUNDING', label: "First Funding", position: 6, color: 'purple' },
    { id: '28488ea3-31b5-4618-b8c6-461f588da9ab', value: 'CLOSED_LOST', label: "Closed Lost", position: 7, color: 'pink' },
    { id: 'a7ea328d-4f02-46ce-81e2-b4c169a47bc4', value: 'DISQUALIFIED', label: "Disqualified", position: 8, color: 'sky' },
    { id: '9e117e41-2004-4bb8-a74a-a7d2e96ab64d', value: 'RENURTURE', label: "Renurture", position: 9, color: 'gray' },
    { id: '4a255be6-3e1f-479a-aad1-a1548a65604f', value: 'ACTIVATED', label: "Activated", position: 10, color: 'blue' },
  ],
  defaultValue: `'NEW_SIGN_UP'`,
});
