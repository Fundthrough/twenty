import { defineView, ViewType } from 'twenty-sdk/define';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import {
  HS_CONTACT_HUBSPOT_ID_UID,
  HS_CONTACT_LEAD_STATUS_UID,
  HS_CONTACT_LIFECYCLE_STAGE_UID,
  HS_CONTACTS_VIEW_UID,
} from 'src/constants/universal-identifiers';

const PERSON_NAME_UID = '20202020-3875-44d5-8c33-a6239011cab8';
const PERSON_EMAILS_UID = '20202020-3c51-43fa-8b6e-af39e29368ab';
const PERSON_PHONES_UID = '20202020-0638-448e-8825-439134618022';
const PERSON_JOB_TITLE_UID = '20202020-b0d0-415a-bef9-640a26dacd9b';

export default defineView({
  universalIdentifier: HS_CONTACTS_VIEW_UID,
  name: 'HS Contacts',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: ViewType.TABLE,
  icon: 'IconUser',
  position: 11,
  fields: [
    {
      universalIdentifier: '2928423b-bb51-4cab-9422-d4c123583b37',
      fieldMetadataUniversalIdentifier: PERSON_NAME_UID,
      position: 0,
      isVisible: true,
      size: 200,
    },
    {
      universalIdentifier: 'c8142851-7c96-47d9-a906-7204e470183b',
      fieldMetadataUniversalIdentifier: PERSON_JOB_TITLE_UID,
      position: 1,
      isVisible: true,
      size: 160,
    },
    {
      universalIdentifier: 'eae54ae2-9a72-47df-a766-09f57946e150',
      fieldMetadataUniversalIdentifier: PERSON_EMAILS_UID,
      position: 2,
      isVisible: true,
      size: 200,
    },
    {
      universalIdentifier: '3c0dc33c-c4ec-40b0-9e06-1da026207a2a',
      fieldMetadataUniversalIdentifier: PERSON_PHONES_UID,
      position: 3,
      isVisible: true,
      size: 150,
    },
    {
      universalIdentifier: '2a336eb8-c667-4aa1-b222-bd2e22e47dc0',
      fieldMetadataUniversalIdentifier: HS_CONTACT_LIFECYCLE_STAGE_UID,
      position: 4,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: 'd7e71095-619d-42ac-8a6a-595af604830d',
      fieldMetadataUniversalIdentifier: HS_CONTACT_LEAD_STATUS_UID,
      position: 5,
      isVisible: true,
      size: 160,
    },
    {
      universalIdentifier: '77dbba12-a822-4dea-8294-6be4227b894e',
      fieldMetadataUniversalIdentifier: HS_CONTACT_HUBSPOT_ID_UID,
      position: 6,
      isVisible: false,
      size: 140,
    },
  ],
});
