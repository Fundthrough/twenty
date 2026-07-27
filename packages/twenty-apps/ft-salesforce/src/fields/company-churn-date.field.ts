import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '6e80d891-ebdb-40e2-9308-c19960817861',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.DATE,
  name: 'churnDate',
  label: "Churn Date",
  description: "Imported: Account.Churn_Date__c",
  icon: 'IconCalendar',
  isNullable: true,
  defaultValue: null,
});
