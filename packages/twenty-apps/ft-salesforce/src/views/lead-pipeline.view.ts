import { defineView, ViewType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PERSON_LEAD_STATUS_UID, PERSON_COMPANY_NAME_UID, PERSON_DESIRED_FUNDING_AMOUNT_UID, PERSON_LEAD_SOURCE_UID } from 'src/constants/universal-identifiers';

export default defineView({
  universalIdentifier: '4f5af308-d62c-44d5-a79d-5cde870d3eb8',
  name: 'Lead Pipeline',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: ViewType.KANBAN,
  mainGroupByFieldMetadataUniversalIdentifier: PERSON_LEAD_STATUS_UID,
  icon: 'IconLayoutKanban',
  position: 0,
  fields: [
    { universalIdentifier: '4e7d2697-ea3e-4e51-a433-c452d2f24424', fieldMetadataUniversalIdentifier: PERSON_COMPANY_NAME_UID, position: 0, isVisible: true, size: 180 },
    { universalIdentifier: 'c4e184da-ea93-4312-9cdc-52a8d101c44d', fieldMetadataUniversalIdentifier: PERSON_DESIRED_FUNDING_AMOUNT_UID, position: 1, isVisible: true, size: 180 },
    { universalIdentifier: '405507f5-2d29-4b2c-a7b5-01d8a188a4af', fieldMetadataUniversalIdentifier: PERSON_LEAD_SOURCE_UID, position: 2, isVisible: true, size: 180 },
  ],
});
