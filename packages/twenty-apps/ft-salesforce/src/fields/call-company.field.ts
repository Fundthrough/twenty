import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { CALL_OBJECT_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: '86f4954c-7ba9-4532-b222-5645ca4270e5',
  objectUniversalIdentifier: CALL_OBJECT_UID,
  type: FieldType.RELATION,
  name: 'company',
  label: 'Company',
  icon: 'IconBuildingSkyscraper',
  description: "Matched person's company at call time",
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: '21869a06-59a1-4392-bee2-b6e30fa7723d',
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'companyId',
  },
});
