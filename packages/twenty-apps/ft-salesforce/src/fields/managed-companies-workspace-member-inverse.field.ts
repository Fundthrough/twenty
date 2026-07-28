import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'd4b81f36-70ea-4c59-9a17-52e3c8046bd1',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'managedCompanies',
  label: 'Managed Clients',
  icon: 'IconHeadset',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: 'ae0c6b14-95d7-42f8-8c33-1b6d0e7a4f52',
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
