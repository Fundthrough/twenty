// One-shot workspace setup to run AFTER `twenty app sync` on any remote (local or cloud).
// Idempotent. Replicates everything the app sync + post-install cannot express:
//   1. record-page Fields panel: viewFields + viewFieldGroups for all custom fields
//      (SDK-synced fields get NO viewField rows, and group-less viewFields never render)
//   2. Lead Pipeline kanban columns: one viewGroup per leadStatus option
//      (mainGroupByFieldMetadataUniversalIdentifier alone renders an empty board)
//   3. Company record layout: "Company Profile" tab + FlowWidget FRONT_COMPONENT widget
//      (backstop for post-install), and Term Sheets relation panel instead of Opportunities
//   4. "Leads" nav item pointing at the Lead Pipeline kanban view
//
// Usage: TWENTY_REMOTE=local node scripts/setup-workspace.mjs
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const REMOTE = process.env.TWENTY_REMOTE ?? 'local';
const cfg = JSON.parse(readFileSync(join(homedir(), '.twenty/config.json'), 'utf8')).remotes[REMOTE];
const BASE = cfg.apiUrl ?? cfg.url ?? 'http://localhost:2020';
const API_KEY = cfg.apiKey;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gql(query, variables, endpoint = '/metadata', attempt = 1) {
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

// Cloud builds (>= mid-2026) removed `isCustom` from metadata Object/Field. "Our" fields
// are detected by applicationId instead — resolved from the app's own front component.
const fcs = (await gql('{ frontComponents { name applicationId } }')).data.frontComponents;
const OUR_APP_ID = fcs.find((c) => c.name === 'flow-company-profile')?.applicationId;
if (!OUR_APP_ID) { console.error('ft-salesforce app not found on this remote — sync the app first'); process.exit(1); }

const meta = await gql('{ objects(paging: { first: 200 }) { edges { node { id nameSingular labelPlural icon isActive labelIdentifierFieldMetadataId fieldsList { id name applicationId type options isActive isSystem } } } } }');
const objects = Object.fromEntries(meta.data.objects.edges.map((e) => [e.node.nameSingular, e.node]));
const isOurs = (f) => f.applicationId === OUR_APP_ID;
const views = (await gql('{ getViews { id name objectMetadataId } }')).data.getViews;

// ---- 1. record-page viewFields + field groups ----
const PLANS = [
  { obj: 'company', group: 'Client Details', priority: ['leadStatus', 'companyId', 'clientId', 'applicationStatus', 'sfOwnerEmail', 'lifecycleStage', 'clientType', 'industry', 'leadSource', 'referringPartner', 'primaryPartnerAffiliation', 'desiredFundingAmount', 'accountingSoftware', 'source'] },
  { obj: 'person', group: 'Lead Details', priority: ['outreachUrl', 'outreachProspectId', 'outreachSequence', 'outreachLastEvent', 'outreachLastEventAt', 'sfOwnerEmail', 'sfLeadId', 'sfContactId'],
    // company-centric model (2026-07-22): pipeline/business/attribution moved to company —
    // hide the legacy person copies (data kept as audit trail)
    hide: ['leadStatus', 'lifecycleStage', 'clientType', 'companyName', 'accountingSoftware', 'invoicePlatforms', 'invoicePlatformsOther', 'doYouInvoiceBusinesses', 'annualRevenueBand', 'desiredFundingAmount', 'desiredFundingBand', 'primaryReasonForFunding', 'primaryReasonForFundingOther', 'howQuicklyDoYouNeedTheMoney', 'businessRegisteredIn', 'accountNotes', 'leadSource', 'howDidYouHearAboutUs', 'howDidYouHearAboutUsOther', 'partnerSource', 'partnerAgentId', 'primaryPartnerAffiliation', 'promoCode', 'hotList', 'disqualifiedReason', 'disqualifiedReasonOther', 'lostReason', 'lostReasonsOther', 'renurtureDate', 'renurtureReason', 'renurtureReasonOther', 'industry', 'website'] },
  { obj: 'task', group: 'Details', priority: ['priority', 'taskType'] },
];
for (const plan of PLANS) {
  const obj = objects[plan.obj];
  const view = views.find((v) => v.objectMetadataId === obj.id && /Record Page Fields/i.test(v.name));
  if (!view) { console.log(plan.obj, ': no record-page view — skipped'); continue; }
  const vRes = await gql('query V($id: String!) { getView(id: $id) { viewFieldGroups { id name } viewFields { id fieldMetadataId viewFieldGroupId } } }', { id: view.id });
  const { viewFieldGroups, viewFields } = vRes.data.getView;
  const byField = Object.fromEntries(viewFields.map((f) => [f.fieldMetadataId, f]));

  let group = viewFieldGroups.find((g) => g.name === plan.group);
  if (!group) {
    const r = await gql('mutation G($input: CreateViewFieldGroupInput!) { createViewFieldGroup(input: $input) { id } }',
      { input: { viewId: view.id, name: plan.group, position: 0.5, isVisible: true } });
    group = r?.data?.createViewFieldGroup;
    await sleep(650);
  }

  const hideSet = new Set(plan.hide ?? []);
  const customs = obj.fieldsList.filter((f) => isOurs(f) && f.type !== 'RELATION');
  customs.sort((a, b) => ((plan.priority.indexOf(a.name) + 1 || 99) - (plan.priority.indexOf(b.name) + 1 || 99)));
  let pos = 0; let created = 0; let moved = 0; let hidden = 0;
  for (const f of customs) {
    const existing = byField[f.id];
    if (hideSet.has(f.name)) {
      if (existing?.isVisible !== false) {
        if (existing) await gql('mutation U($input: UpdateViewFieldInput!) { updateViewField(input: $input) { id } }',
          { input: { id: existing.id, update: { isVisible: false } } });
        hidden++;
        await sleep(650);
      }
      continue;
    }
    if (!existing) {
      const r = await gql('mutation C($input: CreateViewFieldInput!) { createViewField(input: $input) { id } }',
        { input: { viewId: view.id, fieldMetadataId: f.id, isVisible: true, position: pos, viewFieldGroupId: group.id } });
      if (r?.data?.createViewField?.id) created++;
    } else if (!existing.viewFieldGroupId) {
      const r = await gql('mutation U($input: UpdateViewFieldInput!) { updateViewField(input: $input) { id } }',
        { input: { id: existing.id, update: { viewFieldGroupId: group.id, position: pos, isVisible: true } } });
      if (r?.data?.updateViewField?.id) moved++;
    }
    pos++; await sleep(650);
  }
  console.log(`${plan.obj}: group "${plan.group}" — ${created} created, ${moved} grouped, ${hidden} hidden`);
}

// ---- 2. Lead Pipeline kanban viewGroups ----
const pipeline = views.find((v) => v.name === 'Lead Pipeline');
if (pipeline) {
  const vg = (await gql('query V($id: String!) { getView(id: $id) { viewGroups { fieldValue } } }', { id: pipeline.id })).data.getView.viewGroups;
  const have = new Set(vg.map((g) => g.fieldValue));
  const options = objects.person.fieldsList.find((f) => f.name === 'leadStatus')?.options ?? [];
  let made = 0;
  for (const o of [...options].sort((a, b) => a.position - b.position)) {
    if (have.has(o.value)) continue;
    await gql('mutation G($input: CreateViewGroupInput!) { createViewGroup(input: $input) { id } }',
      { input: { viewId: pipeline.id, fieldValue: o.value, isVisible: true, position: o.position } });
    made++; await sleep(650);
  }
  if (!have.has('')) {
    await gql('mutation G($input: CreateViewGroupInput!) { createViewGroup(input: $input) { id } }',
      { input: { viewId: pipeline.id, fieldValue: '', isVisible: false, position: options.length } });
    made++;
  }
  console.log(`Lead Pipeline: ${made} kanban columns created`);
}

// ---- 3. Company layout: Company Profile tab (status banner + full-height Flow iframe) + Term Sheets panel ----
// GOTCHAS (hard-won, see docs/DATA-MODEL.md):
// - The tab MUST be created with layoutMode GRID — rowSpan drives widget height there.
//   VERTICAL_LIST ignores gridPosition and iframes collapse to the 150px browser default,
//   and updatePageLayoutTab silently ignores layoutMode changes (create-time only).
// - Widget titles can't be empty at create; create with a title, then update to ''.
// - A FRONT_COMPONENT widget shows "No Data" if its rendered content is empty or clipped —
//   the banner component always renders a full-width div, and gets 2 grid rows.
// Embed URL per remote (override with FLOW_EMBED_URL):
//   local — /go redirects to the Live-Server-hosted flow-handover/embed.html, which polls
//           the relay (scripts/flow-embed-relay.mjs) for the record's company id
//   cloud — the app's own same-origin BRIDGE page (/s/flow-bridge, Frans's pattern,
//           2026-07-20): reads the record UUID from window.parent.location (legal —
//           same origin), resolves it to companyId via /s/flow-bridge/resolve, then
//           navigates the iframe to Flow's /embed with the id → per-record preselect
//           WITHOUT twentyhq/twenty#23073. See src/logic-functions/flow-bridge*.ts.
const FLOW_DASHBOARD_URL = process.env.FLOW_EMBED_URL
  ?? (REMOTE === 'local'
    ? 'http://127.0.0.1:5511/go'
    : 'https://fundthrough-sales.twenty.com/s/flow-bridge');
const layouts = (await gql('{ getPageLayouts { id name tabs { id title layoutMode widgets { id title type configuration { ... on FieldConfiguration { fieldMetadataId } ... on FrontComponentConfiguration { frontComponentId } } } } } }')).data.getPageLayouts;
const companyLayout = layouts.find((l) => l.name === 'Default Company Layout');
if (companyLayout) {
  const fcs = (await gql('{ frontComponents { id name } }')).data.frontComponents;
  const flowFc = fcs.find((c) => c.name === 'flow-company-profile');
  let profileTab = companyLayout.tabs.find((t) => t.title === 'Company Profile');
  if (profileTab && profileTab.layoutMode !== 'GRID') {
    await gql('mutation { destroyPageLayoutTab(id: "' + profileTab.id + '") }');
    profileTab = undefined;
    console.log('non-GRID Company Profile tab replaced');
    await sleep(650);
  }
  if (!profileTab) {
    const tab = await gql('mutation T($input: CreatePageLayoutTabInput!) { createPageLayoutTab(input: $input) { id } }',
      { input: { pageLayoutId: companyLayout.id, title: 'Company Profile', position: 90, layoutMode: 'GRID' } });
    profileTab = { id: tab.data.createPageLayoutTab.id, widgets: [] };
    console.log('Company Profile tab created (GRID)');
    await sleep(650);
  }
  const blankTitle = async (widgetId) => {
    await gql('mutation U($id: String!, $input: UpdatePageLayoutWidgetInput!) { updatePageLayoutWidget(id: $id, input: $input) { id } }',
      { id: widgetId, input: { title: '' } });
  };
  if (!profileTab.widgets.some((w) => w.type === 'IFRAME')) {
    const w = await gql('mutation W($input: CreatePageLayoutWidgetInput!) { createPageLayoutWidget(input: $input) { id } }',
      { input: { pageLayoutTabId: profileTab.id, title: 'Flow', type: 'IFRAME',
        gridPosition: { row: 0, column: 0, rowSpan: 15, columnSpan: 12 },
        configuration: { configurationType: 'IFRAME', url: FLOW_DASHBOARD_URL } } });
    await sleep(650);
    await blankTitle(w.data.createPageLayoutWidget.id);
    console.log('Flow iframe widget created (full tab)');
    await sleep(650);
  }
  // (validator front-component widget retired 2026-07-22 — the /s/flow-bridge handles
  // missing-companyId fallback itself; 8c destroys any lingering instance)
  const home = companyLayout.tabs.find((t) => t.title === 'Home');
  const oppField = objects.company.fieldsList.find((f) => f.name === 'opportunities');
  const tsField = objects.company.fieldsList.find((f) => f.name === 'termSheets');
  const oppWidget = home?.widgets.find((w) => w.type === 'FIELD' && w.configuration?.fieldMetadataId === oppField?.id);
  const hasTs = home?.widgets.some((w) => w.type === 'FIELD' && w.configuration?.fieldMetadataId === tsField?.id);
  if (oppWidget) { await gql('mutation { destroyPageLayoutWidget(id: "' + oppWidget.id + '") }'); console.log('Opportunities panel removed'); await sleep(650); }
  if (tsField && home && !hasTs) {
    await gql('mutation W($input: CreatePageLayoutWidgetInput!) { createPageLayoutWidget(input: $input) { id } }',
      { input: { pageLayoutTabId: home.id, title: 'Term Sheets', type: 'FIELD',
        gridPosition: { row: 0, column: 0, rowSpan: 12, columnSpan: 12 },
        configuration: { configurationType: 'FIELD', fieldMetadataId: tsField.id, fieldDisplayMode: 'CARD' } } });
    console.log('Term Sheets panel added');
  }
}

// ---- 4. (retired 2026-07-22: Leads nav now targets the company kanban — see 8a) ----
// ---- 5. Opportunity object: not needed by sales (per Linesh, 2026-07-14) ----
// Deactivation hides the object (nav, panels, search) but preserves existing rows.
// Skip with KEEP_OPPORTUNITIES=1 if a workspace still uses them.
if (objects.opportunity?.isActive && !process.env.KEEP_OPPORTUNITIES) {
  const oppNav = (await gql('{ navigationMenuItems { id type targetObjectMetadataId } }')).data.navigationMenuItems
    .find((n) => n.type === 'OBJECT' && n.targetObjectMetadataId === objects.opportunity.id);
  if (oppNav) { await gql('mutation { deleteNavigationMenuItem(id: "' + oppNav.id + '") { id } }'); await sleep(650); }
  const r = await gql('mutation D($input: UpdateOneObjectInput!) { updateOneObject(input: $input) { id isActive } }',
    { input: { id: objects.opportunity.id, update: { isActive: false } } });
  console.log('opportunity object deactivated:', r?.data?.updateOneObject?.isActive === false ? 'OK' : JSON.stringify(r?.errors?.[0]?.message ?? '').slice(0, 160));
}
// ---- 6. Dialpad: Calls nav + unmatched-call review view + relation panels ----
const call = objects.call;
if (call) {
  // 6a. Calls nav item
  const callNavs = (await gql('{ navigationMenuItems { id type viewId targetObjectMetadataId } }')).data.navigationMenuItems;
  if (!callNavs.some((n) => n.type === 'OBJECT' && n.targetObjectMetadataId === call.id)) {
    await gql('mutation C($input: CreateNavigationMenuItemInput!) { createNavigationMenuItem(input: $input) { id } }',
      { input: { type: 'OBJECT', name: 'Calls', targetObjectMetadataId: call.id, icon: 'IconPhone', position: 11 } });
    console.log('Calls nav item created');
    await sleep(650);
  }

  // 6b. "Dialpad — Unmatched" task view: the review queue for calls from unknown numbers
  // (process-dialpad-event creates unassigned tasks titled "Unmatched call: +1…")
  const task = objects.task;
  const allViews = (await gql('{ getViews { id name objectMetadataId } }')).data.getViews;
  if (!allViews.some((v) => v.name === 'Dialpad — Unmatched' && v.objectMetadataId === task.id)) {
    const r = await gql('mutation V($input: CreateViewInput!) { createView(input: $input) { id } }',
      { input: { name: 'Dialpad — Unmatched', objectMetadataId: task.id, type: 'TABLE', icon: 'IconPhoneX' } });
    const unmatchedView = r?.data?.createView;
    await sleep(650);
    if (unmatchedView) {
      const titleField = task.fieldsList.find((f) => f.name === 'title');
      const statusField = task.fieldsList.find((f) => f.name === 'status');
      if (titleField) {
        await gql('mutation F($input: CreateViewFilterInput!) { createViewFilter(input: $input) { id } }',
          { input: { viewId: unmatchedView.id, fieldMetadataId: titleField.id, operand: 'CONTAINS', value: 'Unmatched call:' } });
        await sleep(650);
      }
      if (statusField) {
        await gql('mutation F($input: CreateViewFilterInput!) { createViewFilter(input: $input) { id } }',
          { input: { viewId: unmatchedView.id, fieldMetadataId: statusField.id, operand: 'IS_NOT', value: JSON.stringify(['DONE']) } });
        await sleep(650);
      }
      let colPos = 0;
      for (const name of ['title', 'status', 'assignee', 'dueAt', 'createdAt']) {
        const f = task.fieldsList.find((x) => x.name === name);
        if (!f) continue;
        await gql('mutation C($input: CreateViewFieldInput!) { createViewField(input: $input) { id } }',
          { input: { viewId: unmatchedView.id, fieldMetadataId: f.id, isVisible: true, position: colPos++ } });
        await sleep(650);
      }
      console.log('Dialpad — Unmatched task view created');
    }
  }

  // 6c. Calls relation sidebar panels — RETIRED 2026-07-24 for both person and company:
  // replaced by the §8d full-page Calls table tabs (§8d also removes any leftover panels).
}
// ---- 7. Layout cleanup (Linesh 2026-07-20): nav dedupe + Leads-first order, contaminated
// view removal, Calls views, curated table columns. All idempotent.
{
  const navAll = (await gql('{ navigationMenuItems { id name type position viewId targetObjectMetadataId folderId } }')).data.navigationMenuItems;
  const topLevel = navAll.filter((n) => !n.folderId);

  // 7a. dedupe object nav items (keep the lowest-position one per object)
  const navByObject = {};
  for (const n of topLevel.filter((x) => x.type === 'OBJECT' && x.targetObjectMetadataId)) {
    (navByObject[n.targetObjectMetadataId] ??= []).push(n);
  }
  for (const list of Object.values(navByObject)) {
    list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (const dupe of list.slice(1)) {
      await gql('mutation { deleteNavigationMenuItem(id: "' + dupe.id + '") { id } }');
      console.log('nav duplicate removed:', dupe.id);
      await sleep(650);
    }
  }

  // 7b. Leads-first order; first item is also the login landing page
  const pipelineNav = topLevel.find((n) => n.type === 'VIEW' && n.viewId === pipeline?.id);
  const keeper = (objName) => navByObject[objects[objName]?.id]?.[0];
  const desiredOrder = [
    [pipelineNav, 0], [keeper('company'), 1], [keeper('person'), 2], [keeper('call'), 3],
    [keeper('termSheet'), 4], [keeper('task'), 5], [keeper('note'), 6], [keeper('dashboard'), 7],
    [topLevel.find((n) => n.type === 'FOLDER'), 8],
  ];
  for (const [item, pos] of desiredOrder) {
    if (!item || item.position === pos) continue;
    const r = await gql('mutation U($input: UpdateOneNavigationMenuItemInput!) { updateNavigationMenuItem(input: $input) { id } }',
      { input: { id: item.id, update: { position: pos } } });
    if (!r?.data) console.log('nav reorder failed:', JSON.stringify(r?.errors)?.slice(0, 150));
    await sleep(650);
  }
  console.log('nav ordered Leads-first');

  // 7d. contaminated / dead views: HubSpot leftovers (isolation rule) + deactivated opportunity.
  // deleteView sets isActive=false which removes the view from the UI — rows persist in
  // getViews (destroyView returns true but is a no-op on active rows), so treat inactive as done.
  const allViews7 = (await gql('{ getViews { id name objectMetadataId isActive } }')).data.getViews;
  for (const v of allViews7) {
    const isHs = v.name === 'HS Companies' || v.name === 'HS Contacts';
    const isOpp = objects.opportunity && v.objectMetadataId === objects.opportunity.id;
    if ((!isHs && !isOpp) || v.isActive === false) continue;
    await gql('mutation D($id: String!) { deleteView(id: $id) }', { id: v.id });
    console.log('view deactivated:', v.name);
    await sleep(650);
  }

  // helper: ensure a view shows exactly these columns in order (and hides the listed noise)
  const ensureColumns = async (view, objName, show, hide) => {
    if (!view) return;
    // a just-created view can lag before getView sees it
    let viewData = null;
    for (let attempt = 0; attempt < 4 && !viewData; attempt++) {
      viewData = (await gql('query V($id: String!) { getView(id: $id) { viewFields { id fieldMetadataId isVisible position } } }', { id: view.id })).data?.getView;
      if (!viewData) await sleep(1500);
    }
    if (!viewData) { console.log(`${objName} view "${view.name}": not readable — skipped`); return; }
    const vf = viewData.viewFields;
    const fieldByName = Object.fromEntries(objects[objName].fieldsList.map((f) => [f.name, f]));
    const vfByField = Object.fromEntries(vf.map((x) => [x.fieldMetadataId, x]));
    let pos = 0;
    for (const name of show) {
      const f = fieldByName[name];
      if (!f) { console.log(`  ${objName}.${name}: field not found — skipped`); continue; }
      const existing = vfByField[f.id];
      if (existing) {
        if (existing.position !== pos || !existing.isVisible) {
          await gql('mutation U($input: UpdateViewFieldInput!) { updateViewField(input: $input) { id } }',
            { input: { id: existing.id, update: { position: pos, isVisible: true } } });
          await sleep(650);
        }
      } else {
        await gql('mutation C($input: CreateViewFieldInput!) { createViewField(input: $input) { id } }',
          { input: { viewId: view.id, fieldMetadataId: f.id, isVisible: true, position: pos } });
        await sleep(650);
      }
      pos++;
    }
    for (const name of hide) {
      const f = fieldByName[name];
      const existing = f && vfByField[f.id];
      if (existing?.isVisible) {
        await gql('mutation U($input: UpdateViewFieldInput!) { updateViewField(input: $input) { id } }',
          { input: { id: existing.id, update: { isVisible: false } } });
        await sleep(650);
      }
    }
    console.log(`${objName} view "${view.name}": columns curated`);
  };

  // 7e. All Calls index view (the Call object shipped with no views — table rendered empty)
  let callIndex = allViews7.find((v) => v.name === 'All Calls' && v.objectMetadataId === objects.call?.id);
  if (!callIndex && objects.call) {
    const r = await gql('mutation V($input: CreateViewInput!) { createView(input: $input) { id name } }',
      { input: { name: 'All Calls', objectMetadataId: objects.call.id, type: 'TABLE', key: 'INDEX', icon: 'IconPhone' } });
    callIndex = r?.data?.createView;
    console.log('All Calls index view created');
    await sleep(650);
  }
  await ensureColumns(callIndex, 'call',
    ['name', 'outcome', 'direction', 'person', 'company', 'startedAt', 'durationSeconds', 'dialpadUser', 'externalNumber'],
    []);

  // 7f. record-page fields views + groups for call and termSheet (missing since creation)
  for (const plan7 of [
    { obj: 'call', viewName: 'Call Record Page Fields', group: 'Call Details', priority: ['outcome', 'direction', 'startedAt', 'durationSeconds', 'externalNumber', 'dialpadUser', 'recordingUrl', 'voicemailUrl', 'voicemailTranscript', 'messageText', 'dialpadCallId'] },
    { obj: 'termSheet', viewName: 'Term Sheet Record Page Fields', group: 'Facility Terms', priority: ['status', 'onboardDate'] },
  ]) {
    const obj = objects[plan7.obj];
    if (!obj) continue;
    let fieldsView = allViews7.find((v) => v.objectMetadataId === obj.id && /Record Page Fields/i.test(v.name));
    if (!fieldsView) {
      const r = await gql('mutation V($input: CreateViewInput!) { createView(input: $input) { id name } }',
        { input: { name: plan7.viewName, objectMetadataId: obj.id, type: 'FIELDS_WIDGET', icon: 'IconListDetails' } });
      fieldsView = r?.data?.createView;
      if (!fieldsView) { console.log(plan7.viewName, 'create failed:', JSON.stringify(r?.errors)?.slice(0, 160)); continue; }
      console.log(plan7.viewName, 'created');
      await sleep(2000); // fresh views lag before getView / child mutations see them
    }
    let viewData7 = null;
    for (let attempt = 0; attempt < 4 && !viewData7; attempt++) {
      viewData7 = (await gql('query V($id: String!) { getView(id: $id) { viewFieldGroups { id name } viewFields { id fieldMetadataId viewFieldGroupId } } }', { id: fieldsView.id })).data?.getView;
      if (!viewData7) await sleep(1500);
    }
    if (!viewData7) { console.log(plan7.viewName, 'not readable — skipped'); continue; }
    let group = viewData7.viewFieldGroups.find((g) => g.name === plan7.group);
    if (!group) {
      for (let attempt = 0; attempt < 3 && !group; attempt++) {
        const r = await gql('mutation G($input: CreateViewFieldGroupInput!) { createViewFieldGroup(input: $input) { id } }',
          { input: { viewId: fieldsView.id, name: plan7.group, position: 0.5, isVisible: true } });
        group = r?.data?.createViewFieldGroup;
        if (!group) { console.log('  group create retry:', JSON.stringify(r?.errors)?.slice(0, 120)); await sleep(1500); }
      }
      await sleep(650);
    }
    if (!group) { console.log(plan7.viewName, 'group create failed — skipped'); continue; }
    const byField7 = Object.fromEntries(viewData7.viewFields.map((f) => [f.fieldMetadataId, f]));
    const customs7 = obj.fieldsList.filter((f) => isOurs(f) && f.type !== 'RELATION');
    customs7.sort((a, b) => ((plan7.priority.indexOf(a.name) + 1 || 99) - (plan7.priority.indexOf(b.name) + 1 || 99)));
    let p7 = 0;
    for (const f of customs7) {
      const existing = byField7[f.id];
      if (!existing) {
        await gql('mutation C($input: CreateViewFieldInput!) { createViewField(input: $input) { id } }',
          { input: { viewId: fieldsView.id, fieldMetadataId: f.id, isVisible: true, position: p7, viewFieldGroupId: group.id } });
      } else if (!existing.viewFieldGroupId) {
        await gql('mutation U($input: UpdateViewFieldInput!) { updateViewField(input: $input) { id } }',
          { input: { id: existing.id, update: { viewFieldGroupId: group.id, position: p7, isVisible: true } } });
      }
      p7++; await sleep(650);
    }
    console.log(`${plan7.obj}: record-page fields grouped under "${plan7.group}"`);
  }

  // 7g. curated columns on the main tables (custom fields forward, empty default noise hidden)
  const companyIndex = allViews7.find((v) => v.name === 'All Companies' && v.objectMetadataId === objects.company.id);
  await ensureColumns(companyIndex, 'company',
    ['name', 'companyId', 'applicationStatus', 'industry', 'accountOwner', 'source', 'domainName', 'createdAt'],
    ['employees', 'linkedinLink', 'xLink', 'createdBy', 'address']);
  const peopleIndex = allViews7.find((v) => v.name === 'All People' && v.objectMetadataId === objects.person.id);
  await ensureColumns(peopleIndex, 'person',
    ['name', 'leadStatus', 'companyName', 'phones', 'emails', 'leadSource', 'createdAt'],
    ['linkedinLink', 'xLink', 'jobTitle', 'city', 'createdBy']);
}

// ---- 8c. company side panel order (Linesh 2026-07-22): Fields, People, Term Sheets ----
{
  const layouts8c = (await gql('{ getPageLayouts { id name tabs { id title widgets { id type gridPosition { row column rowSpan columnSpan } configuration { ... on FieldConfiguration { fieldMetadataId } } } } } }')).data.getPageLayouts;
  const compLayout = layouts8c.find((l) => l.name === 'Default Company Layout');
  const home8c = compLayout?.tabs.find((tb) => tb.title === 'Home');
  if (home8c) {
    const relId = (nm) => objects.company.fieldsList.find((f) => f.name === nm && f.type === 'RELATION')?.id;
    const wantRel = { people: relId('people'), termSheets: relId('termSheets') };
    for (const w of home8c.widgets.filter((x) => x.type === 'FRONT_COMPONENT')) {
      await gql('mutation D($id: String!) { destroyPageLayoutWidget(id: $id) }', { id: w.id });
      console.log('obsolete validator widget removed');
      await sleep(650);
    }
    const fieldsWidget = home8c.widgets.find((w) => w.type === 'FIELDS');
    const ordered = [
      fieldsWidget,
      home8c.widgets.find((w) => w.type === 'FIELD' && w.configuration?.fieldMetadataId === wantRel.people),
      home8c.widgets.find((w) => w.type === 'FIELD' && w.configuration?.fieldMetadataId === wantRel.termSheets),
    ].filter(Boolean);
    let row8c = 0; let moved8c = 0;
    for (const w of ordered) {
      if (w.gridPosition?.row !== row8c) {
        await gql('mutation U($id: String!, $input: UpdatePageLayoutWidgetInput!) { updatePageLayoutWidget(id: $id, input: $input) { id } }',
          { id: w.id, input: { gridPosition: { row: row8c, column: 0, rowSpan: w.gridPosition?.rowSpan ?? 12, columnSpan: 12 } } });
        moved8c++; await sleep(650);
      }
      row8c += w.gridPosition?.rowSpan ?? 12;
    }
    console.log('company side panel ordered (Fields, People, Term Sheets): ' + moved8c + ' moved');
  }
}

// ---- 8d. full-page TABLE tabs (Linesh 2026-07-24): person Calls + Campaign Engagements,
// company Calls. Recipe (mirrors frontend buildRecordTableWidgetViewSnapshot): a TABLE_WIDGET
// view on the target object with a current-record filter on its relation back to the layout
// object, referenced by a FIELD widget (fieldDisplayMode TABLE) in a GRID tab.
// campaignEngagement object belongs to the Marketo admin's app — layout/view-level only.
{
  const layouts8d = (await gql('{ getPageLayouts { id name tabs { id title layoutMode widgets { id title type gridPosition { row rowSpan } configuration { ... on FieldConfiguration { fieldMetadataId viewId } } } } } }')).data.getPageLayouts;
  const allViews8d = (await gql('{ getViews { id name objectMetadataId type } }')).data.getViews;
  const targetOf = (nm) => Object.values(objects).find((o) => o.nameSingular === nm);

  const ensureWidgetView = async (targetObj, backRelName, viewName) => {
    // reuse only a non-empty existing widget view (orphaned shells have no fields)
    for (const v of allViews8d.filter((x) => x.objectMetadataId === targetObj.id && x.type === 'TABLE_WIDGET' && x.name === viewName)) {
      const vf = (await gql('{ getViewFields(viewId: "' + v.id + '") { id } }')).data?.getViewFields ?? [];
      if (vf.length > 0) return v.id;
    }
    const created = await gql('mutation V($input: CreateViewInput!) { createView(input: $input) { id } }',
      { input: { name: viewName, objectMetadataId: targetObj.id, type: 'TABLE_WIDGET', icon: targetObj.icon ?? 'IconTable', openRecordIn: 'RECORD_PAGE', visibility: 'WORKSPACE', isCompact: false, position: 0 } });
    const viewId = created?.data?.createView?.id;
    if (!viewId) { console.log(viewName + ' create failed: ' + String(JSON.stringify(created?.errors)).slice(0, 150)); return null; }
    const eligible = targetObj.fieldsList.filter((f) => (f.isActive && !f.isSystem && f.type !== 'RELATION') || f.id === targetObj.labelIdentifierFieldMetadataId);
    const sorted = [eligible.find((f) => f.id === targetObj.labelIdentifierFieldMetadataId), ...eligible.filter((f) => f.id !== targetObj.labelIdentifierFieldMetadataId)].filter(Boolean);
    await gql('mutation F($inputs: [CreateViewFieldInput!]!) { createManyViewFields(inputs: $inputs) { id } }',
      { inputs: sorted.map((f, i) => ({ fieldMetadataId: f.id, viewId, position: i, size: 180, isVisible: i < 6 })) });
    const backRel = targetObj.fieldsList.find((f) => f.name === backRelName && f.type === 'RELATION');
    await gql('mutation FL($input: CreateViewFilterInput!) { createViewFilter(input: $input) { id } }',
      { input: { viewId, fieldMetadataId: backRel.id, operand: 'IS',
        value: { isCurrentRecordSelected: true, isCurrentWorkspaceMemberSelected: false, selectedRecordIds: [] } } });
    return viewId;
  };

  const ensureTableTab = async (layout, tabTitle, position, relField, targetObj, backRelName, viewName) => {
    if (!layout || !relField || !targetObj) { console.log(tabTitle + ': layout/field/object missing — skipped'); return; }
    const viewId = await ensureWidgetView(targetObj, backRelName, viewName);
    if (!viewId) return;
    let tab = layout.tabs.find((t8) => t8.title === tabTitle);
    // GRID is create-time only: replace a wrong-mode tab
    if (tab && tab.layoutMode !== 'GRID') {
      await gql('mutation { destroyPageLayoutTab(id: "' + tab.id + '") }');
      console.log(layout.name + ' / ' + tabTitle + ': non-GRID tab replaced');
      tab = null;
      await sleep(650);
    }
    if (!tab) {
      const r = await gql('mutation T($input: CreatePageLayoutTabInput!) { createPageLayoutTab(input: $input) { id } }',
        { input: { pageLayoutId: layout.id, title: tabTitle, position, layoutMode: 'GRID' } });
      tab = r?.data?.createPageLayoutTab;
      if (!tab) { console.log(tabTitle + ' tab create failed: ' + String(JSON.stringify(r?.errors)).slice(0, 120)); return; }
      tab.widgets = [];
      await sleep(1500);
    }
    const existing = (tab.widgets ?? []).find((w) => w.type === 'FIELD' && w.configuration?.fieldMetadataId === relField.id);
    if (existing && existing.configuration?.viewId !== viewId) {
      await gql('mutation U($id: String!, $input: UpdatePageLayoutWidgetInput!) { updatePageLayoutWidget(id: $id, input: $input) { id } }',
        { id: existing.id, input: { configuration: { configurationType: 'FIELD', fieldMetadataId: relField.id, fieldDisplayMode: 'TABLE', viewId } } });
      console.log(layout.name + ' / ' + tabTitle + ': widget viewId patched');
    } else if (!existing) {
      const w = await gql('mutation W($input: CreatePageLayoutWidgetInput!) { createPageLayoutWidget(input: $input) { id } }',
        { input: { pageLayoutTabId: tab.id, title: tabTitle, type: 'FIELD',
          gridPosition: { row: 0, column: 0, rowSpan: 15, columnSpan: 12 },
          configuration: { configurationType: 'FIELD', fieldMetadataId: relField.id, fieldDisplayMode: 'TABLE', viewId } } });
      if (w?.data?.createPageLayoutWidget?.id) {
        await sleep(650);
        await gql('mutation U($id: String!, $input: UpdatePageLayoutWidgetInput!) { updatePageLayoutWidget(id: $id, input: $input) { id } }',
          { id: w.data.createPageLayoutWidget.id, input: { title: '' } });
        console.log(layout.name + ' / ' + tabTitle + ': TABLE tab ready');
      } else console.log(tabTitle + ' widget failed: ' + String(JSON.stringify(w?.errors)).slice(0, 120));
      await sleep(650);
    }
  };

  const removeHomeCallsPanel = async (layout, objName) => {
    const home = layout?.tabs.find((t8) => t8.title === 'Home');
    const callsRel = objects[objName]?.fieldsList.find((f) => f.name === 'calls' && f.type === 'RELATION');
    for (const w of (home?.widgets ?? []).filter((x) => x.type === 'FIELD' && x.configuration?.fieldMetadataId === callsRel?.id)) {
      await gql('mutation { destroyPageLayoutWidget(id: "' + w.id + '") }');
      console.log('Calls sidebar panel removed from ' + objName + ' Home');
      await sleep(650);
    }
  };

  const personLayout = layouts8d.find((l) => l.name === 'Default Person Layout');
  const companyLayout = layouts8d.find((l) => l.name === 'Default Company Layout');
  const personRel = (nm) => objects.person?.fieldsList.find((f) => f.name === nm && f.type === 'RELATION');
  const companyRel = (nm) => objects.company?.fieldsList.find((f) => f.name === nm && f.type === 'RELATION');

  await ensureTableTab(personLayout, 'Calls', 80, personRel('calls'), targetOf('call'), 'person', 'Calls Table');
  await ensureTableTab(personLayout, 'Campaign Engagements', 81, personRel('campaignEngagements'), targetOf('campaignEngagement'), 'person', 'Campaign Engagements Table');
  await ensureTableTab(companyLayout, 'Calls', 80, companyRel('calls'), targetOf('call'), 'company', 'Calls Table (Company)');
  // company CE aggregation rides on the materialized campaignEngagement.company relation
  // (derived from person.company — see scripts/backfill-ce-company.mjs)
  await ensureTableTab(companyLayout, 'Campaign Engagements', 85, companyRel('campaignEngagements'), targetOf('campaignEngagement'), 'company', 'Campaign Engagements Table (Company)');
  await removeHomeCallsPanel(personLayout, 'person');
  await removeHomeCallsPanel(companyLayout, 'company');
}

// ---- 8b. person layout: remove Opportunities relation panel (object deactivated) ----
{
  const layouts8b = (await gql('{ getPageLayouts { id name tabs { id title widgets { id type configuration { ... on FieldConfiguration { fieldMetadataId } } } } } }')).data.getPageLayouts;
  const personLayout = layouts8b.find((l) => l.name === 'Default Person Layout');
  const oppRelFields = new Set((objects.person?.fieldsList ?? []).filter((f) => f.type === 'RELATION' && /opportunit/i.test(f.name)).map((f) => f.id));
  if (personLayout && oppRelFields.size) {
    for (const tab of personLayout.tabs) {
      for (const w of tab.widgets.filter((x) => x.type === 'FIELD' && oppRelFields.has(x.configuration?.fieldMetadataId))) {
        await gql('mutation { destroyPageLayoutWidget(id: "' + w.id + '") }');
        console.log('person Opportunities panel removed (tab: ' + tab.title + ')');
        await sleep(650);
      }
    }
  }
}

// ---- 8a. Leads nav -> source-owned company kanban (src/views/company-pipeline.view.ts);
// nav is workspace-owned (sync can't resolve same-manifest view references) ----
{
  const views8a = (await gql('{ getViews { id name type objectMetadataId isActive } }')).data.getViews;
  const leadsKanban = views8a.find((v) => v.name === 'Leads' && v.type === 'KANBAN' && v.objectMetadataId === objects.company.id && v.isActive !== false);
  if (!leadsKanban) console.log('source Leads kanban not found - sync the app first');
  else {
    // kanban columns: one viewGroup per leadStatus option (+ hidden empty) — source views
    // don't auto-generate groups, and a group-less kanban renders empty
    const vg8a = (await gql('query V($id: String!) { getView(id: $id) { viewGroups { fieldValue } } }', { id: leadsKanban.id })).data.getView.viewGroups;
    const have8a = new Set(vg8a.map((g) => g.fieldValue));
    const opts8a = objects.company.fieldsList.find((f) => f.name === 'leadStatus')?.options ?? [];
    let made8a = 0;
    for (const o of [...opts8a].sort((a, b) => a.position - b.position)) {
      if (have8a.has(o.value)) continue;
      await gql('mutation G($input: CreateViewGroupInput!) { createViewGroup(input: $input) { id } }',
        { input: { viewId: leadsKanban.id, fieldValue: o.value, isVisible: true, position: o.position } });
      made8a++; await sleep(650);
    }
    if (!have8a.has('')) {
      await gql('mutation G($input: CreateViewGroupInput!) { createViewGroup(input: $input) { id } }',
        { input: { viewId: leadsKanban.id, fieldValue: '', isVisible: false, position: opts8a.length } });
      made8a++;
    }
    if (made8a) console.log('company kanban columns created: ' + made8a);
    const navs8a = (await gql('{ navigationMenuItems { id type viewId folderId } }')).data.navigationMenuItems.filter((n) => !n.folderId);
    for (const n of navs8a.filter((x) => x.type === 'VIEW' && x.viewId !== leadsKanban.id)) {
      await gql('mutation { deleteNavigationMenuItem(id: "' + n.id + '") { id } }');
      console.log('stale VIEW nav removed');
      await sleep(650);
    }
    if (!navs8a.some((n) => n.type === 'VIEW' && n.viewId === leadsKanban.id)) {
      await gql('mutation C($input: CreateNavigationMenuItemInput!) { createNavigationMenuItem(input: $input) { id } }',
        { input: { type: 'VIEW', name: 'Leads', viewId: leadsKanban.id, icon: 'IconTargetArrow', position: 0 } });
      console.log('Leads nav -> company kanban created');
      await sleep(650);
    }
  }
}

// ---- 8. Plumbing-id hiding (kanban + Leads nav are SOURCE-owned since 2026-07-22:
// src/views/company-pipeline.view.ts + src/navigation-menu-items/leads.navigation-menu-item.ts) ----
{
  const compFieldsView = views.find((v) => v.objectMetadataId === objects.company.id && /Record Page Fields/i.test(v.name));
  if (compFieldsView) {
    const vf8 = (await gql('query V($id: String!) { getView(id: $id) { viewFields { id fieldMetadataId isVisible } } }', { id: compFieldsView.id })).data.getView.viewFields;
    for (const nm of ['sfClientId', 'sfAccountId']) {
      const f = objects.company.fieldsList.find((x) => x.name === nm);
      const existing = f && vf8.find((x) => x.fieldMetadataId === f.id);
      if (existing?.isVisible) {
        await gql('mutation U($input: UpdateViewFieldInput!) { updateViewField(input: $input) { id } }',
          { input: { id: existing.id, update: { isVisible: false } } });
        await sleep(650);
      }
    }
    console.log('plumbing ids hidden on company record page');
  }
}

console.log('WORKSPACE SETUP COMPLETE');
