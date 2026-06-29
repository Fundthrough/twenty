import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_TASK_HUBSPOT_ID_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_TASK_HUBSPOT_ID_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.TEXT,
  name: 'hsHubspotId',
  label: 'HubSpot ID',
  description: 'Original HubSpot task record ID for cross-reference',
  icon: 'IconLink',
  isNullable: true,
  defaultValue: null,
});
