// Shared ZoomInfo API client utilities for logic functions.
// Credentials: ZOOMINFO_CLIENT_ID + ZOOMINFO_CLIENT_SECRET (OAuth2 client credentials)
// For local dev: set ZOOMINFO_ACCESS_TOKEN to skip auth call.

const ZI_AUTH_URL = 'https://api.zoominfo.com/gtm/oauth/v1/token';
const ZI_BASE_URL = 'https://api.zoominfo.com/gtm/data/v1';

export type ZoomInfoCompanyResult = {
  id: string;
  attributes: {
    name?: string;
    website?: string;
    primaryIndustry?: string;
    employeeCount?: number;
    revenue?: number;
    city?: string;
    state?: string;
    country?: string;
  };
  meta: {
    matchStatus: 'FULL_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH';
  };
};

export type ZoomInfoContactResult = {
  id: string;
  attributes: {
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    directPhoneNumber?: string;
    linkedInUrl?: string;
    seniority?: string;
    department?: string;
  };
  meta: {
    matchStatus: 'FULL_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH';
  };
};

export type ZoomInfoNewsResult = {
  id: string;
  attributes: {
    headline?: string;
    summary?: string;
    publishedAt?: string;
    url?: string;
  };
};

export type ZoomInfoScoopResult = {
  id: string;
  attributes: {
    content?: string;
    publishedAt?: string;
    type?: string;
  };
};

async function getAccessToken(): Promise<string> {
  // Allow pre-set token for local dev (avoids an auth call per invocation)
  const presetToken = process.env.ZOOMINFO_ACCESS_TOKEN;
  if (presetToken) return presetToken;

  const clientId = process.env.ZOOMINFO_CLIENT_ID;
  const clientSecret = process.env.ZOOMINFO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'ZoomInfo credentials missing. Set ZOOMINFO_CLIENT_ID and ZOOMINFO_CLIENT_SECRET.',
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  );

  const res = await fetch(ZI_AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`ZoomInfo auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function ziPost<T>(
  path: string,
  body: object,
  token: string,
): Promise<T> {
  const res = await fetch(`${ZI_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `ZoomInfo API ${path} failed: ${res.status} ${await res.text()}`,
    );
  }

  return res.json() as Promise<T>;
}

export async function enrichCompany(
  website: string,
  outputFields: string[] = ['primaryIndustry', 'employeeCount', 'revenue'],
): Promise<ZoomInfoCompanyResult | null> {
  const token = await getAccessToken();

  const response = await ziPost<{ data: ZoomInfoCompanyResult[] }>(
    '/companies/enrich',
    {
      data: {
        type: 'CompanyEnrich',
        attributes: {
          matchCompanyInput: [{ companyWebsite: website }],
          outputFields,
        },
      },
    },
    token,
  );

  const result = response.data?.[0];
  if (!result || result.meta.matchStatus === 'NO_MATCH') return null;
  return result;
}

export async function enrichContact(
  email: string,
  outputFields: string[] = [
    'jobTitle',
    'directPhoneNumber',
    'linkedInUrl',
    'seniority',
    'department',
  ],
): Promise<ZoomInfoContactResult | null> {
  const token = await getAccessToken();

  const response = await ziPost<{ data: ZoomInfoContactResult[] }>(
    '/contacts/enrich',
    {
      data: {
        type: 'ContactEnrich',
        attributes: {
          matchContactInput: [{ emailAddress: email }],
          outputFields,
        },
      },
    },
    token,
  );

  const result = response.data?.[0];
  if (!result || result.meta.matchStatus === 'NO_MATCH') return null;
  return result;
}

export async function getCompanyIntentAndNews(
  websites: string[],
  outputFields: string[] = ['primaryIndustry', 'employeeCount', 'scoops', 'recentNews'],
): Promise<ZoomInfoCompanyResult[]> {
  if (websites.length === 0) return [];
  const token = await getAccessToken();

  // ZoomInfo batches up to 25 companies per request
  const batches: string[][] = [];
  for (let i = 0; i < websites.length; i += 25) {
    batches.push(websites.slice(i, i + 25));
  }

  const results: ZoomInfoCompanyResult[] = [];
  for (const batch of batches) {
    const response = await ziPost<{ data: ZoomInfoCompanyResult[] }>(
      '/companies/enrich',
      {
        data: {
          type: 'CompanyEnrich',
          attributes: {
            matchCompanyInput: batch.map((w) => ({ companyWebsite: w })),
            outputFields,
          },
        },
      },
      token,
    );
    results.push(...(response.data ?? []).filter(
      (r) => r.meta.matchStatus !== 'NO_MATCH',
    ));
  }

  return results;
}

// Map ZoomInfo primaryIndustry → Twenty hsIndustry SELECT value
export function mapIndustry(ziIndustry: string | undefined): string | null {
  if (!ziIndustry) return null;
  const upper = ziIndustry.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const MAP: Record<string, string> = {
    TECHNOLOGY: 'TECHNOLOGY',
    SOFTWARE: 'TECHNOLOGY',
    FINANCIAL_SERVICES: 'FINANCIAL_SERVICES',
    FINANCE: 'FINANCIAL_SERVICES',
    HEALTHCARE: 'HEALTHCARE',
    MANUFACTURING: 'MANUFACTURING',
    RETAIL: 'RETAIL',
    REAL_ESTATE: 'REAL_ESTATE',
    EDUCATION: 'EDUCATION',
    CONSULTING: 'CONSULTING',
  };
  for (const [key, val] of Object.entries(MAP)) {
    if (upper.includes(key)) return val;
  }
  return 'OTHER';
}
