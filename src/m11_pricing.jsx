// ============================================================================
// PRICING CALCULATOR + PRICING TAB
// Engine: src/pricing_engine.js (PRC_ENG), ported from the Merchant Pricing Simulator.
//
// Two surfaces, one engine:
//   PricingSimulatorScreen  the full simulator (m12_simulator.jsx), opened by the Pricing calculator button and by the Pricing simulator button.
//   MPPricingTab            the full picture (plan, order mix, revenue lines, and for margin
//                           viewers the cost lines and GM2) on the merchant profile.
//
// WHO SEES WHAT (prcCanUse, prcCanSeeMargin, prcCanSeeCostTab below)
// AMs and sales: no pricing tools at all. Team leaders: revenue and ASP. Heads: plus cost, GM2 and P&L.
// VP: everything, plus the Cost assumptions tab. This is a UI gate, not a security boundary: whatever pack the
// browser fetches can be read by anyone with access to that browser. The standard pack has no cost data in it at all,
// so team leaders never receive cost; serve the full pack only to heads and the VP from the API. See docs/DATA_SOURCES.md.
// ============================================================================

const PRC_STORE_URL = (typeof window !== "undefined" && window.PORTAL_CONFIG && window.PORTAL_CONFIG.pricingUrl) || "/pricing_store.b64";

// Who is signed in. Set by the app on every render (scripts/assemble.py patches it in next to
// `const viewer = parseViewer(viewerKey)`), so the profile screen does not have to thread it down.
let PRC_VIEWER_KEY = "vp";

// Who may use the pricing tools: VP, heads and team leaders (to act on it). Account managers and sales do not see them at all.
// Also hidden on the AM and sales screens (and their merchant pages) even when a leader is looking at them: only the
// VP, heads, team leaders and simulator screens carry the pricing tools. PRC_SCREEN is set by the app on every render.
let PRC_SCREEN = "vp";
function prcCanUse(viewerKey) {
  const v = parseViewer(viewerKey === undefined ? PRC_VIEWER_KEY : viewerKey);
  return (v.kind === "vp" || v.kind === "head" || v.kind === "tl") && ["vp", "heads", "tl", "simulator"].indexOf(PRC_SCREEN) >= 0;
}
// Margin and profitability (cost, GM2, P&L): heads and the VP only. Team leaders see revenue and ASP.
function prcCanSeeMargin(viewerKey) {
  const v = parseViewer(viewerKey === undefined ? PRC_VIEWER_KEY : viewerKey);
  return v.kind === "vp" || v.kind === "head";
}
// The Cost assumptions tab: VP only.
function prcCanSeeCostTab(viewerKey) {
  return parseViewer(viewerKey === undefined ? PRC_VIEWER_KEY : viewerKey).kind === "vp";
}
// The screen that opens the simulator for a merchant (set by the app, like PRC_VIEWER_KEY).
let PRC_OPEN_SIM = null;

// Two packs: the standard one (revenue and ASP only, no cost data in it) and the full one (with cost). Heads and the VP
// load the full pack; everyone else loads the standard one, so a team leader's browser never receives cost figures.
// If the full pack is not served, a head or the VP falls back to the standard pack and sees revenue and ASP only.
const PRC_CACHE = {};
function prcFetchPack(inlineKey, urlKey, defUrl) {
  const cfg = (typeof window !== "undefined" && window.PORTAL_CONFIG) || {};
  const url = cfg[urlKey] || defUrl;
  if (cfg[inlineKey]) return Promise.resolve(cfg[inlineKey]);
  return fetch(url, { credentials: "same-origin" })
    .then((r) => { if (!r.ok) throw new Error("the pricing pack was not found at " + url + " (HTTP " + r.status + ")"); return r.text(); })
    .catch((e) => { throw new Error(/HTTP/.test(String(e.message)) ? e.message : "the pricing pack could not be fetched from " + url + ". It has to be served next to payload.json"); });
}
function prcLoadStore(wantMargin) {
  const kind = wantMargin ? "full" : "std";
  if (PRC_CACHE[kind] && PRC_CACHE[kind].store) return Promise.resolve(PRC_CACHE[kind].store);
  if (PRC_CACHE[kind] && PRC_CACHE[kind].promise) return PRC_CACHE[kind].promise;
  const load = (full) => (full ? prcFetchPack("pricingFullB64", "pricingFullUrl", "/pricing_store_full.b64") : prcFetchPack("pricingB64", "pricingUrl", PRC_STORE_URL))
    .then((b64) => mpInflate(b64.trim())).then((txt) => JSON.parse(txt));
  const p = (wantMargin ? load(true).catch(() => load(false)) : load(false))
    .then((st) => { PRC_CACHE[kind] = { store: st }; return st; })
    .catch((e) => { PRC_CACHE[kind] = null; throw e; });
  PRC_CACHE[kind] = { promise: p };
  return p;
}

