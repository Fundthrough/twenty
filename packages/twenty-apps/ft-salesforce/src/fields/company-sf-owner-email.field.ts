import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'e3923473-313d-42d2-86a3-b81aa166def2',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'sfOwnerEmail',
  label: 'SF Owner Email',
  description: 'Imported: Account OwnerId → User.Email. Backfill key for the standard Account Owner relation.',
  icon: 'IconMail',
  isNullable: true,
  defaultValue: null,
});
