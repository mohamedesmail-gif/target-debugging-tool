import { JSDOM } from 'jsdom';
import fs from 'fs';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
try { Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true }); } catch (e) {}
global.HTMLElement = dom.window.HTMLElement; global.Event = dom.window.Event; global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.fetch = async () => { throw new Error('fetch must not be used'); };
const EX = JSON.parse(fs.readFileSync(new URL('../data/test_examples.json', import.meta.url), 'utf8'));
const XP = JSON.parse(fs.readFileSync(new URL('../data/expected_v4.json', import.meta.url), 'utf8'));
const XC = JSON.parse(fs.readFileSync(new URL('../data/expected_cm.json', import.meta.url), 'utf8'));
const XO = JSON.parse(fs.readFileSync(new URL('../data/expected_org.json', import.meta.url), 'utf8'));
const n0 = (v) => v.toLocaleString('en-US');
const rel = (a, b) => ((a - b) / Math.abs(b)) * 100;
const relTxt = (a, b) => `${Math.abs(rel(a, b)) < 1 ? '•' : a >= b ? '▲' : '▼'} ${Math.abs(rel(a, b)).toFixed(0)}% vs Sep 1–15`;   // changes under 1% are shown as flat (•)
const ptsTxt = (a, b) => `${a >= b ? '▲' : '▼'} ${Math.abs(a - b).toFixed(1)} pts vs Aug`;
const React = (await import('react')).default; const { createRoot } = await import('react-dom/client');
const TT = (await import('../dist/bundle.mjs')).default;
const root = createRoot(document.getElementById('root'));
const errors = [];
window.addEventListener('error', (e) => errors.push(e.error ? e.error.stack : e.message));
const ce = console.error; console.error = (...a) => { const s = a.join(' '); if (!/act\(|Warning: /.test(s)) errors.push('console.error: ' + s.slice(0, 300)); };
const PAYLOAD = JSON.parse(fs.readFileSync(new URL('../dist/payload.json', import.meta.url), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el.dispatchEvent(new window.Event('click', { bubbles: true }));
const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === t);
const txt = () => document.body.textContent;
const DNEW = JSON.parse(fs.readFileSync(new URL('../data/new_data_oct.json', import.meta.url), 'utf8'));
const DNEW_TH = DNEW.ams['Farha Aly Saad'].merchants.find((m) => m.id === 'ImbeR25m9');
const THTARGET = (DNEW_TH.monthly.sep * 1.6 / 26).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const txtNoSel = () => { const c = document.body.cloneNode(true); c.querySelectorAll('select').forEach((x) => x.remove()); return c.textContent; };   // page text without the dropdown options
const listSel = () => Array.from(document.querySelectorAll('select')).find((x) => x.getAttribute('aria-label') === 'Top and bottom list');
const entSel = () => Array.from(document.querySelectorAll('select')).find((x) => x.getAttribute('aria-label') !== 'Top and bottom list');
const num = (s) => Number(String(s).replace(/[^0-9.-]/g, ''));
const setSel = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new window.Event('change', { bubbles: true })); };
const setInput = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new window.Event('input', { bubbles: true })); el.dispatchEvent(new window.Event('change', { bubbles: true })); };
async function waitFor(fn, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(100); } return false; }
async function openViaId(id) {
  click(btn('Portfolio overview →'));
  await waitFor(() => txt().includes('Filter merchants') && txt().includes('Overall overview'));
  setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business ID'), id);
  await waitFor(() => txt().includes('Showing: ') && txt().includes('Overall overview'));
}
async function backToTracker() { if (btn('← Back to portfolio overview')) { click(btn('← Back to portfolio overview')); await sleep(300); await waitFor(() => btn('← Back to Target Tracker')); } click(btn('← Back to Target Tracker')); await sleep(80); }
async function cw(t) { await waitFor(() => btn(t), 8000); const b = btn(t); if (!b) throw new Error('button not found: ' + t); click(b); await sleep(90); }
const TEST_EMAILS = JSON.parse(fs.readFileSync(new URL('../data/test_emails.json', import.meta.url), 'utf8'));
const SPECIAL_EMAILS = { 'A personal Google account': 'someone@gmail.com', 'A Bosta colleague without access': 'nobody.here@bosta.co' };
async function signInWithEmail(email) { click(btn('Continue with Google')); await sleep(80); setInput(document.querySelector('input[aria-label="Bosta email"]'), email); click(btn('Continue')); await sleep(350); }
async function signInAs(label) { const email = SPECIAL_EMAILS[label] || TEST_EMAILS[label]; if (!email) throw new Error('no email for ' + label); await signInWithEmail(email); }
async function signOutUI() { click(btn('Sign out')); await sleep(200); }
let pass = 0, fail = 0;
const check = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const infoCount = () => document.querySelectorAll('[aria-label="How this is calculated"]').length;
const fillKind = (td) => { const bg = td.style.background || td.style.backgroundColor || ''; return /14, 155, 130/.test(bg) ? 'good' : /214, 69, 69/.test(bg) ? 'bad' : /120, 130, 145/.test(bg) ? 'flat' : 'none'; };

root.render(React.createElement(TT, { payload: PAYLOAD })); await sleep(200);
// ===== no login, no permissions for now (AUTH_ENABLED is false): the app opens straight on the VP view
const AUTH_ON = false;
{
  const L0 = txt();
  check('no login screen: the app opens straight on the VP view with every level available', !btn('Continue with Google') && L0.includes('Where the heads stand against targets') && !btn('Sign out') && !document.querySelector('[data-testid="user-chip"]') && ['VP', 'Heads', 'Team leaders', 'Sales', 'AMs'].every((l) => !!btn(l)));
  check('the app file contains no data: it is code only (< 1 MB) and every number comes from the payload', fs.statSync(new URL('../dist/target_tracker.jsx', import.meta.url)).size < 1e6 && !fs.readFileSync(new URL('../dist/target_tracker.jsx', import.meta.url), 'utf8').includes('ImbeR25m9'));
  check('growth window: days compared and working days of the same days last month come from the data (not fixed numbers)', PAYLOAD.data.ptdDays === PAYLOAD.org.days && PAYLOAD.data.wdPtd === PAYLOAD.org.days - [...Array(PAYLOAD.org.days).keys()].filter((i) => new Date(Date.UTC(2026, 8, 1 + i)).getUTCDay() === 5).length);
}
const landedOnVp = txt().includes('Sameh Shaheen') && txt().includes('View level');
click(btn('AMs')); await sleep(120);

// ===== tracker
check('tracker: info icons on cards (>= 10)', infoCount() >= 10, String(infoCount()));
check('tracker: "Portfolio overview" button', !!btn('Portfolio overview →'));
const t0 = (() => { const c = document.body.cloneNode(true); c.querySelectorAll('tbody').forEach((n) => n.remove()); return c.textContent; })();
check('tracker: no "80%" wording', !/80\s?%/.test(t0));
const sel = entSel();
setSel(sel, 'Farha Aly Saad'); await sleep(40);
const row = Array.from(document.querySelectorAll('tr')).find((r) => r.textContent.includes('Trend Hub'));
const cells = Array.from(row.querySelectorAll('td')).map((c) => c.textContent.trim());
{ const hdrs = Array.from(row.closest('table').querySelectorAll('thead th')).map((x) => x.textContent.replace(/[▲▼]/g, '').trim()).join('|');
  check('AM merchant table columns: Merchant | MTD avg daily | PMTD avg daily | Delta | GR % | MTD total volume | PMTD total volume | Run rate | Status (no target columns)', hdrs === 'Merchant|MTD avg daily|PMTD avg daily|Delta|GR %|MTD total volume|PMTD total volume|Run rate|Status', hdrs);
  const D0 = PAYLOAD.data, PTH = D0.ams['Farha Aly Saad'].merchants.find((m) => m.id === 'ImbeR25m9'), pav = PTH.ptd / D0.wdPtd, dl = PTH.mtdAvgDaily - pav, f1 = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), run = PTH.mtd + PTH.mtdAvgDaily * (D0.wdFull - D0.wdElapsed);
  check('Trend Hub: MTD avg daily ' + f1(PTH.mtdAvgDaily) + ' vs PMTD ' + f1(pav) + ', delta, GR %, MTD ' + n0(PTH.mtd) + ' vs PMTD ' + n0(PTH.ptd) + ', run rate ' + n0(Math.round(run)),
    cells[1] === f1(PTH.mtdAvgDaily) && cells[2] === f1(pav) && cells[3] === (dl >= 0 ? '+' : '') + f1(dl) && cells[4] === (dl >= 0 ? '+' : '') + f1(dl / pav * 100) + '%' && cells[5] === n0(PTH.mtd) && cells[6] === n0(PTH.ptd) && cells[7] === n0(Math.round(run)), cells.join(' | ')); }

click(row); await sleep(60);
check('tracker: growth compares the same days of last month', txt().includes('Growth status vs. the same days last month'), (txt().match(/Growth status.{0,120}/) || [''])[0]);
click(row); await sleep(30);

