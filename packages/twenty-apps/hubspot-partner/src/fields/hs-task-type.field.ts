import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_TASK_TYPE_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_TASK_TYPE_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.SELECT,
  name: 'hsTaskType',
  label: 'Task Type',
  description: 'HubSpot task type (maps hs_task_type)',
  icon: 'IconTag',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: 'aa1b2c3d-4e5f-4a6b-8c9d-000000000001', value: 'TODO', label: 'To-Do', position: 0, color: 'blue' },
    { id: 'aa1b2c3d-4e5f-4a6b-8c9d-000000000002', value: 'CALL', label: 'Call', position: 1, color: 'green' },
    { id: 'aa1b2c3d-4e5f-4a6b-8c9d-000000000003', value: 'EMAIL', label: 'Email', position: 2, color: 'orange' },
  ],
});
