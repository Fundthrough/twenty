import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '9f7406fc-c25d-4325-8b2e-07542b8d4882',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.SELECT,
  name: 'taskType',
  label: "Task Type",
  description: "Imported: Task.Type",
  icon: 'IconList',
  options: [
    { id: '1f871e10-ea4d-44f0-ba34-f14d37ca7f2f', value: 'CALL', label: "Call", position: 0, color: 'blue' },
    { id: 'ad127697-9304-46ea-b20f-29859b622723', value: 'MEETING', label: "Meeting", position: 1, color: 'green' },
    { id: '579f14cb-9663-4240-a74b-4001fb2889f6', value: 'OTHER', label: "Other", position: 2, color: 'turquoise' },
    { id: '1ef4725f-64c5-413b-bc4d-61f26b5de536', value: 'INTERCOM', label: "Intercom", position: 3, color: 'yellow' },
  ],
  isNullable: true,
  defaultValue: null,
});
