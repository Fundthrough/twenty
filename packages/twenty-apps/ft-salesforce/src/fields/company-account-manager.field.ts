import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

// Client Success owner of an activated client, from Client__c.am_email__c.
//
// Sales and Client Success work the same company at different states, so ownership is two
// fields, not one: accountOwner is the Sales rep who worked the lead (sfOwnerEmail, which
// resolves lead owner first), and this is the AM who runs the relationship after activation.
// Neither supersedes the other. Shared queues (backoffice@ and friends) are deliberately left
// unresolved rather than pointed at a person.
export default defineField({
  universalIdentifier: 'ae0c6b14-95d7-42f8-8c33-1b6d0e7a4f52',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.RELATION,
  name: 'accountManager',
  label: 'Account Manager',
  description: 'Client Success owner after activation. Sales ownership lives in Account Owner.',
  icon: 'IconHeadset',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: 'd4b81f36-70ea-4c59-9a17-52e3c8046bd1',
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'accountManagerId',
  },
});
