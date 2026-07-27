import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '12d93014-d5b7-4791-a09b-21cb680d1612',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'lifecycleStage',
  label: "Lifecycle Stage",
  description: "Imported: net-new (derived from Lead.IsConverted at import)",
  icon: 'IconList',
  options: [
    { id: '300f3272-3c8c-4022-aabc-32cadab4b202', value: 'LEAD', label: "Lead", position: 0, color: 'blue' },
    { id: '6b248d6f-fc7e-4ef7-a0cd-39ea791a8b5a', value: 'CONVERTED', label: "Converted", position: 1, color: 'green' },
  ],
  isNullable: true,
  defaultValue: null,
});
