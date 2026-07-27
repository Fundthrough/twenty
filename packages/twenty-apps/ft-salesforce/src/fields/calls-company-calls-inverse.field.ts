import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { CALL_OBJECT_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: '21869a06-59a1-4392-bee2-b6e30fa7723d',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.RELATION,
  name: 'calls',
  label: 'Calls',
  icon: 'IconPhone',
  relationTargetObjectMetadataUniversalIdentifier: CALL_OBJECT_UID,
  relationTargetFieldMetadataUniversalIdentifier: '86f4954c-7ba9-4532-b222-5645ca4270e5',
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
