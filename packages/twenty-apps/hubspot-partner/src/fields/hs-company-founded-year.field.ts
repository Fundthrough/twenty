import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_COMPANY_FOUNDED_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_FOUNDED_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'hsFounded',
  label: 'Year Founded',
  description: 'Year the company was founded (maps HubSpot founded_year)',
  icon: 'IconCalendar',
  isNullable: true,
  defaultValue: null,
});
