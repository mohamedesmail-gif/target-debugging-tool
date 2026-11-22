// Sweep of the leadership screens: every tab, every team leader with every AM / sales row expanded. Looks for NaN / undefined / Infinity and runtime errors.
import { JSDOM } from 'jsdom';
import fs from 'fs';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
try { Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true }); } catch (e) {}
global.HTMLElement = dom.window.HTMLElement; global.Event = dom.window.Event; global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
const React = (await import('react')).default; const { createRoot } = await import('react-dom/client');
const TT = (await import('../dist/bundle.mjs')).default; const root = createRoot(document.getElementById('root'));
const PAYLOAD = JSON.parse(fs.readFileSync(new URL('../dist/payload.json', import.meta.url), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el.dispatchEvent(new window.Event('click', { bubbles: true }));
const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === t);
const setSel = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new window.Event('change', { bubbles: true })); };
const entSel = () => Array.from(document.querySelectorAll('select')).find((x) => x.getAttribute('aria-label') !== 'Top and bottom list');
const errs = []; window.addEventListener('error', (e) => errs.push(e.message)); console.error = (...a) => { const s = a.join(' '); if (!/act\(|Warning: /.test(s)) errs.push(s.slice(0, 160)); };
const ORG = JSON.parse(fs.readFileSync(new URL('../data/org_final.json', import.meta.url), 'utf8'));
const noSel = () => { const c = document.body.cloneNode(true); c.querySelectorAll('select').forEach((x) => x.remove()); return c.textContent; };
const bad = []; const scan = (l) => { const m = noSel().match(/.{0,30}(NaN|undefined|Infinity).{0,30}/); if (m && !/NaNa Corchet/.test(m[0])) bad.push(l + ': ' + m[0]); };
root.render(React.createElement(TT, { payload: PAYLOAD })); await sleep(250);
const signInVp = async () => { if (!Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Continue with Google')) return;   // no login screen while auth is off
  click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue with Google')); await sleep(80); const i = document.querySelector('input[aria-label="Bosta email"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'sameh.shaheen@bosta.co'); i.dispatchEvent(new window.Event('input', { bubbles: true })); click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue')); await sleep(350); };
await signInVp();
let t0 = Date.now(), slowest = 0;
click(btn('VP')); await sleep(80); scan('VP screen');
click(btn('Heads')); await sleep(80);
for (const tab of ['Key Accounts', 'Growth Fashion', 'Growth General Trade', 'Growth Cosmetics', 'Startups']) {
  const t1 = Date.now(); click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === tab)); await sleep(60); scan('tab ' + tab);
  for (const v of ['pickups-growth', 'asp-growth', 'dsr', 'vas']) { setSel(Array.from(document.querySelectorAll('select')).find((x) => x.getAttribute('aria-label') === 'Top and bottom list'), v); await sleep(25); scan('tab ' + tab + ' / ' + v); }
  slowest = Math.max(slowest, Date.now() - t1);
}
let expanded = 0;
for (const t of ORG.tls) {
  click(btn('Team leaders')); await sleep(40); setSel(entSel(), t.id); await sleep(80); scan('TL ' + t.name);
  const rows = Array.from(document.querySelectorAll('tbody tr')).filter((r) => r.querySelectorAll('td').length >= 6 && /[▸▾]/.test(r.textContent));
  for (const r of rows) { click(r); await sleep(40); expanded++; scan('TL ' + t.name + ' / ' + r.textContent.slice(0, 24)); click(r); await sleep(10); }
}
console.log('tabs swept: VP + 5 | TLs swept:', ORG.tls.length, '| AM / sales rows expanded:', expanded, '| slowest tab (render + 3 metric views):', slowest, 'ms | glitches:', bad.length ? bad.slice(0, 3) : 'none', '| runtime errors:', errs.length ? errs.slice(0, 3) : 'none');
process.exit(0);
