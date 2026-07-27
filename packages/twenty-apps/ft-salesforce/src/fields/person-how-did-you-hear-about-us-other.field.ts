import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '661536b3-a61b-4ae0-9914-faeeee858734',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'howDidYouHearAboutUsOther',
  label: "How Did You Hear About Us - Other",
  description: "Imported: Lead.How_Did_You_Hear_About_Us_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
