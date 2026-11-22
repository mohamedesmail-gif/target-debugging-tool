// Pricing simulator: role rules. Run after `npm run bundle:test` (npm test does it).
import { JSDOM } from 'jsdom';
import fs from 'fs';
import zlib from 'zlib';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
try { Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true }); } catch (e) {}
global.HTMLElement = dom.window.HTMLElement; global.Event = dom.window.Event; global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.fetch = async () => { throw new Error('fetch must not be used'); };
const D = (f) => new URL('../data/' + f, import.meta.url);
const fullFile = fs.existsSync(D('pricing_store_full.b64')) ? 'pricing_store_full.b64' : 'pricing_store_FULL_private.b64';
const FULL = fs.readFileSync(D(fullFile), 'utf8').trim(), STD = fs.readFileSync(D('pricing_store.b64'), 'utf8').trim();
window.PORTAL_CONFIG = { pricingB64: STD, pricingFullB64: FULL };
const React = (await import('react')).default; const { createRoot } = await import('react-dom/client');
const TT = (await import('../dist/bundle.mjs')).default;
const PAYLOAD = JSON.parse(fs.readFileSync(new URL('../dist/payload.json', import.meta.url), 'utf8'));
const store = JSON.parse(zlib.gunzipSync(Buffer.from(FULL, 'base64')).toString());
const root = createRoot(document.getElementById('root'));
const errors = [];
window.addEventListener('error', (e) => errors.push(e.error ? e.error.stack : e.message));
const ce = console.error; console.error = (...a) => { const s = a.join(' '); if (!/act\(|Warning: /.test(s)) errors.push('console.error: ' + s.slice(0, 300)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el.dispatchEvent(new window.Event('click', { bubbles: true }));
const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === t);
const byTid = (t) => document.querySelector('[data-testid="' + t + '"]');
const txt = () => document.body.textContent;
const setInput = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new window.Event('input', { bubbles: true })); };
async function waitFor(fn, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(100); } return false; }
let pass = 0, fail = 0;
const check = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };

// who owns what
const own = {};
PAYLOAD.org.ams.forEach((a) => (PAYLOAD.data.ams[a.name].merchants || []).forEach((m) => { own[m.id] = { head: a.headId, tl: a.tlId }; }));
PAYLOAD.org.sales.forEach((s) => (s.newList || []).concat(s.cohortList || []).forEach((r) => { if (!own[r[0]]) own[r[0]] = { head: s.headId, tl: s.tlId }; }));
const inPack = Object.keys(store.m).filter((id) => store.name[id]);
const owned = (pred) => inPack.find((id) => own[id] && pred(own[id]));
const unassigned = inPack.find((id) => !own[id]);
const HEAD = PAYLOAD.org.heads[0], OTHER_HEAD = PAYLOAD.org.heads[1];
const mine = owned((o) => o.head === HEAD.id), theirs = owned((o) => o.head === OTHER_HEAD.id);
const TL = PAYLOAD.org.tls.find((t) => owned((o) => o.tl === t.id));
const tlMine = owned((o) => o.tl === TL.id), tlOther = owned((o) => o.tl !== TL.id);
console.log('sample', { mine, theirs, unassigned, tlMine, tlOther, head: HEAD.id, tl: TL.id });

let key = 0;
async function as(viewerKey) { root.render(React.createElement(TT, { key: ++key, payload: PAYLOAD, session: { viewerKey, name: 'Test', email: 't@bosta.co' } })); await sleep(300); }
async function openSim() { await waitFor(() => byTid("sim-btn"), 8000); if (!byTid("sim-btn")) { console.log("NO BUTTON", errors.slice(0,3), txt().slice(0,300)); process.exit(2); } click(byTid('sim-btn')); await waitFor(() => txt().includes('Existing merchants simulation')); await waitFor(() => byTid('sim-search'), 60000); }
async function search(q) { const el = byTid('sim-search'); el.dispatchEvent(new window.Event('focusin', { bubbles: true })); setInput(el, q); await sleep(250); }
async function pickFirst() { const b = Array.from(document.querySelectorAll('button')).find((x) => /Not assigned|\(AM\)|\(sales\)/.test(x.textContent) && x.textContent.length < 160); if (b) click(b); await sleep(200); }
async function pickPlan() { const p = Object.keys(store.pricing.plans).sort()[3]; setInput(byTid('sim-plan'), p); await sleep(400); }

