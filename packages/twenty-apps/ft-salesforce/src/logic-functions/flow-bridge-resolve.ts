import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload, Response } from 'twenty-sdk/logic-function';
import { FLOW_BRIDGE_RESOLVE_UID } from 'src/constants/universal-identifiers';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

// Record UUID → FT companyId (PRO company id). Unauthenticated by design: the bridge
// iframe has no Twenty token; record UUIDs are unguessable and the only thing exposed
// is the numeric company id.
const handler = async (event: RoutePayload): Promise<Response> => {
  const recordId = event.queryStringParameters?.recordId;
  if (!recordId) return jsonResponse({ error: 'Missing recordId query parameter' }, 400);

  try {
    const result = await new CoreApiClient().query({
      company: {
        __args: { filter: { id: { eq: recordId } } },
        id: true,
        companyId: true,
      },
    }) as { company?: { id?: string; companyId?: string | null } };
    const company = result.company;

    if (!company?.id) return jsonResponse({ error: 'Company not found' }, 404);
    if (company.companyId == null || String(company.companyId).trim() === '') {
      return jsonResponse({ error: 'Company has no Company Id (not productionized yet)' }, 404);
    }
    return jsonResponse({ recordId: company.id, companyId: company.companyId });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Failed to resolve companyId' }, 500);
  }
};

export default defineLogicFunction({
  universalIdentifier: FLOW_BRIDGE_RESOLVE_UID,
  name: 'flow-bridge-resolve',
  description: 'Resolves a Twenty company record id to the FT companyId for the Flow bridge.',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/flow-bridge/resolve',
    httpMethod: HTTPMethod.GET,
    isAuthRequired: false,
  },
});
