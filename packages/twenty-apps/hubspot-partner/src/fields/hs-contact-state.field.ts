import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_CONTACT_STATE_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_CONTACT_STATE_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'hsState',
  label: 'State',
  description: 'Contact state/region (maps HubSpot state)',
  icon: 'IconMapPin',
  isNullable: true,
  defaultValue: null,
});
