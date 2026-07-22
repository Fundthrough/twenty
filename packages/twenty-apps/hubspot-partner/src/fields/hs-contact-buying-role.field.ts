import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_CONTACT_BUYING_ROLE_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_CONTACT_BUYING_ROLE_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsBuyingRole',
  label: 'Buying Role',
  description: 'Contact buying role in deals (maps HubSpot hs_buying_role)',
  icon: 'IconUserCheck',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '5e6f7a8b-0001-4e5f-8a9b-500000000001', value: 'DECISION_MAKER', label: 'Decision Maker', position: 0, color: 'red' },
    { id: '5e6f7a8b-0002-4e5f-8a9b-500000000002', value: 'CHAMPION', label: 'Champion', position: 1, color: 'green' },
    { id: '5e6f7a8b-0003-4e5f-8a9b-500000000003', value: 'ECONOMIC_BUYER', label: 'Economic Buyer', position: 2, color: 'blue' },
    { id: '5e6f7a8b-0004-4e5f-8a9b-500000000004', value: 'END_USER', label: 'End User', position: 3, color: 'sky' },
    { id: '5e6f7a8b-0005-4e5f-8a9b-500000000005', value: 'INFLUENCER', label: 'Influencer', position: 4, color: 'yellow' },
    { id: '5e6f7a8b-0006-4e5f-8a9b-500000000006', value: 'OTHER', label: 'Other', position: 5, color: 'gray' },
  ],
});
