import { definePageLayout, PageLayoutType } from 'twenty-sdk/define';
import { AM_DASHBOARD_UID } from 'src/constants/dashboard-field-identifiers';

// AM workload and activity. Design and the measurements behind each widget choice are in
// docs/AM-DASHBOARD-DESIGN.md.
//
// Two tabs split by lifecycle rather than by team, because Sales owns leads and Client Success
// owns accounts while both share the same call, email and task objects.
export default definePageLayout({
  universalIdentifier: AM_DASHBOARD_UID,
  name: 'AM Workload & Activity',
  type: PageLayoutType.DASHBOARD,
});
