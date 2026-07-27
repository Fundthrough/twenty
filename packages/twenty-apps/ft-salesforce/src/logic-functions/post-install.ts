import { definePostInstallLogicFunction } from 'twenty-sdk/define';
import { POST_INSTALL_UID } from 'src/constants/universal-identifiers';

export default definePostInstallLogicFunction({
  universalIdentifier: POST_INSTALL_UID,
  name: 'post-install',
  description: 'Adds the Company Profile (Flow) tab to the Default Company Layout.',
  timeoutSeconds: 30,
  handler: async () => {
    try {
      const serverUrl = process.env.TWENTY_API_URL;
      const token = process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;
      const gql = async (query: string, variables?: Record<string, unknown>) => {
        const res = await fetch(serverUrl + '/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ query, variables }),
        });
        return (await res.json()) as { data?: any; errors?: any };
      };

      const regs = await gql('{ frontComponents { id name } }');
      const fc = regs.data?.frontComponents?.find((c: any) => c.name === 'flow-company-profile');
      if (!fc) { console.warn('front component not found'); return; }

      const layouts = await gql('{ getPageLayouts { id name tabs { id title } } }');
      const layout = layouts.data?.getPageLayouts?.find((l: any) => l.name === 'Default Company Layout');
      if (!layout) { console.warn('default company layout not found'); return; }
      if (layout.tabs?.some((t: any) => t.title === 'Company Profile')) return; // idempotent

      const tab = await gql(
        'mutation CreateTab($input: CreatePageLayoutTabInput!) { createPageLayoutTab(input: $input) { id } }',
        { input: { pageLayoutId: layout.id, title: 'Company Profile', position: 90, layoutMode: 'VERTICAL_LIST' } },
      );
      const tabId = tab.data?.createPageLayoutTab?.id;
      if (!tabId) { console.warn('tab create failed', JSON.stringify(tab.errors)); return; }

      await gql(
        'mutation CreateWidget($input: CreatePageLayoutWidgetInput!) { createPageLayoutWidget(input: $input) { id } }',
        { input: {
            pageLayoutTabId: tabId,
            title: 'Flow Company Profile',
            type: 'FRONT_COMPONENT',
            gridPosition: { row: 0, column: 0, rowSpan: 8, columnSpan: 12 },
            configuration: { configurationType: 'FRONT_COMPONENT', frontComponentId: fc.id },
        } },
      );
    } catch (e) {
      console.warn('post-install skipped:', e);
    }
  },
});
