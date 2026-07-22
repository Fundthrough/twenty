import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { HS_COMPANY_INDUSTRY_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_INDUSTRY_UID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsIndustry',
  label: 'Industry',
  description: 'Company industry from HubSpot',
  icon: 'IconBriefcase',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '723f9315-cae4-42e6-a46f-30bc7cc98c38', value: 'TECHNOLOGY', label: 'Technology', position: 0, color: 'blue' },
    { id: '96ceecdd-2fd4-40f1-9ccb-53cb9109ad35', value: 'FINANCIAL_SERVICES', label: 'Financial Services', position: 1, color: 'green' },
    { id: '94b020bc-08a3-4761-bfba-1d1bb211767d', value: 'HEALTHCARE', label: 'Healthcare', position: 2, color: 'turquoise' },
    { id: '146d342f-ce4b-4938-a2c7-508cddf6a45b', value: 'MANUFACTURING', label: 'Manufacturing', position: 3, color: 'orange' },
    { id: 'd7da32f1-3b74-4a57-a88f-2ab459da33ed', value: 'RETAIL', label: 'Retail', position: 4, color: 'yellow' },
    { id: '98be228c-beff-49a2-85d6-9ddbe46f1247', value: 'REAL_ESTATE', label: 'Real Estate', position: 5, color: 'pink' },
    { id: '6088aa60-70bb-44e6-8182-661b876dcb9e', value: 'EDUCATION', label: 'Education', position: 6, color: 'purple' },
    { id: 'f5370c9b-18e2-442b-8346-1c831bf10162', value: 'CONSULTING', label: 'Consulting', position: 7, color: 'sky' },
    { id: '00e362a0-408a-41e5-bf98-ece62cd151ec', value: 'OTHER', label: 'Other', position: 8, color: 'gray' },
  ],
});
