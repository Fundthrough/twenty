// Auto-link workflow: campaignEngagement.created → copy person.companyId onto the
// engagement's materialized company relation (see backfill-ce-company.mjs for why).
// Idempotent: skips if an active workflow with this name already exists.
// Usage: node scripts/create-ce-company-workflow.mjs
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const BASE = cfg.apiUrl ?? cfg.url;
const KEY = cfg.apiKey;
const claim = JSON.parse(Buffer.from(KEY.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('API key is not the sales workspace — aborting');
  process.exit(1);
}
const q = async (query, variables, ep = '/graphql') => {
  const res = await fetch(BASE + ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  return res.json().catch(() => null);
};

const NAME = 'Campaign Engagement → Company auto-link';

const existing = await q('query W($filter: WorkflowFilterInput) { workflows(filter: $filter, first: 5) { edges { node { id name statuses } } } }',
  { filter: { name: { eq: NAME } } });
const hit = existing?.data?.workflows?.edges?.[0]?.node;
if (hit?.statuses?.includes('ACTIVE')) {
  console.log('workflow already active:', hit.id);
  process.exit(0);
}

const wfId = hit?.id ?? (await q('mutation C($data: WorkflowCreateInput!) { createWorkflow(data: $data) { id } }',
  { data: { name: NAME } }))?.data?.createWorkflow?.id;
if (!wfId) { console.log('workflow create failed'); process.exit(1); }
console.log('workflow:', wfId);

const findStepId = randomUUID();
const updateStepId = randomUUID();
const trigger = {
  type: 'DATABASE_EVENT',
  name: 'Campaign Engagement is created',
  settings: { eventName: 'campaignEngagement.created', outputSchema: {} },
  nextStepIds: [findStepId],
};
const steps = [
  {
    id: findStepId,
    name: 'Find person',
    type: 'FIND_RECORDS',
    valid: true,
    nextStepIds: [updateStepId],
    settings: {
      input: { objectName: 'person', filter: { gqlOperationFilter: [{ id: { eq: `{{trigger.personId}}` } }] }, limit: 1 },
      outputSchema: {},
      errorHandlingOptions: { retryOnFailure: { value: false }, continueOnFailure: { value: false } },
    },
  },
  {
    id: updateStepId,
    name: 'Set company from person',
    type: 'UPDATE_RECORD',
    valid: true,
    nextStepIds: [],
    settings: {
      input: {
        objectName: 'campaignEngagement',
        objectRecordId: `{{trigger.id}}`,
        objectRecord: { companyId: `{{${findStepId}.first.companyId}}` },
        fieldsToUpdate: ['companyId'],
      },
      outputSchema: {},
      errorHandlingOptions: { retryOnFailure: { value: false }, continueOnFailure: { value: false } },
    },
  },
];

const ver = await q('mutation V($data: WorkflowVersionCreateInput!) { createWorkflowVersion(data: $data) { id status } }',
  { data: { workflowId: wfId, name: 'v1', status: 'DRAFT', trigger, steps } });
const verId = ver?.data?.createWorkflowVersion?.id;
if (!verId) { console.log('version create failed:', String(JSON.stringify(ver?.errors)).slice(0, 400)); process.exit(1); }
console.log('version:', verId);

const act = await q('mutation A($workflowVersionId: UUID!) { activateWorkflowVersion(workflowVersionId: $workflowVersionId) }',
  { workflowVersionId: verId });
console.log('activate:', act?.data ? 'OK' : String(JSON.stringify(act?.errors)).slice(0, 300));
