// ============================================================================
// PRICING SIMULATOR (full screen)
// Existing merchants: plan change, RTO colour discount, promo engine. New merchant: a price plan on an order mix.
// Ported from the Merchant Pricing Simulator. The engine is src/pricing_engine.js (PRC_ENG).
//
// WHO SEES WHAT (decided from the signed-in viewer, see prcCanUse / prcCanSeeMargin / prcCanSeeCostTab in m11_pricing.jsx)
//   VP          every merchant; revenue, ASP, cost, GM2, P&L; the Cost assumptions tab.
//   Head        merchants of his own team (AMs and sales) and merchants nobody owns; margin and P&L; no Cost assumptions tab.
//   Team leader merchants of his own team; revenue and ASP only (no margin column, no P&L, no cost data in the pack).
//   AM / sales  no access at all.
// This is a UI gate. Real access control needs the packs served per role by the API (see docs/DATA_SOURCES.md).
// ============================================================================

// ---- who owns a merchant (from the AM roster and the sales lists) ----
let SIM_OWNER_MAP = null;
function simOwners() {
  if (SIM_OWNER_MAP) return SIM_OWNER_MAP;
  const o = {};
  ORG.sales.forEach((s) => (s.newList || []).concat(s.cohortList || []).forEach((r) => { o[String(r[0])] = { label: s.name + " (sales)", tlId: s.tlId, headId: s.headId }; }));
  LEAD_ROWS.forEach((r) => { o[String(r.id)] = { label: r.amName + " (AM)", tlId: r.tlId, headId: r.headId }; });
  SIM_OWNER_MAP = o;
  return o;
}
// Owner of an account: its own entry, else the one of its main account, else the one of another account under the same main.
let SIM_MAIN_OWNER = null, SIM_MAIN_STORE = null;
function simOwnerOf(store, id) {
  const o = simOwners();
  id = String(id);
  if (o[id]) return o[id];
  const main = store.main[id] || id;
  if (o[main]) return o[main];
  if (SIM_MAIN_STORE !== store) {
    SIM_MAIN_STORE = store; SIM_MAIN_OWNER = {};
    Object.keys(store.main).forEach((x) => { const mm = store.main[x] || x; if (o[x] && !SIM_MAIN_OWNER[mm]) SIM_MAIN_OWNER[mm] = o[x]; });
  }
  return SIM_MAIN_OWNER[main] || null;
}
// May this viewer open this merchant? VP: all. Head: his team and unassigned merchants. Team leader: his team.
function simAllowed(viewer, store, id) {
  if (viewer.kind === "vp") return true;
  const w = simOwnerOf(store, id);
  if (viewer.kind === "head") return !w || w.headId === viewer.id;
  if (viewer.kind === "tl") return !!w && w.tlId === viewer.id;
  return false;
}
function simOwnerLabel(store, id) { const w = simOwnerOf(store, id); return w ? w.label : "Not assigned"; }

// ---- calculation helpers (ported) ----
const SIM_COLOURS = [["R", "Red"], ["Y", "Yellow"], ["G", "Green"], ["N", "No history"]];
function simZoneOf(r) { return r.t === "C" || r.t === "K" ? r.p : r.s; }
function simZoneOrders(base, z) { return base.rows.reduce((t, r) => t + (simZoneOf(r) === z ? r.n : 0), 0); }

