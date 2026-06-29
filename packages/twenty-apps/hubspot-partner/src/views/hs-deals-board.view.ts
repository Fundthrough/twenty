import { defineView, ViewType } from 'twenty-sdk/define';
import {
  DEAL_AMOUNT_FIELD_UID,
  DEAL_CLOSE_DATE_FIELD_UID,
  DEAL_NAME_FIELD_UID,
  DEAL_STAGE_FIELD_UID,
  HS_DEALS_BOARD_VIEW_UID,
  HS_PARTNER_DEAL_OBJECT_UID,
  PRIMARY_COMPANY_ON_DEAL_UID,
  PRIMARY_CONTACT_ON_DEAL_UID,
} from 'src/constants/universal-identifiers';

export default defineView({
  universalIdentifier: HS_DEALS_BOARD_VIEW_UID,
  name: 'Pipeline Board',
  objectUniversalIdentifier: HS_PARTNER_DEAL_OBJECT_UID,
  type: ViewType.KANBAN,
  // Kanban columns are generated from the stage SELECT field options
  mainGroupByFieldMetadataUniversalIdentifier: DEAL_STAGE_FIELD_UID,
  icon: 'IconLayoutKanban',
  position: 0,
  fields: [
    {
      universalIdentifier: '005d243d-e0c2-4667-8f88-522090f324d8',
      fieldMetadataUniversalIdentifier: DEAL_NAME_FIELD_UID,
      position: 0,
      isVisible: true,
      size: 200,
    },
    {
      universalIdentifier: 'e6c42fc5-d01b-494e-8810-7b37e8e0b4ff',
      fieldMetadataUniversalIdentifier: DEAL_AMOUNT_FIELD_UID,
      position: 1,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: 'e58de7dc-45fb-467b-8065-aa38c5f9aae8',
      fieldMetadataUniversalIdentifier: PRIMARY_COMPANY_ON_DEAL_UID,
      position: 2,
      isVisible: true,
      size: 160,
    },
    {
      universalIdentifier: 'fe96cd2c-8417-4f9b-bd27-4d5b50ef47a6',
      fieldMetadataUniversalIdentifier: PRIMARY_CONTACT_ON_DEAL_UID,
      position: 3,
      isVisible: true,
      size: 150,
    },
    {
      universalIdentifier: 'b78c7cd0-e78d-4213-a725-47c3e2f05eca',
      fieldMetadataUniversalIdentifier: DEAL_CLOSE_DATE_FIELD_UID,
      position: 4,
      isVisible: true,
      size: 120,
    },
  ],
});
