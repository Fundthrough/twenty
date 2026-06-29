import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { HS_COMPANY_LIFECYCLE_STAGE_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_LIFECYCLE_STAGE_UID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsLifecycleStage',
  label: 'Lifecycle Stage',
  description: 'HubSpot lifecycle stage',
  icon: 'IconProgressCheck',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: 'daddaf72-6d73-4d1b-838c-e687fd736d77', value: 'SUBSCRIBER', label: 'Subscriber', position: 0, color: 'gray' },
    { id: '829d65c6-69cc-4d36-a1c5-b6c69c710fdf', value: 'LEAD', label: 'Lead', position: 1, color: 'blue' },
    { id: '15661eb1-92f5-4835-a66a-2b5e49d18a23', value: 'MARKETING_QUALIFIED_LEAD', label: 'Marketing Qualified Lead', position: 2, color: 'sky' },
    { id: '1658877e-6e3f-4e4b-9f04-031223a87029', value: 'SALES_QUALIFIED_LEAD', label: 'Sales Qualified Lead', position: 3, color: 'turquoise' },
    { id: '698fdfb9-b5b2-4a27-b967-e9aa3547c26a', value: 'OPPORTUNITY', label: 'Opportunity', position: 4, color: 'yellow' },
    { id: 'b8b27ce1-33bb-4006-8446-c7eadab749a8', value: 'CUSTOMER', label: 'Customer', position: 5, color: 'green' },
    { id: '95c8ff57-8691-4b56-a1ff-2e08eb9171bd', value: 'EVANGELIST', label: 'Evangelist', position: 6, color: 'purple' },
    { id: 'aa64b32f-2b74-4fbb-b535-9a7396e07338', value: 'OTHER', label: 'Other', position: 7, color: 'gray' },
  ],
});
