import { defineLogicFunction } from 'twenty-sdk/define';
import { OUTREACH_SYNC_UID } from 'src/constants/universal-identifiers';

// Polling transport for Outreach → Twenty (EE-5069). Webhook deliveries are currently
// unusable: Outreach POSTs application/vnd.api+json, which Twenty's server does not
// body-parse, so signatures can't be verified (Outreach never retries). Until upstream
// accepts +json types, this cron pulls recently-updated resources on a sliding lookback
// window (overlap-safe: downstream mapping is upsert/latest-wins, so no watermark state).
//
// OUTREACH_LOG_ONLY (default '1'): report counts + samples only. The write mapping is
// shared with process-outreach-event and turns on together with it.

const API = 'https://api.outreach.io/api/v2';
const LOOKBACK_MINUTES = 20; // cron runs every 5 min → 4x overlap

const RESOURCES: Array<{ path: string; label: string; sort: string }> = [
  { path: '/mailings', label: 'mailings', sort: '-updatedAt' },
  { path: '/sequenceStates', label: 'sequenceStates', sort: '-updatedAt' },
  { path: '/calls', label: 'calls', sort: '-updatedAt' },
  { path: '/tasks', label: 'tasks', sort: '-updatedAt' },
  { path: '/prospects', label: 'prospects', sort: '-updatedAt' },
];

const handler = async () => {
  const token = process.env.OUTREACH_ACCESS_TOKEN;
  if (!token) { console.log('outreach-sync: OUTREACH_ACCESS_TOKEN not set — skipping'); return { skipped: 'no token' }; }

  const sinceIso = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000).toISOString();
  const summary: Record<string, number> = {};

  for (const r of RESOURCES) {
    const url = `${API}${r.path}?filter[updatedAt]=${encodeURIComponent(sinceIso + '..inf')}&sort=${r.sort}&page[limit]=50`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { console.log('outreach-sync: token expired — refresh cadence needed'); return { error: 'token expired' }; }
    if (!res.ok) { console.log(`outreach-sync: ${r.label} → ${res.status}`); summary[r.label] = -1; continue; }
    const json = (await res.json()) as { data?: Array<{ id: number; type: string; attributes?: Record<string, unknown>; relationships?: Record<string, unknown> }> };
    const rows = json.data ?? [];
    summary[r.label] = rows.length;
    if (rows.length > 0) {
      console.log(`outreach-sync sample ${r.label}:`, JSON.stringify(rows[0]).slice(0, 700));
    }
  }

  console.log(`outreach-sync window ${LOOKBACK_MINUTES}m:`, JSON.stringify(summary));
  const logOnly = (process.env.OUTREACH_LOG_ONLY ?? '1') !== '0';
  if (logOnly) return { logOnly: true, summary };

  // write path lands with the shared mapping module (next increment)
  return { summary };
};

export default defineLogicFunction({
  universalIdentifier: OUTREACH_SYNC_UID,
  name: 'outreach-sync',
  description: 'Cron pull of recent Outreach activity (polling transport while webhook content-type is unsupported upstream).',
  timeoutSeconds: 60,
  handler,
  cronTriggerSettings: {
    pattern: '*/5 * * * *',
  },
});
