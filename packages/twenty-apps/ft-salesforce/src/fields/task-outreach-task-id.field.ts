import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '46d7b1af-576e-4096-9b1b-56e6beba04b7',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.TEXT,
  name: 'outreachTaskId',
  label: 'Outreach Task Id',
  description: 'Outreach task id — idempotency key for task sync (EE-5069)',
  icon: 'IconKey',
  isNullable: true,
  defaultValue: null,
});
