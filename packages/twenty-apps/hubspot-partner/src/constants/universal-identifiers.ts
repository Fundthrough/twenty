// App
export const APP_DISPLAY_NAME = 'HubSpot Partner';
export const APP_DESCRIPTION = 'Partner workspace replicated from HubSpot CRM';
export const APPLICATION_UNIVERSAL_IDENTIFIER =
  'd953cc79-99fd-466f-92a5-118aec76f949';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER =
  'f09a02d3-0160-494c-81f9-c1238cfd1ef6';

// HsPartnerDeal object
export const HS_PARTNER_DEAL_OBJECT_UID =
  'c4ad9716-50d8-4006-b7d1-fd6c44ca4217';
export const DEAL_NAME_FIELD_UID = 'b1f211e0-47f3-4979-acda-dd26e850ea0d';
export const DEAL_AMOUNT_FIELD_UID = 'd4c66f7f-be5d-40dc-bd34-1ec3c72b60e9';
export const DEAL_STAGE_FIELD_UID = '3d6978f2-1eb4-407b-a7f4-332aaa50c825';
export const DEAL_CLOSE_DATE_FIELD_UID =
  '54d5b463-f9ba-4db4-b6e5-f1e9aef94d9a';
export const DEAL_TYPE_FIELD_UID = 'f1adbd77-6b6c-45ca-9a0e-44fdcc096db0';
export const DEAL_DESCRIPTION_FIELD_UID =
  '91ace70b-6512-4092-bfcf-ad79f65e0bdc';

// Relation fields: Deal ↔ Company
export const PRIMARY_COMPANY_ON_DEAL_UID =
  'f1210825-e7bc-4379-8570-dca39fb5825a';
export const DEALS_ON_COMPANY_UID = 'fad84bad-be44-408c-9b8d-76df7bc38363';

// Relation fields: Deal ↔ Person
export const PRIMARY_CONTACT_ON_DEAL_UID =
  '04731528-efb1-4686-a050-d8564ebc3655';
export const DEALS_ON_PERSON_UID = '5acd735f-4253-4381-a1f7-432302512d86';

// Company extension fields
export const HS_COMPANY_INDUSTRY_UID = '4269e7ba-fd07-467b-9eec-10880dc8c8c5';
export const HS_COMPANY_EMPLOYEE_COUNT_UID =
  '77128dd8-f616-41f5-8d96-7521d27b5140';
export const HS_COMPANY_LIFECYCLE_STAGE_UID =
  '01bee146-6c60-4d30-a446-071c0c84e02e';
export const HS_COMPANY_HUBSPOT_ID_UID =
  'b6f3221c-0a90-472b-a181-5a0e0fe35d42';

// Contact extension fields
export const HS_CONTACT_LIFECYCLE_STAGE_UID =
  '4064cbc9-0a48-44ce-ba51-8f0fc91a16b0';
export const HS_CONTACT_LEAD_STATUS_UID =
  '7391294e-9309-4c98-9f15-ecee8c926f9b';
export const HS_CONTACT_HUBSPOT_ID_UID =
  '3bb6ad6c-7ffe-4293-992d-e4e21edb000d';

// Views
export const HS_COMPANIES_VIEW_UID = '026df5ac-38a6-415b-bde0-bf3f7d82f003';
export const HS_CONTACTS_VIEW_UID = '282f6a01-6073-4b77-a69f-45588d1e3b12';
export const HS_DEALS_BOARD_VIEW_UID = '676891dc-bbbb-4be4-99dc-84dceaa7a536';
export const HS_DEALS_TABLE_VIEW_UID = '528193c9-2b61-48a3-a0c8-901601ac7197';

// Navigation menu items
export const HS_COMPANIES_NAV_UID = 'dfd8884d-a24f-4d8e-b6bb-3c3515b1e912';
export const HS_CONTACTS_NAV_UID = '363e552e-14e1-4519-9369-811d7f5e70a3';
export const HS_DEALS_NAV_UID = '8589e2f4-c430-494d-90d8-b8f476279b37';

// Deal extra fields (from actual HubSpot Partner pipeline schema)
export const DEAL_NEXT_STEP_FIELD_UID = 'fea9a95c-ac0d-438b-acb0-6b4acc2f907a';
export const DEAL_PRIORITY_FIELD_UID = 'd18d4e38-b6d3-4d0a-acd7-d1adee90e647';
export const DEAL_SCORE_FIELD_UID = 'ce2bb2d2-8330-49fe-8205-4da6ca531b3a';

// Company extra fields
export const HS_COMPANY_INVOICE_FINANCING_UID =
  'f7f5a6d6-fc5a-424b-9580-e849f153a280';

