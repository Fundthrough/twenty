import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { HS_COMPANY_IS_TARGET_UID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: HS_COMPANY_IS_TARGET_UID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.BOOLEAN,
  name: 'hsIsTargetAccount',
  label: 'Target Account',
  description: 'Whether this is a target account (maps HubSpot hs_is_target_account)',
  icon: 'IconTarget',
  defaultValue: false,
});
