import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import {
  DEALS_ON_COMPANY_UID,
  HS_PARTNER_DEAL_OBJECT_UID,
  PRIMARY_COMPANY_ON_DEAL_UID,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PRIMARY_COMPANY_ON_DEAL_UID,
  objectUniversalIdentifier: HS_PARTNER_DEAL_OBJECT_UID,
  type: FieldType.RELATION,
  name: 'primaryCompany',
  label: 'Company',
  icon: 'IconBuildingSkyscraper',
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: DEALS_ON_COMPANY_UID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'primaryCompanyId',
  },
});
