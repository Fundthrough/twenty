import { useCallback, useEffect, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useRecordId } from 'twenty-sdk/front-component';

import { ENRICH_BUTTON_COMPONENT_UID } from 'src/constants/universal-identifiers';

type EnrichResult = {
  success: boolean;
  matchStatus?: string;
  fieldsUpdated?: string[];
  values?: Record<string, unknown>;
  error?: string;
  message?: string;
};

type CompanyData = {
  hsIndustry: string | null;
  hsNumberOfEmployees: number | null;
  hsCity: string | null;
  hsCountry: string | null;
  domainName: { primaryLinkUrl: string } | null;
};

const TEAL = '#2D7F7B';
const TEAL_LIGHT = '#E8F4F3';
const GRAY = '#6B7B8D';
const BORDER = '#E5E7EB';
const BG = '#FAFAFA';

const Badge = ({ children, color }: { children: string; color: string }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
    fontSize: '11px', fontWeight: 600, background: color + '22', color,
  }}>
    {children}
  </span>
);

const ZoomInfoEnrichButton = () => {
  const recordId = useRecordId();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);

  const fetchCompany = useCallback(async () => {
    if (!recordId) return;
    const client = new CoreApiClient();
    const r = await client.query({
      company: {
        __args: { id: recordId },
        hsIndustry: true,
        hsNumberOfEmployees: true,
        hsCity: true,
        hsCountry: true,
        domainName: true,
      },
    });
    setCompany(r.company as CompanyData);
  }, [recordId]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  const handleEnrich = async () => {
    if (!recordId) return;
    setLoading(true);
    setResult(null);
    try {
      const apiUrl = process.env.TWENTY_API_URL ?? '';
      const token = process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY ?? '';
      const res = await fetch(`${apiUrl}/s/zoominfo/enrich-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId: recordId }),
      });
      const data = await res.json() as EnrichResult & { messages?: string[]; code?: string };
      // Handle HTTP-level errors (500s from logic function execution)
      if (!res.ok || data.code === 'LOGIC_FUNCTION_EXECUTION_ERROR') {
        const msg = data.messages?.[0] ?? data.error ?? `HTTP ${res.status}`;
        setResult({ success: false, error: msg });
      } else {
        setResult(data);
        if (data.success) await fetchCompany();
      }
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
    setLoading(false);
  };

  const hasData = company?.hsIndustry || company?.hsNumberOfEmployees;

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', fontSize: '13px' }}>

      {/* Current enrichment status */}
      <div style={{ marginBottom: '16px', padding: '12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Current ZoomInfo Data
        </div>
        {company?.hsIndustry && (
          <div style={{ marginBottom: '4px', color: '#374151' }}>
            <span style={{ color: GRAY, marginRight: '6px' }}>Industry:</span>
            <Badge color={TEAL}>{company.hsIndustry.replace(/_/g, ' ')}</Badge>
          </div>
        )}
        {company?.hsNumberOfEmployees && (
          <div style={{ marginBottom: '4px', color: '#374151' }}>
            <span style={{ color: GRAY, marginRight: '6px' }}>Employees:</span>
            {company.hsNumberOfEmployees.toLocaleString()}
          </div>
        )}
        {company?.hsCity && (
          <div style={{ marginBottom: '4px', color: '#374151' }}>
            <span style={{ color: GRAY, marginRight: '6px' }}>Location:</span>
            {[company.hsCity, company.hsCountry].filter(Boolean).join(', ')}
          </div>
        )}
        {!hasData && (
          <div style={{ color: GRAY, fontStyle: 'italic' }}>Not yet enriched</div>
        )}
      </div>

      {/* Domain info */}
      {company?.domainName?.primaryLinkUrl && (
        <div style={{ marginBottom: '12px', fontSize: '12px', color: GRAY }}>
          Will match on: <strong style={{ color: '#374151' }}>{company.domainName.primaryLinkUrl.replace(/^https?:\/\//, '')}</strong>
        </div>
      )}

      {/* Enrich button */}
      <button
        onClick={handleEnrich}
        disabled={loading}
        style={{
          width: '100%', padding: '10px 16px', border: 'none',
          borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? TEAL + '88' : TEAL, color: '#fff',
          fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        {loading ? (
          <>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            Enriching...
          </>
        ) : (
          <>⚡ {hasData ? 'Re-enrich with ZoomInfo' : 'Enrich with ZoomInfo'}</>
        )}
      </button>

      {/* Result */}
      {result && (
        <div style={{
          marginTop: '12px', padding: '10px 12px', borderRadius: '6px',
          background: result.success ? TEAL_LIGHT : '#FEF2F2',
          border: `1px solid ${result.success ? TEAL + '44' : '#FCA5A5'}`,
        }}>
          {result.success ? (
            <>
              <div style={{ color: '#166534', fontWeight: 600, marginBottom: '4px' }}>
                ✓ Enriched ({result.matchStatus})
              </div>
              {result.fieldsUpdated && result.fieldsUpdated.length > 0 ? (
                <div style={{ color: '#374151', fontSize: '12px' }}>
                  Updated: {result.fieldsUpdated.join(', ')}
                </div>
              ) : (
                <div style={{ color: GRAY, fontSize: '12px' }}>{result.message ?? 'Fields already up to date'}</div>
              )}
            </>
          ) : (
            <div style={{ color: '#991B1B', fontSize: '12px' }}>
              ✗ {result.error ?? 'Enrichment failed'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: ENRICH_BUTTON_COMPONENT_UID,
  name: 'zoominfo-enrich-button',
  description: 'On-demand ZoomInfo enrichment button for Company records.',
  component: ZoomInfoEnrichButton,
});
