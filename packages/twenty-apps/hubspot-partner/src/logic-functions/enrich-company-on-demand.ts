import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { ENRICH_COMPANY_ON_DEMAND_UID } from 'src/constants/universal-identifiers';
import { enrichCompany, mapIndustry } from 'src/utils/zoominfo-client';

type EnrichRequest = {
  companyId: string;
};

const handler = async (
  payload: RoutePayload<EnrichRequest>,
): Promise<object> => {
  const body =
    typeof payload.body === 'string'
      ? (JSON.parse(payload.body) as EnrichRequest)
      : payload.body;

  const { companyId } = body;
  if (!companyId) {
    return { success: false, error: 'companyId is required' };
  }

  const client = new CoreApiClient();

  // Fetch the company record (filter-based for v2.14.x compatibility)
  const coRes = await client.query({
    companies: {
      __args: { filter: { id: { eq: companyId } } },
      edges: {
        node: {
          id: true,
          name: true,
          domainName: { primaryLinkUrl: true },
          hsIndustry: true,
          hsNumberOfEmployees: true,
        },
      },
    },
  });

  const company = coRes.companies?.edges?.[0]?.node;
  if (!company) {
    return { success: false, error: `Company ${companyId} not found` };
  }

  const domain = company.domainName?.primaryLinkUrl;
  if (!domain) {
    return { success: false, error: 'Company has no domain — cannot enrich without a website URL' };
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const result = await enrichCompany(cleanDomain, [
    'primaryIndustry', 'employeeCount', 'revenue', 'city', 'state', 'country',
    'description', 'foundedYear', 'website',
  ]);

  if (!result) {
    return { success: false, error: `No ZoomInfo match for domain: ${cleanDomain}`, domain: cleanDomain };
  }

  const { primaryIndustry, employeeCount } = result.attributes;
  const updates: Record<string, unknown> = {};

  if (primaryIndustry) {
    const mapped = mapIndustry(primaryIndustry);
    if (mapped) updates['hsIndustry'] = mapped;
  }
  if (employeeCount != null) updates['hsNumberOfEmployees'] = employeeCount;

  if (Object.keys(updates).length === 0) {
    return { success: true, message: 'No new fields to update', matchStatus: result.meta.matchStatus };
  }

  await client.mutation({
    updateCompany: {
      __args: { id: companyId, data: updates },
      id: true,
      name: true,
    },
  });

  return {
    success: true,
    matchStatus: result.meta.matchStatus,
    domain: cleanDomain,
    fieldsUpdated: Object.keys(updates),
    values: updates,
  };
};

export default defineLogicFunction({
  universalIdentifier: ENRICH_COMPANY_ON_DEMAND_UID,
  name: 'enrich-company-on-demand',
  description: 'On-demand ZoomInfo enrichment for a company. Called by the Enrich button on the company record page.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/zoominfo/enrich-company',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
