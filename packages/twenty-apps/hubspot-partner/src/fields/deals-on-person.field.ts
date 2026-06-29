import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import {
  DEALS_ON_PERSON_UID,
  HS_PARTNER_DEAL_OBJECT_UID,
  PRIMARY_CONTACT_ON_DEAL_UID,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: DEALS_ON_PERSON_UID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'hsPartnerDeals',
  label: 'Partner Deals',
  icon: 'IconCurrencyDollar',
  relationTargetObjectMetadataUniversalIdentifier: HS_PARTNER_DEAL_OBJECT_UID,
  relationTargetFieldMetadataUniversalIdentifier: PRIMARY_CONTACT_ON_DEAL_UID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