// Does this merchant have pricing data at all? Used to show or hide the button.
function prcHas(store, id) { return !!(store && store.m && store.m[id]); }

// One scenario: the merchant's own month on `plan`. Returns {actual, current, next}.
function prcRun(store, id, month, plan, scope, compMode) {
  const C = PRC_ENG.costSettings(store, compMode);
  const base = PRC_ENG.baseFor(store, id, month, scope || "id");
  if (!base) return null;
  const curPlan = store.plan[id];
  const actual = PRC_ENG.actual(base, C);
  const opts = { curPlan, k: 1, keepRto: true, keepPromo: true };
  const current = PRC_ENG.simulate(base, store.pricing, { ...opts, plan: curPlan }, C);
  const next = plan && plan !== curPlan ? PRC_ENG.simulate(base, store.pricing, { ...opts, plan }, C) : null;
  return { base, C, curPlan, actual, current, next };
}

// The plan list, current plan first, then alphabetical.
function prcPlanList(store, curPlan) {
  const all = Object.keys(store.pricing.plans).sort();
  return curPlan ? [curPlan].concat(all.filter((p) => p !== curPlan)) : all;
}

function prcDelta(a, b) { return b == null || a == null ? null : b - a; }
function prcPctChange(a, b) { return !a || b == null ? null : (b - a) / Math.abs(a); }

function PrcGm2Badge({ res }) {
  if (!res || res.gm2pct == null) return null;
  const band = PRC_ENG.gm2Range(res.orders);
  const variance = res.gm2pct - band[2];
  const tol = PRC_ENG.tolOf(variance, { tolG: -0.01, tolY: -0.04 });
  const col = tol === "g" ? COLORS.teal : tol === "y" ? COLORS.amber : COLORS.coral;
  const bg = tol === "g" ? COLORS.tealDim : tol === "y" ? COLORS.amberDim : COLORS.coralDim;
  return (
    <div style={{ background: bg, border: `1px solid ${col}`, borderRadius: 8, padding: "10px 14px", fontSize: 12.5, lineHeight: 1.5 }}>
      <strong style={{ color: col }}>GM2 {pct(res.gm2pct, 1)}</strong> against an expected{" "}
      <strong>{pct(band[2], 1)}</strong> for merchants doing {PRC_ENG.gm2RangeLabel(band, true)} orders a month
      {" — "}{variance >= 0 ? "above" : (Math.abs(variance) * 100).toFixed(1) + " points below"} the benchmark.
    </div>
  );
}

// The button on the merchant page. It opens the pricing simulator for this merchant. Only the VP, heads and team leaders get it,
// and it renders nothing until the pack says the merchant is in it.
function PricingCalculatorButton({ merchantId, canSeeMargin }) {
  const [available, setAvailable] = useState(null);
  useEffect(() => {
    let alive = true;
    prcLoadStore(canSeeMargin).then((s) => { if (alive) setAvailable(prcHas(s, merchantId)); }).catch(() => { if (alive) setAvailable(false); });
    return () => { alive = false; };
  }, [merchantId, canSeeMargin]);
  if (!prcCanUse() || available === false) return null;
  return (
    <button onClick={() => PRC_OPEN_SIM && PRC_OPEN_SIM(merchantId)} disabled={available === null}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#fff", background: COLORS.blue, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", opacity: available === null ? 0.6 : 1 }}>
      Pricing calculator
    </button>
  );
}

