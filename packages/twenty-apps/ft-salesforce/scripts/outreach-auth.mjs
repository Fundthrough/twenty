// One-time Outreach OAuth authorization + token exchange (EE-5069 Phase 1).
// Listens on localhost:53682 for the consent redirect, exchanges the code, and saves
// tokens OUTSIDE the repo (~/.outreach-tokens-<env>.json, chmod 600). Outreach refresh
// tokens ROTATE on every refresh — always persist the newest pair via saveTokens().
//
// Usage:  source ~/.zshrc && node scripts/outreach-auth.mjs           # dev app
//         OUTREACH_ENV=prod node scripts/outreach-auth.mjs            # prod app
// Refresh (no browser): node scripts/outreach-auth.mjs --refresh
import { createServer } from 'node:https';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV = process.env.OUTREACH_ENV === 'prod' ? 'prod' : 'dev';
const CLIENT_ID = ENV === 'prod' ? process.env.PROD_OUTREACH_CLIENT_ID : process.env.DEV_OUTREACH_CLIENT_ID;
const CLIENT_SECRET = ENV === 'prod' ? process.env.PROD_OUTREACH_CLIENT_SECRET : process.env.DEV_OUTREACH_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(`Missing ${ENV.toUpperCase()}_OUTREACH_CLIENT_ID / _SECRET in env — run: source ~/.zshrc`);
  process.exit(1);
}

// Outreach's dev portal only accepts https callback URLs → local TLS with a throwaway
// self-signed cert (.twenty/tmp-cert/, minted for 3 days; browser shows one warning)
const REDIRECT_URI = 'https://localhost:53682/callback';
const CERT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.twenty', 'tmp-cert');
// webhooks.all is deliberately absent. Outreach posts webhooks as application/vnd.api+json,
// which Twenty does not body-parse, so the signature can never be verified and the deliveries are
// unusable -- the integration polls instead. Requesting a scope we cannot use also made the prod
// app reject the whole consent with "scope is invalid".
// Override with OUTREACH_SCOPES if an app is configured for a different set.
const SCOPES = (process.env.OUTREACH_SCOPES ?? [
  'prospects.read', 'prospects.write', 'accounts.read', 'accounts.write', 'mailings.read', 'sequences.read',
  'sequenceStates.read', 'calls.read', 'tasks.read', 'users.read',
].join(' '));
const TOKENS_PATH = join(homedir(), `.outreach-tokens-${ENV}.json`);

export const saveTokens = (tokens) => {
  writeFileSync(TOKENS_PATH, JSON.stringify({ ...tokens, savedAt: new Date().toISOString(), env: ENV }, null, 2));
  chmodSync(TOKENS_PATH, 0o600);
};

const tokenRequest = async (params) => {
  const res = await fetch('https://api.outreach.io/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, ...params }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`token endpoint ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
};

if (process.argv.includes('--refresh')) {
  // The workspace owns the rotation: outreach-sync refreshes on age and outreach-push on a 401,
  // both persisting the new pair to the app variables. Refreshing here as well consumes the
  // refresh token the workspace still holds, and its next refresh then fails -- which is the
  // manual re-authorisation this whole mechanism exists to avoid. Only use this to recover when
  // the workspace pair is already broken, and push the result back with
  // scripts/set-outreach-tokens.mjs immediately afterwards.
  if (!process.argv.includes('--i-know-this-competes-with-the-workspace')) {
    console.error('Refusing: the workspace rotates these tokens itself and this would consume its refresh token.');
    console.error('If the workspace pair is already dead, re-run with --i-know-this-competes-with-the-workspace');
    console.error('and then immediately push the new pair back into the app variables.');
    process.exit(1);
  }
  const stored = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: stored.refresh_token });
  saveTokens(fresh);
  console.log(`refreshed OK — access token expires in ${fresh.expires_in}s; new refresh token saved (${ENV})`);
  process.exit(0);
}

const authorizeUrl = 'https://api.outreach.io/oauth/authorize?' + new URLSearchParams({
  client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: SCOPES,
});

const server = createServer({
  key: readFileSync(join(CERT_DIR, 'localhost.key')),
  cert: readFileSync(join(CERT_DIR, 'localhost.crt')),
}, async (req, res) => {
  const url = new URL(req.url, 'http://localhost:53682');
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (err || !code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Authorization failed: ${err ?? 'no code'}`);
    console.error('authorization failed:', err ?? 'no code returned');
    server.close(() => process.exit(1));
    return;
  }
  try {
    const tokens = await tokenRequest({ grant_type: 'authorization_code', code });
    saveTokens(tokens);
    res.writeHead(200, { 'Content-Type': 'text/plain' })
      .end('Outreach authorization complete — you can close this tab.');
    console.log(`TOKENS SAVED (${ENV}) → ${TOKENS_PATH}`);
    console.log(`access token expires in ${tokens.expires_in}s; scopes: ${tokens.scope ?? SCOPES}`);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Token exchange failed — see terminal.');
    console.error('exchange failed:', e.message);
  }
  server.close(() => process.exit(0));
});

server.listen(53682, () => {
  console.log(`Listening on ${REDIRECT_URI} (${ENV} app)`);
  console.log('OPEN THIS URL AND CLICK AUTHORIZE:');
  console.log(authorizeUrl);
});
const TIMEOUT_MIN = Number(process.env.OUTREACH_AUTH_TIMEOUT_MIN ?? 15);
setTimeout(() => { console.error(`timed out after ${TIMEOUT_MIN} min without a callback`); process.exit(1); }, TIMEOUT_MIN * 60 * 1000);
