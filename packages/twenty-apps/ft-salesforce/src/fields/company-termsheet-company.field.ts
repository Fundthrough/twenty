import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { TERM_SHEET_OBJECT_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: 'a3e9a7d1-f05b-492a-9f08-322ae9b99150',
  objectUniversalIdentifier: TERM_SHEET_OBJECT_UID,
  type: FieldType.RELATION,
  name: 'company',
  label: "Client",
  icon: 'IconBuildingSkyscraper',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: 'df37b47d-3e7c-4647-8e42-6ddfd3601402',
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'companyId',
  },
});
