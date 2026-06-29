import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import {
  type DatabaseEventPayload,
  type ObjectRecordCreateEvent,
} from 'twenty-sdk/logic-function';

import { ZOOMINFO_ENRICH_COMPANY_UID } from 'src/constants/universal-identifiers';
import { enrichCompany, mapIndustry } from 'src/utils/zoominfo-client';

type CompanyRecord = {
  id: string;
  name: string;
  domainName?: { primaryLinkUrl?: string };
  hsIndustry?: string;
  hsNumberOfEmployees?: number;
};

type CompanyCreateEvent = DatabaseEventPayload<
  ObjectRecordCreateEvent<CompanyRecord>
>;

const handler = async (
  event: CompanyCreateEvent,
): Promise<object | undefined> => {
  const company = event.properties.after;
  const domain = company.domainName?.primaryLinkUrl;

  if (!domain) {
    return { skipped: true, reason: 'no_domain', companyId: company.id };
  }

  // Strip protocol for ZoomInfo match
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const result = await enrichCompany(cleanDomain);

  if (!result) {
    return {
      skipped: true,
      reason: 'no_match',
      domain: cleanDomain,
      companyId: company.id,
    };
  }

  const { primaryIndustry, employeeCount } = result.attributes;
  const updates: Record<string, unknown> = {};

  if (primaryIndustry && !company.hsIndustry) {
    const mapped = mapIndustry(primaryIndustry);
    if (mapped) updates['hsIndustry'] = mapped;
  }

  if (employeeCount != null && !company.hsNumberOfEmployees) {
    updates['hsNumberOfEmployees'] = employeeCount;
  }

  if (Object.keys(updates).length === 0) {
    return { skipped: true, reason: 'fields_already_set', companyId: company.id };
  }

  const client = new CoreApiClient();
  await client.mutation({
    updateCompany: {
      __args: { id: company.id, data: updates },
      id: true,
    },
  });

  return {
    enriched: true,
    matchStatus: result.meta.matchStatus,
    fieldsUpdated: Object.keys(updates),
    companyId: company.id,
  };
};

export default defineLogicFunction({
  universalIdentifier: ZOOMINFO_ENRICH_COMPANY_UID,
  name: 'zoominfo-enrich-company',
  description:
    'Enriches a newly created Company with ZoomInfo data (industry, employee count).',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'company.created',
  },
});
