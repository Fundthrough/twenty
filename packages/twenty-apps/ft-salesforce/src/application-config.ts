import { defineApplication } from 'twenty-sdk/define';
import { APPLICATION_UID, DEFAULT_ROLE_UID } from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UID,
  displayName: 'FT Salesforce Migration',
  description: 'FundThrough CRM — Salesforce replacement (Person, Company=Client, TermSheet, Lead Pipeline, Flow embed)',
  defaultRoleUniversalIdentifier: DEFAULT_ROLE_UID,
});
