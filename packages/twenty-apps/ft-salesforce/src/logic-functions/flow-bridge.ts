import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';
import { FLOW_BRIDGE_UID } from 'src/constants/universal-identifiers';
import { buildFlowBridgeHtml } from 'src/logic-functions/flow-bridge-html';

// Same-origin bridge pattern (credit: Frans, 2026-07-20). The IFRAME widget points at
// this page on TWENTY'S OWN origin — being same-origin with the record page lets the
// script read window.parent.location to get the record UUID (the "interpolation" Twenty
// itself doesn't do, see twentyhq/twenty#23073), resolve it to the FT companyId via the
// sibling /resolve route, then navigate the iframe to Flow's /embed with that id.
const handler = async (): Promise<Response> =>
  new Response(buildFlowBridgeHtml(), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

export default defineLogicFunction({
  universalIdentifier: FLOW_BRIDGE_UID,
  name: 'flow-bridge',
  description: 'Serves the same-origin bridge page for the Company Profile IFRAME widget (record-aware Flow embed).',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/flow-bridge',
    httpMethod: HTTPMethod.GET,
    isAuthRequired: false,
  },
});
