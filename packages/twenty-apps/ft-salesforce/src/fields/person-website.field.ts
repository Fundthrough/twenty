import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export default defineField({
  universalIdentifier: 'd85c6886-48e9-4959-9ae1-3f82f645d527',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.LINKS,
  name: 'website',
  label: "Website",
  description: "Imported: Lead.Website",
  icon: 'IconLink',
  isNullable: true,
  defaultValue: null,
});
