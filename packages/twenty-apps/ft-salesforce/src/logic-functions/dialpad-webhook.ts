import { createHmac, timingSafeEqual } from 'crypto';
import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';
import { DIALPAD_EVENTS_FUNCTION_UID, PROCESS_DIALPAD_EVENT_UID } from 'src/constants/universal-identifiers';

// Server webhook route for Dialpad call events — served at
//   https://<host>/webhooks/server/8b0356ab-189c-4012-b5d6-b3208ecdc28a
// Runs OUTSIDE workspace context (call-recorder recall-webhook pattern): verify the
// signature on the raw body, resolve the target workspace, and dispatch the decoded
// payload to process-dialpad-event. A thrown error → non-2xx → Dialpad retries.
//
// Dialpad delivers each event as a JWT (HS256) signed with the secret set at
// subscription creation (scripts/setup-dialpad.mjs) — the raw body IS the token.

type ServerRouteResolverResult = {
  workspaceId: string;
  targetLogicFunctionUniversalIdentifier: string;
  payload?: object;
};

const base64UrlDecode = (segment: string) =>
  Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

const verifyDialpadJwt = (token: string, secret: string): object => {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('Webhook body is not a JWT (expected 3 segments)');
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  const header = JSON.parse(base64UrlDecode(headerSegment)) as { alg?: string };
  if (header.alg !== 'HS256') throw new Error(`Unsupported JWT alg: ${header.alg}`);

  const expected = createHmac('sha256', secret)
    .update(`${headerSegment}.${payloadSegment}`)
    .digest('base64url');
  const providedBuffer = Buffer.from(signatureSegment);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid webhook signature');
  }

  return JSON.parse(base64UrlDecode(payloadSegment)) as object;
};

// Two accepted delivery modes (verified against real Dialpad deliveries 2026-07-20):
// A. JWT (webhook created WITH a secret) — Dialpad posts the signed token with
//    Content-Type: application/jwt, which Twenty's server does NOT body-parse today
//    (main.ts only parses json/urlencoded/text-plain), so this path only works once
//    upstream accepts application/jwt as text. Kept as the preferred future mode.
// B. JSON (webhook created WITHOUT a secret) — Dialpad posts plain JSON, which parses
//    fine; authentication is a random token in the webhook URL's ?token= query param,
//    compared constant-time against DIALPAD_URL_TOKEN.
const handler = (route: RoutePayload<unknown>): ServerRouteResolverResult => {
  // single-workspace app: the Dialpad subscription only ever targets the sales workspace;
  // kept as a variable so local/simulator installs fail loudly instead of cross-dispatching
  const workspaceId = process.env.DIALPAD_WORKSPACE_ID;
  if (!workspaceId) {
    throw new Error('DIALPAD_WORKSPACE_ID server variable is not set on the application registration');
  }

  const bodyRecord = route.body as Record<string, unknown> | string | undefined;
  const rawBody = route.rawBody
    ?? (typeof bodyRecord === 'string' ? bodyRecord : undefined)
    ?? (bodyRecord && typeof bodyRecord === 'object' && typeof bodyRecord.raw === 'string' ? bodyRecord.raw : undefined);

  // ---- mode A: signed JWT ----
  if (rawBody && rawBody.trim().split('.').length === 3) {
    const secret = process.env.DIALPAD_WEBHOOK_SECRET;
    if (!secret) throw new Error('JWT delivery received but DIALPAD_WEBHOOK_SECRET is not set');
    return {
      workspaceId,
      targetLogicFunctionUniversalIdentifier: PROCESS_DIALPAD_EVENT_UID,
      payload: verifyDialpadJwt(rawBody, secret),
    };
  }

  // ---- mode B: plain JSON + URL token ----
  if (bodyRecord && typeof bodyRecord === 'object' && !('raw' in bodyRecord)) {
    const expectedToken = process.env.DIALPAD_URL_TOKEN;
    if (!expectedToken) throw new Error('JSON delivery received but DIALPAD_URL_TOKEN is not set');
    const providedToken = route.queryStringParameters?.token ?? '';
    const provided = Buffer.from(String(providedToken));
    const expected = Buffer.from(expectedToken);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new Error('Invalid webhook URL token');
    }
    return {
      workspaceId,
      targetLogicFunctionUniversalIdentifier: PROCESS_DIALPAD_EVENT_UID,
      payload: bodyRecord,
    };
  }

  const contentType = route.headers?.['content-type'] ?? 'unknown';
  const bodyShape = bodyRecord && typeof bodyRecord === 'object' ? `object keys: ${Object.keys(bodyRecord).join(',')}` : typeof bodyRecord;
  throw new Error(`Unsupported delivery (content-type: ${contentType}; body: ${bodyShape}) — expected a JWT or JSON event`);
};

export default defineLogicFunction({
  universalIdentifier: DIALPAD_EVENTS_FUNCTION_UID,
  name: 'dialpad-webhook',
  description: 'Verifies Dialpad webhook JWT signatures and dispatches call events to process-dialpad-event.',
  timeoutSeconds: 30,
  handler,
  serverRouteTriggerSettings: {
    forwardedRequestHeaders: ['content-type'],
  },
});
