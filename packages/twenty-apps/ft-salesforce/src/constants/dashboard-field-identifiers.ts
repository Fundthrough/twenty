// Field identifiers the AM dashboard charts group and aggregate on. Resolved from the live
// workspace rather than hand-written: the app-defined ones come from our own field files, the
// 20202020-prefixed ones are Twenty standard fields, and the 5-digit-suffixed ones are
// workspace-generated. Grouped by object so a widget reads as one line.
//
// COUNT aggregations still need a field to count, so each object exposes its id.

export const DASHBOARD_PERSON = {
  object: '20202020-e674-48e5-a542-72570eee7213',
  id: '1e99e171-d0f9-50a8-b342-7f0bdd9bea66',
  owner: '3645d215-77ea-4393-8cb5-d42864b42323',
  lastActivityAt: '05487125-f1c8-4200-a536-ba06c0756ceb',
  lastActivityType: 'b621dc3a-13ba-4441-a81c-357dfe33febe',
  createdAt: '11e31107-be74-53e5-ba99-e536c6b73ee6',
  naicsSector: 'f39c8d52-4b71-4e06-8d1a-27b5904ce613',
  createdBy: '91b4c732-ea34-5593-b217-34d2120da23e',
} as const;

export const DASHBOARD_COMPANY = {
  object: '20202020-b374-4779-a561-80086cb2e17f',
  id: 'ca0547a7-a55a-51f7-b5d7-f3a03e266c39',
  accountOwner: '20202020-95b8-4e10-9881-edb5d4765f9d',
  naicsSector: 'b7e41a09-2d6c-4f18-9a53-06c8f7d21e44',
  accountManager: 'ae0c6b14-95d7-42f8-8c33-1b6d0e7a4f52',
  createdBy: '6046f5a2-f52b-5c41-95b3-134d95b2cc99',
  createdAt: 'd206d586-fd61-56e1-80a8-9993beb7be0b',
} as const;

export const DASHBOARD_CALL = {
  object: 'e063fedc-33d0-4023-8565-2b5b887b5ab2',
  id: '0f98747d-34ce-5055-936c-b821cbebf3b6',
  handledBy: 'bbce9ae3-19ec-4f91-9e6d-63171173a07f',
  outcome: '04139a1f-772d-487f-9516-dc47f2864505',
  direction: '8aa531da-380d-4874-98a2-c8eaac09c730',
  startedAt: 'a95ccc1e-352a-4f18-afe3-70f86539a39b',
  durationSeconds: '39f6cba5-4f3e-4f95-9c2f-2599ee47ff36',
} as const;

export const DASHBOARD_TASK = {
  object: '20202020-1ba1-48ba-bc83-ef7e5990ed10',
  id: 'd2d4ca07-f034-5c06-b86f-fbab125936b9',
  assignee: '20202020-065a-4f42-a906-e20422c1753f',
  status: '20202020-70bc-48f9-89c5-6aa730b151e0',
} as const;

export const DASHBOARD_MESSAGE_PARTICIPANT = {
  object: '20202020-a433-4456-aa2d-fd9cb26b774a',
  id: 'f1a22964-745b-5e1e-af62-f21cc78f9572',
  workspaceMember: '20202020-77a7-4845-99ed-1bcbb478be6f',
  role: '20202020-65d1-42f4-8729-c9ec1f52aecd',
} as const;

export const AM_DASHBOARD_UID = 'c8a2f731-5e40-4b6d-9a17-3f2e8d05c419';
export const AM_DASHBOARD_TAB_COVERAGE_UID = '1d7b4e92-83af-4c15-b60d-92a7e5c31f68';
export const AM_DASHBOARD_TAB_ACTIVITY_UID = '4f6c19d3-2b87-4e50-a3f9-71cd08b64e2a';
