import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_COMPANY_LEAD_STATUS_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_LEAD_STATUS_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsCompanyLeadStatus',
  label: 'Company Lead Status',
  description: 'Company-level lead status (maps HubSpot hs_lead_status)',
  icon: 'IconFlagCheck',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '2b3c4d5e-0001-4e5f-8a9b-200000000001', value: 'NEW', label: 'New', position: 0, color: 'blue' },
    { id: '2b3c4d5e-0002-4e5f-8a9b-200000000002', value: 'OPEN', label: 'Open', position: 1, color: 'sky' },
    { id: '2b3c4d5e-0003-4e5f-8a9b-200000000003', value: 'IN_PROGRESS', label: 'In Progress', position: 2, color: 'yellow' },
    { id: '2b3c4d5e-0004-4e5f-8a9b-200000000004', value: 'OPEN_DEAL', label: 'Open Deal', position: 3, color: 'orange' },
    { id: '2b3c4d5e-0005-4e5f-8a9b-200000000005', value: 'UNQUALIFIED', label: 'Unqualified', position: 4, color: 'gray' },
    { id: '2b3c4d5e-0006-4e5f-8a9b-200000000006', value: 'ATTEMPTED_TO_CONTACT', label: 'Attempted to Contact', position: 5, color: 'turquoise' },
    { id: '2b3c4d5e-0007-4e5f-8a9b-200000000007', value: 'CONNECTED', label: 'Connected', position: 6, color: 'green' },
    { id: '2b3c4d5e-0008-4e5f-8a9b-200000000008', value: 'BAD_TIMING', label: 'Bad Timing', position: 7, color: 'red' },
  ],
});
