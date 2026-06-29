import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { HS_COMPANY_HUBSPOT_ID_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_HUBSPOT_ID_UID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'hsHubspotId',
  label: 'HubSpot ID',
  description: 'Original HubSpot object ID for cross-reference',
  icon: 'IconLink',
  isNullable: true,
  defaultValue: null,
});
