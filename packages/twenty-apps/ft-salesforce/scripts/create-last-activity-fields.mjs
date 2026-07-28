// Creates the Last Activity field set on person and company, plus call.handledBy.
//
// These are created through /metadata rather than the SDK because the SDK has no
// MORPH_RELATION support and lastActivityItem must point at a call, a message or a
// calendar event. Everything else could be an SDK field, but keeping the whole set in one
// place makes the shape obvious. Idempotent: existing fields are left untouched.
//
// Usage: node scripts/create-last-activity-fields.mjs
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SALES_WORKSPACE_ID = '3ae378c2-3871-4fff-8c69-b4dff2bd5501';
const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes.sales;
const claim = JSON.parse(Buffer.from(cfg.apiKey.split('.')[1], 'base64url').toString());
if (claim.workspaceId !== SALES_WORKSPACE_ID) {
  console.error('API key is not the sales workspace, aborting');
  process.exit(1);
}

const meta = async (query, variables) => {
  const res = await fetch(`${cfg.apiUrl ?? cfg.url}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ query, variables }),
  });
  return res.json().catch(() => null);
};

const objectsRes = await meta('{ objects(paging: {first: 500}) { edges { node { id nameSingular fieldsList { name type } } } } }');
const objects = objectsRes.data.objects.edges.map((e) => e.node);
const byName = Object.fromEntries(objects.map((o) => [o.nameSingular, o]));
const has = (objectName, fieldName) => byName[objectName].fieldsList.some((f) => f.name === fieldName);

const createField = async (field, label) => {
  const r = await meta('mutation C($input: CreateOneFieldMetadataInput!) { createOneField(input: $input) { id name } }', {
    input: { field },
  });
  if (r?.data?.createOneField) {
    console.log(`${label}: created`);
    return r.data.createOneField;
  }
  console.log(`${label}: FAILED ${String(JSON.stringify(r?.errors)).slice(0, 300)}`);
  return null;
};

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'EMAIL', label: 'Email', position: 0, color: 'blue' },
  { value: 'MEETING', label: 'Meeting', position: 1, color: 'purple' },
  { value: 'CALL', label: 'Call', position: 2, color: 'green' },
  { value: 'SMS', label: 'SMS', position: 3, color: 'turquoise' },
];

for (const objectName of ['person', 'company']) {
  const objectMetadataId = byName[objectName].id;
  const plural = objectName === 'person' ? 'People' : 'Companies';

  if (!has(objectName, 'lastActivityAt')) {
    await createField(
      {
        objectMetadataId,
        type: 'DATE_TIME',
        name: 'lastActivityAt',
        label: 'Last Activity',
        description: 'Most recent touch of any kind: email, meeting, call or SMS',
        icon: 'IconTimelineEvent',
        isNullable: true,
      },
      `${objectName}.lastActivityAt`,
    );
  }

  if (!has(objectName, 'lastActivityType')) {
    await createField(
      {
        objectMetadataId,
        type: 'SELECT',
        name: 'lastActivityType',
        label: 'Last Activity Type',
        description: 'What the most recent touch was',
        icon: 'IconCategory',
        isNullable: true,
        options: ACTIVITY_TYPE_OPTIONS.map((o) => ({ ...o })),
      },
      `${objectName}.lastActivityType`,
    );
  }

  if (!has(objectName, 'lastActivityBy')) {
    await createField(
      {
        objectMetadataId,
        type: 'RELATION',
        name: 'lastActivityBy',
        label: 'Last Activity By',
        description: 'Team member behind the most recent touch',
        icon: 'IconUserCircle',
        isNullable: true,
        relationCreationPayload: {
          type: 'MANY_TO_ONE',
          targetObjectMetadataId: byName.workspaceMember.id,
          targetFieldLabel: `Last Activity ${plural}`,
          targetFieldIcon: 'IconTimelineEvent',
        },
      },
      `${objectName}.lastActivityBy`,
    );
  }

  if (!has(objectName, 'lastActivityItem')) {
    const morph = await createField(
      {
        objectMetadataId,
        type: 'MORPH_RELATION',
        name: 'lastActivityItem',
        label: 'Last Activity Item',
        description: 'The call, message or meeting behind the most recent touch',
        icon: 'IconLink',
        isNullable: true,
        morphRelationsCreationPayload: [
          { type: 'MANY_TO_ONE', targetObjectMetadataId: byName.call.id, targetFieldLabel: `Last Activity ${plural}`, targetFieldIcon: 'IconTimelineEvent' },
          { type: 'MANY_TO_ONE', targetObjectMetadataId: byName.message.id, targetFieldLabel: `Last Activity ${plural}`, targetFieldIcon: 'IconTimelineEvent' },
          { type: 'MANY_TO_ONE', targetObjectMetadataId: byName.calendarEvent.id, targetFieldLabel: `Last Activity ${plural}`, targetFieldIcon: 'IconTimelineEvent' },
        ],
      },
      `${objectName}.lastActivityItem (morph)`,
    );

    // Fallback when morph creation is not accepted: a plain call relation. Email and meeting
    // items stay visible through the Last contact app's own item field.
    if (!morph && !has(objectName, 'lastActivityCall')) {
      await createField(
        {
          objectMetadataId,
          type: 'RELATION',
          name: 'lastActivityCall',
          label: 'Last Activity Call',
          description: 'Call or SMS behind the most recent touch',
          icon: 'IconPhone',
          isNullable: true,
          relationCreationPayload: {
            type: 'MANY_TO_ONE',
            targetObjectMetadataId: byName.call.id,
            targetFieldLabel: `Last Activity ${plural}`,
            targetFieldIcon: 'IconTimelineEvent',
          },
        },
        `${objectName}.lastActivityCall (fallback)`,
      );
    }
  }
}

if (!has('call', 'handledBy')) {
  await createField(
    {
      objectMetadataId: byName.call.id,
      type: 'RELATION',
      name: 'handledBy',
      label: 'Handled By',
      description: 'Team member who took or placed the call, resolved from the Dialpad user',
      icon: 'IconHeadset',
      isNullable: true,
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: byName.workspaceMember.id,
        targetFieldLabel: 'Handled Calls',
        targetFieldIcon: 'IconPhone',
      },
    },
    'call.handledBy',
  );
}

console.log('last activity fields ready');
