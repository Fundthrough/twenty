import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_CONTACT_SENIORITY_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_CONTACT_SENIORITY_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsSeniority',
  label: 'Seniority',
  description: 'Contact seniority level (maps HubSpot hs_seniority)',
  icon: 'IconStairs',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '6f7a8b9c-0001-4e5f-8a9b-600000000001', value: 'C_SUITE', label: 'C-Suite', position: 0, color: 'red' },
    { id: '6f7a8b9c-0002-4e5f-8a9b-600000000002', value: 'VP', label: 'VP', position: 1, color: 'orange' },
    { id: '6f7a8b9c-0003-4e5f-8a9b-600000000003', value: 'DIRECTOR', label: 'Director', position: 2, color: 'yellow' },
    { id: '6f7a8b9c-0004-4e5f-8a9b-600000000004', value: 'MANAGER', label: 'Manager', position: 3, color: 'green' },
    { id: '6f7a8b9c-0005-4e5f-8a9b-600000000005', value: 'INDIVIDUAL_CONTRIBUTOR', label: 'Individual Contributor', position: 4, color: 'blue' },
    { id: '6f7a8b9c-0006-4e5f-8a9b-600000000006', value: 'OTHER', label: 'Other', position: 5, color: 'gray' },
  ],
});
