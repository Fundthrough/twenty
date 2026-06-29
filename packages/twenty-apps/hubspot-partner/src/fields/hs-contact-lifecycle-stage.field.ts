import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { HS_CONTACT_LIFECYCLE_STAGE_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_CONTACT_LIFECYCLE_STAGE_UID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsLifecycleStage',
  label: 'Lifecycle Stage',
  description: 'HubSpot lifecycle stage',
  icon: 'IconProgressCheck',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '73f79b18-590a-41b7-9c2a-42d66293ac2d', value: 'SUBSCRIBER', label: 'Subscriber', position: 0, color: 'gray' },
    { id: '11aef20c-0df1-4e9c-85e5-d277a77ffbc2', value: 'LEAD', label: 'Lead', position: 1, color: 'blue' },
    { id: '182e5e80-cf7f-4ac3-a0a3-aa24501d36fd', value: 'MARKETING_QUALIFIED_LEAD', label: 'Marketing Qualified Lead', position: 2, color: 'sky' },
    { id: '15858a3e-c66f-431d-9b1a-659513b19e66', value: 'SALES_QUALIFIED_LEAD', label: 'Sales Qualified Lead', position: 3, color: 'turquoise' },
    { id: 'a73cfef0-e530-454e-ae55-813b3f73d906', value: 'OPPORTUNITY', label: 'Opportunity', position: 4, color: 'yellow' },
    { id: '89b3d528-847d-48e7-a8a4-2e70e82934b8', value: 'CUSTOMER', label: 'Customer', position: 5, color: 'green' },
    { id: '7e63a341-3af5-4987-ac4e-e52e0f5c25dc', value: 'EVANGELIST', label: 'Evangelist', position: 6, color: 'purple' },
    { id: '3cd60492-b333-45ab-b05a-2891c4c1d49f', value: 'OTHER', label: 'Other', position: 7, color: 'gray' },
  ],
});
