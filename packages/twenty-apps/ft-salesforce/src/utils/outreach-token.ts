import { MetadataApiClient } from 'twenty-client-sdk/metadata';

// Outreach access tokens live two hours and refresh tokens rotate on every use, so the token
// has to be refreshed from inside the workspace: a laptop cron misses every window the machine
// sleeps through, which is exactly how the sync died overnight.
//
// The registration holds OUTREACH_CLIENT_ID, OUTREACH_CLIENT_SECRET and OUTREACH_REFRESH_TOKEN.
// After each refresh both the access token and the rotated refresh token are written back, so
// the next run starts from the current pair.

const REGISTRATION_ID = '0cdeaad6-03e8-456d-ae94-f372b9b2439e';

type VariableRow = { id: string; key: string };

// Access tokens last 7200s. Refreshing at 90 minutes keeps a valid token in the app variables at
// all times, so the cron is normally the only thing that ever refreshes and the button just finds
// a working token. That matters because the refresh token rotates on every use: if the cron and a
// button press both refresh at once, one of them ends up holding a consumed token and the chain
// breaks, which is the manual re-authorisation we are trying to eliminate.
const PROACTIVE_REFRESH_AFTER_MS = 90 * 60 * 1000;

export const isOutreachTokenStale = (): boolean => {
  const refreshedAt = process.env.OUTREACH_TOKEN_REFRESHED_AT;
  if (!refreshedAt) return true; // never stamped: treat as stale so the first run takes ownership
  const age = Date.now() - Date.parse(refreshedAt);
  return Number.isNaN(age) || age > PROACTIVE_REFRESH_AFTER_MS;
};

export const refreshOutreachToken = async (): Promise<string | undefined> => {
  const clientId = process.env.OUTREACH_CLIENT_ID;
  const clientSecret = process.env.OUTREACH_CLIENT_SECRET;
  const refreshToken = process.env.OUTREACH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    console.log('outreach-token: client id, secret or refresh token missing from app variables');
    return undefined;
  }

  const res = await fetch('https://api.outreach.io/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    console.log(`outreach-token: refresh failed with ${res.status}, re-consent needed`);
    return undefined;
  }
  const tokens = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!tokens.access_token) return undefined;

  const metadata = new MetadataApiClient();
  const existing = await metadata.query({
    findApplicationRegistrationVariables: {
      __args: { applicationRegistrationId: REGISTRATION_ID },
      id: true,
      key: true,
    },
  }) as { findApplicationRegistrationVariables?: VariableRow[] };
  const byKey = Object.fromEntries((existing.findApplicationRegistrationVariables ?? []).map((v) => [v.key, v.id]));

  const persist = async (key: string, value: string) => {
    const id = byKey[key];
    if (!id) return;
    await metadata.mutation({
      updateApplicationRegistrationVariable: { __args: { input: { id, update: { value } } }, id: true },
    });
  };

  await persist('OUTREACH_ACCESS_TOKEN', tokens.access_token);
  if (tokens.refresh_token) await persist('OUTREACH_REFRESH_TOKEN', tokens.refresh_token);
  // stamped so the cron can refresh on age rather than waiting for a 401
  await persist('OUTREACH_TOKEN_REFRESHED_AT', new Date().toISOString());

  console.log('outreach-token: refreshed in-workspace');
  return tokens.access_token;
};