// ---------------------------------------------------------------- pricing tab
// The detail the calculator leaves out: plan, order mix, every revenue line, and for
// margin viewers the cost lines and GM2.
// ---- Pricing tab sections: ASP bridge, EGP per order, Order mix. Revenue and volume only, never cost. ----

// Every revenue line, EGP per order. Used by the per-order table and the ASP bridge.
function prcAspLines(r) {
  const o = r.orders || 1, L = [];
  "SRECKPGF".split("").forEach((t) => L.push([PRC_ENG.TYPE_NAME[t], ((r.shipT && r.shipT[t]) || 0) / o]));
  L.push(["Bundle sales", r.bundleRev / o], ["Bundle discount", -r.dBundle / o], ["RTO discount", -r.dRto / o], ["Own promo discount", -r.dPromo / o],
    ["RTO colour discount", -r.dColour / o], ["Promo engine discount", -r.dTier / o], ["Zero cash on delivery discount", -r.dZcod / o],
    ["Allow to open", r.ato / o], ["Flexship", r.flex / o], ["Next day COD", (r.nd || 0) / o], ["Extra COD", (r.xcod || 0) / o], ["Insurance", (r.ins || 0) / o],
    ["COD fee", (r.codfee || 0) / o], ["Drop-off zone fees", (r.zone || 0) / o], ["Packaging materials", (r.mat || 0) / o],
    ["Packaging delivery", (r.matdel || 0) / o], ["Pickup fees", (r.pickup || 0) / o]);
  return L;
}

function prcNiceStep(x) {
  const e = Math.pow(10, Math.floor(Math.log10(x || 1))), f = x / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
}

