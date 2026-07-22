import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_CONTACT_MOBILE_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_CONTACT_MOBILE_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'hsMobilePhone',
  label: 'Mobile Phone',
  description: 'Contact mobile phone number (maps HubSpot mobilephone)',
  icon: 'IconDeviceMobile',
  isNullable: true,
  defaultValue: null,
});
