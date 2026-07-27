import { defineView, ViewType } from 'twenty-sdk/define';
import { TERM_SHEET_OBJECT_UID, TERM_SHEET_STATUS_UID, TERM_SHEET_DISCLOSURE_BUCKET_UID, TERM_SHEET_ONBOARD_DATE_UID } from 'src/constants/universal-identifiers';

export default defineView({
  universalIdentifier: '150101e5-24e7-41b0-a3a0-f2ee9289e0ff',
  name: 'Term Sheets',
  objectUniversalIdentifier: TERM_SHEET_OBJECT_UID,
  type: ViewType.TABLE,
  icon: 'IconFileDollar',
  position: 0,
  fields: [
    { universalIdentifier: 'ba3e8d7b-b457-4148-82c3-3d38e665d993', fieldMetadataUniversalIdentifier: TERM_SHEET_STATUS_UID, position: 0, isVisible: true, size: 180 },
    { universalIdentifier: '092ef6e7-93d3-4f4a-8847-593b8c10de48', fieldMetadataUniversalIdentifier: TERM_SHEET_DISCLOSURE_BUCKET_UID, position: 1, isVisible: true, size: 180 },
    { universalIdentifier: '44ef9329-01ed-4964-a983-20bd4de1fa8f', fieldMetadataUniversalIdentifier: TERM_SHEET_ONBOARD_DATE_UID, position: 2, isVisible: true, size: 180 },
  ],
});
