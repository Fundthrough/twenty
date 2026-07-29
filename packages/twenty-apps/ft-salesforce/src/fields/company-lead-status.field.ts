import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

// PROSPECT until the company has a PRO company id, which is the platform-signup signal. See
// person-lead-status.field.ts and backfill-lead-status-from-signup.mjs.
export default defineField({
  universalIdentifier: 'a37ecafd-1c42-45cf-80d8-29bdb6cf39ab',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'leadStatus',
  label: "Lead Status",
  description: "Imported: Lead.Status",
  icon: 'IconList',
  options: [
    { id: '4301321a-87e6-4953-b38b-e4c513fc2587', value: 'PROSPECT', label: "Prospect", position: 0, color: 'blue' },
    { id: '6348526d-3a2d-4516-b0bb-2ead47dd3bfb', value: 'NEW_SIGN_UP', label: "New Sign up", position: 1, color: 'green' },
    { id: '612a0ab0-5e31-4e3e-9243-08168d141d06', value: 'REACHED_OUT', label: "Reached Out", position: 2, color: 'turquoise' },
    { id: '14e2e316-dc4c-47de-9f6f-3d9926fc72e0', value: 'ENGAGED', label: "Engaged", position: 3, color: 'yellow' },
    { id: '1329429b-0fa3-4021-958b-ab1a4a64bbe2', value: 'CREDIT_CLEARANCE', label: "Credit Clearance", position: 4, color: 'orange' },
    { id: '29a0dff5-9131-417b-9b98-cfbbdabfb749', value: 'CUSTOMER_ONBOARDING_READY_FOR_DOC', label: "Customer Onboarding - Ready for DoC", position: 5, color: 'red' },
    { id: '4b6bb5a6-acc8-4237-abfb-f23199eb4f83', value: 'FIRST_FUNDING', label: "First Funding", position: 6, color: 'purple' },
    { id: '98119034-7700-4454-82f3-8b91f2614fa7', value: 'CLOSED_LOST', label: "Closed Lost", position: 7, color: 'pink' },
    { id: 'e1bfde67-579d-4f24-a9bf-5354302bacf9', value: 'DISQUALIFIED', label: "Disqualified", position: 8, color: 'sky' },
    { id: '29f5935f-89ab-484f-bc84-c1cb862154b3', value: 'RENURTURE', label: "Renurture", position: 9, color: 'gray' },
    { id: 'a825b415-d4c1-4d54-a5ac-df3bd72c4834', value: 'ACTIVATED', label: "Activated", position: 10, color: 'blue' },
  ],
  defaultValue: `'PROSPECT'`,
});