// ===== AM portfolio overview (Farha)
click(btn('Portfolio overview →'));
check('portfolio opens', await waitFor(() => txt().includes('Overall overview') && txt().includes('Portfolio overview')));
let p = txt();
check('portfolio header names the AM and merchant count', p.includes('Farha Aly Saad') && new RegExp(DNEW.ams['Farha Aly Saad'].base + ' merchants').test(p), (p.match(/account manager ·.{0,80}/) || [''])[0]);
check('hero: 6 KPI cards incl. Active merchants', ['Active merchants · Oct', 'Volume · Oct', 'Revenue · Oct', 'DSR · Sep', 'ASR · Sep', 'Compensation · Oct'].every((s) => p.includes(s)));
check('hero: Oct shown as month-to-date, no full-month delta', p.includes('Volume · Oct (MTD)') && !/MTD · 3 working days/.test(p) && !/vs Sep(?! 1–15)/.test(p.slice(0, p.indexOf('Overall overview'))));
check('hero: volume / revenue / active merchants / compensation compare Oct 1–15 with Sep 1–15; DSR and ASR use complete months', (p.match(/vs Sep 1–15/g) || []).length >= 4 && p.includes('DSR · Sep') && p.includes('last complete month') && !p.includes('DSR · Oct'), String((p.match(/vs Sep 1–15/g) || []).length));
check('portfolio hero values match the independent calculation (volume, active merchants, DSR, compensation)', p.includes(relTxt(XP.pf.td.vol, XP.pf.ptd.vol)) && p.includes(relTxt(XP.pf.td.active, XP.pf.ptd.active)) && p.includes(ptsTxt(XP.pf.dsr_sep, XP.pf.dsr_aug)) && p.includes(ptsTxt(XP.pf.asr_sep, XP.pf.asr_aug)) && p.includes(relTxt(XP.pf.td.comp, XP.pf.ptd.comp)), [relTxt(XP.pf.td.vol, XP.pf.ptd.vol), relTxt(XP.pf.td.active, XP.pf.ptd.active), ptsTxt(XP.pf.dsr_sep, XP.pf.dsr_aug)].join(' | '));
check('seasonality is Coming soon in the portfolio flags', /Seasonality\s*Coming soon/.test(p) && !/Peaks in|derived/.test(p));
check('portfolio flags: Merchants / Sub-accounts / Websites known / FB ads Coming soon', ['Merchants', 'Sub-accounts', 'Websites known', 'Coming soon'].every((s) => p.includes(s)));
const titles = ['Volume', 'Revenue', 'Active merchants', 'ASP', 'Compensation', 'DSR', 'ASR', 'Lost & damaged', 'Top merchants', 'Where merchants stand now'];
check('short chart titles present', titles.every((s) => p.includes(s)));
check('no long old titles / no pie / no zones in overview', !/Operational issues trend|volume share by business line|DSR \/ ASR trend|delivery zones/i.test(p));
check('story insight lines present (vs Aug / peak)', /vs (Aug|Sep)/.test(p) && /peak/.test(p));
check('info icons on charts + cards (>= 20)', infoCount() >= 20, String(infoCount()));
// tooltip text on hover
const icon = document.querySelector('[aria-label="How this is calculated"]');
icon.parentElement.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
await sleep(30); icon.click(); await sleep(40);
check('info icon opens a tooltip', document.body.textContent.length > p.length);
// date range
const dates = Array.from(document.querySelectorAll('input[type="date"]'));
check('from / to calendar inputs replace the month dropdown', dates.length === 2 && !document.querySelector('select.emph') && dates[0].value === '2026-01-01' && dates[1].value === DNEW.asOf);
let rowsMonthly = document.querySelectorAll('tbody tr').length;
check('monthly table has 10 rows (Jan-Oct)', rowsMonthly === 10, String(rowsMonthly));
setInput(dates[0], '2026-07-01'); await sleep(40);
check('range from Jul 1 -> table has 4 months', document.querySelectorAll('tbody tr').length === 4, String(document.querySelectorAll('tbody tr').length));
setInput(document.querySelectorAll('input[type="date"]')[1], '2026-09-30'); await sleep(40);
check('range to Sep 30 -> 3 months and hero follows Sep', document.querySelectorAll('tbody tr').length === 3 && txt().includes('Volume · Sep'));
click(btn('YTD')); await sleep(40);
// conditional formatting logic on the DSR column (monthly)
const ths = Array.from(document.querySelectorAll('thead th')).map((t) => t.textContent.trim());
const dsrIx = ths.indexOf('DSR');
const trs = Array.from(document.querySelectorAll('tbody tr'));
const dsrCells = trs.map((r) => r.querySelectorAll('td')[dsrIx]);
const vals = dsrCells.map((c) => parseFloat(c.textContent));
let logicOk = true, checked = 0, bad = [];
for (let i = 1; i < vals.length - 1; i++) {
  const rel = (vals[i] - vals[i - 1]) / Math.abs(vals[i - 1]) * 100;
  if (Math.abs(Math.abs(rel) - 2) < 0.4) continue; // displayed rounding can flip a borderline cell
  const exp = Math.abs(rel) <= 2 ? 'flat' : rel > 0 ? 'good' : 'bad';
  checked++; if (fillKind(dsrCells[i]) !== exp) { logicOk = false; bad.push(`${vals[i - 1]}->${vals[i]} exp ${exp} got ${fillKind(dsrCells[i])}`); }
}
check('DSR column: red/green/grey vs previous month with 2% band (' + checked + ' cells; first row blank)', logicOk && fillKind(dsrCells[0]) === 'none', bad.join('; '));
{
  const hs = Array.from(document.querySelectorAll('thead th')).map((x) => x.textContent.trim()); const di = hs.indexOf('DSR'), ai = hs.indexOf('ASR');
  const lastRow = trs[trs.length - 1].querySelectorAll('td'), prevRow = trs[trs.length - 2].querySelectorAll('td');
  check('overview table: running month (Oct MTD) has no DSR / ASR, complete months do', lastRow[di].textContent === '—' && lastRow[ai].textContent === '—' && /%$/.test(prevRow[di].textContent) && /%$/.test(prevRow[ai].textContent), lastRow[di].textContent + ' / ' + prevRow[di].textContent);
}
check('month-to-date row is never coloured against a full month (all cells)', Array.from(trs[trs.length - 1].querySelectorAll('td')).every((td) => fillKind(td) === 'none'));
const lostIx = ths.indexOf('Lost'); const lostCells = trs.map((r) => r.querySelectorAll('td')[lostIx]); const lv = lostCells.map((c) => num(c.textContent));
let lostOk = true; for (let i = 1; i < lv.length - 1; i++) { if (lv[i - 1] === 0) continue; const rel = (lv[i] - lv[i - 1]) / Math.abs(lv[i - 1]) * 100; if (Math.abs(Math.abs(rel) - 2) < 0.4) continue; const exp = Math.abs(rel) <= 2 ? 'flat' : rel < 0 ? 'good' : 'bad'; if (fillKind(lostCells[i]) !== exp) lostOk = false; }
check('Lost column: inverted (falling = green)', lostOk);
check('Stable band control removed (legend only)', !Array.from(document.querySelectorAll('input[type="number"]')).some((i) => i.step === '0.5') && !/Stable band/.test(txt()));
// granularities
for (const g of ['Weekly', 'Daily', 'Monthly']) { click(btn(g)); await sleep(40); }
click(btn('Daily')); await sleep(40);
const dayRows = document.querySelectorAll('tbody tr').length;
check('daily view renders and skips Fridays (' + dayRows + ' rows)', dayRows > 20 && txt().includes('skips Fridays'));
setInput(document.querySelectorAll('input[type="date"]')[1], '2026-02-10'); setInput(document.querySelectorAll('input[type="date"]')[0], '2026-01-05'); await sleep(40);
check('daily with a range before Sep 1 explains instead of crashing', txt().includes('daily and weekly detail starts on Sep 1'));
click(btn('Monthly')); click(btn('Sep → Oct')); await sleep(40);

