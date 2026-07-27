import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { CALL_OBJECT_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: '6efe62a9-a485-418c-8d25-303d2470918a',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'calls',
  label: 'Calls',
  icon: 'IconPhone',
  relationTargetObjectMetadataUniversalIdentifier: CALL_OBJECT_UID,
  relationTargetFieldMetadataUniversalIdentifier: '7c004877-4d61-4e40-b1d1-f01e09e98a57',
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
