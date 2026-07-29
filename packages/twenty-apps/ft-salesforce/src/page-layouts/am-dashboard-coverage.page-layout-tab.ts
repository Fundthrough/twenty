import { AggregateOperations, definePageLayoutTab, ObjectRecordGroupByDateGranularity, PageLayoutTabLayoutMode, ViewFilterOperand } from 'twenty-sdk/define';
import {
  AM_DASHBOARD_TAB_COVERAGE_UID,
  AM_DASHBOARD_UID,
  DASHBOARD_COMPANY,
  DASHBOARD_PERSON,
} from 'src/constants/dashboard-field-identifiers';

// Lead coverage: how much book each AM carries and whether it is being worked.
//
// Coverage (touched over owned) is the headline rather than raw activity volume. Measured
// 2026-07-28: Francisco owns 462 leads and has touched 7, Lyle owns 328 and touched 143. Raw
// call counts would rank a CS rep with 77 calls and 1 lead above either of them.
export default definePageLayoutTab({
  universalIdentifier: AM_DASHBOARD_TAB_COVERAGE_UID,
  pageLayoutUniversalIdentifier: AM_DASHBOARD_UID,
  title: 'Lead Coverage',
  position: 0,
  icon: 'IconUsers',
  layoutMode: PageLayoutTabLayoutMode.GRID,
  widgets: [
    {
      universalIdentifier: '7a1c05e8-9b34-4f62-8d17-2e5a94c07b31',
      title: 'Leads with no owner',
      type: 'GRAPH',
      objectUniversalIdentifier: DASHBOARD_PERSON.object,
      gridPosition: { row: 0, column: 0, rowSpan: 2, columnSpan: 6 },
      configuration: {
        configurationType: 'AGGREGATE_CHART',
        aggregateFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.owner,
        aggregateOperation: AggregateOperations.COUNT_EMPTY,
        label: 'Unowned leads',
        description: 'Departed reps and shared mailboxes. Reported, not solved: redistribution needs a rule.',
        displayDataLabel: true,
        filter: {
          recordFilters: [
            {
              fieldMetadataUniversalIdentifier: DASHBOARD_PERSON.createdBy,
              operand: ViewFilterOperand.IS,
              value: '["API"]',
              type: 'ACTOR',
              subFieldName: 'source',
            },
          ],
        },
      },
    },
    {
      universalIdentifier: 'b2e74f16-4d80-4a35-9c62-8f13a5e0d947',
      title: 'Leads never touched',
      type: 'GRAPH',
      objectUniversalIdentifier: DASHBOARD_PERSON.object,
      gridPosition: { row: 0, column: 6, rowSpan: 2, columnSpan: 6 },
      configuration: {
        configurationType: 'AGGREGATE_CHART',
        aggregateFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.lastActivityAt,
        aggregateOperation: AggregateOperations.COUNT_EMPTY,
        label: 'No activity ever',
        description: 'No call, SMS, email or meeting on record.',
        displayDataLabel: true,
        filter: {
          recordFilters: [
            {
              fieldMetadataUniversalIdentifier: DASHBOARD_PERSON.createdBy,
              operand: ViewFilterOperand.IS,
              value: '["API"]',
              type: 'ACTOR',
              subFieldName: 'source',
            },
          ],
        },
      },
    },
    {
      universalIdentifier: 'c93a68d2-7f51-4e08-b4d6-05e2c7419a83',
      title: 'Leads owned per AM',
      type: 'GRAPH',
      objectUniversalIdentifier: DASHBOARD_PERSON.object,
      gridPosition: { row: 2, column: 0, rowSpan: 6, columnSpan: 6 },
      configuration: {
        configurationType: 'BAR_CHART',
        layout: 'HORIZONTAL',
        aggregateFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.id,
        aggregateOperation: AggregateOperations.COUNT,
        primaryAxisGroupByFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.owner,
        primaryAxisGroupBySubFieldName: 'name.firstName',
        primaryAxisOrderBy: 'VALUE_DESC',
        omitNullValues: true,
        displayLegend: false,
        displayDataLabel: true,
        filter: {
          recordFilters: [
            {
              fieldMetadataUniversalIdentifier: DASHBOARD_PERSON.createdBy,
              operand: ViewFilterOperand.IS,
              value: '["API"]',
              type: 'ACTOR',
              subFieldName: 'source',
            },
          ],
        },
      },
    },
    {
      universalIdentifier: 'd47b1c95-6a23-4f79-8e05-b3f7d2a68c14',
      title: 'Coverage per AM',
      type: 'GRAPH',
      objectUniversalIdentifier: DASHBOARD_PERSON.object,
      gridPosition: { row: 2, column: 6, rowSpan: 6, columnSpan: 6 },
      configuration: {
        configurationType: 'BAR_CHART',
        layout: 'HORIZONTAL',
        groupMode: 'STACKED',
        aggregateFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.id,
        aggregateOperation: AggregateOperations.COUNT,
        primaryAxisGroupByFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.owner,
        primaryAxisGroupBySubFieldName: 'name.firstName',
        primaryAxisOrderBy: 'VALUE_DESC',
        secondaryAxisGroupByFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.lastActivityType,
        // untouched leads must stay visible: they are the point of the chart
        omitNullValues: false,
        displayLegend: true,
        description: 'Segment with no activity type is the untouched portion of that AM book.',
        filter: {
          recordFilters: [
            {
              fieldMetadataUniversalIdentifier: DASHBOARD_PERSON.createdBy,
              operand: ViewFilterOperand.IS,
              value: '["API"]',
              type: 'ACTOR',
              subFieldName: 'source',
            },
          ],
        },
      },
    },
    {
      universalIdentifier: 'e58c2d76-3b94-4a10-9d68-7c1f0e4b53a2',
      title: 'Leads by NAICS sector',
      type: 'GRAPH',
      objectUniversalIdentifier: DASHBOARD_PERSON.object,
      gridPosition: { row: 8, column: 0, rowSpan: 6, columnSpan: 6 },
      configuration: {
        configurationType: 'BAR_CHART',
        layout: 'HORIZONTAL',
        aggregateFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.id,
        aggregateOperation: AggregateOperations.COUNT,
        primaryAxisGroupByFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.naicsSector,
        primaryAxisOrderBy: 'VALUE_DESC',
        omitNullValues: true,
        displayLegend: false,
        description: 'Inferred from credit industry codes. Blank where credit has not classified the business.',
        filter: {
          recordFilters: [
            {
              fieldMetadataUniversalIdentifier: DASHBOARD_PERSON.createdBy,
              operand: ViewFilterOperand.IS,
              value: '["API"]',
              type: 'ACTOR',
              subFieldName: 'source',
            },
          ],
        },
      },
    },
    {
      universalIdentifier: 'f69d3e81-5c07-4b26-8a14-9d2b6f05c738',
      title: 'Accounts by NAICS sector',
      type: 'GRAPH',
      objectUniversalIdentifier: DASHBOARD_COMPANY.object,
      gridPosition: { row: 8, column: 6, rowSpan: 6, columnSpan: 6 },
      configuration: {
        configurationType: 'BAR_CHART',
        layout: 'HORIZONTAL',
        aggregateFieldMetadataUniversalIdentifier: DASHBOARD_COMPANY.id,
        aggregateOperation: AggregateOperations.COUNT,
        primaryAxisGroupByFieldMetadataUniversalIdentifier: DASHBOARD_COMPANY.naicsSector,
        primaryAxisOrderBy: 'VALUE_DESC',
        omitNullValues: true,
        displayLegend: false,
        filter: {
          recordFilters: [
            {
              fieldMetadataUniversalIdentifier: DASHBOARD_COMPANY.createdBy,
              operand: ViewFilterOperand.IS,
              value: '["API"]',
              type: 'ACTOR',
              subFieldName: 'source',
            },
          ],
        },
      },
    },
    {
      universalIdentifier: '0a7e4b93-8d16-4c52-9f38-2b5c1e07a94d',
      title: 'New leads per week',
      type: 'GRAPH',
      objectUniversalIdentifier: DASHBOARD_PERSON.object,
      gridPosition: { row: 14, column: 0, rowSpan: 6, columnSpan: 12 },
      configuration: {
        configurationType: 'LINE_CHART',
        aggregateFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.id,
        aggregateOperation: AggregateOperations.COUNT,
        primaryAxisGroupByFieldMetadataUniversalIdentifier: DASHBOARD_PERSON.createdAt,
        primaryAxisDateGranularity: ObjectRecordGroupByDateGranularity.WEEK,
        displayLegend: false,
        filter: {
          recordFilters: [
            {
              fieldMetadataUniversalIdentifier: DASHBOARD_PERSON.createdBy,
              operand: ViewFilterOperand.IS,
              value: '["API"]',
              type: 'ACTOR',
              subFieldName: 'source',
            },
          ],
        },
      },
    },
  ],
});
