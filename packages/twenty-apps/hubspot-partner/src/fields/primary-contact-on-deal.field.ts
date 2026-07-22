import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import {
  DEALS_ON_PERSON_UID,
  HS_PARTNER_DEAL_OBJECT_UID,
  PRIMARY_CONTACT_ON_DEAL_UID,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: PRIMARY_CONTACT_ON_DEAL_UID,
  objectUniversalIdentifier: HS_PARTNER_DEAL_OBJECT_UID,
  type: FieldType.RELATION,
  name: 'primaryContact',
  label: 'Contact',
  icon: 'IconUser',
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: DEALS_ON_PERSON_UID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'primaryContactId',
  },
});
