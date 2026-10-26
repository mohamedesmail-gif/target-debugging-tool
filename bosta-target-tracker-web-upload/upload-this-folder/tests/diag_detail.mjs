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
const errs = []; window.addEventListener('error', (e) => errs.push(e.message)); console.error = (...a) => { const s = a.join(' '); if (!/act\(|Warning: /.test(s)) errs.push(s.slice(0, 160)); };
const ORG = JSON.parse(fs.readFileSync(new URL('../data/org_final.json', import.meta.url), 'utf8'));
root.render(React.createElement(TT, { payload: PAYLOAD })); await sleep(200);
const signInVp = async () => { if (!Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Continue with Google')) return;   // no login screen while auth is off
  click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue with Google')); await sleep(80); const i = document.querySelector('input[aria-label="Bosta email"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'sameh.shaheen@bosta.co'); i.dispatchEvent(new window.Event('input', { bubbles: true })); click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue')); await sleep(350); };
await signInVp(); click(btn('AMs')); await sleep(100);
setSel(Array.from(document.querySelectorAll('select')).find((x) => x.getAttribute('aria-label') !== 'Top and bottom list'), 'Ali Aboudy'); await sleep(80); click(btn('ASP')); await sleep(150);
click(document.querySelectorAll('tbody tr')[0]); await sleep(120);
const det = Array.from(document.querySelectorAll('tbody tr')).find((r) => r.textContent.includes('In simple words'));
const lines = []; det.querySelectorAll('div').forEach((d) => { if (d.children.length === 0 || d.children.length >= 3 && d.querySelectorAll('div').length === 0) { const t = d.textContent.replace(/\s+/g, ' ').trim(); if (t && !lines.includes(t)) lines.push(t); } });
console.log(lines.slice(0, 40).join('\n'));
let opened = 0, bad = [];
for (const a of ORG.ams) {
  setSel(Array.from(document.querySelectorAll('select')).find((x) => x.getAttribute('aria-label') !== 'Top and bottom list'), a.name); await sleep(30); if (btn('Pickups')) {} 
  if (!btn('ASP')) continue; click(btn('ASP')); await sleep(50);
  const rows = Array.from(document.querySelectorAll('tbody tr')).filter((r) => r.querySelectorAll('td').length === 10);
  for (const r of [rows[0], rows[rows.length - 1]].filter(Boolean)) { click(r); await sleep(30); opened++; const t = document.body.textContent; const m = t.match(/.{0,30}(NaN|undefined|Infinity).{0,30}/); if (m && !/NaNa Corchet/.test(m[0])) bad.push(a.name + ': ' + m[0]); click(r); await sleep(10); }
  click(btn('Pickups')); await sleep(15);
}
console.log('\nrow details opened:', opened, '| glitches:', bad.length ? bad.slice(0, 3) : 'none', '| runtime errors:', errs.length ? errs.slice(0, 3) : 'none');
process.exit(0);
