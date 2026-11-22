// Live section: baseline line, fresh feed over fetch (green "Live"), and the message when there is no feed and no snapshot.
import { JSDOM } from 'jsdom';
import fs from 'fs';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
try { Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true }); } catch (e) {}
global.HTMLElement = dom.window.HTMLElement; global.Event = dom.window.Event; global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
const SNAP = JSON.parse(fs.readFileSync(new URL('../data/live.json', import.meta.url), 'utf8'));
const cairoNow = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })); const z = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':00'; };
const mode = process.argv[2];
let fetched = 0;
if (mode === 'fresh') {
  const now = cairoNow(), live = { ...SNAP, asOf: now, day: now.slice(0, 10), bwC: 2, bwP: 1 };
  live.rows = SNAP.rows.map((r) => r.map((v, i) => (i === 3 ? v * 2 + 2 : i === 6 ? v : v)));   // baseline created = sum over 2 weeks (so average = value + 1), picked = 1 week
  global.fetch = async () => { fetched++; return { ok: true, json: async () => live }; };
} else { global.fetch = async () => { fetched++; throw new Error('HTTP 404'); }; }
window.PORTAL_CONFIG = mode === 'snapshot' ? { live: SNAP } : {};
const React = (await import('react')).default; const { createRoot } = await import('react-dom/client');
const TT = (await import('../dist/bundle.mjs')).default;
const PAYLOAD = JSON.parse(fs.readFileSync(new URL('../dist/payload.json', import.meta.url), 'utf8'));
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(TT, { payload: PAYLOAD }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 100 && !document.body.textContent.includes('Activity analysis'); i++) await sleep(100);
await sleep(400);
const t = () => (document.querySelector('[data-testid="live-section"]') || { textContent: '' }).textContent;
let pass = 0, fail = 0; const check = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const clock = () => (document.querySelector('[data-testid="live-clock"]') || { textContent: '' }).textContent;
if (mode === 'fresh') {
  const ids = Object.values(PAYLOAD.data.ams).flatMap((a) => a.merchants.map((m) => m.id)); const M = new Map(SNAP.rows.map((r) => [r[0], r]));
  const cT = ids.reduce((a, id) => a + (M.has(id) ? M.get(id)[1] : 0), 0), cB = ids.reduce((a, id) => a + (M.has(id) ? M.get(id)[3] * 2 + 2 : 0), 0) / 2;
  check('feed read over fetch', fetched >= 1);
  check('fresh feed: the line starts with "Live ·" and no age', /^Live · Today \d\d:\d\d$/.test(clock()), clock());
  check('baseline line: vs baseline same minute ' + Math.round(cB).toLocaleString('en-US'), t().includes('vs baseline same minute ' + Math.round(cB).toLocaleString('en-US')), t().slice(0, 220));
  check('baseline chip shows a percent change', /Created today[\d,]+▲|Created today[\d,]+▼/.test(t()));
  document.querySelector('button[aria-label="Refresh the live numbers"]').dispatchEvent(new window.Event('click', { bubbles: true })); await sleep(100);
  check('the refresh button reads the feed again', fetched >= 2, 'fetches ' + fetched);
} else if (mode === 'snapshot') {
  check('no feed, snapshot in the page: numbers shown and labelled Snapshot', /^Snapshot · Today 23:50 · \d+ (min|h|d) ago$/.test(clock()) && t().includes('Created today'), clock());
  check('the snapshot note is shown', t().includes('snapshot kept in the page'));
} else {
  check('no feed and no snapshot: a plain message, no numbers', t().includes('Live numbers are not available right now') && !t().includes('Created today'), t().slice(0, 160));
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
