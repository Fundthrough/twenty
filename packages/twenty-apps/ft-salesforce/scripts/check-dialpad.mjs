// READ-ONLY Dialpad account probe — Phase 0 of the Dialpad integration plan.
// Verifies what FT's Dialpad plan/key can do BEFORE any build: API access, departments
// (to find the sales-department subscription target), webhook + event-subscription
// endpoints, and whether SMS subscriptions / recording access are permitted.
// Touches NOTHING in Twenty and creates NOTHING in Dialpad (GET-only).
// Usage: DIALPAD_API_KEY=… node scripts/check-dialpad.mjs > /tmp/dialpad-check.json
const BASE = 'https://dialpad.com/api/v2';
const API_KEY = process.env.DIALPAD_API_KEY;
if (!API_KEY) { console.error('DIALPAD_API_KEY not set'); process.exit(1); }

// 403 on a valid key means the plan/scope doesn't cover that endpoint — that's a
// finding, not an error, so every probe reports status instead of throwing.
async function probe(name, path) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    });
    const body = await res.json().catch(() => null);
    return { name, path, status: res.status, ok: res.ok, body };
  } catch (e) {
    return { name, path, status: 0, ok: false, error: String(e) };
  }
}

const results = {};
const verdicts = [];

const company = await probe('company', '/company');
results.company = company;
if (company.status === 401) {
  console.error('ABORT: Dialpad rejected the key (401) — re-check DIALPAD_API_KEY');
  process.exit(1);
}
verdicts.push(`API access: ${company.ok ? 'YES' : `NO (${company.status})`}${company.body?.name ? ` — company "${company.body.name}"` : ''}`);

const departments = await probe('departments', '/departments?limit=100');
results.departments = departments;
const deptItems = departments.body?.items ?? [];
verdicts.push(`Departments listable: ${departments.ok ? `YES — ${deptItems.length} found` : `NO (${departments.status})`}`);
if (departments.ok) {
  // candidate subscription targets — Linesh picks the sales one from this list
  results.departmentCandidates = deptItems.map((d) => ({ id: d.id, name: d.name }));
}

const offices = await probe('offices', '/offices?limit=100');
results.offices = offices;
verdicts.push(`Offices listable: ${offices.ok ? `YES — ${(offices.body?.items ?? []).length} found` : `NO (${offices.status})`}`);

const webhooks = await probe('webhooks', '/webhooks?limit=10');
results.webhooks = webhooks;
verdicts.push(`Webhook API: ${webhooks.ok ? `YES — ${(webhooks.body?.items ?? []).length} existing` : `NO (${webhooks.status})`}`);

const callSubs = await probe('call_event_subscriptions', '/subscriptions/call?limit=10');
results.callSubscriptions = callSubs;
verdicts.push(`Call event subscriptions: ${callSubs.ok ? `YES — ${(callSubs.body?.items ?? []).length} existing` : `NO (${callSubs.status})`}`);

const smsSubs = await probe('sms_event_subscriptions', '/subscriptions/sms?limit=10');
results.smsSubscriptions = smsSubs;
verdicts.push(`SMS event subscriptions: ${smsSubs.ok ? 'YES' : `NO (${smsSubs.status})`}`);

// recordings access rides on the key's recordings_export scope; the calls list is the
// cheapest read-only signal (a 403 here = scope missing, calls themselves unaffected)
const calls = await probe('calls_list', '/call?limit=1');
results.callsList = calls;
verdicts.push(`Calls list API: ${calls.ok ? 'YES' : `NO (${calls.status})`}`);

results.summary = verdicts;
console.error('\n== Dialpad Phase 0 verdicts ==');
for (const v of verdicts) console.error('  - ' + v);
console.error('\nFull JSON on stdout (redirect to a file). Pick the sales department id from departmentCandidates.');
console.log(JSON.stringify(results, null, 2));
