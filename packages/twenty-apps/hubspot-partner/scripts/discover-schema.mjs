#!/usr/bin/env node
// Run: HUBSPOT_PAT=$HUBSPOT_PAT node scripts/discover-schema.mjs
// Outputs: scripts/hubspot-schema.json with pipelines, properties, and sample field options

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAT = process.env.HUBSPOT_PAT;

if (!PAT) {
  console.error('Error: HUBSPOT_PAT environment variable is not set.');
  console.error('Run: HUBSPOT_PAT=$HUBSPOT_PAT node scripts/discover-schema.mjs');
  process.exit(1);
}

const BASE = 'https://api.hubapi.com';
const HEADERS = {
  Authorization: `Bearer ${PAT}`,
  'Content-Type': 'application/json',
};

async function hsGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API ${path} failed ${res.status}: ${body}`);
  }
  return res.json();
}

async function getProperties(objectType) {
  const data = await hsGet(`/crm/v3/properties/${objectType}`);
  return data.results
    .filter((p) => !p.hidden && p.groupName !== 'ai_properties')
    .map((p) => ({
      name: p.name,
      label: p.label,
      type: p.type,
      fieldType: p.fieldType,
      groupName: p.groupName,
      options: p.options?.map((o) => ({ label: o.label, value: o.value, displayOrder: o.displayOrder })),
    }));
}

async function getPipelines() {
  const data = await hsGet('/crm/v3/pipelines/deals');
  return data.results.map((pipeline) => ({
    id: pipeline.id,
    label: pipeline.label,
    stages: pipeline.stages
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => ({
        id: s.id,
        label: s.label,
        probability: s.metadata?.probability,
        displayOrder: s.displayOrder,
      })),
  }));
}

async function main() {
  console.log('Discovering HubSpot schema...\n');

  const [companyProps, contactProps, dealProps, pipelines] = await Promise.all([
    getProperties('companies'),
    getProperties('contacts'),
    getProperties('deals'),
    getPipelines(),
  ]);

  const schema = {
    discoveredAt: new Date().toISOString(),
    pipelines,
    objectProperties: {
      companies: companyProps,
      contacts: contactProps,
      deals: dealProps,
    },
    summary: {
      pipelines: pipelines.length,
      pipelineNames: pipelines.map((p) => p.label),
      stages: pipelines.flatMap((p) => p.stages.map((s) => `${s.id} → "${s.label}"`)),
      companyPropertyCount: companyProps.length,
      contactPropertyCount: contactProps.length,
      dealPropertyCount: dealProps.length,
    },
  };

  const outPath = join(__dirname, 'hubspot-schema.json');
  writeFileSync(outPath, JSON.stringify(schema, null, 2));

  console.log('Schema discovered:');
  console.log(`  Pipelines (${schema.summary.pipelines}):`);
  schema.summary.pipelineNames.forEach((n) => console.log(`    - ${n}`));
  console.log('\n  Deal stages:');
  schema.summary.stages.forEach((s) => console.log(`    ${s}`));
  console.log(`\n  Company properties: ${schema.summary.companyPropertyCount}`);
  console.log(`  Contact properties: ${schema.summary.contactPropertyCount}`);
  console.log(`  Deal properties: ${schema.summary.dealPropertyCount}`);
  console.log(`\nOutput written to: ${outPath}`);
  console.log('\nNext: review stage IDs in hubspot-schema.json and update');
  console.log('src/objects/hs-partner-deal.object.ts DEAL_STAGES if they differ.');
}

main().catch((err) => {
  console.error('Discovery failed:', err.message);
  process.exit(1);
});
