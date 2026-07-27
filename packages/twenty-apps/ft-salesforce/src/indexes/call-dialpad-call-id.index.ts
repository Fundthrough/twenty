import { defineIndex } from 'twenty-sdk/define';
import { CALL_DIALPAD_CALL_ID_UID, CALL_OBJECT_UID } from 'src/constants/universal-identifiers';

// Idempotency: Dialpad delivers multiple state events (and retries) per call —
// the webhook upserts by dialpadCallId, so duplicates can never create a second record.
export default defineIndex({
  universalIdentifier: '22477015-df1f-4e85-a0b0-f41cbd1c65ae',
  objectUniversalIdentifier: CALL_OBJECT_UID,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '9c2d54b1-08a1-4e6f-9c76-6a4c76b0a913',
      fieldUniversalIdentifier: CALL_DIALPAD_CALL_ID_UID,
    },
  ],
});
