// The bridge page served at /s/flow-bridge (see flow-bridge.ts for the architecture).
// Adapted from Frans's working local version 2026-07-20; changes: our embed tab set,
// search-mode fallback when the record has no companyId (pre-production clients).
export const buildFlowBridgeHtml = (): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FundThrough company profile</title>
    <style>
      html, body { margin: 0; width: 100%; height: 100%; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111; }
      #status { padding: 12px 16px; font-size: 13px; color: #555; }
      #status[data-error="true"] { color: #b42318; }
    </style>
  </head>
  <body>
    <div id="status">Resolving company…</div>
    <script>
      (function () {
        var EMBED_BASE = 'https://flow.fundthrough.com/embed'
          + '?dashboardId=company_profile'
          + '&instanceId=twenty-company-profile'
          + '&showHeader=true'
          + '&showTitle=false'
          + '&enabledTabs=' + encodeURIComponent('Profile,Snapshot,Cash Events,Customers,Invoices,Risk,Pipefy Cards,Flow Cases,Salesforce');

        var statusEl = document.getElementById('status');
        var setStatus = function (message, isError) {
          if (!statusEl) return;
          statusEl.textContent = message;
          statusEl.setAttribute('data-error', isError ? 'true' : 'false');
        };

        var getRecordId = function () {
          var params = new URLSearchParams(window.location.search);
          var fromQuery = params.get('recordId');
          if (fromQuery) return fromQuery;
          try {
            // legal because this page is served from Twenty's own origin
            var path = window.parent.location.pathname || '';
            var parts = path.split('/');
            var companyIndex = parts.indexOf('company');
            if (companyIndex === -1 || !parts[companyIndex + 1]) return null;
            return parts[companyIndex + 1];
          } catch (error) {
            console.error('[flow-bridge] cannot read parent location', error);
            return null;
          }
        };

        var goSearchMode = function (reason) {
          setStatus(reason + ' Opening search…');
          window.location.replace(EMBED_BASE + '&allowSearch=true');
        };

        var resolveCompanyId = async function (recordId) {
          var resolveUrl = new URL(window.location.href);
          var basePath = resolveUrl.pathname.endsWith('/') ? resolveUrl.pathname.slice(0, -1) : resolveUrl.pathname;
          resolveUrl.pathname = basePath + '/resolve';
          resolveUrl.search = '';
          resolveUrl.searchParams.set('recordId', recordId);
          var response = await fetch(resolveUrl.toString(), { method: 'GET', credentials: 'same-origin' });
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok || payload == null || payload.companyId == null) {
            return null; // not productionized / not found — search mode instead
          }
          return payload.companyId;
        };

        var run = async function () {
          var recordId = getRecordId();
          if (!recordId) return goSearchMode('Could not read the company record id.');
          setStatus('Fetching company id…');
          var companyId = await resolveCompanyId(recordId);
          if (companyId == null) return goSearchMode('No FT company id on this record (not productionized yet).');
          setStatus('Opening FundThrough profile…');
          // Navigate this iframe to Flow's origin so the Google session survives
          // Twenty destroying/recreating the widget iframe on tab switches.
          window.location.replace(EMBED_BASE + '&allowSearch=false&companyId=' + encodeURIComponent(String(companyId)));
        };

        run().catch(function (error) {
          console.error('[flow-bridge]', error);
          goSearchMode('Could not resolve this company.');
        });
      })();
    </script>
  </body>
</html>
`;
