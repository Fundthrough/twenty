import { definePostInstallLogicFunction } from 'twenty-sdk/define';
import { type InstallPayload } from 'twenty-sdk/logic-function';

// This post-install hook adds the ZoomInfo enrichment tab to the Default Company Layout.
// The SDK's definePageLayout creates a separate layout — we must add to the default
// layout programmatically to make the tab visible on company records.

const ZOOMINFO_ENRICH_BUTTON_COMPONENT_NAME = 'zoominfo-enrich-button';
const ZOOMINFO_TAB_TITLE = 'ZoomInfo';
const ZOOMINFO_TAB_POSITION = 99;

const handler = async (payload: InstallPayload): Promise<void> => {
  console.log('Post-install running. Previous version:', payload.previousVersion);

  try {
    const serverUrl = process.env.TWENTY_API_URL ?? '';
    const token = process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY ?? '';

    const meta = async (query: string, variables: object = {}) => {
      const res = await fetch(`${serverUrl}/metadata`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
      if (json.errors?.length) throw new Error(json.errors[0].message);
      return json.data ?? {};
    };

    // 1. Find the front component ID
    const fcData = await meta('{ findManyApplicationRegistrations { frontComponents { id name } } }') as {
      findManyApplicationRegistrations?: Array<{ frontComponents?: Array<{ id: string; name: string }> }>;
    };
    const allComponents = fcData.findManyApplicationRegistrations?.flatMap(a => a.frontComponents ?? []) ?? [];
    const fc = allComponents.find(c => c.name === ZOOMINFO_ENRICH_BUTTON_COMPONENT_NAME);
    if (!fc) {
      console.warn('ZoomInfo front component not found — skipping tab setup');
      return;
    }

    // 2. Find the Default Company Layout
    const layoutsData = await meta('{ getPageLayouts { id name tabs { id title } } }') as {
      getPageLayouts?: Array<{ id: string; name: string; tabs?: Array<{ id: string; title: string }> }>;
    };
    const defaultLayout = layoutsData.getPageLayouts?.find(l => l.name === 'Default Company Layout');
    if (!defaultLayout) {
      console.warn('Default Company Layout not found — skipping tab setup');
      return;
    }

    // 3. Check if ZoomInfo tab already exists
    const existingTab = defaultLayout.tabs?.find(t => t.title === ZOOMINFO_TAB_TITLE);
    if (existingTab) {
      console.log('ZoomInfo tab already exists on Default Company Layout');
      return;
    }

    // 4. Create the ZoomInfo tab
    const tabData = await meta(
      'mutation CreateTab($input: CreatePageLayoutTabInput!) { createPageLayoutTab(input: $input) { id } }',
      { input: { pageLayoutId: defaultLayout.id, title: ZOOMINFO_TAB_TITLE, position: ZOOMINFO_TAB_POSITION, layoutMode: 'VERTICAL_LIST' } }
    ) as { createPageLayoutTab?: { id: string } };
    const tabId = tabData.createPageLayoutTab?.id;
    if (!tabId) throw new Error('Failed to create ZoomInfo tab');

    // 5. Add the enrich button widget
    await meta(
      'mutation CreateWidget($input: CreatePageLayoutWidgetInput!) { createPageLayoutWidget(input: $input) { id } }',
      {
        input: {
          pageLayoutTabId: tabId,
          title: 'Enrich with ZoomInfo',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
          configuration: { configurationType: 'FRONT_COMPONENT', frontComponentId: fc.id },
        },
      }
    );

    console.log('ZoomInfo tab added to Default Company Layout ✓');
  } catch (err) {
    console.error('Post-install failed to add ZoomInfo tab:', err instanceof Error ? err.message : String(err));
  }
};

export default definePostInstallLogicFunction({
  universalIdentifier: '78a0a9a6-9eba-4c7b-a678-78d2e50be5fb',
  name: 'post-install',
  description: 'Adds ZoomInfo enrichment tab to Default Company Layout after install.',
  timeoutSeconds: 30,
  handler,
});
