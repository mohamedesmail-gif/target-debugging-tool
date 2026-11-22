// ============================================================================
// THEME: the single source of truth for colours, type, radii and the global stylesheet.
// Plain JS (no JSX, no React). scripts/assemble.py puts it at module level, ahead of the app,
// so the loading and error screens can use it too. COLORS in tracker.jsx is built from THEME.color.
//
// Design basis: the Smileys dashboard look (soft rounded cards, thin borders, navy primary, Inter, Lucide outline icons).
// Tokens come from the values inspected on the reference. Where the reference value is too light for small text
// (muted #888780 is 3.4:1 on white), TEXT uses the darker "soft" token and the reference value is kept for icons
// and non-text details. See docs/THEME.md.
// ============================================================================
const THEME = {
  color: {
    page: "#FFFFFF",          // page background and inner tiles
    tile: "#FFFFFF",          // inner metric tiles
    card: "#F7F7F5",          // main card background
    control: "#F4F4F2",       // neutral controls (inactive pills, secondary buttons, inputs)
    line: "#EFEFEC",          // borders and dividers
    lineStrong: "#D6D5CE",    // control outlines (inputs, secondary buttons): slightly stronger for visibility
    navy: "#21254B",          // primary
    navyHover: "#2E3366",
    navyTint: "rgba(33,37,75,0.06)",
    text: "#1C1D21",          // main text
    text2: "#5F5E5A",         // secondary text
    soft: "#6B6A65",          // small functional text (labels, hints): 5.0:1 on the card colour
    muted: "#888780",         // icons, placeholders, disabled: not for small text
    deco: "#B4B2A9",          // faint decorative elements
    brand: "#E30613",         // brand accent, used sparingly
    pos: "#1D9E75", posBg: "#E1F5EE", posText: "#0F6E56",
    neg: "#A32D2D", negBg: "#FDECEE",
    warn: "#854F0B", warnBg: "#FAEEDA",
    chart: "#0F9D8A", chart2: "#7FCFC2", chartTint: "#D6EFEA", sand: "#E9DFC8", // chart theme: one teal accent with its tints and a sand neutral (no grid, no reference lines)
    violet: "#5B4FA3", violetBg: "#EEECF8", // the one extra hue: keeps the "New" category apart in charts and badges
  },
  radius: { card: 20, tile: 14, btn: 14, input: 12, small: 8, pill: 999 },
  space: { card: 18, tile: 14 },
  font: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap",
};

// Global stylesheet. Inline styles in the components set the look of each element; this sheet adds what inline styles cannot:
// base typography, hover / focus / selected / disabled states, scrollbars, reduced motion, and the phone / tablet adjustments.
const THEME_CSS = (() => {
  const c = THEME.color;
  return `
@import url('${THEME.fontUrl}');
:root{--tt-page:${c.page};--tt-card:${c.card};--tt-control:${c.control};--tt-line:${c.line};--tt-line-strong:${c.lineStrong};--tt-navy:${c.navy};--tt-text:${c.text};--tt-text2:${c.text2};--tt-brand:${c.brand};--tt-font:${THEME.font}}
.tt-root,.tt-root *{box-sizing:border-box}
.tt-root{font-family:var(--tt-font);color:var(--tt-text);background:var(--tt-page);font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-variant-numeric:tabular-nums;min-height:100%;width:100%;max-width:100%;overflow-x:clip}
.tt-root button,.tt-root input,.tt-root select,.tt-root textarea{font-family:inherit;font-variant-numeric:tabular-nums}
.tt-root h1,.tt-root h2,.tt-root h3{font-family:inherit}
.tt-root ::selection{background:${c.navy};color:#fff}
/* interaction states */
.tt-root button{transition:background-color .15s,border-color .15s,box-shadow .15s,filter .15s,color .15s}
.tt-root button:not(:disabled){cursor:pointer}
.tt-root button:not(:disabled):hover{filter:brightness(.965)}
.tt-root button:not(:disabled):active{filter:brightness(.93)}
.tt-root button:disabled,.tt-root button[aria-disabled="true"]{opacity:.5;cursor:not-allowed}
.tt-root :focus{outline:none}
.tt-root :focus-visible{outline:2px solid ${c.navy};outline-offset:2px;border-radius:${THEME.radius.small}px}
.tt-root input:focus-visible,.tt-root select:focus-visible{outline-offset:0;border-color:${c.navy}!important;box-shadow:0 0 0 3px rgba(33,37,75,.14)}
.tt-root input::placeholder{color:${c.muted};opacity:1}
.tt-root input:disabled,.tt-root select:disabled{background:${c.control};color:${c.muted};cursor:not-allowed}
.tt-root tr[style*="cursor: pointer"]:hover td{background:${c.card}}
.tt-root th[style*="cursor: pointer"]:hover{color:${c.text}}
.tt-root button[style*="background: none"]:hover,.tt-root button[title="Open merchant profile"]:hover{text-decoration:underline}
.tt-root a{color:${c.navy}}
.tt-root a:hover{text-decoration:underline}
.tt-root table{font-variant-numeric:tabular-nums}
.tt-root [data-tt="scroll"]{-webkit-overflow-scrolling:touch}
.tt-root ::-webkit-scrollbar{height:8px;width:8px}
.tt-root ::-webkit-scrollbar-thumb{background:${c.deco};border-radius:8px;border:2px solid transparent;background-clip:content-box}
.tt-root ::-webkit-scrollbar-track{background:transparent}
.tt-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.tt-shell{padding:28px 24px 64px}
.tt-wrap{max-width:1180px;margin:0 auto;width:100%}
.tt-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tt-bar-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-left:auto}
.tt-scroll-x{overflow-x:auto;max-width:100%}
@media (prefers-reduced-motion:reduce){.tt-root *{transition:none!important;animation:none!important}}
/* tablet */
@media (max-width:900px){
  .tt-shell{padding:22px 18px 56px}
  .tt-wrap{max-width:100%}
}
/* phone */
@media (max-width:640px){
  .tt-shell{padding:16px 14px 48px}
  .tt-bar-actions{margin-left:0;width:100%}
  .tt-bar-actions>button{flex:1 1 auto;justify-content:center}
  .tt-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;padding:12px!important}
  .tt-stack-sm{flex-direction:column!important;align-items:stretch!important}
  .tt-full-sm{width:100%!important;min-width:0!important;max-width:100%!important}
  .tt-root table td:first-child,.tt-root table th:first-child{position:sticky;left:0;z-index:1;background:inherit}
  .tt-root table thead th:first-child{background:${c.card}}
  .tt-root input[type="text"],.tt-root input[type="number"],.tt-root input[type="date"],.tt-root input:not([type]),.tt-root select{font-size:16px!important}
}
`;
})();
