import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'ca86558e-2e48-465a-a156-4c17482643ae',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.SELECT,
  name: 'priority',
  label: "Priority",
  description: "Imported: Task.Priority",
  icon: 'IconList',
  options: [
    { id: '827722a0-fb0c-41ef-82ca-ea3cafae432c', value: 'HIGH', label: "High", position: 0, color: 'blue' },
    { id: '63cddc13-7162-4871-892b-7be93f272b67', value: 'NORMAL', label: "Normal", position: 1, color: 'green' },
  ],
  defaultValue: `'NORMAL'`,
});