// ASP bridge: current plan ASP to the chosen plan's ASP, one bar per revenue line whose value per order changed.
function PrcAspBridge({ cur, fin, finName }) {
  const a = prcAspLines(cur), b = prcAspLines(fin), steps = [];
  for (let i = 0; i < a.length; i++) { const d = b[i][1] - a[i][1]; if (Math.abs(d) >= 0.005) steps.push([a[i][0], d]); }
  const a0 = cur.revenue / cur.orders, a1 = fin.revenue / fin.orders;
  const bars = [{ l: "Current plan ASP", v: a0, tot: true }, ...steps.map((x) => ({ l: x[0], v: x[1] })), { l: "New plan ASP", v: a1, tot: true }];
  let run = 0, lo = 0, hi = 0;
  bars.forEach((bb) => { if (bb.tot) { bb.y0 = 0; bb.y1 = bb.v; run = bb.v; } else { bb.y0 = run; bb.y1 = run + bb.v; run = bb.y1; } lo = Math.min(lo, bb.y0, bb.y1); hi = Math.max(hi, bb.y0, bb.y1); });
  const W = 860, H = 250, pl = 40, pr = 10, pt = 18, pb = 92, iw = W - pl - pr, ih = H - pt - pb;
  const step = prcNiceStep((hi - lo) / 4 || 1), y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
  const Y = (v) => pt + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const bw = iw / bars.length, sg = (v) => (v >= 0 ? "+" : "\u2212");
  const grid = [];
  for (let t = y0; t <= y1 + 1e-9; t += step) grid.push(t);
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>ASP bridge, EGP per order</div>
      <div style={{ fontSize: 11.5, color: COLORS.textFaint, margin: "2px 0 8px" }}>Current plan {"\u2192"} {finName}. Only revenue lines that change are shown.</div>
      {steps.length === 0 ? <div style={{ fontSize: 12.5, color: COLORS.textMuted, padding: "10px 0" }}>No revenue line changes per order.</div> : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="ASP bridge from the current plan to the new plan" style={{ fontFamily: "inherit" }}>
          {grid.map((t) => (
            <g key={t}><line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} stroke={COLORS.panelBorder} />
              <text x={pl - 6} y={Y(t) + 4} textAnchor="end" fontSize="10.5" fill={COLORS.textFaint}>{fmt(t, 0)}</text></g>
          ))}
          {bars.map((bb, i) => {
            const x = pl + i * bw + bw * 0.18, w = bw * 0.64, top = Y(Math.max(bb.y0, bb.y1)), bot = Y(Math.min(bb.y0, bb.y1));
            const col = bb.tot ? COLORS.slate : bb.v >= 0 ? COLORS.teal : COLORS.coral;
            const lx = x + w / 2, ly = H - pb + 12;
            return (
              <g key={i}>
                <rect x={x} y={top} width={w} height={Math.max(1.5, bot - top)} rx="2" fill={col}><title>{bb.l + ": " + (bb.tot ? "" : sg(bb.v)) + fmt(Math.abs(bb.v), 2)}</title></rect>
                {i < bars.length - 1 && <line x1={x + w} x2={x + bw} y1={Y(bb.tot ? bb.v : bb.y1)} y2={Y(bb.tot ? bb.v : bb.y1)} stroke={COLORS.textFaint} strokeDasharray="2 2" />}
                <text x={lx} y={top - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill={bb.tot ? COLORS.text : col}>{bb.tot ? fmt(bb.v, 2) : sg(bb.v) + fmt(Math.abs(bb.v), 2)}</text>
                <text x={lx} y={ly} textAnchor="end" fontSize="10.5" fill={COLORS.textMuted} transform={`rotate(-28 ${lx} ${ly})`}>{bb.l.length > 24 ? bb.l.slice(0, 23) + "\u2026" : bb.l}</text>
              </g>
            );
          })}
          <line x1={pl} x2={W - pr} y1={Y(0)} y2={Y(0)} stroke={COLORS.textFaint} />
        </svg>
      )}
      <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: COLORS.textMuted, marginTop: 4, flexWrap: "wrap" }}>
        <span><i style={{ display: "inline-block", width: 9, height: 9, background: COLORS.slate, borderRadius: 2, marginRight: 5 }} />ASP</span>
        <span><i style={{ display: "inline-block", width: 9, height: 9, background: COLORS.teal, borderRadius: 2, marginRight: 5 }} />Increase</span>
        <span><i style={{ display: "inline-block", width: 9, height: 9, background: COLORS.coral, borderRadius: 2, marginRight: 5 }} />Decrease</span>
      </div>
    </div>
  );
}

