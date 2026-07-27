// Copies the curated demo records from the LOCAL workspace to the SALES cloud workspace:
// companies (all custom fields), people (linked), term sheets (linked), tasks+targets,
// notes+targets. Idempotent: companies upsert by name, people by email; scratch test
// records on cloud are scrubbed first. Also a dress rehearsal for the SF import path.
// Usage: node scripts/copy-local-to-sales.mjs
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const remotes = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes;
const SRC = { base: remotes.local.apiUrl, key: remotes.local.apiKey };
const DST = { base: remotes.sales.apiUrl, key: remotes.sales.apiKey };
const claims = JSON.parse(Buffer.from(DST.key.split('.')[1], 'base64url').toString());
if (claims.workspaceId !== '3ae378c2-3871-4fff-8c69-b4dff2bd5501') {
  console.error('ABORT: sales remote key is not the sales workspace'); process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = 400;
const gqlFactory = (env) => async (query, variables, endpoint = '/graphql', attempt = 1) => {
  const res = await fetch(env.base + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.key}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (JSON.stringify(body?.errors ?? '').includes('Limit reached') && attempt < 8) {
    await sleep(62000); return gqlFactory(env)(query, variables, endpoint, attempt + 1);
  }
  return body;
};
const src = gqlFactory(SRC);
const dst = gqlFactory(DST);

// deep-clean: drop null/undefined/'' and empty objects; strip __typename
const clean = (v) => {
  if (Array.isArray(v)) { const a = v.map(clean).filter((x) => x !== undefined); return a.length ? a : undefined; }
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === '__typename') continue;
      const c = clean(val);
      if (c !== undefined) o[k] = c;
    }
    return Object.keys(o).length ? o : undefined;
  }
  return v === null || v === undefined || v === '' ? undefined : v;
};

// selection + copy shapes per field type
const SEL = {
  TEXT: (n) => n, SELECT: (n) => n, MULTI_SELECT: (n) => n, NUMBER: (n) => n,
  BOOLEAN: (n) => n, DATE: (n) => n, DATE_TIME: (n) => n,
  CURRENCY: (n) => `${n} { amountMicros currencyCode }`,
  LINKS: (n) => `${n} { primaryLinkUrl primaryLinkLabel }`,
  RICH_TEXT_V2: (n) => `${n} { markdown }`,
  RICH_TEXT: (n) => `${n} { markdown }`,
  FULL_NAME: (n) => `${n} { firstName lastName }`,
  EMAILS: (n) => `${n} { primaryEmail }`,
  PHONES: (n) => `${n} { primaryPhoneNumber primaryPhoneCallingCode }`,
  ADDRESS: (n) => `${n} { addressStreet1 addressStreet2 addressCity addressState addressPostcode addressCountry }`,
};
const richTextFix = (v) => (v && v.markdown ? { markdown: v.markdown, blocknote: '' } : undefined);

// ---- build field lists from LOCAL metadata (our app's fields + relevant natives) ----
const meta = await src('{ objects(paging: { first: 200 }) { edges { node { nameSingular fieldsList { name type applicationId } } } } }', undefined, '/metadata');
const objMeta = Object.fromEntries(meta.data.objects.edges.map((e) => [e.node.nameSingular, e.node.fieldsList]));
const fcs = await src('{ frontComponents { name applicationId } }', undefined, '/metadata');
const APP_ID = fcs.data.frontComponents.find((c) => c.name === 'flow-company-profile').applicationId;
const appFields = (obj) => objMeta[obj].filter((f) => f.applicationId === APP_ID && SEL[f.type]);
const selFor = (obj, natives) => [...natives, ...appFields(obj).map((f) => SEL[f.type](f.name))].join(' ');
const richFields = (obj) => new Set(objMeta[obj].filter((f) => /RICH_TEXT/.test(f.type)).map((f) => f.name));

