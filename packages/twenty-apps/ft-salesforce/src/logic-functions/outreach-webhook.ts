import { createHmac, timingSafeEqual } from 'crypto';
import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';
import { OUTREACH_WEBHOOK_UID, PROCESS_OUTREACH_EVENT_UID } from 'src/constants/universal-identifiers';

// Server webhook route for Outreach events (EE-5069) — two-stage pattern proven by
// dialpad-webhook: this resolver runs OUTSIDE workspace context, verifies the
// signature, and dispatches to process-outreach-event workspace-scoped.
//
// Outreach signs each delivery: HMAC-SHA256 hex digest of the RAW JSON body with the
// secret set at webhook creation (scripts/setup-outreach.mjs), sent in the
// `Outreach-Webhook-Signature` header. Outreach does NOT retry failed deliveries
// (except network errors) — outreach-backfill.mjs reconciles gaps.

type ServerRouteResolverResult = {
  workspaceId: string;
  targetLogicFunctionUniversalIdentifier: string;
  payload?: object;
};

const handler = (route: RoutePayload<unknown>): ServerRouteResolverResult => {
  const workspaceId = process.env.OUTREACH_WORKSPACE_ID;
  if (!workspaceId) {
    throw new Error('OUTREACH_WORKSPACE_ID server variable is not set on the application registration');
  }
  const secret = process.env.OUTREACH_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('OUTREACH_WEBHOOK_SECRET server variable is not set on the application registration');
  }

  const bodyRecord = route.body as Record<string, unknown> | string | undefined;
  const rawBody = route.rawBody
    ?? (typeof bodyRecord === 'string' ? bodyRecord : undefined);
  if (!rawBody) {
    throw new Error('No raw body available for signature verification');
  }

  const provided = String(route.headers?.['outreach-webhook-signature'] ?? '');
  if (!provided) throw new Error('Missing Outreach-Webhook-Signature header');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Invalid Outreach webhook signature');
  }

  const payload = (typeof bodyRecord === 'object' && bodyRecord !== null)
    ? bodyRecord
    : JSON.parse(rawBody) as object;

  return {
    workspaceId,
    targetLogicFunctionUniversalIdentifier: PROCESS_OUTREACH_EVENT_UID,
    payload,
  };
};

export default defineLogicFunction({
  universalIdentifier: OUTREACH_WEBHOOK_UID,
  name: 'outreach-webhook',
  description: 'Verifies Outreach webhook HMAC signatures and dispatches events to process-outreach-event.',
  timeoutSeconds: 30,
  handler,
  serverRouteTriggerSettings: {
    forwardedRequestHeaders: ['content-type', 'outreach-webhook-signature'],
  },
});
