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
const errs = []; window.addEventListener('error', (e) => errs.push(e.message)); const ce = console.error; console.error = (...a) => { const s = a.join(' '); if (!/act\(|Warning: /.test(s)) errs.push(s.slice(0, 200)); };
const ORG = JSON.parse(fs.readFileSync(new URL('../data/org_final.json', import.meta.url), 'utf8'));
root.render(React.createElement(TT, { payload: PAYLOAD })); await sleep(200);
const signInVp = async () => { if (!Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Continue with Google')) return;   // no login screen while auth is off
  click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue with Google')); await sleep(80); const i = document.querySelector('input[aria-label="Bosta email"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'sameh.shaheen@bosta.co'); i.dispatchEvent(new window.Event('input', { bubbles: true })); click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue')); await sleep(350); };
await signInVp(); click(btn('AMs')); await sleep(100);
let bad = [], noData = [], checked = 0, failedChecks = [];
for (const a of ORG.ams) {
  setSel(Array.from(document.querySelectorAll('select')).find((x) => x.getAttribute('aria-label') !== 'Top and bottom list'), a.name); await sleep(40);
  click(btn('ASP')); await sleep(70);
  const t = document.body.textContent;
  if (t.includes('cannot be shown')) { noData.push(a.name); click(btn('Pickups')); continue; }
  checked++;
  const m = t.match(/.{0,30}(NaN|undefined|Infinity).{0,30}/); if (m) bad.push(a.name + ': ' + m[0]);
  if (t.includes('✗')) failedChecks.push(a.name);
  click(btn('Pickups')); await sleep(20);
}
console.log('AMs checked', checked, '| no ASP data/target (message shown):', noData, '| glitches:', bad.length ? bad : 'none', '| failed reconciliation:', failedChecks.length ? failedChecks : 'none', '| runtime errors:', errs.length ? errs.slice(0, 3) : 'none');
process.exit(0);
