import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '6e0001a5-689f-4125-8c48-a0c17924cd42',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'sfOwnerEmail',
  label: 'SF Owner Email',
  description: 'Imported: Lead/Contact OwnerId → User.Email. Interim "my leads" filter; backfill key for the Owner relation.',
  icon: 'IconMail',
  isNullable: true,
  defaultValue: null,
});
