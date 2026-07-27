import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { CALL_OBJECT_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: '7c004877-4d61-4e40-b1d1-f01e09e98a57',
  objectUniversalIdentifier: CALL_OBJECT_UID,
  type: FieldType.RELATION,
  name: 'person',
  label: 'Person',
  icon: 'IconUser',
  description: 'External party matched by phone number',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: '6efe62a9-a485-418c-8d25-303d2470918a',
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'personId',
  },
});
