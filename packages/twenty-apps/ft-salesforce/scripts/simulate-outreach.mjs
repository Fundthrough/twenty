// HMAC-signed synthetic Outreach events → the live outreach-webhook receiver (EE-5069).
// Validates the delivery chain (signature → dispatch → process-outreach-event) without
// waiting for real Outreach traffic. Safe under OUTREACH_LOG_ONLY=1 (no writes).
// Usage: node scripts/simulate-outreach.mjs [eventName]   (default prospect.updated)
//        node scripts/simulate-outreach.mjs --bad-signature   (must be rejected)
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOOK_URL = 'https://fundthrough-sales.twenty.com/webhooks/server/c77f6ccf-c9c0-42b2-8875-970643187fab';
const REGISTRATION_ID = '0cdeaad6-03e8-456d-ae94-f372b9b2439e';

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const claim = JSON.parse(Buffer.from(cfg.apiKey.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') { console.error('not sales — abort'); process.exit(1); }

// canonical secret lives in the local 600-file maintained by setup-outreach.mjs
const ENV = process.env.OUTREACH_ENV === 'prod' ? 'prod' : 'dev';
const secret = readFileSync(join(homedir(), `.outreach-webhook-secret-${ENV}`), 'utf8').trim();

const badSignature = process.argv.includes('--bad-signature');
const eventName = process.argv.slice(2).find((a) => a.includes('.') && !a.startsWith('-')) ?? 'prospect.updated';
const [resource] = eventName.split('.');

const body = JSON.stringify({
  data: {
    type: resource,
    id: 999001,
    attributes: { updatedAt: new Date().toISOString(), direction: 'outbound', action: 'Simulator test task' },
    relationships: { prospect: { data: { type: 'prospect', id: 999001 } } },
  },
  meta: { eventName, deliveredAt: new Date().toISOString() },
});
const signature = createHmac('sha256', badSignature ? 'wrong-secret' : secret).update(body).digest('hex');

const res = await fetch(HOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Outreach-Webhook-Signature': signature },
  body,
});
console.log(`${eventName}${badSignature ? ' (bad signature)' : ''} → HTTP ${res.status}`);
console.log((await res.text()).slice(0, 300));