// EGP per order: every revenue line per order for the current plan, and for the chosen plan with the change.
function PrcPerOrder({ cur, fin, finName }) {
  const a = prcAspLines(cur), b = fin ? prcAspLines(fin) : null;
  const rows = a.map((r, i) => [r[0], r[1], b ? b[i][1] : null]).filter((r) => Math.abs(r[1]) >= 0.005 || (r[2] != null && Math.abs(r[2]) >= 0.005));
  const asp0 = cur.revenue / cur.orders, asp1 = fin ? fin.revenue / fin.orders : null;
  const th = { textAlign: "right", padding: "6px 14px", fontWeight: 500 };
  const td = { padding: "7px 14px", textAlign: "right", fontFamily: MP_MONO };
  const chg = (d) => (Math.abs(d) < 0.005 ? <span style={{ color: COLORS.textFaint }}>{"\u2014"}</span> : <span style={{ color: d > 0 ? COLORS.teal : COLORS.coral }}>{(d > 0 ? "+" : "\u2212") + fmt(Math.abs(d), 2)}</span>);
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", background: COLORS.slateDim }}>EGP per order</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ fontSize: 11, color: COLORS.textFaint }}>
            <th style={{ ...th, textAlign: "left" }} /><th style={th}>Current plan</th>{fin && <th style={th}>{finName}</th>}{fin && <th style={th}>Change</th>}
          </tr></thead>
          <tbody>
            {rows.map(([l, v0, v1]) => (
              <tr key={l} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                <td style={{ padding: "7px 14px" }}>{l}</td>
                <td style={td}>{fmt(v0, 2)}</td>
                {fin && <td style={td}>{fmt(v1, 2)}</td>}
                {fin && <td style={td}>{chg(v1 - v0)}</td>}
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${COLORS.panelBorder2}`, fontWeight: 700 }}>
              <td style={{ padding: "8px 14px" }}>ASP (total revenue per order)</td>
              <td style={td}>{fmt(asp0, 2)}</td>
              {fin && <td style={td}>{fmt(asp1, 2)}</td>}
              {fin && <td style={td}>{chg(asp1 - asp0)}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Order mix: how the month's orders split by type, size, zones and VAS. Collapsed until opened.
function PrcOrderMix({ base, periodLabel }) {
  const [open, setOpen] = useState(false);
  const A = base.A, tot = A.orders;
  const by = (fn) => { const o = {}; base.rows.forEach((r) => { const k = fn(r); o[k] = (o[k] || 0) + r.n; }); return o; };
  const t = by((r) => r.t), pz = by((r) => r.p), sz = by((r) => r.z), dz = by((r) => r.s);
  const pal = [COLORS.slate, COLORS.blue, COLORS.teal, COLORS.amber, COLORS.purple, COLORS.coral, "#2F7FA8", "#8A9A96", "#B0BDB9"];
  const types = "SRECKPGF".split("").map((k) => ({ name: PRC_ENG.TYPE_NAME[k], n: t[k] || 0 }));
  if (t.O) types.push({ name: "Other", n: t.O });
  const sizes = PRC_ENG.SIZES.split("").map((k) => ({ name: PRC_ENG.SIZE_NAME[k], n: sz[k] || 0 }));
  const zones = (o) => { const x = []; for (let i = 1; i <= 7; i++) x.push({ name: PRC_ENG.ZONE_NAME[i], n: o[i] || 0 }); if (o[0]) x.push({ name: "Unknown", n: o[0] }); return x; };
  const vas = [
    { name: "Allow to open, total", n: A.ato_flag }, { name: "Allow to open, charged", n: A.ato_chg }, { name: "Flexship, paid", n: A.flex_coll },
    { name: "Next day COD", n: A.exp_n }, { name: "Insurance", n: A.ins_n }, { name: "Extra COD", n: A.xcod_n },
  ];
  const share = (n) => (tot ? n / tot : 0);
  const Stack = ({ title, items }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", background: COLORS.slateDim }}>
        {items.map((it, i) => it.n > 0 && (
          <i key={it.name} title={it.name + ": " + pct(share(it.n), 1)} style={{ flex: share(it.n) + " 1 0", background: pal[i % pal.length], color: "#fff", fontSize: 10.5, fontStyle: "normal", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {share(it.n) >= 0.08 ? fmt(share(it.n) * 100, 0) + "%" : ""}
          </i>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 7, fontSize: 11.5, color: COLORS.textMuted }}>
        {items.map((it, i) => it.n > 0 && (
          <span key={it.name}><b style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: pal[i % pal.length], marginRight: 5 }} />{it.name} <em style={{ fontStyle: "normal", fontFamily: MP_MONO }}>{pct(share(it.n), 1)}</em></span>
        ))}
      </div>
    </div>
  );
  const Bars = ({ title, items }) => {
    const max = Math.max(0.0001, ...items.map((it) => share(it.n)));
    return (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{title}</div>
        {items.map((it, i) => (
          <div key={it.name} title={it.name + ": " + fmt(it.n, 0) + " orders"} style={{ display: "grid", gridTemplateColumns: "150px 1fr 52px", gap: 8, alignItems: "center", fontSize: 12, padding: "2px 0" }}>
            <span style={{ color: COLORS.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</span>
            <span style={{ background: COLORS.slateDim, borderRadius: 4, height: 9 }}><i style={{ display: "block", height: 9, borderRadius: 4, width: (share(it.n) / max * 100).toFixed(1) + "%", background: pal[i % pal.length] }} /></span>
            <span style={{ textAlign: "right", fontFamily: MP_MONO }}>{pct(share(it.n), 1)}</span>
          </div>
        ))}
      </div>
    );
  };
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", background: COLORS.slateDim, border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
        <span>{open ? "\u25BE" : "\u25B8"} Order mix, {periodLabel}</span>
        <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: COLORS.textFaint }}>{open ? "Click to hide" : "Click to show"}</span>
      </button>
      {open && (
        <div style={{ padding: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px 24px" }}>
            <Stack title="Order type" items={types} />
            <Stack title="Size" items={sizes} />
            <Stack title="Drop-off zone" items={zones(dz)} />
            <Stack title="Pickup zone" items={zones(pz)} />
            <Bars title="VAS (% of orders)" items={vas} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 22px", marginTop: 14, paddingTop: 10, borderTop: `1px solid ${COLORS.panelBorder}`, fontSize: 12, color: COLORS.textMuted }}>
            <span>Bundle orders: <b style={{ color: COLORS.text }}>{pct(share(A.bundle_orders), 1)}</b> of orders</span>
            <span>Flexship eligible returns: <b style={{ color: COLORS.text }}>{pct(A.rto_orders ? A.flex_elig / A.rto_orders : 0, 1)}</b> of returns</span>
            <span>Cash on delivery orders: <b style={{ color: COLORS.text }}>{pct(share(A.cod_orders), 1)}</b> of orders</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MPPricingTab({ canSeeMargin }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [store, setStore] = useState(null);
  const [month, setMonth] = useState(null);
  const [plan, setPlan] = useState("");
  const id = MP_MERCHANT.id;

  useEffect(() => {
    let alive = true;
    prcLoadStore(canSeeMargin)
      .then((s) => {
        if (!alive) return;
        if (!prcHas(s, id)) { setError("This merchant is not in the pricing pack (as of " + s.asof + ")."); setStatus("error"); return; }
        setStore(s); setMonth(s.months[0]); setStatus("ready");
      })
      .catch((e) => { if (alive) { setError("Could not load the pricing data (" + (e.message || e) + ")."); setStatus("error"); } });
    return () => { alive = false; };
  }, [id]);

  const run = useMemo(() => (store && month ? prcRun(store, id, month, plan || null, "id") : null), [store, id, month, plan]);

  if (status === "loading") return <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "20px 2px" }}>Loading the pricing data&hellip;</div>;
  if (status === "error") return <MPBanner text={error} />;

  const a = run.actual;
  const margin = canSeeMargin && store.margin !== false && a.cost;
  const money = (v) => fmt(v);
  const perOrder = (v) => (a.orders ? fmt(v / a.orders, 2) : "—");
  const revLines = [
    ["Shipping, before discounts", a.ship - a.zone],
    ["Drop-off zone fees", a.zone],
    ["Allow to open", a.ato],
    ["Flexship", a.flex],
    ["Next day COD", a.nd],
    ["Extra COD", a.xcod],
    ["Insurance", a.ins],
    ["COD fee", a.codfee],
    ["Packaging materials", a.mat],
    ["Packaging delivery", a.matdel],
    ["Pickup fees", a.pickup],
    ["Bundle sales", a.bundleRev],
    ["Bundle discount", -a.dBundle],
    ["RTO discount", -a.dRto],
    ["Promo discount", -a.dPromo],
    ["Zero COD discount", -a.dZcod],
  ].filter((r) => Math.abs(r[1]) > 0.004);

  const costLines = !a.cost ? [] : [
    ["First mile", a.cost.fm], ["Middle mile", a.cost.mm], ["Last mile, fixed", a.cost.lmFixed],
    ["Last mile, variable", a.cost.lmVar], ["Hub", a.cost.hub], ["Communication", a.cost.comm],
    ["Reverse (returns)", a.cost.reverse], ["Cash collection", a.cost.cod],
    ["Packaging materials", a.cost.materials], ["Compensation", a.cost.comp],
  ];

  const Tbl = ({ title, rows, total, totalLabel }) => (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", background: COLORS.slateDim }}>{title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ fontSize: 11, color: COLORS.textFaint }}>
            <th style={{ textAlign: "left", padding: "6px 14px", fontWeight: 500 }} />
            <th style={{ textAlign: "right", padding: "6px 14px", fontWeight: 500 }}>EGP / month</th>
            <th style={{ textAlign: "right", padding: "6px 14px", fontWeight: 500 }}>EGP / order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([l, v]) => (
            <tr key={l} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
              <td style={{ padding: "7px 14px" }}>{l}</td>
              <td style={{ padding: "7px 14px", textAlign: "right", fontFamily: MP_MONO }}>{money(v)}</td>
              <td style={{ padding: "7px 14px", textAlign: "right", fontFamily: MP_MONO, color: COLORS.textMuted }}>{perOrder(v)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${COLORS.panelBorder2}`, fontWeight: 700 }}>
            <td style={{ padding: "8px 14px" }}>{totalLabel}</td>
            <td style={{ padding: "8px 14px", textAlign: "right", fontFamily: MP_MONO }}>{money(total)}</td>
            <td style={{ padding: "8px 14px", textAlign: "right", fontFamily: MP_MONO }}>{perOrder(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <label style={{ fontSize: 12, color: COLORS.textMuted }}>Month{" "}
          <select value={month} onChange={(e) => setMonth(e.target.value)}
            style={{ padding: "6px 9px", fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, color: COLORS.text }}>
            {store.months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <div style={{ fontSize: 12.5, color: COLORS.textMuted }}>Current plan <strong style={{ color: COLORS.text }}>{run.curPlan || "\u2014"}</strong></div>
        <label style={{ fontSize: 12, color: COLORS.textMuted }}>Compare with plan{" "}
          <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Compare with plan"
            style={{ padding: "6px 9px", fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, color: COLORS.text, maxWidth: 220 }}>
            <option value="">None</option>
            {prcPlanList(store, run.curPlan).filter((x) => x !== run.curPlan).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        {/* no calculator button here: the merchant header above the tabs already carries one */}
      </div>

      <MPGrid2 min={160}>
        <MPKpi label="Orders" value={fmt(a.orders)} sub="delivered or returned" />
        <MPKpi label="Revenue" value={fmt(a.revenue)} sub="EGP before VAT" />
        <MPKpi label="ASP" value={fmt(a.asp, 2)} sub="EGP / order" />
        {margin && <MPKpi label="GM2" value={fmt(a.gm2)} sub={pct(a.gm2pct, 1) + " of revenue"} accent={a.gm2 >= 0 ? COLORS.teal : COLORS.coral} />}
      </MPGrid2>

      {margin && <PrcGm2Badge res={a} />}

      <Tbl title="Revenue" rows={revLines} total={a.revenue} totalLabel="Total revenue" />
      {run.next && <PrcAspBridge cur={run.current} fin={run.next} finName={plan} />}
      {!run.next && <div style={{ fontSize: 12.5, color: COLORS.textMuted, background: COLORS.slateDim, borderRadius: 10, padding: "10px 14px" }}>Pick a plan in <b>Compare with plan</b> to see the ASP bridge and what changes per order.</div>}
      <PrcPerOrder cur={run.current} fin={run.next} finName={plan} />
      <PrcOrderMix base={run.base} periodLabel={month} />
      {margin && <Tbl title="Direct cost" rows={costLines} total={a.cost && a.cost.total} totalLabel="Total direct cost" />}

      {!margin && (
        <div style={{ fontSize: 12, color: COLORS.textFaint, lineHeight: 1.5 }}>
          Cost and margin are not shown in this view.
        </div>
      )}
      <div style={{ fontSize: 11.5, color: COLORS.textFaint, lineHeight: 1.5 }}>
        Data as of {store.asof}, rate card {store.pricing_asof}. EGP before VAT; fulfillment revenue and cost are out of scope.
        Orders are those that reached delivered or returned status in the month.
      </div>
    </div>
  );
}
