import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '88b143a6-29b3-449b-add9-d3722faa90c2',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.RELATION,
  name: 'referrals',
  label: "Referrals",
  icon: 'IconHeartHandshake',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: '3ee8ac63-4941-4ee1-ae79-29cfeeda0c44',
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
