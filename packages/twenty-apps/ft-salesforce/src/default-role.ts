import { defineApplicationRole } from 'twenty-sdk/define';
import { DEFAULT_ROLE_UID } from 'src/constants/universal-identifiers';

export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UID,
  label: 'FT Salesforce default role',
  description: 'FT Salesforce Migration default role',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: false,
  // Required so the app can rotate its own OAuth tokens. Outreach access tokens last two hours
  // and its refresh tokens rotate on every use, so a refresh is only durable if the new pair is
  // written straight back to the app variables -- which is a settings write. Without this the
  // functions could refresh but not persist, the rotated refresh token would be lost, and
  // someone would have to re-authorise by hand every 14 days.
  canUpdateAllSettings: true,
});