function simSum(list) {
  if (!list.length) return null;
  const out = JSON.parse(JSON.stringify(list[0]));
  const add = (a, b) => { for (const k in b) { if (typeof b[k] === "number") a[k] = (a[k] || 0) + b[k]; else if (b[k] && typeof b[k] === "object") { a[k] = a[k] || {}; add(a[k], b[k]); } } };
  for (let i = 1; i < list.length; i++) add(out, list[i]);
  simRefresh(out);
  return out;
}
// asp, gm2 and gm2pct from revenue and cost (cost is null for packs without cost data)
function simRefresh(r) {
  r.asp = r.orders > 0 ? r.revenue / r.orders : null;
  if (r.cost) { r.gm2 = r.revenue - r.cost.total; r.gm2pct = r.revenue ? r.gm2 / r.revenue : null; } else { r.gm2 = null; r.gm2pct = null; }
  return r;
}
function simMerge(store, parts) {
  const A = {}; store.fields.forEach((f) => { A[f] = 0; });
  let rows = [], legs = {}, plans = {};
  parts.forEach((p) => {
    for (const f in p.base.A) A[f] = (A[f] || 0) + p.base.A[f];
    rows = rows.concat(p.base.rows);
    for (const k in p.base.legs) legs[k] = (legs[k] || 0) + p.base.legs[k];
    for (const q in p.base.plans) plans[q] = (plans[q] || 0) + p.base.plans[q];
  });
  return { A, rows, legs, plans };
}
function simPlanOf(store, part) {
  const p = store.plan[part.id];
  if (p && store.pricing.plans[p]) return { plan: p, fallback: false };
  let best = null, n = -1;
  for (const k in part.base.plans) if (store.pricing.plans[k] && part.base.plans[k] > n) { best = k; n = part.base.plans[k]; }
  return { plan: best, fallback: true, wanted: p };
}
// extra orders up to a target, all dropped in one zone
function simAugment(store, base, extra, z) {
  const O = base.A.orders;
  if (!(extra > 0) || !O) return base;
  const g = extra / O, A = {}, zr = base.rows.filter((r) => simZoneOf(r) === z), zO = zr.reduce((t, r) => t + r.n, 0);
  const src = zO > 0 ? zr : base.rows.map((r) => { const c = { ...r }; if (r.t === "C" || r.t === "K") c.p = z; else c.s = z; return c; });
  const srcO = zO > 0 ? zO : O, srcR = src.reduce((t, r) => t + (r.t === "R" ? r.n : 0), 0);
  for (const f in base.A) A[f] = base.A[f] * (1 + g);
  A.orders = O + extra; A.rto_orders = base.A.rto_orders + extra * (srcO ? srcR / srcO : 0);
  const rows = base.rows.concat(src.map((r) => ({ ...r, n: r.n * extra / srcO })));
  const legs = {}; for (const k in base.legs) legs[k] = base.legs[k] + (k[0] === "P" ? base.legs[k] * g : 0);
  const dz = ((store.net || {}).drop || {})[String(z)] || {}; let dt = 0; for (const c in dz) dt += dz[c];
  for (const c in dz) legs["D" + c] = (legs["D" + c] || 0) + extra * dz[c] / (dt || 1);
  const plans = {}; for (const p in base.plans) plans[p] = base.plans[p] * (1 + g);
  const Zs = {}; for (const zt in (base.Z || {})) Zs[zt] = base.Z[zt] * (1 + g);
  return { A, rows, legs, plans, X: (base.X || []).map((v) => v * (1 + g)), Y: base.Y, Z: Zs,
    atoAtt: base.atoAtt == null ? null : base.atoAtt * (1 + g),
    D: base.D ? base.D.map((d) => ({ t: d.t, p: d.p, s: d.s, z: d.z, n: d.n * (1 + g), rq: d.rq * (1 + g), rd: d.rd * (1 + g) })) : null,
    fmT: base.fmT * (1 + g), lmfT: base.lmfT * (1 + g), matT: base.matT * (1 + g), missingCostOrders: (base.missingCostOrders || 0) * (1 + g) };
}
function simKeepVas(res, ref) {
  const f = res.orders / ref.orders;
  ["ato", "flex", "nd", "xcod", "ins", "ful", "codfee", "mat", "matdel", "pickup"].forEach((q) => { res[q] = (ref[q] || 0) * f; });
  res.otherVas = res.ins + res.codfee;
  const z = (ref.zone || 0) * f; res.ship += z - (res.zone || 0); res.zone = z;
  res.packPickup = res.mat + res.matdel + res.pickup;
  res.vas = res.ato + res.flex + res.nd + res.xcod + res.otherVas;
  res.revenue = res.ship + res.vas + res.packPickup + res.bundleRev - res.discounts;
  return simRefresh(res);
}
function simApplyTier(res, d) { res.dTier = d; res.discounts += d; res.revenue -= d; return simRefresh(res); }
const SIM_PROMO_SHIP = [["all", "All orders"], ["S", "Send"], ["R", "Return to origin (RTO)"], ["E", "Exchange"], ["C", "Customer return pickup"]];
const SIM_PROMO_VAS = [["xcod", "Extra COD fee"], ["nd", "Next day COD fee"], ["ato", "Allow to open fee"], ["flex", "Flexship fee"]];
function simPromoPool(store, parts, k, P, tier, planFor) {
  let elig = 0, rev = 0, zO = 0, totO = 0;
  parts.forEach((p) => {
    const plan = planFor(p); if (!plan) return;
    p.base.rows.forEach((r) => {
      totO += r.n; const inZ = !!P.zones[r.s]; if (inZ) zO += r.n;
      if (P.type === "ship" && inZ && !r.b && (P.sub === "all" || r.t === P.sub)) {
        const pr = PRC_ENG.price(store.pricing, plan, r.t, r.p, r.s, r.z);
        if (pr != null) { elig += r.n; rev += pr * r.n; }
      }
    });
  });
  if (P.type === "ship") return { orders: elig * k, rev: rev * k, zoneShare: totO ? zO / totO : 0 };
  const share = totO ? zO / totO : 0, A = simMerge(store, parts).A;
  const cnt = { xcod: A.xcod_n * k, nd: A.exp_n * k, ato: tier.atoChargedOrders || 0, flex: A.flex_coll * k }[P.sub] || 0;
  return { orders: cnt * share, rev: (tier[P.sub] || 0) * share, zoneShare: share };
}
function simPromoDiscount(pool, P) {
  const n = Math.min(P.max, pool.orders), per = pool.orders > 0 ? pool.rev / pool.orders : 0;
  const perDisc = P.dtype === "pct" ? per * Math.min(1, P.val / 100) : Math.min(P.val, per);
  return { n, per, perDisc, total: n * perDisc, capped: P.dtype === "egp" && P.val > per };
}

// All the scenarios for one merchant (or one main account with its sub accounts) in one month.
// o: {types:{plan,rto,promo}, newPlan, colour:{R,Y,G,N} in %, P: promo inputs}
function simExisting(store, ids, month, o, compMode) {
  const C = PRC_ENG.costSettings(store, compMode || "month");
  const parts = [];
  ids.forEach((id) => { const base = PRC_ENG.baseFor(store, id, month, "id"); if (base) parts.push({ id, base }); });
  if (!parts.length) return null;
  const T = o.types, validNew = !!store.pricing.plans[o.newPlan];
  const doPlan = T.plan && validNew, doRto = T.rto, doPromo = T.promo, notes = [];
  const base = simMerge(store, parts);
  const colour = () => { const c = {}; SIM_COLOURS.forEach(([k]) => { c[k] = (+o.colour[k] || 0) / 100; }); return c; };
  const run = (plan, k, col, list) => simSum((list || parts).map((p) => {
    const po = simPlanOf(store, p), pl = plan || po.plan; if (!pl) return null;
    return PRC_ENG.simulate(p.base, store.pricing, { plan: pl, curPlan: po.plan, k, keepRto: true, keepPromo: true, colour: col || null }, C);
  }).filter(Boolean));
  parts.forEach((p) => { const po = simPlanOf(store, p); if (po.fallback) notes.push((store.name[p.id] || p.id) + ": the current plan " + (po.wanted || "(none)") + " is not in the pricing sheet, so the plan with most orders this month (" + (po.plan || "none") + ") is used."); });
  const act = simSum(parts.map((p) => PRC_ENG.actual(p.base, C)));
  const cur = run(null, 1, null);
  const planX = doPlan ? o.newPlan : null;
  const s1 = doPlan ? run(planX, 1, null) : cur;
  const s2 = doRto ? run(planX, 1, colour()) : s1;
  let s3 = s2, pool = null, pd = null, k = 1;
  const P = o.P;
  if (doPromo) {
    const extra = P.target > base.A.orders ? P.target - base.A.orders : 0;
    let list = parts;
    if (P.inc === "mix") k = extra ? P.target / base.A.orders : 1;
    else {
      const zi = +P.inc, zAll = parts.reduce((t, p) => t + simZoneOrders(p.base, zi), 0);
      list = parts.map((p) => { const sh = zAll > 0 ? simZoneOrders(p.base, zi) / zAll : p.base.A.orders / base.A.orders; return { id: p.id, base: simAugment(store, p.base, extra * sh, zi) }; });
    }
    s3 = run(planX, k, doRto ? colour() : null, list);
    if (P.inc !== "mix" && extra > 0 && s3 && s2 && s2.orders > 0) simKeepVas(s3, s2);
    if (P.max > 0 && s3) { pool = simPromoPool(store, list, k, P, s3, (p) => planX || simPlanOf(store, p).plan); pd = simPromoDiscount(pool, P); simApplyTier(s3, pd.total); }
  }
  const anyDisc = doRto || doPromo;
  const cols = [{ name: "Actual", r: act }];
  if (cur) cols.push({ name: "Current plan (simulated)", r: cur });
  let finName = null;
  if (doPlan && anyDisc) { cols.push({ name: "New plan: " + o.newPlan + ", before discounts", r: s1 }); cols.push({ name: "New plan: " + o.newPlan + ", after discounts", r: s3 }); finName = "New plan after discounts"; }
  else if (doPlan) { cols.push({ name: "New plan: " + o.newPlan, r: s3 }); finName = "New plan"; }
  else if (anyDisc && cur) { cols.push({ name: "Current plan, after discounts", r: s3 }); finName = "Current plan after discounts"; }
  if (doPlan && s1 && s1.missingPriceOrders > 0) notes.push(fmt(s1.missingPriceOrders, 0) + " orders have an order type with no price in the sheet and are left out of shipping revenue.");
  return { C, parts, base, act, cur, s1, s2, fin: s3, cols, finName, notes, pool, pd, validNew, doPlan, doRto, doPromo };
}

