import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_CONTACT_CITY_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_CONTACT_CITY_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'hsCity',
  label: 'City',
  description: 'Contact city (maps HubSpot city)',
  icon: 'IconMapPin',
  isNullable: true,
  defaultValue: null,
});