// portfolio: other tabs
for (const t of ['Comparison', 'Current month overview', 'Overall overview']) await cw(t);
await cw('Comparison');
const metricSel = Array.from(document.querySelectorAll('select')).find((s) => Array.from(s.options).some((o) => o.textContent === 'Active merchants'));
check('comparison metric list includes Active merchants in portfolio mode', !!metricSel);
if (metricSel) for (const o of Array.from(metricSel.options)) { setSel(metricSel, o.value); await sleep(10); }
for (const lvl of ['Day', 'Week', 'Month']) { click(btn(lvl)); for (const st of ['Previous day', 'Same weekday last week', 'Same date last month', 'Custom', 'Previous week', 'Same week last month', 'Previous month']) { const b = btn(st); if (b) { click(b); await sleep(8); } } }
await cw('Month'); await cw('Previous month');
if (metricSel) { setSel(metricSel, 'active_merchants'); await sleep(150); }
check('portfolio comparison: active merchants Oct 1–15 (45) vs Sep 1–15 (42), current value shown first', txt().includes('Oct 1–15 · current') && txt().includes(String(XP.pf.td.active)) && txt().includes(String(XP.pf.ptd.active)) && txt().includes('not with the full month'));
check('comparison shows the new delta card + pair table with colours', txt().includes('All metrics, same-length periods'));
for (const t of ['Issues', 'Operational', 'CX', 'Merchants & customers', 'Opportunities']) await cw(t);
await cw('Issues'); await cw('Operational');
p = txt();
check('portfolio issues: top merchants per issue', p.includes('Which merchants'));
check('portfolio issues: real parcel tables, counts match the independent pull (fake / RTO / lost / damaged / compensation)', [['Fake attempts', XC.pf.F], ['RTO without attempt', XC.pf.R], ['Lost parcels', XC.pf.L], ['Damaged parcels', XC.pf.D], ['Compensation', XC.pf.C]].every(([t, n]) => p.includes(t + ' (' + n0(n) + ')')) && !/SAMPLE|sample data/i.test(p), [XC.pf.F, XC.pf.R, XC.pf.L, XC.pf.D, XC.pf.C].join('/'));
check('portfolio: long list is paged (RTO shows 50, rest behind Show more)', Array.from(document.querySelectorAll('button')).some((b) => /^Show 50 more \(/.test(b.textContent.trim())));
await cw('CX'); p = txt();
check('portfolio CX: real tickets (' + XC.pf.tickets + ') from public.freshdesk_tickets_enriched, merchant-link caveat shown', p.includes(n0(XC.pf.tickets)) && p.includes('Only about half of all tickets') && !/coming soon/i.test(p.slice(p.indexOf('Tickets'))), String(XC.pf.tickets));
await cw('Merchants & customers'); p = txt();
check('portfolio failed attempts: total / customer / merchant match the independent pull', p.includes(n0(XC.pf.att_total)) && p.includes(n0(XC.pf.att.Customer)) && p.includes(n0(XC.pf.att.Merchant)), [XC.pf.att_total, XC.pf.att.Customer, XC.pf.att.Merchant].join('/'));
await cw('Opportunities');
check('portfolio opportunities: VAS + zones', txt().includes('VAS revenue by type') && txt().includes('Where parcels go'));
check('portfolio: no runtime errors so far', errors.length === 0, errors.slice(0, 2).join(' | '));

// click-through: portfolio -> merchant -> back to portfolio
await cw('Profile Overview'); await cw('Overall overview'); await waitFor(() => txt().includes('Who drives this portfolio'));
const topBtn = Array.from(document.querySelectorAll('div')).find((d) => d.title && d.style.cursor === 'pointer' && d.children.length === 0);
const topName = topBtn ? topBtn.textContent : null;
click(topBtn);
check('click a top merchant -> that merchant is shown inside the portfolio overview (filter set automatically)', await waitFor(() => txt().includes('Back to portfolio overview') && txt().includes('Showing: ' + topName)), topName);
p = txt();
check('merchant view keeps its name and AM', p.includes(topName) && p.includes('Farha Aly Saad'));
click(btn('← Back to portfolio overview')); await sleep(300);
check('back returns to the portfolio overview', await waitFor(() => txt().includes('Who drives this portfolio')));
click(btn('← Back to Target Tracker')); await sleep(60);
check('back returns to the tracker', txt().includes('Target daily avg'));

// ===== merchant profile: Trend Hub
const sel2 = entSel(); setSel(sel2, 'Farha Aly Saad'); await sleep(30);
await openViaId('ImbeR25m9');
await waitFor(() => txt().includes('Overall overview') && txt().includes('Trend Hub'));
p = txt();
check('merchant: chips Account / Lifecycle / Seasonality / DSR status / VAS / Creation source / Website / FB ads / Pickup locations', ['Account', 'Lifecycle', 'Seasonality', 'DSR status', 'VAS', 'Creation source', 'Website', 'FB ads', 'Pickup locations'].every((s) => p.includes(s)));
check('merchant: website taager.com from public.businesses', p.includes('taager.com'));
check('merchant: FB ads = Coming soon', /FB ads\s*Coming soon/.test(p));
check('merchant: seasonality = Coming soon (no derived value)', /Seasonality\s*Coming soon/.test(p) && !/Peaks in|derived/.test(p));
check('merchant: Trend Hub is a main account', /Account\s*Main account/.test(p));
check('merchant: short chart titles + insights', ['Volume', 'Revenue', 'ASP', 'Compensation', 'DSR', 'ASR', 'Lost & damaged'].every((s) => p.includes(s)) && /vs Aug/.test(p));
check('merchant: info icons (>= 25)', infoCount() >= 25, String(infoCount()));
check('merchant: no month dropdown, calendar range instead', document.querySelectorAll('input[type="date"]').length === 2);
for (const t of ['Comparison', 'Current month overview', 'Overall overview', 'Issues', 'CX', 'Merchants & customers', 'Operational', 'Opportunities']) await cw(t);
check('merchant: sample tabs still render', errors.length === 0, errors.slice(0, 2).join(' | '));
await cw('Issues'); await cw('Operational'); p = txt();
check('merchant parcel tables: real counts (Trend Hub) and no sample wording', [['Fake attempts', XC.th.F], ['RTO without attempt', XC.th.R], ['Lost parcels', XC.th.L], ['Damaged parcels', XC.th.D], ['Compensation', XC.th.C]].every(([t, n]) => p.includes(t + ' (' + n0(n) + ')')) && p.includes(XC.th_first_L[0]) && !/SAMPLE|sample data/i.test(p), [XC.th.F, XC.th.R, XC.th.L, XC.th.D, XC.th.C].join('/'));
{
  const inp = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Tracking #');
  setInput(inp, XC.th_first_F[0]); await sleep(120);
  check('table filter narrows the list (Fake attempts: 1 of ' + XC.th.F + ')', txt().includes('(1 of ' + XC.th.F + ')'), '');
  setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Tracking #'), ''); await sleep(60);
}
await cw('CX'); p = txt();
check('merchant CX: ' + XC.th.tickets + ' real tickets, opened / pending / compensation tables', p.includes(n0(XC.th.tickets)) && p.includes('Opened tickets') && p.includes('Pending tickets') && p.includes('Tickets with compensation') && !/SAMPLE|sample data/i.test(p), String(XC.th.tickets));
await cw('Merchants & customers'); p = txt();
check('merchant failed attempts: total / customer / merchant / address-phone match the independent pull', p.includes(n0(XC.th.att_total)) && p.includes(n0(XC.th.att.Customer)) && p.includes(n0(XC.th.att.Merchant)) && p.includes(n0(XC.th.att['Address / phone data'])), [XC.th.att_total, XC.th.att.Customer, XC.th.att.Merchant].join('/'));
check('failed attempts: latest-10 table + side grouping explained', p.includes('Latest failed attempts') && p.includes('latest 10'));
await cw('Profile Overview'); await cw('Overall overview');
p = txt();
check('merchant hero: volume / DSR / compensation vs Sep 1–15 match the independent calculation', p.includes(relTxt(XP.th.td.vol, XP.th.ptd.vol)) && p.includes(ptsTxt(XP.th.dsr_sep, XP.th.dsr_aug)) && p.includes(ptsTxt(XP.th.asr_sep, XP.th.asr_aug)) && p.includes(relTxt(XP.th.td.comp, XP.th.ptd.comp)), [relTxt(XP.th.td.vol, XP.th.ptd.vol), ptsTxt(XP.th.dsr_sep, XP.th.dsr_aug), relTxt(XP.th.td.comp, XP.th.ptd.comp)].join(' | '));
// ---- Comparison tab: same-length periods, current value first
await cw('Profile Overview'); await cw('Comparison');
let t = txt();
check('day / same weekday: current (' + XP.th.lastLabel + ') first, then every earlier same weekday', t.includes(XP.th.lastLabel + ' · current') && XP.th.sameWeekday.every((v) => t.includes(v.toLocaleString('en-US'))), XP.th.sameWeekday.join(','));
await cw('Previous day'); t = txt();
check('day / previous day: shows ' + XP.th.prevLabel + ' next to ' + XP.th.lastLabel, t.includes(XP.th.lastLabel + ' · current') && t.includes(XP.th.prevLabel));
await cw('Week'); await cw('Previous week'); t = txt();
check('week / previous week: week-to-date (' + XP.th.weekK + ' days) vs the first ' + XP.th.weekK + ' days of earlier weeks', t.includes('first ' + XP.th.weekK + ' days') && t.includes('Wk of ' + XP.th.weekStart + ' (first ' + XP.th.weekK + 'd) · current') && XP.th.weekPrev.every(([lab, v]) => t.includes('Wk of ' + lab + ' (first ' + XP.th.weekK + 'd)') && t.includes(v.toLocaleString('en-US'))) && t.includes(XP.th.oct4.vol.toLocaleString('en-US') ? '' : ''));
await cw('Month'); t = txt();
check('month / previous month: Oct 1–15 vs Sep 1–15 (not the full month)', t.includes('Oct 1–15 · current') && t.includes('Sep 1–15') && t.includes(XP.th.td.vol.toLocaleString('en-US')) && t.includes(XP.th.ptd.vol.toLocaleString('en-US')) && t.includes('not with the full month'));
const mSel = Array.from(document.querySelectorAll('select')).find((x) => Array.from(x.options).some((o) => o.value === 'dsr'));
setSel(mSel, 'dsr'); await sleep(120); t = txt();
check('DSR is NOT aggregated over a partial period (month-to-date): explanation instead of numbers', t.includes('only shown for complete periods') && !t.includes(XP.th.td.dsr.toFixed(1) + '%') && !t.includes(XP.th.ptd.dsr.toFixed(1) + '%'));
await cw('Week'); await cw('Previous week'); t = txt();
check('DSR is NOT aggregated over a partial week either', t.includes('only shown for complete periods'));
await cw('Day'); await cw('Same weekday last week'); t = txt();
check('DSR for single days is still available (not an aggregation)', !t.includes('only shown for complete periods') && t.includes(XP.th.lastLabel + ' · current'));
await cw('Month');
await cw('Custom');
let ms = Array.from(document.querySelectorAll('select')).filter((x) => Array.from(x.options).some((o) => o.textContent === 'Oct (MTD)'));
setSel(ms[1], '7'); await sleep(120);
check('month custom: Oct (MTD) vs Aug is refused with an explanation', txt().includes('can only be compared with September'));
ms = Array.from(document.querySelectorAll('select')).filter((x) => Array.from(x.options).some((o) => o.textContent === 'Oct (MTD)'));
setSel(ms[0], '5'); await sleep(60); ms = Array.from(document.querySelectorAll('select')).filter((x) => Array.from(x.options).some((o) => o.textContent === 'Oct (MTD)')); setSel(ms[1], '2'); await sleep(120); t = txt();
check('month custom: two complete months (Jun vs Mar) compare normally', t.includes('Jun · current') && !t.includes('month-to-date, so it is compared'));
await cw('Current month overview'); await cw('Monthly'); t = txt();
check('current month / monthly view uses the same days (Sep 1–15 vs Oct 1–15)', t.includes('Sep 1–15') && t.includes('Oct 1–15') && t.includes('compares the same days of both months'));
await cw('Overall overview');
await backToTracker();

// ===== sub-account flag
const [sid, sname, sam] = EX.sub;
setSel(entSel(), sam); await sleep(40);
await openViaId(sid);
{
  const acc = Array.from(document.querySelectorAll('div')).find((d) => /^Account/.test(d.textContent) && d.querySelector('[aria-label="How this is calculated"]') && d.children.length <= 4);
  acc.querySelector('[aria-label="How this is calculated"]').click(); await sleep(60);
  check('sub-account info icon shows the main account id', txt().includes('Main account ID: Y4yw4ZQkuXWkSCkMN'), (txt().match(/This is a sub-account.{0,60}/) || [''])[0]);
}
check('sub-account merchant (' + sname + ') shows "Sub-account of ..."', /Account\s*Sub-account of/.test(txt()), (txt().match(/Account\s*Sub-account of.{0,40}/) || [''])[0]);
await backToTracker();
const [pid2, pname, pam] = EX.par;
setSel(entSel(), pam); await sleep(40);
await openViaId(pid2);
{
  const acc = Array.from(document.querySelectorAll('div')).find((d) => /^Account/.test(d.textContent) && d.querySelector('[aria-label="How this is calculated"]') && d.children.length <= 4);
  acc.querySelector('[aria-label="How this is calculated"]').click(); await sleep(60);
  check('main-account info icon shows the number of sub-accounts', txt().includes('main account with 2 sub-accounts'), (txt().match(/This is a main account.{0,50}/) || [''])[0]);
}
check('parent merchant (' + pname + ') shows "Parent · N sub-accounts"', /Account\s*Parent · \d+ sub-account/.test(txt()), (txt().match(/Account\s*Parent.{0,30}/) || [''])[0]);
await backToTracker();

// ===== AMs that had no merchants at the last pull now have a portfolio
setSel(entSel(), 'Yousra Gamal Youssef Elawady'); await sleep(40);
click(btn('Portfolio overview →'));
check('Yousra now has a portfolio (' + DNEW.ams['Yousra Gamal Youssef Elawady'].base + ' merchants) and the portfolio overview opens without the empty-portfolio message', await waitFor(() => txt().includes('Overall overview')) && !txt().includes('No merchants are assigned to Yousra') && txt().includes(DNEW.ams['Yousra Gamal Youssef Elawady'].base + ' merchants'));
click(btn('← Back to Target Tracker')); await sleep(40);


// ===================== LEADERSHIP VIEWS (VP, Heads tabs, team leaders) =====================
const EL = JSON.parse(fs.readFileSync(new URL('../data/expected_lead.json', import.meta.url), 'utf8'));
const tl = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v, d) => (v >= 0 ? '+' : '−') + tl(Math.abs(v), d);
const fixedP = (v, d) => (v * 100).toFixed(d);
const panelOf = (t) => Array.from(document.querySelectorAll('div')).find((d) => d.firstElementChild && d.firstElementChild.textContent.startsWith(t) && d.querySelector('table'));
const orderOk = (el, names) => { if (!el) return false; const t = el.textContent; let last = -1; return names.every((n) => { const i = t.indexOf(n, last + 1); if (i < 0) return false; last = i; return true; }); };
const pillsNow = () => Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim()).filter((t) => ['VP', 'Heads', 'Team leaders', 'Sales', 'AMs'].includes(t));
const tabsNow = () => Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim()).filter((t) => ['All', 'Key Accounts', 'Growth Fashion', 'Growth General Trade', 'Growth Cosmetics', 'Startups'].includes(t));
const tabBtn = (t) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === t);
const showList = async (v) => { setSel(listSel(), v); await sleep(120); };
check('the VP lands on the VP screen with the level bar', landedOnVp);
click(btn('VP')); await sleep(150); p = txt();
check('VP screen: Sameh Shaheen, 5 heads / 9 team leaders / 49 AMs / 22 sales, no team tabs', p.includes('Sameh Shaheen') && /5 heads · 9 team leaders · 49 AMs · 22 sales/.test(p) && tabsNow().length === 0, tabsNow().join('|'));
check('VP and Heads are separate tabs in the view level bar', pillsNow().join('|') === 'VP|Heads|Team leaders|Sales|AMs', pillsNow().join('|'));
const iStand = p.indexOf('Where the heads stand against targets'), iMain = p.indexOf('Main view'), iBase = p.indexOf('Base'), iAct = p.indexOf('Activity'), iTop = p.indexOf('Top 10 and Bottom 10');
check('"where the team stands" comes BEFORE the main view: standing < main < base < activity < top/bottom', iStand > 0 && iStand < iMain && iMain < iBase && iBase < iAct && iAct < iTop, [iStand, iMain, iBase, iAct, iTop].join(','));
const standCheck = (E, tag) => {
  const q = txt();
  check(tag + ' standing: monthly target ' + n0(E.target) + ' (no separate Target card); pickups so far ' + n0(E.pickups) + ' = ' + tl(E.achv * 100, 1) + '% of the monthly target', q.includes('from the targets sheet') && q.includes(n0(E.target)) && q.includes(n0(E.pickups)) && q.includes(tl(E.achv * 100, 1) + '% of the monthly target') && !q.includes('the bar the status is judged against') && !/% of Target/.test(q), tl(E.achv * 100, 1));
  check(tag + ' standing: daily average ' + n0(Math.round(E.avgDaily)) + ', run rate ' + n0(Math.round(E.projected)) + ' (' + tl(E.projPctMonthly * 100, 1) + '% of the monthly target), status ' + E.status, q.includes('Run rate') && !q.includes('Estimated month-end') && !q.includes('Required daily average') && !q.includes('from now') && q.includes(n0(Math.round(E.avgDaily))) && q.includes(n0(Math.round(E.projected))) && q.includes(tl(E.projPctMonthly * 100, 1) + '% of the monthly target') && q.includes(E.status) && (E.status === 'Achieved' || q.includes(n0(Math.round(E.short)) + ' short of the monthly target')), E.status);
  check(tag + ' base: portfolio ' + n0(E.portfolio) + ', active ' + n0(E.active) + ', churned ' + n0(E.churned) + ', retention ' + tl(E.retention * 100, 1) + '%, churn ' + tl(E.churnRate * 100, 1) + '%', q.includes(n0(E.portfolio) + 'merchants') && q.includes(n0(E.active)) && q.includes(n0(E.churned)) && q.includes(tl(E.retention * 100, 1) + '%') && q.includes(tl(E.churnRate * 100, 1) + '%'));
  check(tag + ' main view: New merchants (MTD) ' + n0(E.newMerchants) + ' in the Base section, New base ASP ' + (E.newBaseAsp == null ? '—' : tl(E.newBaseAsp, 2)) + ' in the Activity section', (() => { const b = q.indexOf('Base'), a2 = q.indexOf('Activity'), t2 = q.indexOf('Top 10 and Bottom 10'); const nm = q.indexOf('New merchants (MTD)' + ''), na = q.indexOf('New base ASP'); return nm > b && nm < a2 && na > a2 && na < t2 && q.slice(nm, a2).includes(n0(E.newMerchants)) && q.slice(na, t2).includes(E.newBaseAsp == null ? '—' : tl(E.newBaseAsp, 2)); })());
  check(tag + ' activity: pickups ' + n0(E.pickups) + ', avg daily ' + tl(E.pickups / EL.elapsed, 1) + ', ASP ' + tl(E.asp, 2) + ', fresh ' + n0(E.fresh) + ', contribution ' + tl(E.contribution * 100, 1) + '% of ' + n0(E.pickups + E.freshOutside), q.includes(tl(E.pickups / EL.elapsed, 1)) && q.includes(tl(E.asp, 2)) && q.includes('of ' + n0(E.pickups + E.freshOutside) + ' total pickups') && q.includes(tl(E.contribution * 100, 1) + '%'), tl(E.contribution * 100, 1));
};
// every target KPI has its own top / bottom view, the dropdown holds all of them, and the default is the pickups target
const LISTS = (E) => [['pickups-growth', 'Top 10 merchants by pickups growth (' + n0(E.nPkUp) + ' growing)', E.pkUp], ['pickups-growth', 'Bottom 10 merchants by pickups growth (' + n0(E.nPkDown) + ' dropping)', E.pkDown],
  ['asp-growth', 'Top 10 merchants by ASP growth (' + n0(E.nAspUp) + ' growing)', E.aspUp], ['asp-growth', 'Bottom 10 merchants by ASP growth (' + n0(E.nAspDown) + ' dropping)', E.aspDown],
  ['dsr', 'Low DSR merchants: ' + n0(E.nLowDsr) + ' at or below 65% (' + tl(E.lowShare * 100, 1) + '% of September volume)', E.lowDsr],
  ['vas', 'Top 10 VAS users', E.vasTop], ['vas', 'Bottom 10 VAS users', E.vasBot]];
