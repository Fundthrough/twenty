import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { HS_CONTACT_LEAD_STATUS_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_CONTACT_LEAD_STATUS_UID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsLeadStatus',
  label: 'Lead Status',
  description: 'HubSpot lead status',
  icon: 'IconUserCheck',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '603af74e-9861-4014-a437-87f0d7e458ba', value: 'NEW', label: 'New', position: 0, color: 'blue' },
    { id: 'a6747c91-5309-4b51-915d-4db52bb23863', value: 'OPEN', label: 'Open', position: 1, color: 'sky' },
    { id: '211b38a5-53e5-4267-baef-78261d3a10d8', value: 'IN_PROGRESS', label: 'In Progress', position: 2, color: 'yellow' },
    { id: 'a5112292-93b4-46e9-92bc-fda900dc06c2', value: 'OPEN_DEAL', label: 'Open Deal', position: 3, color: 'orange' },
    { id: '41d6f68c-088d-4375-94fb-84c4de63f80f', value: 'UNQUALIFIED', label: 'Unqualified', position: 4, color: 'gray' },
    { id: 'd2d2a7c3-304c-4fa8-a818-64dfd54f3dec', value: 'ATTEMPTED_TO_CONTACT', label: 'Attempted to Contact', position: 5, color: 'turquoise' },
    { id: 'efcbafa8-e4a2-4548-8ea5-452c95127c6c', value: 'CONNECTED', label: 'Connected', position: 6, color: 'green' },
    { id: 'fb50017c-f368-4880-bc5d-7cad13d7f593', value: 'BAD_TIMING', label: 'Bad Timing', position: 7, color: 'red' },
  ],
});
