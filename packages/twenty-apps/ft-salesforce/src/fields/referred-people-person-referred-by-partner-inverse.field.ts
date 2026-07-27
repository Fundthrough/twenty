import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'bb21b834-d1f1-437a-8549-691bbb154793',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.RELATION,
  name: 'referredPeople',
  label: "Referred People",
  icon: 'IconHeartHandshake',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: 'c03b9e3c-3e49-4751-b687-867e4f6d5735',
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