// ---- small UI pieces ----
const SIM_IN = { ...UI.input, fontSize: 13, width: "100%", boxSizing: "border-box" };
function SimCard({ title, note, children }) {
  return (
    <div style={{ ...UI.card, padding: "16px 18px" }}>
      {title && <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: `0 0 ${note ? 2 : 10}px` }}>{title}</h3>}
      {note && <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 8 }}>{note}</div>}
      {children}
    </div>
  );
}
function SimField({ label, children, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ ...UI.label, display: "block", marginBottom: 5 }}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", fontSize: 11.5, color: COLORS.textFaint, marginTop: 3 }}>{hint}</span>}
    </label>
  );
}
function SimSeg({ value, options, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, padding: 3, background: COLORS.control, border: `1px solid ${COLORS.panelBorder}`, borderRadius: THEME.radius.pill, maxWidth: "100%" }}>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          style={{ ...UI.pill(value === v), border: "1px solid transparent", background: value === v ? COLORS.navy : "transparent", padding: "6px 14px" }}>{l}</button>
      ))}
    </div>
  );
}
const simSign = (d, digits) => (d >= 0 ? "+" : "−") + fmt(Math.abs(d), digits || 0);

// Summary table: one column per scenario. Margin rows only for viewers who may see margin.
function SimSummary({ cols, canMargin, bench }) {
  const th = { textAlign: "right", padding: "6px 12px", fontWeight: 600, fontSize: 11.5, color: COLORS.textMuted };
  const td = { padding: "8px 12px", textAlign: "right", fontSize: 13 };
  const rows = [["Orders", (r) => fmt(r.orders, 0)], ["Revenue (EGP)", (r) => fmt(r.revenue, 0)], ["ASP (EGP per order)", (r) => (r.asp == null ? "—" : fmt(r.asp, 2))]];
  if (canMargin && cols.every((c) => c.r.cost)) rows.push(["Direct cost (EGP)", (r) => fmt(r.cost.total, 0)], ["GM2 (EGP)", (r) => fmt(r.gm2, 0)], ["GM2 %", (r) => (r.gm2pct == null ? "—" : pct(r.gm2pct, 1))]);
  return (
    <SimCard title="Summary">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }} />{cols.map((c) => <th key={c.name} style={th}>{c.name}</th>)}</tr></thead>
          <tbody>
            {rows.map(([l, f]) => (
              <tr key={l} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                <td style={{ padding: "7px 12px", fontSize: 13 }}>{l}</td>
                {cols.map((c) => <td key={c.name} style={td}>{f(c.r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bench}
    </SimCard>
  );
}
// Headline and one line per step, revenue and ASP (and GM2 for margin viewers).
function SimSteps({ steps, canMargin, cur, fin }) {
  const line = (label, a, b) => {
    const dr = b.revenue - a.revenue, da = (b.asp || 0) - (a.asp || 0);
    let t = label + ": revenue " + simSign(dr) + " EGP" + (a.revenue ? " (" + simSign(dr / Math.abs(a.revenue) * 100, 1) + "%)" : "") + ", ASP " + simSign(da, 2) + " EGP per order";
    if (canMargin && a.cost && b.cost) t += ", GM2 " + simSign(b.gm2 - a.gm2) + " EGP";
    return t;
  };
  return (
    <SimCard title="What changes">
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{line("Overall", cur, fin)}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: COLORS.textMuted }}>
        {steps.map(([l, a, b]) => <li key={l}>{line(l, a, b)}</li>)}
      </ul>
    </SimCard>
  );
}
// Rate card of one or more plans, from the main pickup zone, per drop-off sector.
function SimRateCard({ store, plans, pz }) {
  const th = { padding: "6px 8px", fontSize: 11, color: COLORS.textFaint, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", textAlign: "right", fontFamily: MP_MONO, fontSize: 12.5, whiteSpace: "nowrap" };
  const P = store.pricing, f = (pl, t, z) => fmt(PRC_ENG.price(P, pl, t, pz, z, "N"), 0) + " / " + fmt(PRC_ENG.price(P, pl, t, pz, z, "B"), 0);
  const list = plans.filter((x) => x.plan && P.plans[x.plan]);
  const money = (v) => (v > 0 ? fmt(v * 100, 1).replace(/\.0$/, "") + "%" : "Not charged");
  return (
    <SimCard title="Price plan" note={"Before VAT, EGP, from " + PRC_ENG.ZONE_NAME[pz] + ". Normal / light bulky."}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Plan</th><th style={{ ...th, textAlign: "left" }} />{[1, 2, 3, 4, 5, 6, 7].map((z) => <th key={z} style={th}>{PRC_ENG.ZONE_NAME[z]}</th>)}</tr></thead>
          <tbody>
            {list.map((x) => [["S", "Send"], ["R", "Return (RTO)"]].map(([t, tl], i) => (
              <tr key={x.plan + x.label + t} style={{ borderTop: i === 0 ? `2px solid ${COLORS.panelBorder2}` : `1px solid ${COLORS.panelBorder}` }}>
                <td style={{ padding: "6px 8px", fontSize: 12.5, fontWeight: 600 }}>{i === 0 ? <span>{x.label}<div style={{ color: COLORS.textMuted }}>{x.plan}</div></span> : ""}</td>
                <td style={{ padding: "6px 8px", fontSize: 12.5, color: COLORS.textMuted }}>{tl}</td>
                {[1, 2, 3, 4, 5, 6, 7].map((z) => <td key={z} style={td}>{f(x.plan, t, z)}</td>)}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      {list.map((x) => { const c = P.card[x.plan]; return c && (
        <div key={x.plan + "f"} style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6 }}>
          <b>{x.label}</b>: allow to open {c.ato_on ? fmt(c.ato, 0) : "not charged"} · flexship {fmt(c.flex, 0)} · next day COD {c.nd > 0 ? money(c.nd) : "not charged"} · extra COD {c.xcod_on && c.xcod > 0 ? money(c.xcod) + " above " + fmt(c.xcod_lim, 0) : "not charged"}
        </div>
      ); })}
    </SimCard>
  );
}
// Profit and loss: margin viewers only.
function SimPnl({ cols }) {
  const lines = [
    ["Shipping (after zone fees)", (r) => r.ship - (r.zone || 0)], ["Drop-off zone fees", (r) => r.zone || 0], ["Value added services", (r) => r.vas || 0],
    ["Packaging and pickup", (r) => r.packPickup || 0], ["Bundle sales", (r) => r.bundleRev || 0], ["Discounts", (r) => -(r.discounts || 0)],
  ];
  const costs = [["First mile", "fm"], ["Middle mile", "mm"], ["Last mile, fixed", "lmFixed"], ["Last mile, variable", "lmVar"], ["Hub", "hub"], ["Communication", "comm"],
    ["Reverse (returns)", "reverse"], ["Cash collection", "cod"], ["Packaging materials", "materials"], ["Compensation", "comp"]];
  const th = { textAlign: "right", padding: "6px 12px", fontWeight: 600, fontSize: 11.5, color: COLORS.textMuted };
  const td = (b) => ({ padding: "6px 12px", textAlign: "right", fontFamily: MP_MONO, fontSize: 13, fontWeight: b ? 700 : 400 });
  const Row = ({ l, f, b, top }) => <tr style={{ borderTop: top ? `2px solid ${COLORS.panelBorder2}` : `1px solid ${COLORS.panelBorder}` }}><td style={{ padding: "6px 12px", fontSize: 13, fontWeight: b ? 700 : 400 }}>{l}</td>{cols.map((c) => <td key={c.name} style={td(b)}>{f(c.r)}</td>)}</tr>;
  return (
    <SimCard title="Profit and loss" note="EGP per month, before VAT. Fulfillment is out of scope.">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }} />{cols.map((c) => <th key={c.name} style={th}>{c.name}</th>)}</tr></thead>
          <tbody>
            {lines.map(([l, f]) => <Row key={l} l={l} f={(r) => fmt(f(r), 0)} />)}
            <Row l="Revenue" b top f={(r) => fmt(r.revenue, 0)} />
            {costs.map(([l, k]) => <Row key={l} l={l} f={(r) => fmt((r.cost && r.cost[k]) || 0, 0)} />)}
            <Row l="Total direct cost" b top f={(r) => fmt(r.cost.total, 0)} />
            <Row l="GM2" b top f={(r) => fmt(r.gm2, 0)} />
            <Row l="GM2 %" b f={(r) => (r.gm2pct == null ? "—" : pct(r.gm2pct, 1))} />
          </tbody>
        </table>
      </div>
    </SimCard>
  );
}
function SimBench({ res }) {
  if (!res || res.gm2pct == null) return null;
  return <div style={{ marginTop: 10 }}><PrcGm2Badge res={res} /></div>;
}

// ---- merchant search, limited to what the viewer may open ----
function SimSearch({ store, viewer, value, onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const out = [], mainNames = (store.idx && store.idx.mains) || {};
    for (const id of Object.keys(store.m)) {
      const main = store.main[id] || id;
      if (!(id.toLowerCase().includes(s) || (store.name[id] || "").toLowerCase().includes(s) || main.toLowerCase().includes(s) || String(mainNames[main] || "").toLowerCase().includes(s))) continue;
      if (!simAllowed(viewer, store, id)) continue;
      out.push(id);
      if (out.length >= 25) break;
    }
    return out;
  }, [q, store, viewer]);
  return (
    <div style={{ position: "relative" }}>
      <input data-testid="sim-search" style={SIM_IN} value={open || !value ? q : (store.name[value] || value)} placeholder="Search by merchant name or ID"
        onFocus={() => { setOpen(true); setQ(""); }} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && q.trim().length >= 2 && (
        <div style={{ position: "absolute", zIndex: 5, left: 0, right: 0, top: "100%", marginTop: 2, background: COLORS.panel, border: `1px solid ${COLORS.panelBorder2}`, borderRadius: 8, maxHeight: 280, overflowY: "auto", boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}>
          {hits.length === 0 && <div style={{ padding: "9px 12px", fontSize: 12.5, color: COLORS.textMuted }}>No merchant found that you can open.</div>}
          {hits.map((id) => (
            <button key={id} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(id); setOpen(false); setQ(""); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 13, background: "transparent", border: "none", borderBottom: `1px solid ${COLORS.panelBorder}`, cursor: "pointer", color: COLORS.text }}>
              <b>{store.name[id] || id}</b> <span style={{ color: COLORS.textFaint, fontFamily: MP_MONO }}>{id}</span>
              <div style={{ fontSize: 11.5, color: COLORS.textMuted }}>{simOwnerLabel(store, id)}{(store.main[id] || id) !== id ? " · main account " + (((store.idx.mains || {})[store.main[id]]) || store.main[id]) + " (" + store.main[id] + ")" : ""}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- existing merchants
function SimExistingTab({ store, viewer, canMargin, initialId }) {
  const [id, setId] = useState(initialId && prcHas(store, initialId) && simAllowed(viewer, store, initialId) ? String(initialId) : "");
  const [month, setMonth] = useState(store.months[0]);
  const [scope, setScope] = useState("id");
  const [types, setTypes] = useState({ plan: true, rto: false, promo: false });
  const [typesOpen, setTypesOpen] = useState(false);
  const [newPlan, setNewPlan] = useState("");
  const [colour, setColour] = useState({ R: 0, Y: 0, G: 0, N: 0 });
  const [P, setP] = useState({ type: "ship", sub: "all", zones: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true }, dtype: "pct", val: 100, target: 0, max: 0, inc: "mix" });
  const setPf = (k, v) => setP((p) => ({ ...p, [k]: v }));
  const ids = useMemo(() => {
    if (!id) return [];
    if (scope !== "main") return [id];
    const mainId = store.main[id] || id;
    const all = Object.keys(store.main).filter((x) => (store.main[x] || x) === mainId);
    if (all.indexOf(id) < 0) all.push(id);
    return all;
  }, [id, scope, store]);
  const sim = useMemo(() => (id ? simExisting(store, ids, month, { types, newPlan, colour, P }, "month") : null), [store, ids, month, types, newPlan, colour, P, id]);
  const typeLabel = [types.plan && "Price plan change", types.rto && "RTO colour discount", types.promo && "Promo engine discount"].filter(Boolean).join(", ") || "None selected";
  const margin = canMargin && store.margin !== false;
  const curPlan = id ? store.plan[id] : null;

  const colourOrders = useMemo(() => { const o = { R: 0, Y: 0, G: 0, N: 0 }; if (sim) sim.base.rows.forEach((r) => { if (o[r.c] != null) o[r.c] += r.n; }); return o; }, [sim]);
  const totalO = sim ? sim.base.A.orders : 0;

  let right = null;
  if (!id) right = <SimCard><b>Pick a merchant to start</b><div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 4 }}>Search by name or business ID above, then choose a simulation type.</div></SimCard>;
  else if (!sim) right = <SimCard><b>No orders in {month}</b><div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 4 }}>Pick another month.</div></SimCard>;
  else {
    const { cur, s1, s2, fin, cols, finName, notes, pd, pool } = sim;
    const steps = [];
    if (sim.doPlan) steps.push(["Plan change", cur, s1]);
    if (sim.doRto) steps.push(["RTO discount", s1, s2]);
    if (sim.doPromo && fin !== s2) steps.push(["Promo engine", s2, fin]);
    const pz = (() => { const c = {}; sim.base.rows.forEach((r) => { c[r.p] = (c[r.p] || 0) + r.n; }); let b = 1, n = -1; for (const z in c) if (c[z] > n) { n = c[z]; b = +z || 1; } return b; })();
    const used = Object.keys(sim.base.plans).filter((k) => store.pricing.plans[k]).sort((a, b) => sim.base.plans[b] - sim.base.plans[a]);
    const curMain = simPlanOf(store, sim.parts[0]).plan;
    const other = used.find((k) => k !== curMain);
    const planCols = (other ? [{ label: "Also used this month", plan: other }] : []).concat([{ label: "Current", plan: curMain }], sim.doPlan ? [{ label: "New", plan: newPlan }] : []);
    const what = P.type === "ship" ? (SIM_PROMO_SHIP.find((x) => x[0] === P.sub) || [])[1] + " shipping fee" : (SIM_PROMO_VAS.find((x) => x[0] === P.sub) || [])[1];
    right = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SimCard title="Merchant data">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 13 }}>
            <span><b>{store.name[id] || id}</b></span><span>ID <b style={{ fontFamily: MP_MONO }}>{id}</b></span>
            <span><b style={{ fontFamily: MP_MONO }}>{fmt(sim.base.A.orders, 0)}</b> orders in {month}</span>
            <span>Delivered <b style={{ fontFamily: MP_MONO }}>{pct(sim.base.A.orders ? 1 - sim.base.A.rto_orders / sim.base.A.orders : 0, 1)}</b></span>
            <span>Current plan <b>{curPlan || "—"}</b></span><span>Owner <b>{simOwnerLabel(store, id)}</b></span>
          </div>
          {scope === "main" && (
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr style={{ color: COLORS.textFaint, fontSize: 11 }}><th style={{ textAlign: "left", padding: "4px 8px" }}>Account</th><th style={{ textAlign: "right", padding: "4px 8px" }}>Orders</th><th style={{ textAlign: "right", padding: "4px 8px" }}>Share</th><th style={{ textAlign: "left", padding: "4px 8px" }}>Current price plan</th></tr></thead>
                <tbody>{sim.parts.map((p) => (
                  <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}><td style={{ padding: "5px 8px" }}>{store.name[p.id] || p.id} <span style={{ color: COLORS.textFaint, fontFamily: MP_MONO }}>{p.id}</span></td>
                    <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: MP_MONO }}>{fmt(p.base.A.orders, 0)}</td><td style={{ padding: "5px 8px", textAlign: "right", fontFamily: MP_MONO }}>{pct(totalO ? p.base.A.orders / totalO : 0, 1)}</td>
                    <td style={{ padding: "5px 8px" }}>{store.plan[p.id] || "—"}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {notes.map((n) => <div key={n} style={{ fontSize: 12, color: COLORS.amber, marginTop: 6 }}>{n}</div>)}
          {!types.plan && !types.rto && !types.promo && <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 6 }}>Choose a simulation type at the top.</div>}
          {types.plan && !sim.validNew && <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 6 }}>Pick a new plan on the left to simulate the plan change.</div>}
          {types.promo && !(P.max > 0) && <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 6 }}>Set the max promo orders on the left to see the promo result.</div>}
          {pd && (pool.orders > 0
            ? <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 6 }}>Promo on <b>{what}</b>. Cost: <b style={{ fontFamily: MP_MONO }}>EGP {fmt(pd.total, 0)}</b> = {fmt(pd.n, 0)} orders × EGP {fmt(pd.perDisc, 2)} off per order. {fmt(pool.orders, 0)} orders qualify at the target volume.{pd.capped ? " The fixed discount is capped at the average fee per order." : ""}</div>
            : <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 6 }}>No orders qualify for this promo, so it costs nothing.</div>)}
        </SimCard>
        <SimSummary cols={cols} canMargin={margin} bench={margin ? <SimBench res={cols[cols.length - 1].r} /> : null} />
        {cur && finName && steps.length > 0 && <SimSteps steps={steps} canMargin={margin} cur={cur} fin={fin} />}
        <SimRateCard store={store} plans={planCols} pz={pz} />
        {cur && finName && <PrcAspBridge cur={cur} fin={fin} finName={finName} />}
        {cur && <PrcPerOrder cur={cur} fin={finName ? fin : null} finName={finName || ""} />}
        <PrcOrderMix base={sim.base} periodLabel={month} />
        {margin && cols.every((c) => c.r.cost) && <SimPnl cols={cols} />}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", marginBottom: 14 }}>
        <div style={{ flex: "1 1 280px", minWidth: 240 }}><SimField label="Merchant"><SimSearch store={store} viewer={viewer} value={id} onPick={(x) => { setId(x); setScope("id"); }} /></SimField></div>
        <SimField label="Month">
          <select style={{ ...SIM_IN, width: "auto" }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">{store.months.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        </SimField>
        <SimField label="Simulation type">
          <div style={{ position: "relative" }}>
            <button data-testid="sim-types" onClick={() => setTypesOpen(!typesOpen)} style={{ ...SIM_IN, display: "flex", alignItems: "center", width: "auto", minWidth: 200, textAlign: "left", cursor: "pointer" }}>{typeLabel}<ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" style={{ marginLeft: "auto" }} /></button>
            {typesOpen && (
              <div style={{ position: "absolute", zIndex: 5, top: "100%", left: 0, marginTop: 2, background: COLORS.panel, border: `1px solid ${COLORS.panelBorder2}`, borderRadius: 8, padding: "6px 12px", boxShadow: "0 6px 18px rgba(0,0,0,0.12)", minWidth: 220 }}>
                {[["plan", "Price plan change"], ["rto", "RTO colour discount"], ["promo", "Promo engine discount"]].map(([k, l]) => (
                  <label key={k} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={types[k]} onChange={(e) => setTypes({ ...types, [k]: e.target.checked })} /> {l}</label>
                ))}
              </div>
            )}
          </div>
        </SimField>
        <SimField label="Calculate on" hint={scope === "main" && id ? (ids.length + " accounts under main account " + (store.main[id] || id)) : "Main + sub accounts adds every account under the same main account."}>
          <SimSeg label="Calculate on" value={scope} onChange={setScope} options={[["id", "This account only"], ["main", "Main + sub accounts"]]} />
        </SimField>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 340px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          {types.plan && (
            <SimCard title="New price plan">
              <SimField label="Plan to simulate" hint={newPlan && !store.pricing.plans[newPlan] ? "This plan is not in the pricing sheet." : (store.pricing.card[newPlan] || {}).type || ""}>
                <input data-testid="sim-plan" style={SIM_IN} list="sim-plans" value={newPlan} onChange={(e) => setNewPlan(e.target.value)} placeholder="Pick a plan…" autoComplete="off" />
                <datalist id="sim-plans">{prcPlanList(store, curPlan).map((p) => <option key={p} value={p} />)}</datalist>
              </SimField>
            </SimCard>
          )}
          {types.promo && (
            <SimCard title="Promo engine">
              <SimField label="Promo type"><select style={SIM_IN} value={P.type} onChange={(e) => setP((p) => ({ ...p, type: e.target.value, sub: e.target.value === "ship" ? "all" : "xcod" }))}><option value="ship">Shipping</option><option value="vas">VAS</option></select></SimField>
              <SimField label={P.type === "ship" ? "Order type" : "VAS fee"}><select style={SIM_IN} value={P.sub} onChange={(e) => setPf("sub", e.target.value)}>{(P.type === "ship" ? SIM_PROMO_SHIP : SIM_PROMO_VAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></SimField>
              <SimField label="Promo drop-off zones">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((z) => <label key={z} style={{ fontSize: 12.5, display: "flex", gap: 5 }}><input type="checkbox" checked={!!P.zones[z]} onChange={(e) => setP((p) => ({ ...p, zones: { ...p.zones, [z]: e.target.checked } }))} />{PRC_ENG.ZONE_NAME[z]}</label>)}
                </div>
              </SimField>
              <SimField label="Max promo orders"><input style={SIM_IN} type="number" min="0" step="50" value={P.max} onChange={(e) => setPf("max", +e.target.value || 0)} /></SimField>
              <SimField label="Discount type"><select style={SIM_IN} value={P.dtype} onChange={(e) => setP((p) => ({ ...p, dtype: e.target.value, val: e.target.value === "egp" ? 10 : 100 }))}><option value="pct">Percent (%)</option><option value="egp">Fixed EGP per order</option></select></SimField>
              <SimField label={"Discount value (" + (P.dtype === "egp" ? "EGP / order" : "%") + ")"}><input style={SIM_IN} type="number" min="0" value={P.val} onChange={(e) => setPf("val", +e.target.value || 0)} /></SimField>
              <SimField label="Monthly order target" hint={sim ? "Current orders " + fmt(sim.base.A.orders, 0) + (P.target > sim.base.A.orders ? " · incremental orders " + fmt(P.target - sim.base.A.orders, 0) : "") : ""}><input style={SIM_IN} type="number" min="0" step="100" value={P.target} onChange={(e) => setPf("target", +e.target.value || 0)} /></SimField>
              <SimField label="Incremental orders zone mix"><select style={SIM_IN} value={P.inc} onChange={(e) => setPf("inc", e.target.value)}><option value="mix">Same mix as today</option>{[1, 2, 3, 4, 5, 6, 7].map((z) => <option key={z} value={z}>All to {PRC_ENG.ZONE_NAME[z]}</option>)}</select></SimField>
            </SimCard>
          )}
          <SimCard title={"Customer colour" + (id ? ", " + month : "")}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ color: COLORS.textFaint, fontSize: 11 }}><th style={{ textAlign: "left", padding: "4px 4px" }}>Colour</th><th style={{ textAlign: "right", padding: "4px 4px" }}>Orders (share)</th>{types.rto && <th style={{ textAlign: "right", padding: "4px 4px" }}>RTO discount %</th>}</tr></thead>
              <tbody>{SIM_COLOURS.map(([k, l]) => (
                <tr key={k} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                  <td style={{ padding: "5px 4px" }}>{l}</td>
                  <td style={{ padding: "5px 4px", textAlign: "right", fontFamily: MP_MONO }}>{sim ? fmt(colourOrders[k], 0) + " (" + pct(totalO ? colourOrders[k] / totalO : 0, 0) + ")" : "—"}</td>
                  {types.rto && <td style={{ padding: "3px 4px", textAlign: "right" }}><input aria-label={"RTO discount % " + l} style={{ ...SIM_IN, width: 64, textAlign: "right" }} type="number" min="0" max="100" value={colour[k]} onChange={(e) => setColour({ ...colour, [k]: +e.target.value || 0 })} /></td>}
                </tr>
              ))}</tbody>
            </table>
            {types.rto && <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 6 }}>The % you enter is taken off the return shipping fee of returns to customers of that colour, on the plan being simulated.</div>}
          </SimCard>
        </div>
        <div style={{ flex: "1 1 460px", minWidth: 0 }}>{right}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- new merchant