// Company fields — location & identity
export const HS_COMPANY_PHONE_UID = '8e19ef7f-6c85-4857-ad61-4704e01ac317';
export const HS_COMPANY_CITY_UID = 'e2a03a28-cbd4-4169-abce-748a7461db11';
export const HS_COMPANY_COUNTRY_UID = 'd59921e1-f658-439b-ac7e-dc98c1b858d0';
export const HS_COMPANY_STATE_UID = '30a0e061-08d9-4933-929d-ab09b3d43723';
export const HS_COMPANY_ZIP_UID = '4b86507a-8fff-49c1-bdc4-37d275c64072';
export const HS_COMPANY_STREET_ADDRESS_UID = 'ef448fbb-5363-4c11-a2c2-8d61a6bc3131';
export const HS_COMPANY_DESCRIPTION_UID = 'ef7be6e5-6325-4c99-926d-24324a8c4435';
export const HS_COMPANY_FOUNDED_UID = '8aac3617-a8e2-4e84-a10f-b8d139324c18';
export const HS_COMPANY_ICP_TIER_UID = 'c7c5b764-d695-4520-8983-befbe9686321';
export const HS_COMPANY_IS_TARGET_UID = '7c1e0213-1d66-4d4c-b4a2-7338a4558666';
export const HS_COMPANY_LEAD_STATUS_UID = '43786bd6-1750-4bc5-ab68-7ba69a8a4ce1';
export const HS_COMPANY_CSM_SENTIMENT_UID = '4a5d646f-24d9-4810-9601-a2a3c6c6fa9a';
export const HS_COMPANY_TYPE_UID = '30e841e5-ef14-4099-8880-8204326bbb33';

// Contact fields — additional
export const HS_CONTACT_MOBILE_UID = 'e29584b4-3c39-4c05-b81a-2684af838797';
export const HS_CONTACT_CITY_UID = '4d422c24-57cb-4753-8932-2ecb32b07c9d';
export const HS_CONTACT_COUNTRY_UID = '58cd77b3-2af9-4a9e-a41f-04a47aec6758';
export const HS_CONTACT_STATE_UID = '5f00eb2c-438b-42ce-8d3c-112117095555';
export const HS_CONTACT_BUYING_ROLE_UID = 'b44dbed7-9f56-432a-b85e-97c195ca4879';
export const HS_CONTACT_SENIORITY_UID = 'e659480b-6af5-4723-9da7-922fe6f4256f';

// Deal fields — additional
export const DEAL_CLOSED_LOST_REASON_UID = '4b2142df-3206-47ab-8631-1fdd129e1868';
export const DEAL_CLOSED_WON_REASON_UID = 'a4949e6e-7f58-45e5-b8e4-3eb914cdce2b';
export const DEAL_PROBABILITY_UID = 'd98487f4-a639-41f6-b11c-11fd477aa753';
export const DEAL_PARTNER_TECH_WIN_UID = 'd5f0f1a2-841c-4122-9ba9-cfb4b38f222a';
export const DEAL_NEXT_MEETING_NAME_UID = 'd87d66f1-9c5e-42f4-8402-7eddfacce853';
export const DEAL_ARR_UID = '12074257-7570-488a-b8f9-0f792e244963';
export const DEAL_MRR_UID = '55227bed-c114-4f51-9aed-4dde9ba82d56';

// Task custom fields
export const HS_TASK_HUBSPOT_ID_UID = '2cf4b1a9-8e53-4d7a-b6f2-1a9c3e5d7f8b';
export const HS_TASK_TYPE_UID = '7b3e2d1c-9f4a-4e6b-8c5d-2a1b3c4d5e6f';

// ZoomInfo on-demand enrich (button)
export const ENRICH_COMPANY_ON_DEMAND_UID = '919950ee-002f-4bf7-b510-108756832b4b';
export const ENRICH_BUTTON_COMPONENT_UID = '5103ee49-fb3d-430d-b062-014ce1b4ae65';
export const COMPANY_PAGE_LAYOUT_UID = 'dddf7bfc-e7da-46ac-91f3-cd4f28a08496';
export const COMPANY_PAGE_LAYOUT_TAB_UID = 'dbffc631-a2a6-4776-acb5-f28f4b853b5c';
export const COMPANY_PAGE_LAYOUT_FIELDS_WIDGET_UID = '60e41e1b-78a9-42a9-af0f-098e82e21856';
export const COMPANY_PAGE_LAYOUT_ENRICH_WIDGET_UID = '8db084a6-4f37-43e3-9155-202ba91c9f65';

// ZoomInfo logic functions
export const ZOOMINFO_ENRICH_COMPANY_UID =
  'ef469ff6-052d-4283-9075-326f817ecacf';
export const ZOOMINFO_ENRICH_CONTACT_UID =
  '6caf099d-b507-4948-980d-74aa17c46832';
export const ZOOMINFO_INTENT_SCANNER_UID =
  '7635d3af-0dad-439b-b08d-6923bbc22660';
export const ZOOMINFO_NEWS_DIGEST_UID =
  'c280cc62-b2c1-4795-9ab4-b1c35116edf1';
