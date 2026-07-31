// Collapse per-record arrays in an import/recon report into counts, so a report can be
// committed without carrying customer identities. Reports exist to answer "how many, and
// why" -- the individual names and ids were never the diagnostic value.
//
// Usage:  node scripts/redact-report.mjs docs/import-report-2026-07-23.json [...more]
//         node scripts/redact-report.mjs --check docs/*.json      # report only, no writes
//
// Any non-empty array whose elements look like records ({id}/{name}/{email}, or free strings)
// is replaced by `<key>Count` plus, where a reason is recoverable, a `<key>Summary` histogram.
// Everything else is left untouched. There is deliberately no size threshold: three leaked
// records is still a leak, and an earlier 25-entry cutoff let exactly that through.
// Run it only on import/recon reports -- on a workspace-metadata dump it would also collapse
// legitimately useful arrays like `views`, which is what `--check` is for.
import { readFileSync, writeFileSync } from 'node:fs';
const checkOnly = process.argv.includes('--check');
const files = process.argv.slice(2).filter((a) => a !== '--check');

const looksLikeRecord = (el) => {
  if (typeof el === 'string') return /[A-Za-z]{3}/.test(el);
  return !!el && typeof el === 'object' && ('id' in el || 'name' in el || 'email' in el);
};

// error strings embed the record they failed on; keep the stage and the API message only
const errorShape = (s) => {
  const stage = (String(s).match(/^([a-z_ ]+?)\s/i) ?? [, 'other'])[1].trim();
  const message = (String(s).match(/"message":"([^"]+)"/) ?? [, 'unknown'])[1];
  const subCode = (String(s).match(/"subCode":"([^"]+)"/) ?? [])[1];
  return `${stage}: ${message}${subCode ? ` (${subCode})` : ''}`;
};

// A bare string element is a record name, not a reason -- deriving a key from it would leak
// the very thing being redacted. Only strings carrying an API error payload are summarizable.
const isErrorString = (el) => typeof el === 'string' && /"message":"/.test(el);

const histogram = (arr) => {
  const hist = {};
  for (const el of arr) {
    if (typeof el === 'string' && !isErrorString(el)) return null;
    const key = typeof el === 'string' ? errorShape(el)
      : (el.reason ?? el.error ?? el.status ?? el.stage ?? null);
    if (key === null || key === undefined) return null;
    hist[String(key)] = (hist[String(key)] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(hist).sort((a, b) => b[1] - a[1]));
};

const redact = (node, changes, trail = '') => {
  if (!node || typeof node !== 'object') return node;
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value) && value.length > 0 && value.some(looksLikeRecord)) {
      const summary = histogram(value);
      delete node[key];
      node[`${key}Count`] = value.length;
      if (summary) node[`${key}Summary`] = summary;
      changes.push(`${trail}${key}[${value.length}]${summary ? ` -> ${Object.keys(summary).length}-row summary` : ' -> count'}`);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      redact(value, changes, `${trail}${key}.`);
    }
  }
  return node;
};

for (const file of files) {
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  const changes = [];
  const out = redact(parsed, changes);
  if (changes.length === 0) {
    console.log(`${file}: already clean`);
    continue;
  }
  out.recordsRedacted = 'Per-record entries removed: they carried customer names, ids or emails. Counts and reason breakdowns are preserved.';
  if (!checkOnly) writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${file}${checkOnly ? ' (would change)' : ''}: ${changes.join(', ')}`);
}