const listCheck = async (E, tag, only) => {
  for (const [view, title, names] of LISTS(E)) {
    if (only && !only.includes(view)) continue;
    await showList(view);
    check(tag + ' list "' + title.slice(0, 46) + '": the first ' + Math.min(6, names.length) + ' merchants in the independent order', orderOk(panelOf(title), names.slice(0, 6)) && (names.length > 0 || /None/.test((panelOf(title) || {}).textContent || '')), (names[0] || 'none'));
  }
  await showList('pickups-growth');
};
standCheck(EL.all, 'VP');
{ const hp = txt(); check('VP heads table lists all 5 heads with their pickups', Object.keys(XO.heads).every((h) => hp.includes(h)) && Object.keys(XO.heads).every((h) => hp.includes(n0(XO.heads[h].pickups)))); }
{ const hdr = Array.from(document.querySelectorAll('thead th')).map((x) => x.textContent.trim()).join('|');
  check('standing tables hold pickups columns only (no ASP / Fresh sales / Retention / Churn) and an Achievement % column right after the pickups', /Pickups \/ monthly target\|Achievement %\|Daily avg/.test(hdr) && !/ASP|Fresh sales|Retention|Churn/.test(hdr), hdr);
  const vr = Array.from(document.querySelectorAll('tbody tr')).filter((x) => x.querySelectorAll('td').length > 5);
  check('every head row shows its achievement % (pickups ÷ monthly target)', Object.keys(XO.heads).every((h) => { const r = vr.find((x) => x.textContent.includes(h)); return r && r.querySelectorAll('td')[2].textContent.trim() === tl(XO.heads[h].pickups / PAYLOAD.org.heads.find((x) => x.name === h).t.pickups * 100, 1) + '%'; }), vr.slice(0, 1).map((x) => x.textContent).join('')); }
