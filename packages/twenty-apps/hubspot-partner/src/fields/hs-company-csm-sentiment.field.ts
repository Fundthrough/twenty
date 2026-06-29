import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_COMPANY_CSM_SENTIMENT_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_CSM_SENTIMENT_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsCsmSentiment',
  label: 'CSM Sentiment',
  description: 'Customer success manager sentiment (maps HubSpot hs_csm_sentiment)',
  icon: 'IconMoodSmile',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '3c4d5e6f-0001-4e5f-8a9b-300000000001', value: 'GOOD', label: 'Good', position: 0, color: 'green' },
    { id: '3c4d5e6f-0002-4e5f-8a9b-300000000002', value: 'NEUTRAL', label: 'Neutral', position: 1, color: 'gray' },
    { id: '3c4d5e6f-0003-4e5f-8a9b-300000000003', value: 'BAD', label: 'Bad', position: 2, color: 'red' },
    { id: '3c4d5e6f-0004-4e5f-8a9b-300000000004', value: 'AT_RISK', label: 'At Risk', position: 3, color: 'orange' },
  ],
});
