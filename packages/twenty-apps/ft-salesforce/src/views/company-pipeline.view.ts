import { defineView, ViewType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

// THE sales pipeline (company-centric per Linesh 2026-07-22): companies grouped by the
// 11-stage leadStatus. Source-owned so syncs assert it (SDK 2.23 enforces source views).
export default defineView({
  universalIdentifier: 'adc08953-0b5c-4575-af08-cab608daa1a3',
  name: 'Leads',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: ViewType.KANBAN,
  mainGroupByFieldMetadataUniversalIdentifier: 'a37ecafd-1c42-45cf-80d8-29bdb6cf39ab', // company.leadStatus
  icon: 'IconLayoutKanban',
  position: 0,
  fields: [
    { universalIdentifier: '2bb98f43-f413-4d01-9fa7-b35a814e51cf', fieldMetadataUniversalIdentifier: '7a045c6e-6c5d-4b61-b679-1a467766edf5', position: 0, isVisible: true, size: 120 }, // companyId
    { universalIdentifier: '20bdf218-13b4-4df9-9427-878a309cf4ea', fieldMetadataUniversalIdentifier: 'e3923473-313d-42d2-86a3-b81aa166def2', position: 1, isVisible: true, size: 180 }, // sfOwnerEmail
    { universalIdentifier: '211ce196-8394-447a-9c33-291e4a058deb', fieldMetadataUniversalIdentifier: 'fc68afca-300a-4077-bc4f-8aae4bb5bf71', position: 2, isVisible: true, size: 160 }, // leadSource
    { universalIdentifier: '7aaedadf-4b81-4764-aef8-098bc16fd15a', fieldMetadataUniversalIdentifier: '91b35d3f-9628-4410-b3ca-300b0f448973', position: 3, isVisible: true, size: 160 }, // desiredFundingAmount
  ],
});
