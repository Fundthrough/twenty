import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_COMPANY_COUNTRY_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_COUNTRY_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'hsCountry',
  label: 'Country',
  description: 'Company country (maps HubSpot country)',
  icon: 'IconWorld',
  isNullable: true,
  defaultValue: null,
});
