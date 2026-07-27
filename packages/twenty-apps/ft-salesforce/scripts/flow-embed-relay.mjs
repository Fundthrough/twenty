// Relay for the Company Profile embed's per-record company id (local demo).
//   /set?company_id=N — the Twenty front component reports the record being viewed
//   /get              — flow-handover/embed.html (served by Live Server on :5500) polls
//                       this and mounts FlowWidget on that company
//   /go               — 302 → http://localhost:5500/embed.html; Twenty's IFRAME widget
//                       points here because its URL validator rejects hostnames without
//                       a TLD ("localhost"), and landing on the localhost:5500 origin
//                       reuses the Google session the user already has there
// Once Flow hosts embed.html on its own origin with ?company_id= (see flow-handover/),
// and Twenty supports record variables in iframe URLs, this relay retires.
// Usage: node scripts/flow-embed-relay.mjs   (listens on http://127.0.0.1:5511)
import { createServer } from 'node:http';

const PORT = 5511;
// ids older than this are treated as gone — a blocked /set hop (or a record closed long
// ago) must degrade to the widget's search, never preselect a stale company
const STALE_MS = 10 * 60 * 1000;
let current = { companyId: null, at: 0 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  // Chrome Private Network Access: the /set call comes from a PUBLIC https page
  // (fundthrough.twenty.com) to this local server — Chrome preflights it and requires
  // this header, otherwise the fetch is silently blocked
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/get') console.log(new Date().toISOString(), req.method, req.url, 'origin:', req.headers.origin ?? '-');

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  if (url.pathname === '/go') {
    res.writeHead(302, { ...CORS, Location: 'http://localhost:5500/embed.html' });
    res.end(); return;
  }
  if (url.pathname === '/set') {
    const id = url.searchParams.get('company_id');
    if (id && /^\d+$/.test(id)) current = { companyId: Number(id), at: Date.now() };
    res.writeHead(204, CORS); res.end(); return;
  }
  if (url.pathname === '/get') {
    const fresh = current.companyId !== null && Date.now() - current.at < STALE_MS;
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fresh ? current : { companyId: null, at: 0 })); return;
  }
  res.writeHead(404, CORS); res.end();
}).listen(PORT, () => console.log(`flow embed relay on http://127.0.0.1:${PORT} (/set /get /go)`));
