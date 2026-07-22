import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_COMPANY_PHONE_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_PHONE_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.PHONES,
  name: 'hsPhone',
  label: 'Phone',
  description: 'Company phone number (maps HubSpot phone)',
  icon: 'IconPhone',
  isNullable: true,
  defaultValue: null,
});
