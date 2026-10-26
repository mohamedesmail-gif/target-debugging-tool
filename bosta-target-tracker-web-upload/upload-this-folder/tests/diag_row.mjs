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
window.addEventListener('error', (e) => { console.log('ERR', e.error && e.error.stack ? e.error.stack.split('\n').slice(0, 6).join('\n') : e.message); });
const ce = console.error; console.error = (...a) => { const s = a.join(' '); if (/reduce|undefined/.test(s)) console.log('CE', s.slice(0, 600)); };
root.render(React.createElement(TT, { payload: PAYLOAD })); await sleep(200);
const signInVp = async () => { if (!Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Continue with Google')) return;   // no login screen while auth is off
  click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue with Google')); await sleep(80); const i = document.querySelector('input[aria-label="Bosta email"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'sameh.shaheen@bosta.co'); i.dispatchEvent(new window.Event('input', { bubbles: true })); click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue')); await sleep(350); };
await signInVp(); click(btn('AMs')); await sleep(100);
setSel(Array.from(document.querySelectorAll('select')).find((x) => x.getAttribute('aria-label') !== 'Top and bottom list'), 'Ali Aboudy'); await sleep(80); click(btn('ASP')); await sleep(150);
console.log('table rows', document.querySelectorAll('tbody tr').length);
click(document.querySelectorAll('tbody tr')[0]); await sleep(150);
console.log('detail open:', document.body.textContent.includes('In simple words'));
process.exit(0);
