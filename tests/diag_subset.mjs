import fs from 'fs';
import { JSDOM } from 'jsdom';
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
const setInput = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new window.Event('input', { bubbles: true })); };
async function waitFor(fn, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(100); } return false; }
const bad = []; const scan = (l) => { const t = document.body.textContent; const m = t.match(/.{0,40}(NaN|undefined|Infinity).{0,30}/); if (m) bad.push(l + ': ' + m[0]); };
root.render(React.createElement(TT, { payload: PAYLOAD })); await sleep(200);
const signInVp = async () => { if (!Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Continue with Google')) return;   // no login screen while auth is off
  click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue with Google')); await sleep(80); const i = document.querySelector('input[aria-label="Bosta email"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'sameh.shaheen@bosta.co'); i.dispatchEvent(new window.Event('input', { bubbles: true })); click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue')); await sleep(350); };
await signInVp();
click(btn('AMs')); await sleep(100);
for (const am of ['Farha Aly Saad', 'maha Kotb', 'Nourhan Hossam Farid', 'Yousra Gamal Youssef Elawady']) {
  setSel(Array.from(document.querySelectorAll('select')).find((x) => x.getAttribute('aria-label') !== 'Top and bottom list'), am); await sleep(60); scan('tracker ' + am);
  click(btn('ASP')); await sleep(80); scan('tracker ASP ' + am); click(btn('Pickups')); await sleep(40);
  click(btn('Portfolio overview →')); await waitFor(() => document.body.textContent.includes('Filter merchants') || document.body.textContent.includes('No merchants are assigned'));
  if (document.body.textContent.includes('Filter merchants') && document.body.textContent.includes('Overall overview')) {
    scan('portfolio ' + am);
    for (const q of ['a', 'sh', 'store']) { setInput(Array.from(document.querySelectorAll('input')).find((i) => i.placeholder === 'Business name'), q); await sleep(700); await waitFor(() => !document.body.textContent.includes('Loading'), 8000); scan('filter "' + q + '" ' + am); }
  }
  click(btn('← Back to portfolio overview') || btn('← Back to Target Tracker')); await sleep(300); if (btn('← Back to Target Tracker')) click(btn('← Back to Target Tracker')); await sleep(100);
}
console.log('glitches:', bad.length ? bad : 'none');
process.exit(0);