// ---- 0. scrub cloud scratch records ----
const scratch = await dst('{ people(first: 30) { edges { node { id emails { primaryEmail } } } } }');
for (const e of scratch.data?.people?.edges ?? []) {
  if (/scratch\.example|amtrend\.example/.test(e.node.emails?.primaryEmail ?? '')) {
    await dst('mutation D($id: UUID!) { deletePerson(id: $id) { id } }', { id: e.node.id });
    await sleep(T);
  }
}
console.log('cloud scratch people scrubbed');

// ---- 1. companies ----
const compSel = selFor('company', ['id name', SEL.LINKS('domainName'), SEL.ADDRESS('address'), SEL.CURRENCY('annualRecurringRevenue'), 'employees']);
const comps = (await src(`{ companies(first: 60) { edges { node { ${compSel} } } } }`)).data.companies.edges.map((e) => e.node);
const cloudComps = (await dst('{ companies(first: 60) { edges { node { id name } } } }')).data.companies.edges.map((e) => e.node);
const cloudByName = Object.fromEntries(cloudComps.map((c) => [c.name.toLowerCase(), c.id]));
const idMap = {}; // local company id -> cloud company id
let cC = 0, cU = 0;
for (const c of comps) {
  const { id: localId, ...fields } = c;
  const data = clean(fields) ?? {};
  const existing = cloudByName[c.name.toLowerCase()];
  if (existing) {
    await dst('mutation U($id: UUID!, $data: CompanyUpdateInput!) { updateCompany(id: $id, data: $data) { id } }', { id: existing, data });
    idMap[localId] = existing; cU++;
  } else {
    const r = await dst('mutation C($data: CompanyCreateInput!) { createCompany(data: $data) { id } }', { data });
    const nid = r?.data?.createCompany?.id;
    if (nid) { idMap[localId] = nid; cC++; }
    else console.error('company fail:', c.name, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160));
  }
  await sleep(T);
}
console.log(`companies: ${cC} created, ${cU} updated`);

// ---- 2. people ----
// local stores phones split (number + callingCode); cloud create wants one +-prefixed
// number and infers the rest (explicit country/calling codes trigger validation errors)
const joinPhone = (ph) => {
  const num = (ph?.primaryPhoneNumber ?? '').replace(/[^\d]/g, '');
  if (!num) return undefined;
  const cc = (ph?.primaryPhoneCallingCode ?? '').replace(/[^\d]/g, '');
  if (cc) return { primaryPhoneNumber: `+${cc}${num}` };
  return { primaryPhoneNumber: num.length === 10 ? `+1${num}` : `+${num}` };
};
const persSel = selFor('person', ['id companyId', SEL.FULL_NAME('name'), SEL.EMAILS('emails'), SEL.PHONES('phones'), 'jobTitle city']);
const people = (await src(`{ people(first: 60) { edges { node { ${persSel} } } } }`)).data.people.edges.map((e) => e.node);
let pC = 0, pS = 0;
for (const p of people) {
  const { id: localId, companyId: localCo, ...fields } = p;
  const email = p.emails?.primaryEmail?.toLowerCase();
  if (email) {
    const dup = await dst('query P($email: String!) { people(first: 1, filter: { emails: { primaryEmail: { ilike: $email } } }) { edges { node { id } } } }', { email });
    if (dup.data?.people?.edges?.length) { pS++; continue; }
  }
  fields.phones = joinPhone(fields.phones);
  const data = clean(fields) ?? {};
  if (localCo && idMap[localCo]) data.companyId = idMap[localCo];
  const r = await dst('mutation C($data: PersonCreateInput!) { createPerson(data: $data) { id } }', { data });
  if (r?.data?.createPerson?.id) pC++;
  else console.error('person fail:', email, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160));
  await sleep(T);
}
console.log(`people: ${pC} created, ${pS} skipped (already present)`);