check('Top 10 and Bottom 10: the default view is pickups MTD avg daily vs PMTD (GR %), and the dropdown holds pickups growth, ASP growth, DSR and VAS only', listSel().value === 'pickups-growth' && !!panelOf('Top 10 merchants by pickups growth') && !!panelOf('Bottom 10 merchants by pickups growth') && Array.from(listSel().options).map((o) => o.value).join('|') === 'pickups-growth|asp-growth|dsr|vas', Array.from(listSel().options).map((o) => o.value).join('|'));
check('only one list view is on screen at a time (the others live in the dropdown)', !panelOf('Top 10 merchants by ASP growth') && !panelOf('Top 10 VAS users'));
check('removed from the dropdown: retention target, fresh sales target, churn target, merchants by pickups, merchants by ASP, growers and droppers, pickups / ASP target lists', !/Retention target|Fresh sales target|Churn target|Merchants by pickups|Merchants by ASP|Growers and droppers|did not hit their pickups target|gap contributors/.test(Array.from(listSel().options).map((o) => o.textContent).join('|')));
await listCheck(EL.all, 'VP');
{ const heads = (el) => Array.from(el.querySelector('table').querySelectorAll('th')).map((x) => x.textContent.trim()).join('|');
  await showList('pickups-growth'); const hp1 = heads(panelOf('Top 10 merchants by pickups growth')), hp2 = heads(panelOf('Bottom 10 merchants by pickups growth'));
  check('pickups lists: # | Merchant | MTD avg daily | PMTD avg daily | Delta | GR %', hp1 === '#|Merchant|MTD avg daily|PMTD avg daily|Delta|GR %' && hp1 === hp2, hp1);
  await showList('asp-growth'); const ha1 = heads(panelOf('Top 10 merchants by ASP growth')), ha2 = heads(panelOf('Bottom 10 merchants by ASP growth'));
  check('ASP lists: # | Merchant | MTD ASP | PMTD ASP | Delta | GR % | Parcels', ha1 === '#|Merchant|MTD ASP|PMTD ASP|Delta|GR %|Parcels' && ha1 === ha2, ha1);
  const r1 = panelOf('Top 10 merchants by ASP growth').querySelector('tbody tr').textContent;
  check('ASP list: the first row has a positive delta and GR %', /\+\d/.test(r1), r1);
  await showList('pickups-growth'); const r0 = panelOf('Top 10 merchants by pickups growth').querySelector('tbody tr').textContent, rb = panelOf('Bottom 10 merchants by pickups growth').querySelector('tbody tr').textContent;
  check('pickups lists: top row grows (+), bottom row drops (−)', /\+\d/.test(r0) && /−\d/.test(rb), r0 + ' / ' + rb); }
check('info icons on the leadership screen (>= 10)', infoCount() >= 10, String(infoCount()));
// Heads screen: one tab per team
click(btn('Heads')); await sleep(200); p = txt();
check('Heads screen: tabs Key Accounts, Growth Fashion, Growth General Trade, Growth Cosmetics, Startups (no All)', tabsNow().join('|') === 'Key Accounts|Growth Fashion|Growth General Trade|Growth Cosmetics|Startups', tabsNow().join('|'));
check('Key Accounts tab: Abed Ali (head) with his team leaders', p.includes('Abed Ali') && p.includes('Ahmed Saleh') && p.includes('Mostafa Elsaeied') && p.includes('Where the team stands against targets'));
standCheck(EL.Key, 'Key tab'); await listCheck(EL.Key, 'Key tab');
click(tabBtn('Startups')); await sleep(200);
standCheck(EL.Startups, 'Startups tab');
check('Startups tab: status ' + EL.Startups.status, txt().includes(EL.Startups.status));
click(tabBtn('Growth Fashion')); await sleep(200);
standCheck(EL['Growth - Fashion'], 'Growth Fashion tab');
check('Growth Fashion tab: sales reporting directly to the head are listed (pickups columns only)', txt().includes('Sales reporting directly to this head') && txt().includes('salma seliem'));
// team leader screen
click(btn('Team leaders')); await sleep(150);
setSel(entSel(), 't4'); await sleep(200); p = txt();
check('team leader screen: Ahmed Saleh with his AMs and sales', p.includes('Ahmed Saleh') && p.includes('Farha Aly Saad') && p.includes('Mayar Adel') && p.includes('Abdelrhman Salman') && p.includes('Ahmed Sayed Ahmed') && p.includes('Samia Tarek') && p.includes('Mohamed Gamal Badawy'));
standCheck(EL.t4, 'TL Ahmed Saleh'); await listCheck(EL.t4, 'TL Ahmed Saleh', ['pickups-growth', 'asp-growth']);
{ const hdr = Array.from(document.querySelectorAll('thead th')).map((x) => x.textContent.trim()).join('|');
  check('team leader AM and Sales tables: pickups columns only, each with an Achievement % column', /Pickups \/ monthly target\|Achievement %/.test(hdr) && /New pickups \/ monthly target\|Achievement %/.test(hdr) && (hdr.match(/Achievement %/g) || []).length >= 2 && !/ASP|Fresh sales|Retention|Churn/.test(hdr), hdr); }
{ // the layer above the business level: an AM row opens that AM's details without leaving the screen
  const row = Array.from(document.querySelectorAll('tbody tr')).find((x) => x.querySelectorAll('td').length > 5 && x.textContent.includes('Farha Aly Saad')); click(row); await sleep(250);
  const q = txt();
  check('opening Farha\'s row shows her business-level details inside the team leader screen', q.includes('Farha Aly Saad · business level') && q.includes('Open the Target Tracker for Farha Aly Saad') && (q.match(/Top 10 and Bottom 10/g) || []).length >= 2 && q.includes('Total portfolio'));
  const sr = Array.from(document.querySelectorAll('tbody tr')).find((x) => x.textContent.includes('Ahmed Sayed Ahmed') && x.querySelectorAll('td').length > 5); click(sr); await sleep(200);
  check('opening a sales row shows the merchants of the sales rep: new this month and last month\'s cohort', txt().includes('Ahmed Sayed Ahmed · business level') && txt().includes('New merchants this month') && txt().includes("Last month's new merchants"));
  click(Array.from(document.querySelectorAll('button')).find((x) => x.textContent.startsWith('Open the Target Tracker for Farha Aly Saad'))); await sleep(250); p = txt();
}
check('the Open button leads to the Target Tracker for Farha', p.includes('Target daily avg') && p.includes('Farha Aly Saad'));
check('AM tracker: ASP card = ' + XO.am_farha.asp.toFixed(1) + ' vs target ' + XO.am_farha.target.asp, p.includes(XO.am_farha.asp.toFixed(1)) && p.includes('target ' + XO.am_farha.target.asp.toFixed(1)));
check('AM tracker: retention card = ' + fixedP(XO.am_farha.retention, 1) + '% vs target >= 99.0%, marked provisional', p.includes(fixedP(XO.am_farha.retention, 1) + '%') && p.includes('target ≥ 99.0%') && /provisional/.test(p));
check('AM tracker: no merchant-profile buttons or links', !document.querySelector('button[title="Open merchant profile"]'));
{ const r = Array.from(document.querySelectorAll('tbody tr')).find((x) => x.textContent.includes('Trend Hub')); click(r); await sleep(80);
  check('merchant detail drilldown has no "View full merchant profile" any more', !txt().includes('View full merchant profile') && txt().includes('Business ID:'));
  { const mm = PAYLOAD.data.ams['Farha Aly Saad'].merchants.find((x) => x.id === 'ImbeR25m9'), D = PAYLOAD.data; const g = ((mm.td / D.wdElapsed) - (mm.ptd / D.wdPtd)) / (mm.ptd / D.wdPtd) * 100;
    check('merchant growth status compares the same days of both months: ' + g.toFixed(1) + '% avg daily, days 1–' + D.ptdDays, txt().includes(g.toFixed(1) + '% avg daily, days 1–' + D.ptdDays + " vs last month's days 1–" + D.ptdDays)); }
  click(r); await sleep(30); }
