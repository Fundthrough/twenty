import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { TERM_SHEET_OBJECT_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: 'df37b47d-3e7c-4647-8e42-6ddfd3601402',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.RELATION,
  name: 'termSheets',
  label: "Term Sheets",
  icon: 'IconBuildingSkyscraper',
  relationTargetObjectMetadataUniversalIdentifier: TERM_SHEET_OBJECT_UID,
  relationTargetFieldMetadataUniversalIdentifier: 'a3e9a7d1-f05b-492a-9f08-322ae9b99150',
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
