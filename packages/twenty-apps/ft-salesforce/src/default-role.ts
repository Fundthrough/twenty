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
});
