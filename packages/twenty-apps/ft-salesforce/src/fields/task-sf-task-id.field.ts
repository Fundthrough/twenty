import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '5949870d-3354-4505-b561-08b53324d829',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.TEXT,
  name: 'sfTaskId',
  label: 'SF Task Id',
  description: 'Imported: Task.Id — idempotency key for the SF import (unique index)',
  icon: 'IconKey',
  isNullable: true,
  defaultValue: null,
});