// level bar from the AM view
click(btn('Team leaders')); await sleep(150);
check('level bar: Team leaders view opens', txt().includes('team leader ·') && txt().includes('Where the team stands against targets'));
// Sales screen
click(btn('Sales')); await sleep(150);
{
  const selS = entSel(); const zid = Array.from(selS.options).find((o) => o.textContent === 'Zinab Ayman').value; setSel(selS, zid); await sleep(150);
  p = txt();
  const zin = JSON.parse(fs.readFileSync(new URL('../data/org_final.json', import.meta.url), 'utf8')).sales.find((x) => x.name === 'Zinab Ayman');
  const mrows = () => Array.from(document.querySelectorAll('tbody tr')).filter((x) => x.querySelectorAll('td').length === 9);
  const nm = zin.a.newMerchants, nc = zin.cohort ? zin.cohort : zin.a.cohort, nAct = zin.a.cohort - zin.a.cohortChurned;
  const hd = Array.from(document.querySelectorAll('thead th')).map((x) => x.textContent.replace(/[▲▼]/g, '').trim()).join('|');
  check('sales view = AM layout: achievement bar, ASP + churn + current-achievement cards, headline stats, merchant detail table', p.includes('Zinab Ayman') && p.includes('Pickups achievement vs. monthly target') && p.includes('Current total achievement vs target') && p.includes('ASP (fresh sales)') && p.includes('Churn (last month') && ['Monthly target', 'Target daily avg', 'Actual daily avg', 'Run rate (month end)'].every((x) => p.includes(x)) && !p.includes('Required daily avg') && p.includes('Merchant detail') && !p.includes('Scorecard weights'), '');
  check('sales view table columns: Merchant | MTD avg daily | Last month avg daily | Delta | GR % | MTD total volume | Last month total volume | Run rate | Status', hd.startsWith('Merchant|MTD avg daily|Last month avg daily|Delta|GR %|MTD total volume|Last month total volume|Run rate|Status'), hd);
  check('sales view: Zinab Ayman has ' + nm + ' new + ' + zin.a.cohort + ' last-month merchants in the table; New / Active / Churned cards = ' + nm + ' / ' + nAct + ' / ' + zin.a.cohortChurned, mrows().length === nm + zin.a.cohort && p.includes(fixedP(zin.a.cohortChurned / zin.a.cohort, 1) + '%'), String(mrows().length));
  check('sales target 2,000 new pickups, ASP target 121, Startups churn target <= 25%', p.includes('2,000') && p.includes('target 121.0') && p.includes('target ≤ 25.0%'));
  { const r = mrows().find((x) => x.textContent.includes(zin.cohortList[0][1])); const c = Array.from(r.querySelectorAll('td')).map((x) => x.textContent.trim()); const x = zin.cohortList[0];
    check('last month\'s merchant row: MTD total ' + n0(x[3]) + ' vs last month total ' + n0(x[6]) + ', MTD avg daily = MTD ÷ ' + PAYLOAD.data.wdElapsed + ' working days', c[5] === n0(x[3]) && c[6] === n0(x[6]) && c[1] === (x[3] / PAYLOAD.data.wdElapsed).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), c.join(' | ')); }
  { const r = mrows().find((x) => x.textContent.includes(zin.newList[0][1])); const c = Array.from(r.querySelectorAll('td')).map((x) => x.textContent.trim());
    check('this month\'s new merchant row: no last-month baseline, so last month / Delta / GR % show —', c[2] === '—' && c[3] === '—' && c[4] === '—' && c[6] === '—' && c[8] === 'New', c.join(' | ')); }
  const fidIn = Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business ID');
  const someId = zin.cohortList[0][0]; setInput(fidIn, someId); await sleep(100);
  check('Business ID filter narrows the sales table to one merchant', mrows().length === 1, someId);
  setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business ID'), ''); await sleep(60);
  setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business name'), zin.cohortList[1][1].slice(0, 4)); await sleep(100);
  check('Business name filter narrows the sales table', mrows().length > 0 && mrows().length < nm + zin.a.cohort);
  setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business name'), ''); await sleep(60);
  click(mrows()[0]); await sleep(60);
  check('clicking a sales row opens its detail (Business ID, first pickup)', txt().includes('Business ID:') && txt().includes('This month so far'));
  click(btn('ASP')); await sleep(80);
  { const t2 = txt(), hd2 = Array.from(document.querySelectorAll('thead th')).map((x) => x.textContent.replace(/[▲▼]/g, '').trim()).join('|');
    check('sales ASP view: Total revenues, Delivered parcels, Portfolio ASP, Net ASP gap and the gap-contribution table', ['Total revenues', 'Delivered parcels', 'Portfolio ASP', 'Net ASP gap'].every((x) => t2.includes(x)) && !t2.includes('Total eligible revenue') && hd2 === 'Merchant|Parcels|Merchant ASP|Parcel share|ASP gap contribution|Status', hd2);
    const allm = zin.newList.concat(zin.cohortList).filter((r) => r[4] > 0), D2 = allm.reduce((x, r) => x + r[4], 0), R2 = allm.reduce((x, r) => x + r[5], 0);
    check('sales ASP view: total revenues ' + n0(R2) + ', delivered parcels ' + n0(D2) + ', portfolio ASP ' + tl(R2 / D2, 2), t2.includes(n0(R2)) && t2.includes(n0(D2)) && t2.includes(tl(R2 / D2, 2)), '');
    const gsum = Array.from(document.querySelectorAll('tbody tr')).filter((x) => x.querySelectorAll('td').length === 6).length; check('sales ASP view: one row per merchant with delivered parcels', gsum === allm.length, gsum + ' vs ' + allm.length); }
  click(btn('Pickups')); await sleep(60);
}
check('org screens: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));


// ===================== SESSION 3 CHANGES =====================
// Hajar under Mohamed Samir
click(btn('Team leaders')); await sleep(120);
{
  const optS = Array.from(entSel().options); const ms = optS.find((o) => o.textContent.startsWith('Mohamed Samir')), mo = optS.find((o) => o.textContent.startsWith('Moataz Muhammed'));
  setSel(entSel(), ms.value); await sleep(150); p = txt();
  check('Hajar Bahaa Eldin sits under Mohamed Samir (pickups ' + n0(XO.tl_mohamed_samir.pickups) + ')', p.includes('Hajar Bahaa Eldin') && p.includes(n0(XO.tl_mohamed_samir.pickups)));
  setSel(entSel(), mo.value); await sleep(150); p = txt();
  check('...and no longer under Moataz Mohamed', !txtNoSel().includes('Hajar Bahaa Eldin') && p.includes(n0(XO.tl_moataz.pickups)));
}
// growth sales: churn target = 1 - sheet value
click(btn('Sales')); await sleep(120);
{
  const selS = entSel(); setSel(selS, Array.from(selS.options).find((o) => o.textContent === 'Eman Shehata').value); await sleep(150);
  const ORGJ = JSON.parse(fs.readFileSync(new URL('../data/org_final.json', import.meta.url), 'utf8')); const em = ORGJ.sales.find((x) => x.name === 'Eman Shehata');
  check('Startups sales: churn target 25% shown', txt().includes('target ≤ 25.0%'), String(em.t.churn));
  setSel(entSel(), Array.from(entSel().options).find((o) => o.textContent === 'Merna Atef').value); await sleep(150);
  check('Growth sales (0.86 in the sheet): max churn shown as 14%', txt().includes('target ≤ 14.0%'));
  const mm = ORGJ.sales.find((x) => x.name === 'Zinab Ayman');
  setSel(entSel(), Array.from(entSel().options).find((o) => o.textContent === 'Zinab Ayman').value); await sleep(150);
  check('new merchants are defined by first pickup (column header + count from the independent pull)', txt().includes('first pickup') && txt().includes('Merchant detail') && Array.from(document.querySelectorAll('tbody tr')).filter((x) => x.querySelectorAll('td').length === 9).length === mm.a.newMerchants + mm.a.cohort);
}
// tracker: weights card gone, ASP toggle
click(btn('AMs')); await sleep(120);
setSel(entSel(), 'Farha Aly Saad'); await sleep(80);
check('AM scorecard: weights card removed', !txt().includes('Scorecard weights') && txt().includes('Retention'));
check('achievement bar and target card say they are about PICKUPS', txt().includes('Pickups achievement vs. monthly target') && txt().includes('% of monthly target') && txt().includes('Monthly pickups target'));
{
  const XA = JSON.parse(fs.readFileSync(new URL('../data/expected_asp.json', import.meta.url), 'utf8'))['Farha Aly Saad'];
  const tl = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const sg = (v, d) => (v >= 0 ? '+' : '−') + tl(Math.abs(v), d);
  click(btn('ASP')); await sleep(150); p = txt();
  const heads2 = Array.from(document.querySelectorAll('thead th')).map((x) => x.textContent.trim());
  const exact = ['Merchant', 'Parcels', 'Merchant ASP', 'Parcel Share', 'ASP Gap Contribution', 'Revenue Gap to Target', 'Merchant Group'];
  check('ASP table: Merchant / Parcels / Merchant ASP / Parcel Share / ASP Gap Contribution / Revenue Gap / Group, then shipping / VAS / change; ASP Deviation is gone', exact.every((h, i) => heads2[i].startsWith(h)) && ['Shipping ASP', 'VAS ASP', 'Change vs Sep 1–15'].every((h, i) => heads2[7 + i].startsWith(h)) && !heads2.some((x) => x.includes('Deviation')), heads2.join(' | '));
  const rowsT = Array.from(document.querySelectorAll('tbody tr')).filter((x) => x.querySelectorAll('td').length === 10).map((x) => Array.from(x.querySelectorAll('td')).map((c) => c.textContent.trim()));
  check('only eligible merchants (>= 1 delivered parcel) are listed: ' + XA.nElig + ' of ' + XA.nAll, rowsT.length === XA.nElig, String(rowsT.length));
  check('sorted by ASP Gap Contribution ascending: ' + XA.rows[0].name + ' first', rowsT[0][0] === XA.rows[0].name && Number(rowsT[0][4].replace('−', '-').replace('+', '')) <= Number(rowsT[1][4].replace('−', '-').replace('+', '')), rowsT[0].join(' | '));
  const T = XA.T, thx = XA.rows.find((r) => r.id === 'ImbeR25m9'); const r = Array.from(document.querySelectorAll('tbody tr')).find((x) => x.querySelectorAll('td').length === 10 && x.textContent.includes('Trend Hub'));
  const cells = Array.from(r.querySelectorAll('td')).map((c) => c.textContent.trim());
  check('Trend Hub row matches the independent spec calculation (parcels, ASP, share, gap contribution, revenue gap, group)', cells[1] === n0(thx.dl) && cells[2] === tl(thx.asp, 2) && cells[3] === tl(thx.share * 100, 2) + '%' && cells[4] === sg(thx.gapc, 3) && cells[5] === sg(thx.revgap, 0) && cells[6] === thx.group, cells.slice(0, 7).join(' | '));
  const sumG = rowsT.reduce((s2, c) => s2 + Number(c[4].replace('−', '-').replace('+', '')), 0);
  check('sum of ASP Gap Contributions = Portfolio ASP − Target (' + XA.gap.toFixed(3) + ')', Math.abs(sumG - XA.gap) < 0.03, sumG.toFixed(3));
  check('summary: total revenue, parcels, portfolio ASP and net gap (4 cards)', p.includes(n0(XA.REV)) && p.includes(n0(XA.DL)) && p.includes(tl(XA.P, 2)) && p.includes(sg(XA.gap, 2)), tl(XA.P, 2));
  check('removed as requested: Median Parcel Share card, Revenue gap card, Reconciliation checks, Data-quality exceptions', !p.includes('Median Parcel Share') && !p.includes('Revenue gap, below target') && !p.includes('Reconciliation') && !p.includes('Data-quality') && !p.includes('✗') && !p.includes('ASP Deviation'));
  check('summary: merchants per Merchant Group', Object.entries(XA.counts).every(([g, n]) => p.includes(g + ': ' + n)), JSON.stringify(XA.counts));
  check('the merchants causing most of the gap are listed (first 3 names)', p.includes('Five merchants causing most of the gap') && XA.neg5.slice(0, 3).every((nme) => p.includes(nme)));
  check('business interpretation, how-to and download button are shown', p.includes('Business interpretation') && p.includes('not a forecast') && p.includes('How to read this table') && p.includes('Download table (CSV)'));
  click(r); await sleep(60);
  check('row opens the scenario detail: simple words, ASP up, more parcels, shipping vs VAS, suggested focus; numbers behind it', ['In simple words', "If this merchant's ASP goes up", 'If this merchant sends more parcels', 'Where does its ASP come from', 'Suggested focus', 'Numbers behind it'].every((x) => txt().includes(x)) && !txt().includes('View full merchant profile'));
  click(r); await sleep(30);
  click(btn('Pickups')); await sleep(100);
  check('toggle back to Pickups restores the pickup columns', Array.from(document.querySelectorAll('thead th')).some((x) => x.textContent.startsWith('MTD avg daily')));
}
// portfolio overview: previous period in absolute numbers + placeholder tabs + automatic filters
click(btn('Portfolio overview →')); await waitFor(() => txt().includes('Filter merchants') && txt().includes('Overall overview'));
p = txt();
check('cards show the previous period in absolute numbers (Sep 1–15: volume / revenue, Aug: DSR)', p.includes('Sep 1–15: ' + n0(XP.pf.ptd.vol)) && /Sep 1–15: [\d,]+/.test(p) && p.includes('Aug: ' + XP.pf.dsr_aug.toFixed(1) + '%'), 'Sep 1–15: ' + n0(XP.pf.ptd.vol));
check('portfolio overview has placeholder tabs Analysis and Debugger', !!btn('Analysis') && !!btn('Debugger'));
click(btn('Debugger')); await sleep(60);
check('placeholder tab says it is to be added', txt().includes('Debugger · to be added'));
click(btn('Profile Overview')); await sleep(60);
{
  const rowsAll = JSON.parse(fs.readFileSync(new URL('../data/roster_rows.json', import.meta.url), 'utf8'));
  // one match: typing a unique name applies by itself (no click)
  setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business name'), 'Trend Hub');
  check('typing a unique business name applies automatically', await waitFor(() => txt().includes('Showing: Trend Hub') && txt().includes('Overall overview')));
  check('placeholder tabs are for the portfolio view only (not on a single merchant)', !btn('Analysis') && !btn('Debugger'));
  // clear
  click(Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Clear filters')); 
  await waitFor(() => txt().includes('Who drives this portfolio'));
  // several matches: the filtered group
  const frm = rowsAll.filter((r) => r[2] === 'Farha Aly Saad' && r[1].toLowerCase().includes('le'));
  setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business name'), 'le');
  check('2+ characters with several matches show the filtered group (' + frm.length + ' merchants)', await waitFor(() => txt().includes('Filtered: ' + frm.length + ' merchants') && txt().includes('Filtered view of ' + frm.length + ' merchants')), String(frm.length));
  p = txt();
  const expVol = frm.reduce((s2, r) => { const v = r[6].split(';')[9].split(',').map(Number); return s2 + v[0] + v[1] + v[2]; }, 0);
  check('filtered group: October volume = sum of those merchants (' + n0(expVol) + ') and "of ' + frm.length + ' filtered"', p.includes(n0(expVol)) && p.includes('of ' + frm.length + ' filtered'));
  check('filtered group: approximation note for ASR', /ASR for months before October is approximate/.test(p));
  setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business name'), 'zzzzqq');
  check('no match: clear message', await waitFor(() => txt().includes('No merchant in this portfolio matches')));
  setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business name'), '');
  check('emptying the filter returns to the whole portfolio', await waitFor(() => txt().includes('Who drives this portfolio')));
}
check('session 3: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));


// ===================== ASP analysis: clean case (Ali Aboudy) and data-quality case (Nada Elsayed) =====================
if (!btn('AMs')) await backToTracker();
click(btn('AMs')); await sleep(150);
{
  const EX2 = JSON.parse(fs.readFileSync(new URL('../data/expected_asp.json', import.meta.url), 'utf8'));
  const tl2 = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const sg2 = (v, d) => (v >= 0 ? '+' : '−') + tl2(Math.abs(v), d);
  for (const am of ['Ali Aboudy', 'Nada Elsayed']) {
    const XA = EX2[am];
    setSel(entSel(), am); await sleep(100);
    if (!Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'ASP')) throw new Error('no ASP toggle');
    click(btn('ASP')); await sleep(200);
    const pp = txt();
    check(am + ': totals, ASP, net gap, median share and group counts match the independent spec calculation', pp.includes(n0(XA.REV)) && pp.includes(n0(XA.DL)) && pp.includes(tl2(XA.P, 2)) && pp.includes(sg2(XA.gap, 2)) && pp.includes(tl2(XA.median * 100, 2) + '%') && Object.entries(XA.counts).every(([g, n]) => pp.includes(g + ': ' + n)), tl2(XA.P, 2) + ' / ' + JSON.stringify(XA.counts));
    const f1 = XA.rows[0];
    const exBox = Array.from(document.querySelectorAll('details')).find((d2) => d2.textContent.startsWith('How to read this table')).textContent;
    check(am + ': how-to explains the gap column in team-average words (target ' + tl2(XA.T, 2) + ', today ' + tl2(XA.P, 2) + ')', exBox.includes('The gap column in simple words') && exBox.includes('one team that must average') && exBox.includes(tl2(XA.T, 2)) && exBox.includes(tl2(XA.P, 2)) && exBox.includes('not a to-do of "reach the target"'));
    const gcell = Array.from(document.querySelectorAll('tbody tr'))[0].querySelectorAll('td')[4];
    check(am + ': hovering the first gap number gives the realistic framing (pulls down ' + tl2(Math.abs(f1.gapc), 3) + '; +1 EGP adds only ' + tl2(f1.share, 3) + ')', (gcell.getAttribute('title') || '').includes('Pulls the portfolio ASP ' + tl2(Math.abs(f1.gapc), 3)) && (gcell.getAttribute('title') || '').includes('Every +1 EGP on its ASP adds only ' + tl2(f1.share, 3)), gcell.getAttribute('title') || '');
    check(am + ': column header explains it ("gap it causes")', Array.from(document.querySelectorAll('thead th')).some((x) => x.textContent.includes('ASP Gap Contribution') && x.textContent.includes('gap it causes')));
    click(Array.from(document.querySelectorAll('tbody tr'))[0]); await sleep(60);
    {
      const dt = txt(); const MA = JSON.parse(fs.readFileSync(new URL('../data/merchant_asp.json', import.meta.url), 'utf8'));
      const sh = f1.share, P0 = XA.P, G0 = XA.gap;
      const eff = (dP) => dP > 0 ? (G0 < 0 ? 'closes ' + tl2((dP / -G0) * 100, 1) + '% of the gap' : 'adds ' + sg2(dP, 3) + ' to the portfolio ASP') : (G0 < 0 ? 'widens the gap by ' + tl2((-dP / -G0) * 100, 1) + '%' : 'lowers the portfolio ASP by ' + tl2(-dP, 3));
      const upOk = [0.5, 1, 2, 5].every((x) => dt.includes('ASP +' + tl2(x, 2) + ' EGP per parcel (' + tl2(f1.asp, 2) + ' → ' + tl2(f1.asp + x, 2) + ')') && dt.includes(tl2(P0 + x * sh, 3)) && dt.includes(sg2(G0 + x * sh, 3)) && dt.includes(eff(x * sh)));
      check(am + ': ASP-up scenarios for ' + f1.name + ' (+0.5 / +1 / +2 / +5 EGP): portfolio ASP, gap and effect match the independent arithmetic', upOk, 'share ' + tl2(sh * 100, 2) + '%');
      const up10 = 0.1 * f1.asp * sh;
      check(am + ': +10% ASP scenario matches (portfolio +' + tl2(up10, 3) + ')', dt.includes('ASP +10% (' + tl2(f1.asp, 2) + ' → ' + tl2(f1.asp * 1.1, 2) + ')') && dt.includes(eff(up10)));
      const volOk = [0.1, 0.25, 0.5].every((q) => { const dl2 = q * f1.dl; const P2 = (XA.REV + f1.asp * dl2) / (XA.DL + dl2); return dt.includes('+' + tl2(q * 100, 0) + '% more parcels at the same ASP') && dt.includes(tl2(P2, 3)) && dt.includes(eff(P2 - P0)); });
      check(am + ': more-parcels scenarios (+10% / +25% / +50%) match, with the honest direction (' + (f1.asp < P0 ? 'lowers' : 'lifts') + ' the portfolio ASP)', volOk);
      const vasTot = XA.rows.reduce((s2, r2) => s2 + MA[r2.id][1], 0), vasAvg = vasTot / XA.DL, vasM = MA[f1.id][1] / f1.dl;
      check(am + ': shipping vs VAS comparison shows ' + f1.name + ' VAS ' + tl2(vasM, 2) + ' vs portfolio ' + tl2(vasAvg, 2), dt.includes('Where does its ASP come from') && dt.includes(tl2(vasM, 2)) && dt.includes(tl2(vasAvg, 2)));
      if (vasM < vasAvg) check(am + ': VAS-to-portfolio-average scenario present and correct', dt.includes('VAS ASP up to the portfolio average (' + tl2(vasM, 2) + ' → ' + tl2(vasAvg, 2) + ')') && dt.includes(tl2(P0 + (vasAvg - vasM) * sh, 3)));
      const levers = [{ t: 'raising its ASP by 10%', dP: up10 }]; if (vasM < vasAvg) levers.push({ t: 'lifting its VAS ASP to the portfolio average', dP: (vasAvg - vasM) * sh });
      const dl25 = 0.25 * f1.dl, P25 = (XA.REV + f1.asp * dl25) / (XA.DL + dl25); if (P25 - P0 > 0) levers.push({ t: 'growing its parcels by 25%', dP: P25 - P0 });
      const best = levers.sort((x, y) => y.dP - x.dP)[0];
      check(am + ': suggested focus = ' + best.t + ' (' + sg2(best.dP, 3) + ')', dt.includes('The biggest of these levers is ' + best.t + ': it would lift the portfolio ASP by ' + sg2(best.dP, 3)), best.t);
    }
    click(Array.from(document.querySelectorAll('tbody tr'))[0]); await sleep(30);
    check(am + ': worked example in the how-to uses the first row (' + f1.name + ')', exBox.includes(f1.name) && exBox.includes(tl2(f1.asp, 2)) && exBox.includes(sg2(f1.gapc, 3)) && exBox.includes(f1.group), f1.name + ' ' + sg2(f1.gapc, 3));
  }
}

check('ASP view has no Not-eligible section any more', !txt().includes('Not eligible'));

// ===================== PICKUPS ACHIEVEMENT: BAR, CARD AND ESTIMATE AGREE FOR EVERY AM AND SALES REP =====================
{
  if (!btn('AMs')) await backToTracker();
  click(btn('AMs')); await sleep(150);
  const DJ = JSON.parse(fs.readFileSync(new URL('../data/new_data_oct.json', import.meta.url), 'utf8')); const OJ = JSON.parse(fs.readFileSync(new URL('../data/org_final.json', import.meta.url), 'utf8'));
  const tl3 = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const names = Array.from(entSel().options).map((o) => o.value);
  let bad = [], looked = 0;
  for (const am of names) {
    setSel(entSel(), am); await sleep(35);
    const d = DJ.ams[am], t = d.target, pk = d.merchants.reduce((x, m) => x + m.mtd, 0), daily = d.merchants.reduce((x, m) => x + m.mtdAvgDaily, 0);
    const est = pk + daily * (DJ.wdFull - DJ.wdElapsed), q = txt(), req = Math.max(0, t - pk) / Math.max(1, DJ.wdFull - DJ.wdElapsed);
    const ok = q.includes(tl3((pk / t) * 100, 1) + '% of monthly target') && q.includes(n0(pk) + ' of ' + n0(t) + ' pickups') && q.includes('Current total achievement vs target')
      && q.includes(tl3((pk / t) * 100, 1) + '% of the monthly target (' + n0(t) + ')')
      && q.includes('Run rate (month end)') && q.includes(tl3((est / t) * 100, 1) + '% of monthly target') && !q.includes('Estimated total')
      && !q.includes('Required daily avg') && !/% of Target|of pickups Target/.test(q);
    looked++; if (!ok) bad.push(am);
  }
  check('all ' + looked + ' AMs: the bar, the "Current total achievement vs target" card and the run rate all use the monthly target of the sheet and agree', bad.length === 0, bad.slice(0, 5).join(', '));
  setSel(entSel(), 'Doha Ahmed'); await sleep(60);
  { const d = DJ.ams['Doha Ahmed'], pk = d.merchants.reduce((x, m) => x + m.mtd, 0);
    check('Doha Ahmed: ' + n0(pk) + ' pickups = ' + tl3(pk / d.target * 100, 1) + '% of the monthly target ' + n0(d.target) + ' on the bar and in the card: one number, not two', txt().includes(tl3(pk / d.target * 100, 1) + '% of monthly target') && txt().includes(tl3(pk / d.target * 100, 1) + '% of the monthly target (' + n0(d.target) + ')') && !/% of Target/.test(txt())); }
  { const cards = Array.from(document.querySelectorAll('div')).filter((x) => x.textContent.startsWith('ASP') || x.textContent.startsWith('Retention') || x.textContent.startsWith('Current total achievement vs target'));
    const pos = (t) => txt().indexOf(t);
    check('the achievement card sits in the ASP / Retention row, before the Working days input; the old card is gone', pos('ASP') < pos('Retention') && pos('Retention') < pos('Current total achievement vs target') && pos('Current total achievement vs target') < pos('Working days (excl. Fridays)') && (txt().match(/Current total achievement/g) || []).length === 1); }
  check('AM tracker: no literal \\u escape sequences on screen', !/\\u[0-9a-fA-F]{4}/.test(txt()));
check('Monthly target card shows the sheet target; no card or sentence about a separate Target', txt().includes('Monthly pickups target') && txt().includes('pickups (from the targets sheet)') && !txt().includes('to reach Target'));
  // sales reps: new pickups card = actual / target as given
  click(btn('Sales')); await sleep(150);
  let badS = [], nS = 0;
  for (const sid of Array.from(entSel().options).map((o) => o.value)) {
    setSel(entSel(), sid); await sleep(35);
    const sl = OJ.sales.find((x) => x.id === sid), q = txt(), pc = tl3((sl.a.newPicked / sl.t.newPickups) * 100, 1);
    nS++; if (!(q.includes(pc + '% of monthly target') && q.includes(n0(sl.a.newPicked) + ' of ' + n0(sl.t.newPickups) + ' new pickups') && q.includes(pc + '% of the monthly target (' + n0(sl.t.newPickups) + ')') && Array.from(document.querySelectorAll('tbody tr')).filter((x) => x.querySelectorAll('td').length === 9).length === sl.a.newMerchants + sl.a.cohort)) badS.push(sl.name);
  }
  check('all ' + nS + ' sales reps: the bar and the current-achievement card show new pickups and % of the monthly target, and the table lists every new and last-month merchant', badS.length === 0, badS.slice(0, 5).join(', '));
}

// ===================== AUTHORIZATION AND ACCESS LEVELS (who can see whom): only when AUTH_ENABLED is true =====================
if (AUTH_ON) {
  const opts = () => Array.from(entSel().options).map((o) => o.textContent);
  if (!btn('Sign out')) await backToTracker();
  await signOutUI();
  check('Sign out returns to the login screen with "You\u2019re signed out." and shows no data', !!btn('Continue with Google') && (document.querySelector('[role="status"]') || {}).textContent === 'You\u2019re signed out.' && !txt().includes('Scorecard') && !document.querySelector('table') && !document.querySelector('select'));
  // VP: everything
  await signInAs('Sameh Shaheen');
  check('VP: levels VP / Heads / Team leaders / Sales / AMs, signed-in chip with access level', pillsNow().join('|') === 'VP|Heads|Team leaders|Sales|AMs' && /Sameh Shaheen.*VP · Every team/.test((document.querySelector('[data-testid="user-chip"]') || {}).textContent || ''), pillsNow().join('|'));
  click(btn('Heads')); await sleep(150); const vpTabs = tabsNow().length;
  click(btn('Team leaders')); await sleep(150); const vpTl = opts().length;
  click(btn('Sales')); await sleep(150); const vpSales = opts().length;
  click(btn('AMs')); await sleep(150); const vpAms = opts().length;
  check('VP can open 5 head tabs, any team leader (9), sales manager (22) and account manager (49)', vpTabs === 5 && vpTl === 9 && vpSales === 22 && vpAms === 49, [vpTabs, vpTl, vpSales, vpAms].join('/'));
  // Head of Key Accounts: his team only
  await signOutUI(); await signInAs('Abed Ali');
  check('Head lands on his team: levels Heads / Team leaders / Sales / AMs, only the Key Accounts tab, no VP level', tabsNow().join('|') === 'Key Accounts' && pillsNow().join('|') === 'Heads|Team leaders|Sales|AMs' && txtNoSel().includes('Head · Key Accounts') && /Head · Key Accounts team/.test((document.querySelector('[data-testid="user-chip"]') || {}).textContent || ''), tabsNow().join('|') + ' / ' + pillsNow().join('|'));
  standCheck(EL.Key, 'Head view (Key)');
  const hv = txtNoSel();
  check('Head sees no other team: no other head, no VP, no Startups or Fashion merchant', !hv.includes('Sameh Shaheen') && !hv.includes('Soha Shabaan') && !hv.includes('Khaled Mohamed El-Sadek') && !hv.includes(EL.Startups.topPick[0]) && !hv.includes(EL['Growth - Fashion'].topPick[0]), '');
  click(btn('Team leaders')); await sleep(150); const hTl = opts();
  click(btn('Sales')); await sleep(150); const hSales = opts();
  click(btn('AMs')); await sleep(150); const hAms = opts();
  check('Head can open his 2 team leaders, 6 sales and 7 AMs only', hTl.length === 2 && hSales.length === 6 && hAms.length === 7 && hAms.includes('Farha Aly Saad') && !hAms.includes('Sohaila Emad') && !hSales.includes('Zinab Ayman'), [hTl.length, hSales.length, hAms.length].join('/'));
  // Team leader: his AMs and sales only
  await signOutUI(); await signInAs('Ahmed Saleh');
  check('Team leader lands on his own screen: no tabs, levels Team leaders / Sales / AMs', pillsNow().join('|') === 'Team leaders|Sales|AMs' && tabsNow().length === 0 && txtNoSel().includes('Where the team stands against targets'), pillsNow().join('|'));
  const tv = txtNoSel();
  check('Team leader sees his AMs and sales and nothing of the other team leader', tv.includes('Farha Aly Saad') && tv.includes('Ahmed Sayed Ahmed') && !tv.includes('Ali Aboudy') && !tv.includes('Merna Atef') && !tv.includes('Mostafa Elsaeied'), '');
  check('Team leader: his own selector holds only himself', opts().length === 1, opts().join(','));
  click(btn('Sales')); await sleep(150); const tSales = opts();
  click(btn('AMs')); await sleep(150); const tAms = opts();
  check('Team leader can open his 3 sales and 3 AMs only', tSales.length === 3 && tAms.length === 3 && tAms.includes('Mayar Adel') && !tAms.includes('Ali Aboudy') && !tSales.includes('Merna Atef'), tSales.length + '/' + tAms.length);
  // Account manager: own view only
  await signOutUI(); await signInAs('Farha Aly Saad');
  check('Account manager lands on his own tracker and has no other level', pillsNow().join('|') === 'AMs' && txt().includes('Target daily avg') && opts().join('|') === 'Farha Aly Saad', pillsNow().join('|') + ' / ' + opts().join('|'));
  check('Account manager can still open his own portfolio overview', !!btn('Portfolio overview →'));
  // Sales manager: own view only
  await signOutUI(); await signInAs('Zinab Ayman');
  check('Sales manager lands on his own sales view and has no other level', pillsNow().join('|') === 'Sales' && opts().join('|') === 'Zinab Ayman' && txt().includes('Merchant detail'), pillsNow().join('|') + ' / ' + opts().join('|'));
  // back to VP
  await signOutUI(); await signInAs('Sameh Shaheen');
  check('signing in again as the VP restores the full view', pillsNow().length === 5);
  check('permissions block: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
}

check('literal \\u sequences anywhere: none', !/\\u[0-9a-fA-F]{4}/.test(txt()));
check('TOTAL runtime errors = 0', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
