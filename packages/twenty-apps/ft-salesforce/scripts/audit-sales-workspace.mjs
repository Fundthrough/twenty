// READ-ONLY audit of the sales cloud workspace (fundthrough.twenty.com, BO key).
// Produces the pre-wipe manifest for CLOUD-DEPLOY-PLAN step 1. Writes JSON to stdout dir.
// Usage: node scripts/audit-sales-workspace.mjs > /tmp/sales-audit.json
const BASE = 'https://fundthrough.twenty.com';
const API_KEY = process.env.TWENTY_BO_API_KEY;
if (!API_KEY) { console.error('TWENTY_BO_API_KEY not set'); process.exit(1); }

// safety: confirm the key targets the sales workspace before doing anything
const claims = JSON.parse(Buffer.from(API_KEY.split('.')[1], 'base64url').toString());
if (claims.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('ABORT: key workspaceId is not the sales workspace:', claims.workspaceId);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gql(query, variables, endpoint = '/graphql', attempt = 1) {
  const res = await fetch(BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 8) {
    await sleep(62000); return gql(query, variables, endpoint, attempt + 1);
  }
  return body;
}

const audit = { at: claims.workspaceId, generated: 'pre-wipe manifest' };

// metadata: objects + fields with ownership
const meta = await gql('{ objects(paging: { first: 200 }) { edges { node { id nameSingular isSystem isActive applicationId universalIdentifier fieldsList { id name type applicationId } } } } }', undefined, '/metadata');
const objects = meta.data.objects.edges.map((e) => e.node);
audit.nonSystemObjects = objects.filter((o) => !o.isSystem).map((o) => ({ name: o.nameSingular, id: o.id, applicationId: o.applicationId, isActive: o.isActive }));
// applications present
audit.frontComponents = (await gql('{ frontComponents { id name applicationId } }', undefined, '/metadata')).data?.frontComponents ?? [];
// hs-prefixed + suspicious fields per core object
audit.suspiciousFields = {};
for (const objName of ['company', 'person', 'task', 'note', 'opportunity']) {
  const obj = objects.find((o) => o.nameSingular === objName);
  if (!obj) continue;
  const standardNames = new Set(['id','createdAt','updatedAt','deletedAt','createdBy','updatedBy','position','searchVector','name','domainName','address','employees','linkedinLink','xLink','annualRecurringRevenue','idealCustomerProfile','accountOwner','people','opportunities','taskTargets','noteTargets','attachments','timelineActivities','favorites','emails','phones','jobTitle','city','avatarUrl','avatarFile','company','pointOfContactForOpportunities','calendarEventParticipants','messageParticipants','title','body','bodyV2','status','dueAt','assignee','assigneeId','stage','closeDate','amount','companyId','pointOfContactId','position']);
  audit.suspiciousFields[objName] = obj.fieldsList.filter((f) => !standardNames.has(f.name)).map((f) => ({ name: f.name, type: f.type, id: f.id, applicationId: f.applicationId }));
}
// views, nav, workflows, layouts
audit.views = (await gql('{ getViews { id name objectMetadataId } }', undefined, '/metadata')).data?.getViews?.map((v) => v.name) ?? [];
const navs = (await gql('{ navigationMenuItems { id type name targetObjectMetadataId viewId applicationId } }', undefined, '/metadata')).data?.navigationMenuItems ?? [];
audit.navItems = navs.length;
audit.workflows = (await gql('{ workflows(first: 30) { edges { node { id name statuses } } } }')).data?.workflows?.edges?.map((e) => e.node) ?? [];
audit.pageLayouts = (await gql('{ getPageLayouts { id name } }', undefined, '/metadata')).data?.getPageLayouts?.map((l) => l.name) ?? [];
// record counts
audit.recordCounts = {};
for (const plural of ['companies', 'people', 'tasks', 'notes', 'opportunities']) {
  const r = await gql(`{ ${plural}(first: 1) { totalCount } }`);
  audit.recordCounts[plural] = r.data?.[plural]?.totalCount ?? 'ERR';
  await sleep(300);
}
const hs = await gql('{ companies(first: 1, filter: { hsHubspotId: { is: "NOT_NULL" } }) { totalCount } }');
audit.recordCounts.companiesWithHsId = hs.data?.companies?.totalCount ?? 'n/a';

console.log(JSON.stringify(audit, null, 2));
