import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '0977eab4-5af3-4d38-b85a-e2ff07fc4e72',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'ownedPeople',
  label: 'Owned Leads',
  icon: 'IconUsers',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: '3645d215-77ea-4393-8cb5-d42864b42323',
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
