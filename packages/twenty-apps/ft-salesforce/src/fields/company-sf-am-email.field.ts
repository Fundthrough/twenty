import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'c1f7a0d2-3b48-4e6a-9d21-7f4c8b5e2a90',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'sfAmEmail',
  label: 'SF AM Email',
  description: 'Imported: Client__c.am_email__c. Backfill key for Account Manager (Client Success). Distinct from sfOwnerEmail, which is the Sales lead owner.',
  icon: 'IconMail',
  isNullable: true,
  defaultValue: null,
});
