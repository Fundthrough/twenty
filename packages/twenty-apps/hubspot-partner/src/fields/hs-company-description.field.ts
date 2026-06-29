import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_COMPANY_DESCRIPTION_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_DESCRIPTION_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.RICH_TEXT,
  name: 'hsDescription',
  label: 'Description',
  description: 'Company description (maps HubSpot description)',
  icon: 'IconNotes',
  isNullable: true,
  defaultValue: null,
});
