import { defineView, ViewType } from 'twenty-sdk/define';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import {
  HS_COMPANIES_VIEW_UID,
  HS_COMPANY_EMPLOYEE_COUNT_UID,
  HS_COMPANY_HUBSPOT_ID_UID,
  HS_COMPANY_INDUSTRY_UID,
  HS_COMPANY_LIFECYCLE_STAGE_UID,
} from 'src/constants/universal-identifiers';

const COMPANY_NAME_UID = '20202020-4d99-4e2e-a84c-4a27837b1ece';
const COMPANY_DOMAIN_NAME_UID = '20202020-0c28-43d8-8ba5-3659924d3489';

export default defineView({
  universalIdentifier: HS_COMPANIES_VIEW_UID,
  name: 'HS Companies',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: ViewType.TABLE,
  icon: 'IconBuildingSkyscraper',
  position: 10,
  fields: [
    {
      universalIdentifier: 'a99b8dfb-b51c-4971-acb3-8ad168e56e07',
      fieldMetadataUniversalIdentifier: COMPANY_NAME_UID,
      position: 0,
      isVisible: true,
      size: 200,
    },
    {
      universalIdentifier: 'a5a7de2b-30dc-4cf0-ac22-f28b7858945c',
      fieldMetadataUniversalIdentifier: COMPANY_DOMAIN_NAME_UID,
      position: 1,
      isVisible: true,
      size: 200,
    },
    {
      universalIdentifier: 'dce47c88-0f0c-4c73-b827-06758e2aefff',
      fieldMetadataUniversalIdentifier: HS_COMPANY_INDUSTRY_UID,
      position: 2,
      isVisible: true,
      size: 150,
    },
    {
      universalIdentifier: '6023b67d-e102-4b29-942a-436d54067dfd',
      fieldMetadataUniversalIdentifier: HS_COMPANY_LIFECYCLE_STAGE_UID,
      position: 3,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: 'a0a327db-3d5d-4a5a-be72-a2ad53d3549a',
      fieldMetadataUniversalIdentifier: HS_COMPANY_EMPLOYEE_COUNT_UID,
      position: 4,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: 'dbaee7ea-9e72-481e-be89-a92aad7bf88e',
      fieldMetadataUniversalIdentifier: HS_COMPANY_HUBSPOT_ID_UID,
      position: 5,
      isVisible: false,
      size: 140,
    },
  ],
});