// ===== VP
await as('vp'); await openSim();
check('VP: simulator opens with all three tabs', ['Existing merchants simulation', 'New merchant', 'Cost assumptions'].every((t) => !!btn(t)));
check('VP: Simulation type, Calculate on toggle and Month are there', !!byTid('sim-types') && !!btn('Main + sub accounts') && !!btn('This account only'));
check('VP: no Settings section', !/\bSettings\b/.test(txt()));
const subAcc = Object.keys(store.main).find((x) => store.main[x] && store.main[x] !== x && store.name[x]);
await search(store.main[subAcc]); check('VP: a main account ID finds its accounts', txt().includes(store.name[subAcc]) && txt().includes('main account'));
await search(store.name[subAcc]); await pickFirst(); await sleep(300);
await search(theirs); await pickFirst();
await waitFor(() => txt().includes('Merchant data'), 8000); await pickPlan();
await waitFor(() => txt().includes('GM2'), 8000);
check('VP: summary has cost and GM2 columns, P&L, ASP bridge, EGP per order, price plan, customer colour', ['GM2 %', 'Profit and loss', 'ASP bridge', 'EGP per order', 'Price plan', 'Customer colour', 'New price plan', 'Merchant data'].every((t) => txt().includes(t)), 'text has ' + txt().length);
click(btn('Main + sub accounts')); await sleep(400);
check('VP: Main + sub accounts works without errors and shows the account table', txt().includes('Current price plan') && errors.length === 0, errors[0]);
click(btn('Cost assumptions')); await sleep(200);
check('VP: Cost assumptions tab shows', txt().includes('Middle mile cost per leg') && txt().includes('GM2 range'));
click(btn('New merchant')); await sleep(200);
setInput(byTid('sim-new-plan'), Object.keys(store.pricing.plans).sort()[3]); await sleep(300);
check('VP: New merchant shows summary with GM2 and P&L, no peer card', txt().includes('GM2 %') && txt().includes('Profit and loss') && !/peer/i.test(txt()));

// VP browsing the AM and sales levels must not see the simulator button
for (const lvl of ['AMs', 'Sales']) { if (byTid('sim-back')) click(byTid('sim-back')); await sleep(300); click(btn(lvl)); await sleep(500); check('VP looking at the ' + lvl + ' view: no pricing simulator button', !byTid('sim-btn') && !!btn('Daily analysis')); }
// VP opening the simulator from the team leaders view gets the team leader rules (no margin, no cost tab)
if (byTid('sim-back')) click(byTid('sim-back')); await sleep(300); await as('vp'); await sleep(300); click(btn('Team leaders')); await sleep(600);
click(byTid('sim-btn')); await waitFor(() => byTid('sim-search'), 60000);
check('VP via team leaders view: no Cost assumptions tab', !btn('Cost assumptions'));
await search(tlMine); await pickFirst(); await waitFor(() => txt().includes('Merchant data'), 8000); await pickPlan(); await waitFor(() => txt().includes('ASP (EGP per order)'), 8000);
check('VP via team leaders view: no GM2, no Direct cost, no Profit and loss', !txt().includes('GM2') && !txt().includes('Direct cost') && !txt().includes('Profit and loss') && !txt().includes('Total direct cost'));
click(btn('New merchant')); await sleep(200); setInput(byTid('sim-new-plan'), Object.keys(store.pricing.plans).sort()[3]); await sleep(300);
check('VP via team leaders view: New merchant has no margin either', !txt().includes('GM2') && !txt().includes('Profit and loss'));
// ===== Head
await as('h:' + HEAD.id); await openSim();
check('Head: no Cost assumptions tab', !btn('Cost assumptions') && !!btn('New merchant'));
await search(theirs);
check("Head: cannot find a merchant owned by another head's team", txt().includes('No merchant found'));
await search(mine); check('Head: finds a merchant of his own team', !!Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('(AM)') || x.textContent.includes('(sales)')));
await search(unassigned); check('Head: finds a merchant nobody owns', !!Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('Not assigned')));
await pickFirst(); await waitFor(() => txt().includes('Merchant data'), 8000); await pickPlan(); await waitFor(() => txt().includes('GM2'), 8000);
check('Head: sees margin columns and P&L', txt().includes('GM2 %') && txt().includes('Profit and loss'));
click(btn('New merchant')); await sleep(200); setInput(byTid('sim-new-plan'), Object.keys(store.pricing.plans).sort()[3]); await sleep(300);
check('Head: New merchant shows margin and P&L', txt().includes('GM2 %') && txt().includes('Profit and loss'));

// ===== Team leader
await as('t:' + TL.id); await openSim();
check('TL: no Cost assumptions tab', !btn('Cost assumptions'));
await search(tlOther); check("TL: cannot find a merchant outside his team", txt().includes('No merchant found'));
await search(unassigned); check('TL: cannot find an unassigned merchant', txt().includes('No merchant found'));
await search(tlMine); await pickFirst(); await waitFor(() => txt().includes('Merchant data'), 8000); await pickPlan(); await waitFor(() => txt().includes('ASP (EGP per order)'), 8000);
check('TL: sees revenue and ASP, no GM2, no cost, no P&L', txt().includes('Revenue (EGP)') && txt().includes('ASP bridge') && !txt().includes('GM2') && !txt().includes('Profit and loss') && !txt().includes('Direct cost'));
click(btn('New merchant')); await sleep(200); setInput(byTid('sim-new-plan'), Object.keys(store.pricing.plans).sort()[3]); await sleep(300);
check('TL: New merchant has no margin or P&L', txt().includes('Revenue (EGP)') && !txt().includes('GM2') && !txt().includes('Profit and loss'));

// ===== AM and sales
const AM = PAYLOAD.org.ams[0].name;
await as('a:' + AM);
check('AM: no pricing simulator button', !byTid('sim-btn'));
await as('s:' + PAYLOAD.org.sales[0].id);
check('Sales: no pricing simulator button', !byTid('sim-btn'));

check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
