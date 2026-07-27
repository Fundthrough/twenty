import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '5c0e5dcf-4e80-45af-b021-63ba2b00e9d1',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'lifecycleStage',
  label: "Lifecycle Stage",
  description: "Imported: net-new (derived from Lead.IsConverted at import)",
  icon: 'IconList',
  options: [
    { id: 'fef6ecf3-7bb7-4a6f-aa45-b949377f065d', value: 'LEAD', label: "Lead", position: 0, color: 'blue' },
    { id: '8e2da8a3-f835-470f-aaca-71c7933554ce', value: 'CONVERTED', label: "Converted", position: 1, color: 'green' },
  ],
  isNullable: true,
  defaultValue: null,
});