const SIM_NEWMIX = { pick: [100, 0, 0, 0, 0, 0, 0], drop: [62, 12, 18, 8, 0, 0, 0], size: [100, 0, 0, 0, 0, 0] };
function SimNewTab({ store, canMargin }) {
  const [f, setF] = useState({ name: "", orders: 1000, del: 80, cod: 100, avgCod: 900, ato: 0, flex: 0, ins: 0, insRate: 1, nd: 0, pack: "0", stops: 20, plan: "" });
  const [pick, setPick] = useState(SIM_NEWMIX.pick.slice(0, 6));
  const [drop, setDrop] = useState(SIM_NEWMIX.drop.slice(0, 6));
  const bi = PRC_ENG.SIZES.indexOf("B");
  const [size, setSize] = useState(SIM_NEWMIX.size.filter((_, i) => i !== bi));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const rest = (a) => Math.round((100 - a.reduce((t, v) => t + v, 0)) * 100) / 100;
  const pickAll = pick.concat([rest(pick)]), dropAll = drop.concat([rest(drop)]);
  const sizeAll = size.slice(0, bi).concat([rest(size)], size.slice(bi));
  const neg = pickAll.some((v) => v < 0) || dropAll.some((v) => v < 0) || sizeAll.some((v) => v < 0);
  const margin = canMargin && store.margin !== false;
  const C = useMemo(() => PRC_ENG.costSettings(store, "month"), [store]);
  const valid = !!store.pricing.plans[f.plan];
  const q = { orders: +f.orders || 0, deliveredPct: Math.max(0, Math.min(1, (+f.del || 0) / 100)), pick: pickAll, drop: dropAll, size: sizeAll,
    atoPct: (+f.ato || 0) / 100, flexPct: (+f.flex || 0) / 100, codPct: (+f.cod || 0) / 100, insPct: (+f.ins || 0) / 100, insRate: (+f.insRate || 0) / 100, ndPct: (+f.nd || 0) / 100,
    avgCod: +f.avgCod || 0, packaging: f.pack === "1", stops: +f.stops || 0, plan: f.plan };
  const r = valid && q.orders > 0 && !neg ? PRC_ENG.acquisition(q, store.pricing, C, store.net || {}) : null;
  let pz = 1; for (let i = 2; i <= 7; i++) if (pickAll[i - 1] > pickAll[pz - 1]) pz = i;
  const num = (k, label, extra) => <SimField label={label}><input style={SIM_IN} type="number" min="0" step={extra || 1} value={f[k]} onChange={(e) => set(k, e.target.value)} /></SimField>;
  const mixTable = (title, names, arr, setArr, all) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 8 }}>
      <thead><tr style={{ color: COLORS.textFaint, fontSize: 11 }}><th style={{ textAlign: "left", padding: 4 }}>{title}</th><th style={{ textAlign: "right", padding: 4 }}>Share %</th></tr></thead>
      <tbody>{names.map((n, i) => (
        <tr key={n} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}><td style={{ padding: "4px" }}>{n}</td>
          <td style={{ padding: "3px 4px", textAlign: "right" }}>{i < arr.length ? <input aria-label={title + " " + n} style={{ ...SIM_IN, width: 72, textAlign: "right" }} type="number" value={arr[i]} onChange={(e) => setArr(arr.map((v, j) => (j === i ? +e.target.value || 0 : v)))} /> : <span style={{ fontFamily: MP_MONO, color: all[i] < 0 ? COLORS.coral : COLORS.textMuted }}>{all[i]} (calculated)</span>}</td></tr>
      ))}</tbody>
    </table>
  );
  const zn = [1, 2, 3, 4, 5, 6, 7].map((z) => PRC_ENG.ZONE_NAME[z]);
  const sn = PRC_ENG.SIZES.split("").map((z) => PRC_ENG.SIZE_NAME[z]);
  const sizeInputs = sn.filter((_, i) => i !== bi);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
      <div style={{ flex: "0 0 340px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <SimCard title="New merchant">
          <SimField label="Name (optional)"><input style={SIM_IN} value={f.name} onChange={(e) => set("name", e.target.value)} /></SimField>
          {num("orders", "Orders per month", 50)}{num("del", "Delivered % (DSR)")}{num("stops", "Pickup stops per month")}
          {num("cod", "Cash on delivery % of orders")}{num("avgCod", "Average cash on delivery (EGP)", 50)}
          {num("ato", "Allow to open % of orders (flagged)")}{num("flex", "Flexship paid % of returns")}{num("ins", "Insurance % of orders")}{num("insRate", "Insurance rate %", 0.1)}{num("nd", "Next day COD % of orders")}
          <SimField label="Uses Bosta packaging"><select style={SIM_IN} value={f.pack} onChange={(e) => set("pack", e.target.value)}><option value="0">No</option><option value="1">Yes</option></select></SimField>
          <SimField label="Price plan"><input data-testid="sim-new-plan" style={SIM_IN} list="sim-plans2" value={f.plan} onChange={(e) => set("plan", e.target.value)} placeholder="Pick a plan…" autoComplete="off" />
            <datalist id="sim-plans2">{prcPlanList(store, null).map((p) => <option key={p} value={p} />)}</datalist></SimField>
        </SimCard>
        <SimCard title="Order mix (%)">
          {mixTable("Pickup", zn, pick, setPick, pickAll)}{mixTable("Drop-off", zn, drop, setDrop, dropAll)}{mixTable("Size", sn, size, setSize, sizeAll)}
          <div style={{ fontSize: 11.5, color: COLORS.textFaint }}>The last zone and light bulky are calculated: 100% minus the others.</div>
        </SimCard>
      </div>
      <div style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <SimCard title="Merchant data">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 13 }}>
            <span><b>{f.name || "New merchant"}</b></span><span><b style={{ fontFamily: MP_MONO }}>{fmt(q.orders, 0)}</b> orders per month</span>
            <span>DSR <b style={{ fontFamily: MP_MONO }}>{pct(q.deliveredPct, 0)}</b></span><span>Plan <b>{valid ? f.plan : "not picked"}</b></span>
          </div>
          {neg && <div role="alert" style={{ fontSize: 12.5, color: COLORS.coral, marginTop: 8 }}>A mix has a negative value. Adjust the order mix so each one adds up to 100% without negative values.</div>}
        </SimCard>
        {!(q.orders > 0) && <SimCard><b>Enter orders per month</b></SimCard>}
        {q.orders > 0 && !valid && !neg && <SimCard><b>Pick a price plan</b><div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 4 }}>Choose a plan on the left to see the results.</div></SimCard>}
        {r && (<>
          <SimSummary cols={[{ name: f.plan, r }]} canMargin={margin} bench={margin && r.gm2pct != null ? <SimBench res={r} /> : null} />
          <SimRateCard store={store} plans={[{ label: "New", plan: f.plan }]} pz={pz} />
          <PrcPerOrder cur={r} fin={null} finName="" />
          {margin && r.cost && <SimPnl cols={[{ name: f.plan, r }]} />}
        </>)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cost assumptions (VP only, read only)
function SimCostTab({ store }) {
  const C = PRC_ENG.costSettings(store, "month");
  const scalar = [["First mile per stop", C.fmPerStop], ["First mile per order, default", C.fmPerOrder], ["Last mile, fixed per order", C.lmFixed], ["Last mile, variable per successful order", C.lmVar],
    ["Hub per order", C.hub], ["Communication per order", C.comm], ["Reverse per returned order", C.reverse], ["Cash collection, share of cash collected", C.codPct], ["Packaging cost per order", C.matCost],
    ["Packaging materials per order, default", C.matPerOrder], ["Packaging revenue per order", C.packRev], ["Compensation per order", C.compDefault], ["Allow to open charge rate", C.atoChargeRate]];
  const th = { textAlign: "left", padding: "5px 10px", fontSize: 11.5, color: COLORS.textMuted };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SimCard title="Cost assumptions" note="Read only. Defaults come from the profitability file; overrides set in the pack are already applied.">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><tbody>
          {scalar.map(([l, v]) => <tr key={l} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}><td style={{ padding: "6px 10px" }}>{l}</td><td style={{ padding: "6px 10px", textAlign: "right", fontFamily: MP_MONO }}>{v == null ? "—" : fmt(v, 4)}</td></tr>)}
        </tbody></table>
      </SimCard>
      <SimCard title="Middle mile cost per leg, by governorate (EGP)">
        <div style={{ columns: "3 220px", fontSize: 12.5 }}>
          {Object.keys(C.mm).sort().map((g) => <div key={g} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${COLORS.panelBorder}` }}><span>{g}</span><span style={{ fontFamily: MP_MONO }}>{fmt(C.mm[g], 2)}</span></div>)}
          {Object.keys(C.mm).length === 0 && <div style={{ color: COLORS.textMuted }}>No cost data in this pack.</div>}
        </div>
      </SimCard>
      <SimCard title="GM2 range" note="Expected GM2 % by monthly orders. Fixed: September 2026 actual profit and loss.">
        <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr><th style={th}>Orders a month</th><th style={{ ...th, textAlign: "right" }}>Expected GM2 %</th></tr></thead>
          <tbody>{PRC_ENG.GM2_RANGE.map((g) => <tr key={g[0]} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}><td style={{ padding: "5px 10px" }}>{PRC_ENG.gm2RangeLabel(g, true)}</td><td style={{ padding: "5px 10px", textAlign: "right", fontFamily: MP_MONO }}>{pct(g[2], 1)}</td></tr>)}</tbody>
        </table>
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 6 }}>Variance tolerance: green from {fmt(C.tolG * 100, 0)} points, amber from {fmt(C.tolY * 100, 0)} points, red below.</div>
      </SimCard>
    </div>
  );
}

// ---------------------------------------------------------------- screen
// fromScreen: the screen the simulator was opened from. The simulator follows that view, not only who is signed in, so a VP
// who opens it from the team leaders view sees what a team leader sees (no margin), and the Cost assumptions tab
// appears only when it was opened from the VP view.
function PricingSimulatorScreen({ nav, viewerKey, initialId, fromScreen, onBack }) {
  const viewer = parseViewer(viewerKey);
  const canMargin = prcCanSeeMargin(viewerKey) && fromScreen !== "tl";
  const canCost = prcCanSeeCostTab(viewerKey) && (!fromScreen || fromScreen === "vp");
  const [tab, setTab] = useState("existing");
  const [store, setStore] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    prcLoadStore(canMargin).then((s) => { if (alive) setStore(s); }).catch((e) => { if (alive) setError("Could not load the pricing data (" + (e.message || e) + ")."); });
    return () => { alive = false; };
  }, [canMargin]);
  const tabs = [["existing", "Existing merchants simulation"], ["new", "New merchant"]].concat(canCost ? [["cost", "Cost assumptions"]] : []);
  return (
    <div className="tt-shell" style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: THEME.font }}>
      <div className="tt-wrap" style={{ maxWidth: 1240 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
          <button data-testid="sim-back" onClick={onBack} style={UI.btn}><ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />Back</button>
          <h1 style={{ ...UI.title, margin: 0 }}>Pricing simulator</h1>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>{store ? "Data as of " + store.asof + ", rate card " + store.pricing_asof + ". EGP before VAT." : ""}</span>
        </div>
        {!prcCanUse(viewerKey) ? <MPBanner text="The pricing simulator is for team leaders, heads and the VP." /> : (
          <>
            <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {tabs.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  style={UI.pill(tab === k)}>{l}</button>
              ))}
            </div>
            {error && <MPBanner text={error} />}
            {!error && !store && <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "20px 2px" }}>Loading the pricing data&hellip;</div>}
            {store && tab === "existing" && <SimExistingTab store={store} viewer={viewer} canMargin={canMargin} initialId={initialId} />}
            {store && tab === "new" && <SimNewTab store={store} canMargin={canMargin} />}
            {store && tab === "cost" && canCost && <SimCostTab store={store} />}
            {store && !canMargin && <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 14 }}>Cost and margin are not shown in this view.</div>}
          </>
        )}
      </div>
    </div>
  );
}
