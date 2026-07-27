import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: '2c4fd1f0-b584-4b52-86ee-77533f483cea',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'howDidYouHearAboutUsOther',
  label: "How Did You Hear About Us - Other",
  description: "Imported: Lead.How_Did_You_Hear_About_Us_Other__c",
  icon: 'IconAbc',
  isNullable: true,
  defaultValue: null,
});
