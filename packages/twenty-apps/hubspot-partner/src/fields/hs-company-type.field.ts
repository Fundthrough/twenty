import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_COMPANY_TYPE_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_TYPE_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsCompanyType',
  label: 'Company Type',
  description: 'Type of company relationship (maps HubSpot type)',
  icon: 'IconTag',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '4d5e6f7a-0001-4e5f-8a9b-400000000001', value: 'PROSPECT', label: 'Prospect', position: 0, color: 'blue' },
    { id: '4d5e6f7a-0002-4e5f-8a9b-400000000002', value: 'PARTNER', label: 'Partner', position: 1, color: 'green' },
    { id: '4d5e6f7a-0003-4e5f-8a9b-400000000003', value: 'RESELLER', label: 'Reseller', position: 2, color: 'turquoise' },
    { id: '4d5e6f7a-0004-4e5f-8a9b-400000000004', value: 'VENDOR', label: 'Vendor', position: 3, color: 'yellow' },
    { id: '4d5e6f7a-0005-4e5f-8a9b-400000000005', value: 'OTHER', label: 'Other', position: 4, color: 'gray' },
  ],
});
