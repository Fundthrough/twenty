import { defineView, ViewType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

// THE sales pipeline (company-centric per Linesh 2026-07-22): companies grouped by the 11-stage
// leadStatus. Source-owned so every sync asserts it back — this file is the lock. Anything a user
// renames or re-columns here is reset on the next `twenty apply`.
//
// The columns themselves are viewGroups, which a view definition cannot express, so
// scripts/setup-workspace.mjs section 2 builds them from company.leadStatus options and prunes any
// group whose value is not a leadStatus. That pruning exists because this board was found grouping
// by leadStatus while carrying 19 columns of company.accountType values (CUSTOMER, COMPETITOR,
// PAYOR, ACCOUNTANT…): only PROSPECT overlapped, so every other card had no column to land in.
//
// Card fields are chosen on measured coverage (2026-07-29, of 7,540 companies):
//   companyId          4,171   the PRO platform id reps quote
//   accountOwner       1,231   who owns the relationship now (Sales, or CS once funded)
//   applicationStatus  4,171   Funded / Application Started — the real progress signal
//   naicsSector        1,926   industry, replacing the old messy Industry field
// Dropped: desiredFundingAmount (86) and leadSource (375) were near-empty columns, and
// sfOwnerEmail (5,542) is superseded by the accountOwner relation.
export default defineView({
  universalIdentifier: 'adc08953-0b5c-4575-af08-cab608daa1a3',
  name: 'Company Leads',
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: ViewType.KANBAN,
  mainGroupByFieldMetadataUniversalIdentifier: 'a37ecafd-1c42-45cf-80d8-29bdb6cf39ab', // company.leadStatus
  icon: 'IconLayoutKanban',
  position: 0,
  fields: [
    { universalIdentifier: '2bb98f43-f413-4d01-9fa7-b35a814e51cf', fieldMetadataUniversalIdentifier: '7a045c6e-6c5d-4b61-b679-1a467766edf5', position: 0, isVisible: true, size: 120 }, // companyId
    { universalIdentifier: '20bdf218-13b4-4df9-9427-878a309cf4ea', fieldMetadataUniversalIdentifier: '20202020-95b8-4e10-9881-edb5d4765f9d', position: 1, isVisible: true, size: 180 }, // accountOwner
    { universalIdentifier: '211ce196-8394-447a-9c33-291e4a058deb', fieldMetadataUniversalIdentifier: '40740de7-6af0-4799-991e-7ad309da2496', position: 2, isVisible: true, size: 160 }, // applicationStatus
    { universalIdentifier: '7aaedadf-4b81-4764-aef8-098bc16fd15a', fieldMetadataUniversalIdentifier: 'b7e41a09-2d6c-4f18-9a53-06c8f7d21e44', position: 3, isVisible: true, size: 200 }, // naicsSector
  ],
});
