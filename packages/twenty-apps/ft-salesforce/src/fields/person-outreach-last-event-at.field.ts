import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '0d58ab35-6a96-4fc9-85a8-fe0ec862a37d',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.DATE_TIME,
  name: 'outreachLastEventAt',
  label: 'Outreach Last Event At',
  description: 'Timestamp of the most recent Outreach engagement event',
  icon: 'IconCalendarTime',
  isNullable: true,
  defaultValue: null,
});
