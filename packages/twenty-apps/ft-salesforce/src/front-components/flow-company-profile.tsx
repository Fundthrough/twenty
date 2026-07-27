import { useEffect, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useRecordId } from 'twenty-sdk/front-component';
import { FLOW_COMPANY_PROFILE_COMPONENT_UID } from 'src/constants/universal-identifiers';

// Record-level validation banner for the Company Profile tab. The Flow dashboard renders
// in the native IFRAME widget below, pointed at Flow's /embed route (URL-param driven:
// ?dashboardId&companyId&enabledTabs…). Users authenticate by their Flow browser session
// (the IFRAME widget keeps allow-same-origin). This component only warns when the record's
// Company Id is missing/invalid — it does NOT talk to any relay/localhost (that approach is
// retired; Chrome blocks public→loopback fetches).
//
// Per-record auto-preselect still needs Twenty to inject the record's companyId into the
// widget URL (tested: `{{record.companyId}}` renders literally). Flow's /embed already
// accepts ?companyId=, so the day Twenty supports URL variables it's a one-line change.
const FlowCompanyProfile = () => {
  const recordId = useRecordId();
  const [status, setStatus] = useState<{ kind: 'ok' | 'loading' | 'warning' | 'error'; text?: string }>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const client = new CoreApiClient();
        // singular record queries take a filter arg, not id
        const result = await client.query({
          company: { __args: { filter: { id: { eq: recordId } } }, id: true, companyId: true },
        }) as { company?: { companyId?: string | null } };
        if (cancelled) return;

        const raw = result?.company?.companyId;
        if (raw === null || raw === undefined || String(raw).trim() === '') {
          setStatus({
            kind: 'warning',
            text: 'No FT company id on this record — this client is not productionized yet, so it will not appear in the Flow profile below. Set the Company Id field (PRO company id) once the client is in production.',
          });
          return;
        }
        if (!/^\d+$/.test(String(raw).trim())) {
          setStatus({
            kind: 'error',
            text: `Company Id "${raw}" is not a valid FT company id (expected a number). Fix the Company Id field on this record.`,
          });
          return;
        }
        if (!cancelled) setStatus({ kind: 'ok' });
      } catch (e) {
        if (cancelled) return;
        console.warn('[flow-company-profile]', e);
        setStatus({ kind: 'error', text: `Could not resolve the FT company id: ${e instanceof Error ? e.message : String(e)}` });
      }
    };
    run();
    return () => { cancelled = true; };
  }, [recordId]);

  return (
    <div style={{ width: '100%', minHeight: 24 }}>
      {(status.kind === 'warning' || status.kind === 'error') && (
        <div
          style={{
            margin: '4px 0',
            padding: '10px 14px',
            borderRadius: 6,
            fontSize: 13,
            border: status.kind === 'error' ? '1px solid #e5484d' : '1px solid #f5a623',
            color: status.kind === 'error' ? '#e5484d' : '#b8860b',
          }}
        >
          {status.text}
        </div>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: FLOW_COMPANY_PROFILE_COMPONENT_UID,
  name: 'flow-company-profile',
  description: 'Validates the record\'s FT company id (missing / non-numeric) above the embedded Flow dashboard.',
  component: FlowCompanyProfile,
});