// ---- 3. term sheets ----
const tsRich = richFields('termSheet');
const tsSel = selFor('termSheet', ['id name companyId']);
const sheets = (await src(`{ termSheets(first: 60) { edges { node { ${tsSel} } } } }`)).data.termSheets.edges.map((e) => e.node);
const cloudTs = (await dst('{ termSheets(first: 60) { edges { node { name } } } }')).data?.termSheets?.edges?.map((e) => e.node.name) ?? [];
let tC = 0;
for (const t of sheets) {
  if (cloudTs.includes(t.name)) continue;
  const { id: localId, companyId: localCo, ...fields } = t;
  for (const rf of tsRich) if (fields[rf]) fields[rf] = richTextFix(fields[rf]);
  const data = clean(fields) ?? {};
  if (localCo && idMap[localCo]) data.companyId = idMap[localCo];
  const r = await dst('mutation C($data: TermSheetCreateInput!) { createTermSheet(data: $data) { id } }', { data });
  if (r?.data?.createTermSheet?.id) tC++;
  else console.error('termsheet fail:', t.name, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 200));
  await sleep(T);
}
console.log(`termSheets: ${tC} created`);

// ---- 4. tasks + targets ----
const tasks = (await src(`{ tasks(first: 30) { edges { node { id title status dueAt ${SEL.RICH_TEXT_V2('bodyV2')} ${selFor('task', []) } taskTargets { edges { node { company { id } } } } } } } }`)).data.tasks.edges.map((e) => e.node);
const cloudTasks = (await dst('{ tasks(first: 30) { edges { node { title } } } }')).data?.tasks?.edges?.map((e) => e.node.title) ?? [];
let kC = 0;
for (const t of tasks) {
  if (cloudTasks.includes(t.title)) continue;
  const targets = (t.taskTargets?.edges ?? []).map((e) => e.node.company?.id).filter(Boolean);
  const data = clean({ title: t.title, status: t.status, dueAt: t.dueAt, bodyV2: richTextFix(t.bodyV2), priority: t.priority, taskType: t.taskType }) ?? {};
  const r = await dst('mutation C($data: TaskCreateInput!) { createTask(data: $data) { id } }', { data });
  const tid = r?.data?.createTask?.id;
  if (!tid) { console.error('task fail:', t.title, JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160)); continue; }
  kC++;
  for (const co of targets) {
    if (!idMap[co]) continue;
    await sleep(T);
    await dst('mutation TT($data: TaskTargetCreateInput!) { createTaskTarget(data: $data) { id } }', { data: { taskId: tid, targetCompanyId: idMap[co] } });
  }
  await sleep(T);
}
console.log(`tasks: ${kC} created (with targets)`);

// ---- 5. notes + targets ----
const notes = (await src(`{ notes(first: 30) { edges { node { id title ${SEL.RICH_TEXT_V2('bodyV2')} noteTargets { edges { node { company { id } } } } } } } }`)).data.notes.edges.map((e) => e.node);
const cloudNotes = (await dst('{ notes(first: 30) { edges { node { title } } } }')).data?.notes?.edges?.map((e) => e.node.title) ?? [];
let nC = 0;
for (const n of notes) {
  if (cloudNotes.includes(n.title)) continue;
  const targets = (n.noteTargets?.edges ?? []).map((e) => e.node.company?.id).filter(Boolean);
  const r = await dst('mutation C($data: NoteCreateInput!) { createNote(data: $data) { id } }', { data: clean({ title: n.title, bodyV2: richTextFix(n.bodyV2) }) });
  const nid = r?.data?.createNote?.id;
  if (!nid) { console.error('note fail:', n.title); continue; }
  nC++;
  for (const co of targets) {
    if (!idMap[co]) continue;
    await sleep(T);
    await dst('mutation NT($data: NoteTargetCreateInput!) { createNoteTarget(data: $data) { id } }', { data: { noteId: nid, targetCompanyId: idMap[co] } });
  }
  await sleep(T);
}
console.log(`notes: ${nC} created (with targets)`);

// ---- summary ----
const fin = await dst('{ companies(first:1){ totalCount } people(first:1){ totalCount } termSheets(first:1){ totalCount } tasks(first:1){ totalCount } notes(first:1){ totalCount } }');
console.log('CLOUD TOTALS:', JSON.stringify(fin.data));
console.log('COPY COMPLETE');
