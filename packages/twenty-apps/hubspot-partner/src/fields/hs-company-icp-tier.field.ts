import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_COMPANY_ICP_TIER_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_ICP_TIER_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsIcpTier',
  label: 'ICP Tier',
  description: 'Ideal Customer Profile tier (maps HubSpot hs_ideal_customer_profile)',
  icon: 'IconStar',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '1a2b3c4d-0001-4e5f-8a9b-100000000001', value: 'TIER_1', label: 'Tier 1', position: 0, color: 'green' },
    { id: '1a2b3c4d-0002-4e5f-8a9b-100000000002', value: 'TIER_2', label: 'Tier 2', position: 1, color: 'blue' },
    { id: '1a2b3c4d-0003-4e5f-8a9b-100000000003', value: 'TIER_3', label: 'Tier 3', position: 2, color: 'yellow' },
    { id: '1a2b3c4d-0004-4e5f-8a9b-100000000004', value: 'NONE', label: 'None', position: 3, color: 'gray' },
  ],
});
