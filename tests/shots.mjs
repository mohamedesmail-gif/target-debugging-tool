import { JSDOM } from 'jsdom';
import fs from 'fs';
import { Resvg } from '@resvg/resvg-js';
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
async function waitFor(fn, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(100); } return false; }
root.render(React.createElement(TT, { payload: PAYLOAD })); await sleep(200);
const signInVp = async () => { if (!Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Continue with Google')) return;   // no login screen while auth is off
  click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue with Google')); await sleep(80); const i = document.querySelector('input[aria-label="Bosta email"]'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'sameh.shaheen@bosta.co'); i.dispatchEvent(new window.Event('input', { bubbles: true })); click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Continue')); await sleep(350); };
await signInVp();
const which = process.argv[2] || 'portfolio';
if (which === 'portfolio') { click(btn('Portfolio overview →')); await waitFor(() => document.body.textContent.includes('Who drives')); }
else { const b = Array.from(document.querySelectorAll('button[title="Open merchant profile"]')).find((x) => x.textContent === 'Trend Hub'); click(btn('Portfolio overview →') && b); await waitFor(() => document.body.textContent.includes('Overall overview')); }
await sleep(200);
// each chart card: title + insight + its svg(s) -> one svg image per card (title/insight drawn as text above)
const cards = Array.from(document.querySelectorAll('div')).filter((d) => d.querySelector(':scope > div > span') && d.querySelector('svg') && /border-radius: 12px/.test(d.getAttribute('style') || '') && /padding: 14px 16px 10px/.test(d.getAttribute('style') || ''));
console.log('chart cards:', cards.length);
let idx = 0;
for (const c of cards) {
  const title = c.querySelector(':scope > div > span').textContent;
  const insight = (c.children[1] && c.children[1].tagName === 'DIV' && !c.children[1].querySelector('svg') ? c.children[1].textContent : '');
  const svgs = Array.from(c.querySelectorAll('svg')).filter((s) => s.getAttribute('viewBox'));
  let y = 52, parts = [];
  for (const s of svgs) { const vb = s.getAttribute('viewBox').split(' ').map(Number); parts.push(`<g transform="translate(0,${y})">${s.innerHTML}</g>`); y += vb[3] + 6; }
  const esc = (t) => String(t).replace(/&/g, 'and').replace(/</g, '').replace(/>/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${y + 8}" viewBox="0 0 640 ${y + 8}"><rect width="640" height="${y + 8}" fill="#fff"/><text x="12" y="22" font-family="sans-serif" font-size="14" font-weight="700" fill="#1B2333">${esc(title)}</text><text x="12" y="42" font-family="sans-serif" font-size="12" fill="#5B6472">${esc(insight)}</text>${parts.join('')}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 960 }, font: { loadSystemFonts: true } }).render().asPng();
  fs.writeFileSync(`tests/out/${which}_${String(idx++).padStart(2, '0')}_${title.replace(/[^a-z0-9]+/gi, '_')}.png`, png);
}
process.exit(0);
