
// ============================================================================
// Daily analysis: how the merchants of a scope did on one day, compared with the same weekday of the last weeks.
// Opened with the "Daily analysis" button from every level (VP, heads, team leaders, sales, AMs).
// Rules (from the daily merchant activity report):
//   Segments      only Key-Account, Growth-Fashion, Growth-Cosmetics, Growth-General-Trade, Startups.
//   Sub-accounts  a sub-account is counted inside its main account (its pickups and its September volume are added to the main account's).
//   Baseline      the merchant's average pickups per working day of LAST month (last month's total ÷ its working days).
//   Absent        picked up on at least one of the reference weekdays (the last 3 same weekdays, a day with far fewer active merchants than usual is skipped) and has no pickup on the analysed day.
//                 Exception (all segments except Key-Account): picked up on each of the last two working days with more than baseline + 15% = "Quiet today, strong yesterday", not absent.
//   Dropper       picked up today, today's pickups 15% or more below the baseline.   Grower: 15% or more above it.
//   New           first pickup in the new-merchant window (25th of last month to the 25th of this month): no baseline, so never a dropper or grower.
//   On risk       no pickup for more than 14 days (looked at inside the data window).
//   Net impact    growers' gain + droppers' loss + absents' loss against the baseline (an absent merchant loses its whole baseline).
// ============================================================================
const DA_SEGS = ["Key-Account", "Growth-Fashion", "Growth-Cosmetics", "Growth-General-Trade", "Startups", "Box", "No segment", "Other segments"];   // the last three exist in the VP scope only (DATA.vpExtra)
const DA_SEG_LABEL = { "Key-Account": "Key Accounts", "Growth-Fashion": "Growth Fashion", "Growth-Cosmetics": "Growth Cosmetics", "Growth-General-Trade": "Growth General Trade", Startups: "Startups", Box: "Box", "No segment": "No segment", "Other segments": "Other segments" };
const DA_THR = 0.15;
const DA_COMPANY = __P.company || null;   // every pickup of the company per day (data/company_daily.json): the VP sees all of it, not only the roster merchants
const DA_MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DA_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DA_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DA_TABS = [
  ["absent", "Absent", () => COLORS.coral, "Picked up on the reference weekdays but not today. Ranked by their baseline: the volume at risk."],
  ["dropper", "Droppers", () => COLORS.coral, "Picked up today, but 15% or more below their baseline. Ranked by the pickups lost against the baseline."],
  ["grower", "Growers", () => COLORS.teal, "Picked up today, 15% or more above their baseline. Ranked by the pickups gained."],
  ["risk", "On risk", () => COLORS.amber, "No pickup for more than 14 days. Ranked by their baseline."],
  ["new", "New", () => COLORS.purple, "First pickup this month. They have no baseline, so they are not counted as droppers or growers."],
  ["watch", "Quiet today, strong yesterday", () => COLORS.blue, "No pickup today, but they picked up on each of the last two working days with more than baseline + 15%. Not counted as absent (not for Key Accounts)."],
];
const DA_TAB_ICON = { absent: BellOff, dropper: TrendingDown, grower: TrendingUp, risk: Flame, new: UserPlus, watch: Hourglass };
const daDateLabel = (d) => DA_DOW[new Date(d + "T00:00:00Z").getUTCDay()] + " " + Number(d.slice(8, 10)) + " " + DA_MON[Number(d.slice(5, 7)) - 1];
const daSgn = (v, d = 0) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v), d);
const daDow = (d) => new Date(d + "T00:00:00Z").getUTCDay();

// one merged account per roster merchant of the scope (sub-accounts folded into their main account)
function daPrepare(rows, store, company) {
  const ids = new Set(rows.map((r) => r.id)), byId = {};
  const sample = rows.map((r) => store.p[r.id]).find((e) => e && e[1]);
  if (!sample) return null;
  const n = sample[1].split(";").length;
  const dates = []; for (let k = 0; k < n; k++) dates.push(new Date(new Date(MP_DAILY_START + "T00:00:00Z").getTime() + k * 864e5).toISOString().slice(0, 10));
  const prevKey = DA_MONTH_KEYS[Math.max(0, Number(MP_CUR_MONTH_START.slice(5, 7)) - 2)];
  rows.forEach((r) => {
    if (!DA_SEGS.includes(r.seg)) return;
    const e = store.p[r.id]; if (!e || !e[1]) return;
    const series = e[1].split(";").map((s) => Number(s.split(",")[3]) || 0);
    byId[r.id] = { id: r.id, name: r.name, am: r.amName, seg: r.seg, newM: !!r.newThisMonth, prev: (r.monthly && r.monthly[prevKey]) || 0, series, subs: 0 };
  });
  const present = new Set(Object.keys(byId));
  const rootOf = (id) => { // follow the parent links; when two accounts name each other as parent, the smaller id is the main account
    const seen = [id]; let c = id;
    for (;;) { const x = store.x && store.x[c], pid = x && x.pid; if (!pid || pid === c || !present.has(pid)) return c; const at = seen.indexOf(pid); if (at >= 0) return seen.slice(at).sort()[0]; seen.push(pid); c = pid; }
  };
  Object.keys(byId).forEach((id) => { // fold sub-accounts into their main account (also when a main account is itself a sub-account)
    const root = rootOf(id); if (root === id) return;
    const par = byId[root], ch = byId[id]; ch.series.forEach((v, k) => { par.series[k] += v; }); par.prev += ch.prev; par.subs += 1 + ch.subs; delete byId[id];
  });
  const monthStart = dates.findIndex((d) => d >= MP_CUR_MONTH_START);
  const ms = Object.values(byId);
  // VP: all pickups of the company. "Other" = everything the roster merchants of the target segments do not cover (no account manager, other segments, box pickups of merchants outside the roster).
  let co = null;
  if (company && company.rows && company.rows.length) {
    const at = {}; company.rows.forEach((r, j) => { at[new Date(new Date(company.start + "T00:00:00Z").getTime() + j * 864e5).toISOString().slice(0, 10)] = r; });
    if (dates.every((d) => at[d])) {
      const all = dates.map((d) => at[d][0]), box = dates.map((d) => at[d][3]), actv = dates.map((d) => at[d][4]);
      const other = dates.map((d, k) => Math.max(0, all[k] - ms.reduce((t, m) => t + m.series[k], 0)));
      co = { all, box, actv, other };
    }
  }
  return { dates, n, ms, prevKey, monthStart: monthStart < 0 ? 0 : monthStart, wdPrev: WD_BY_MONTH[prevKey] || 26, co };
}
function daAnalyze(P, i) {
  const { dates, ms, monthStart, wdPrev } = P;
  const act = dates.map((_, k) => ms.reduce((s, m) => s + (m.series[k] > 0 ? 1 : 0), 0));
  const cand = [i - 7, i - 14, i - 21, i - 28].filter((k) => k >= 0);
  const sorted = cand.map((k) => act[k]).sort((a, b) => a - b), med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const refs = cand.filter((k) => act[k] >= 0.7 * med).slice(0, 3);
  const prevDays = []; for (let k = i - 1; k >= 0 && prevDays.length < 2; k--) if (daDow(dates[k]) !== 5) prevDays.push(k); // Friday is an off day
  const [y, db] = prevDays;
  const recs = ms.map((m) => {
    const v = m.series[i], lw = i >= 7 ? m.series[i - 7] : null, base = m.prev > 0 ? m.prev / wdPrev : 0;
    const wasActive = refs.some((k) => m.series[k] > 0);
    let last = -1; for (let k = i; k >= 0; k--) if (m.series[k] > 0) { last = k; break; }
    const inactive = last >= 0 ? i - last : null;
    let mt = 0, wd = 0; for (let k = monthStart; k <= i; k++) { mt += m.series[k]; if (daDow(dates[k]) !== 5) wd++; }
    const mtdAvg = wd ? mt / wd : 0, gr = base > 0 ? (mtdAvg - base) / base : null;
    const yv = y != null ? m.series[y] : 0, dv = db != null ? m.series[db] : 0;
    let status = "steady";
    if (v > 0) { if (m.newM) status = "new"; else if (base > 0 && v < base * (1 - DA_THR)) status = "dropper"; else if (base > 0 && v > base * (1 + DA_THR)) status = "grower"; }
    else if (wasActive) status = (m.seg !== "Key-Account" && base > 0 && yv > base * (1 + DA_THR) && dv > base * (1 + DA_THR)) ? "watch" : "absent";
    else status = "idle";
    const risk = inactive != null && inactive > 14;
    const impact = status === "dropper" || status === "grower" ? v - base : status === "absent" ? -base : 0;
    return { ...m, v, lw, base, inactive, risk, mtdAvg, gr, yv, dv, status, impact, wasActive };
  });
  const blank = () => ({ active: 0, vol: 0, lw: 0, absent: 0, dropper: 0, grower: 0, risk: 0, newM: 0, watch: 0, gain: 0, loss: 0, absLoss: 0, impact: 0, merchants: 0 });
  const tot = blank(), seg = Object.fromEntries(DA_SEGS.map((s) => [s, blank()]));
  recs.forEach((r) => {
    [tot, seg[r.seg]].forEach((a) => {
      a.merchants++; a.vol += r.v; a.lw += r.lw || 0; if (r.v > 0) a.active++;
      if (r.status === "absent") { a.absent++; a.absLoss += r.impact; } if (r.status === "dropper") { a.dropper++; a.loss += r.impact; } if (r.status === "grower") { a.grower++; a.gain += r.impact; }
      if (r.status === "new") a.newM++; if (r.status === "watch") a.watch++; if (r.risk) a.risk++; a.impact += r.impact;
    });
  });
  const lists = { absent: [], dropper: [], grower: [], risk: [], new: [], watch: [] };
  recs.forEach((r) => { if (r.status === "absent") lists.absent.push(r); if (r.status === "dropper") lists.dropper.push(r); if (r.status === "grower") lists.grower.push(r); if (r.risk) lists.risk.push(r); if (r.status === "new") lists.new.push(r); if (r.status === "watch") lists.watch.push(r); });
  lists.absent.sort((a, b) => b.base - a.base); lists.dropper.sort((a, b) => a.impact - b.impact); lists.grower.sort((a, b) => b.impact - a.impact);
  lists.risk.sort((a, b) => b.prev - a.prev); lists.new.sort((a, b) => b.v - a.v); lists.watch.sort((a, b) => b.yv - a.yv);
  const baseTotal = recs.reduce((s, r) => s + r.base, 0);
  let cs = null;
  if (P.co) { // company-wide figures of the analysed day and of the same weekday last week
    const C = P.co, lwk = i >= 7 ? i - 7 : null, g = (a, k) => (k == null ? null : a[k]);
    let pm = 0; for (let k = 0; k < monthStart; k++) pm += C.other[k];
    cs = { vol: C.all[i], lw: g(C.all, lwk), other: C.other[i], otherLw: g(C.other, lwk), box: C.box[i], boxLw: g(C.box, lwk), active: C.actv[i], otherBase: pm / wdPrev };
  }
  return { refs, y, db, recs, tot, seg, lists, baseTotal, act, cs, lowRefs: cand.filter((k) => !refs.includes(k)) };
}
function daSpark(r, P, i, w = 360, h = 70) {
  const from = Math.max(0, i - 27), pts = []; let mx = Math.max(r.base, 1);
  for (let k = from; k <= i; k++) mx = Math.max(mx, r.series[k]);
  const x = (k) => ((k - from) / Math.max(1, i - from)) * (w - 8) + 4, yy = (v) => h - 6 - (v / mx) * (h - 14);
  for (let k = from; k <= i; k++) pts.push(x(k) + "," + yy(r.series[k]));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Last 28 days of pickups">
      <polyline fill="none" stroke={COLORS.chart} strokeWidth="2" points={pts.join(" ")} />
      {[i - 7, i - 14, i - 21].filter((k) => k >= from).map((k) => <circle key={k} cx={x(k)} cy={yy(r.series[k])} r="3" fill={COLORS.amber} />)}
      <circle cx={x(i)} cy={yy(r.series[i])} r="4" fill={r.v > 0 ? COLORS.teal : COLORS.coral} />
    </svg>
  );
}

function DaBars({ P, A, i, onPick }) {
  const [hov, setHov] = useState(null);
  const from = P.monthStart, ks = []; for (let k = from; k < P.n; k++) ks.push(k);
  const tot = ks.map((k) => P.ms.reduce((s, m) => s + m.series[k], 0) + (P.co ? P.co.other[k] : 0));   // VP: plus every other pickup of the company
  const mx = Math.max(...tot, 1) * 1.08, W = 720, H = 190, pad = 6, bw = (W - pad * 2) / ks.length;
  const hk = hov == null ? i : hov, hv = tot[hk - from];
  return (
    <div>
      <div style={{ fontSize: 12.5, color: COLORS.text, marginBottom: 6, minHeight: 18 }}><strong>{daDateLabel(P.dates[hk])}</strong> · {fmt(hv)} pickups · {fmt(A.act[hk])} active merchants{hk !== i ? <span style={{ color: COLORS.textFaint }}> · click to analyse this day</span> : <span style={{ color: COLORS.blue }}> · analysed day</span>}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Daily pickups of the month">
        {ks.map((k, j) => {
          const h = (tot[j] / mx) * (H - 30), isSel = k === i, isRef = A.refs.includes(k), fri = daDow(P.dates[k]) === 5;
          return (
            <g key={k} onMouseEnter={() => setHov(k)} onMouseLeave={() => setHov(null)} onClick={() => !fri && onPick(k)} style={{ cursor: fri ? "default" : "pointer" }}>
              <rect x={pad + j * bw + 1.5} y={H - 18 - h} width={Math.max(2, bw - 3)} height={Math.max(1, h)} rx="3" fill={isSel ? COLORS.chart : fri ? COLORS.slateDim : isRef ? COLORS.sand : COLORS.chartTint} />
              {(isSel || isRef) && <text x={pad + j * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize="9" fill={isSel ? COLORS.chart : COLORS.textMuted}>{Number(P.dates[k].slice(8, 10))}</text>}
            </g>);
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: COLORS.textMuted, flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: COLORS.chart, borderRadius: 2, marginRight: 5 }} />analysed day</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: COLORS.sand, borderRadius: 2, marginRight: 5 }} />reference weekdays</span>
      </div>
    </div>
  );
}
function DaImpact({ T }) {
  const parts = [["Growers", T.gain, COLORS.teal], ["Droppers", T.loss, COLORS.coral], ["Absent", T.absLoss, COLORS.coral]];
  const mx = Math.max(T.gain, Math.abs(T.loss), Math.abs(T.absLoss), 1);
  return (
    <div>
      {parts.map(([l, v, c]) => (
        <div key={l} style={{ display: "grid", gridTemplateColumns: "86px 1fr 80px", alignItems: "center", gap: 8, fontSize: 12.5, padding: "5px 0" }}>
          <span style={{ color: COLORS.textMuted }}>{l}</span>
          <div style={{ height: 14, background: COLORS.slateDim, borderRadius: 7, overflow: "hidden" }}><div style={{ width: Math.max(2, (Math.abs(v) / mx) * 100) + "%", height: "100%", background: c, opacity: l === "Absent" ? 0.65 : 1 }} /></div>
          <span style={{ fontFamily: THEME.font, color: c, textAlign: "right", fontWeight: 600 }}>{daSgn(v)}</span>
        </div>))}
      <div style={{ display: "grid", gridTemplateColumns: "86px 1fr 80px", gap: 8, fontSize: 13, padding: "8px 0 0", borderTop: `1px solid ${COLORS.panelBorder}`, marginTop: 4 }}>
        <strong>Net impact</strong><span style={{ color: COLORS.textFaint, fontSize: 11.5 }}>against the baseline, pickups per day</span>
        <strong style={{ fontFamily: THEME.font, color: T.impact >= 0 ? COLORS.teal : COLORS.coral, textAlign: "right" }}>{daSgn(T.impact)}</strong>
      </div>
    </div>
  );
}
function DaDiv({ v, mx, w = 90 }) { // diverging bar around zero
  const half = w / 2, len = mx ? Math.min(half, (Math.abs(v) / mx) * half) : 0;
  return <svg width={w} height="10" style={{ verticalAlign: "middle" }}><line x1={half} x2={half} y1="0" y2="10" stroke={COLORS.panelBorder2} /><rect x={v >= 0 ? half : half - len} y="2" width={Math.max(0, len)} height="6" rx="2" fill={v >= 0 ? COLORS.teal : COLORS.coral} /></svg>;
}

function DailyAnalysisScreen({ nav, spec, onBack }) {
  const [store, setStore] = useState(null); const [err, setErr] = useState(null);
  const [idx, setIdx] = useState(null); const [tab, setTab] = useState("absent"); const [segF, setSegF] = useState("all");
  const [q, setQ] = useState(""); const [showAll, setShowAll] = useState(false); const [open, setOpen] = useState(null);
  useEffect(() => { let on = true; mpLoadStore().then((s) => on && setStore(s)).catch((e) => on && setErr(String(e.message || e))); return () => { on = false; }; }, []);
  const { title, sub, rows } = useMemo(() => {
    if (spec.kind === "sales") { const ids = new Set(spec.ent.newList.concat(spec.ent.cohortList, spec.ent.reactList || []).map((x) => x[0])); return { title: spec.ent.name, sub: "sales · merchants of this sales rep that are in an AM portfolio", rows: LEAD_ROWS.filter((r) => ids.has(r.id)) }; }
    const S = leadScope(spec.kind, spec.ent);
    return { title: spec.kind === "vp" ? "All teams" : spec.ent.name, sub: spec.kind === "vp" ? "VP · every team" : spec.kind === "head" ? "Head · " + LEAD_TAB_LABEL[spec.ent.team] : spec.kind === "tl" ? "Team leader · " + LEAD_TAB_LABEL[spec.ent.team] : "Account manager · " + LEAD_TAB_LABEL[spec.ent.team], rows: S.rows };
  }, [spec]);
  const P = useMemo(() => (store ? daPrepare(rows, store, spec.kind === "vp" ? DA_COMPANY : null) : null), [store, rows, spec.kind]);
  const days = useMemo(() => (P ? P.dates.map((d, k) => k).filter((k) => k >= P.monthStart && daDow(P.dates[k]) !== 5) : []), [P]);
  const cur = idx != null && days.includes(idx) ? idx : days[days.length - 1];
  const A = useMemo(() => (P && cur != null ? daAnalyze(P, cur) : null), [P, cur]);
  const shell = (children) => (
    <div style={{ background: COLORS.bg, color: COLORS.text, fontFamily: THEME.font, minHeight: "100%" }} className="tt-shell">
      <div className="tt-wrap">
        <button onClick={onBack} style={{ ...UI.btn, marginBottom: 14 }}><ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />Back</button>
        {children}
      </div>
    </div>);
  if (err) return shell(<MPBanner text={"The merchant data could not be loaded: " + err} />);
  if (!store) return shell(<div style={{ color: COLORS.textMuted, padding: 30 }}>Loading the daily merchant data…</div>);
  if (!P || !A) return shell(<MPBanner text={"There are no merchants of the target segments with daily data in this scope" + (spec.kind === "sales" ? " (only merchants that sit in an AM portfolio have daily data)." : ".")} />);
  const T = A.tot, d = P.dates[cur], lwD = cur >= 7 ? P.dates[cur - 7] : null;
  const CS = A.cs;   // VP only: all pickups of the company
  const vTot = CS ? CS.vol : T.vol, vLw = CS ? (CS.lw == null ? 0 : CS.lw) : T.lw;
  const volDelta = vTot - vLw, segList = DA_SEGS.filter((s) => A.seg[s].merchants > 0);
  const maxImp = Math.max(1, ...segList.map((s) => Math.abs(A.seg[s].impact))), maxVol = Math.max(1, ...segList.map((s) => Math.abs(A.seg[s].vol - A.seg[s].lw)));
  const worst = segList.slice().sort((a, b) => A.seg[a].impact - A.seg[b].impact)[0], best = segList.slice().sort((a, b) => A.seg[b].impact - A.seg[a].impact)[0];
  const topAbs = A.lists.absent[0];
  const insights = [
    { c: volDelta >= 0 ? COLORS.teal : COLORS.coral, t: <span><strong>{fmt(vTot)}</strong> {CS ? "pickups of the whole company (box and merchants without an account manager included)" : "pickups"} on {daDateLabel(d)}: <strong style={{ color: volDelta >= 0 ? COLORS.teal : COLORS.coral }}>{daSgn(volDelta)}</strong>{vLw ? " (" + daSgn((volDelta / vLw) * 100, 1) + "%)" : ""} against {lwD ? daDateLabel(lwD) : "the same day last week"}.</span> },
    { c: T.impact >= 0 ? COLORS.teal : COLORS.coral, t: <span>Against last month's baseline the day is <strong style={{ color: T.impact >= 0 ? COLORS.teal : COLORS.coral }}>{daSgn(T.impact)}</strong>: growers {daSgn(T.gain)}, droppers {daSgn(T.loss)}, absent merchants {daSgn(T.absLoss)}.</span> },
    worst && A.seg[worst].impact < 0 ? { c: COLORS.coral, t: <span>Biggest drag: <strong>{DA_SEG_LABEL[worst]}</strong> at {daSgn(A.seg[worst].impact)}{best && best !== worst && A.seg[best].impact > 0 ? <span>; best: <strong>{DA_SEG_LABEL[best]}</strong> at {daSgn(A.seg[best].impact)}.</span> : "."}</span> } : { c: COLORS.teal, t: <span>No segment is below its baseline{best ? "; best: " + DA_SEG_LABEL[best] + " at " + daSgn(A.seg[best].impact) : ""}.</span> },
    topAbs ? { c: COLORS.amber, t: <span>Largest absent merchant: <strong>{topAbs.name}</strong> ({topAbs.am}), normally about {fmt(topAbs.base, 0)} pickups a day. {fmt(T.absent)} merchants are absent, {fmt(T.risk)} have been silent for more than 14 days.</span> } : null,
  ].filter(Boolean);
  const list = A.lists[tab].filter((r) => (segF === "all" || r.seg === segF) && (!q || (r.name + " " + r.id + " " + r.am).toLowerCase().includes(q.toLowerCase())));
  const shown = showAll ? list : list.slice(0, 10);
  const tabInfo = DA_TABS.find((x) => x[0] === tab);
  const cardTab = (k, label, value, sub2, accent, info) => (
    <div onClick={() => { setTab(k); setOpen(null); setShowAll(false); }} style={{ cursor: "pointer", outline: tab === k ? `2px solid ${accent || COLORS.text}` : "none", borderRadius: 12 }}>
      <OrgCard label={label} info={info} value={value} sub={sub2} accent={accent} />
    </div>);
  const csv = () => {
    const head = ["Merchant", "Business ID", "AM", "Segment", "Today", "Same day last week", "Baseline per day", "Impact vs baseline", "Month GR %", "Inactive days"];
    const body = list.map((r) => [r.name, r.id, r.am, r.seg, r.v, r.lw == null ? "" : r.lw, Math.round(r.base * 10) / 10, Math.round(r.impact), r.gr == null ? "" : Math.round(r.gr * 1000) / 10, r.inactive == null ? "" : r.inactive]);
    const text = [head].concat(body).map((row) => row.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" })); a.download = "daily_analysis_" + tab + "_" + d + ".csv"; a.click();
  };
  const th = { padding: "8px 10px", textAlign: "right", fontSize: 11.5, color: COLORS.textMuted, fontWeight: 600, whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", textAlign: "right", fontFamily: THEME.font, whiteSpace: "nowrap" };
  const pos = (i2) => cur + (i2 > 0 ? 1 : -1);
  const step = (dir) => { const j = days.indexOf(cur) + dir; if (j >= 0 && j < days.length) { setIdx(days[j]); setOpen(null); } };
  const nb = (dir, label) => (<button onClick={() => step(dir)} disabled={days.indexOf(cur) + dir < 0 || days.indexOf(cur) + dir >= days.length} style={UI.btn}>{dir < 0 && <ChevronLeft size={15} strokeWidth={1.75} aria-hidden="true" />}{label}{dir > 0 && <ChevronRight size={15} strokeWidth={1.75} aria-hidden="true" />}</button>);
  return shell(
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: COLORS.textFaint, textTransform: "uppercase", fontWeight: 600, fontFamily: THEME.font, marginBottom: 6 }}>Daily analysis · {DATA.month}</div>
      <h1 style={{ ...UI.title, margin: "0 0 2px" }}>{title}</h1>
      <div style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 14 }}>{sub} · {fmt(P.ms.length)} accounts in the target segments (sub-accounts counted in their main account){CS ? " · plus all other pickups of the company (no account manager, other segments) and box pickups" : ""} · data as of {DATA.asOf}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {nb(-1, "Previous day")}
        <select value={cur} onChange={(e) => { setIdx(Number(e.target.value)); setOpen(null); }} aria-label="Analysed day" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder2}`, borderRadius: 12, color: COLORS.text, fontSize: 15, fontWeight: 700, padding: "8px 12px" }}>
          {days.slice().reverse().map((k) => <option key={k} value={k}>{daDateLabel(P.dates[k])}</option>)}
        </select>
        {nb(1, "Next day")}
        <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>compared with the same weekday: {A.refs.length ? A.refs.map((k) => daDateLabel(P.dates[k])).join(", ") : "no reference day with data"}</span>
        <InfoTip text={"Reference weekdays = the last 3 same weekdays before the analysed day. A weekday with far fewer active merchants than usual (a holiday or a data gap) is skipped" + (A.lowRefs.length ? ": skipped here " + A.lowRefs.map((k) => daDateLabel(P.dates[k])).join(", ") : "") + ". Fridays are off days. The baseline of a merchant is its average pickups per working day of last month."} />
      </div>
      <div style={{ ...UI.surface, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>What stands out</div>
        {insights.map((x, k) => (<div key={k} style={{ display: "flex", gap: 9, fontSize: 13, padding: "3px 0", lineHeight: 1.5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: x.c, marginTop: 6, flexShrink: 0 }} /><div>{x.t}</div></div>))}
      </div>
      <div className="tt-kpis" style={{ ...UI.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 12, marginBottom: 16 }}>
        <OrgCard label="Total volume" info={CS ? "All pickups of the company on the analysed day (box pickups included, with or without an account manager, any segment), against the same weekday last week. Target segments: " + fmt(T.vol) + ", other: " + fmt(CS.other) + "." : "Pickups of the scope on the analysed day, against the same weekday last week."} value={fmt(vTot)} accent={volDelta >= 0 ? COLORS.teal : COLORS.coral} sub={daSgn(volDelta) + " vs " + (lwD ? daDateLabel(lwD) : "last week")} />
        {CS && <OrgCard label="Other pickups" info="Pickups of merchants that are not in the account managers' target segments: no account manager, other segments, and merchants outside the roster. Company total minus the target segments." value={fmt(CS.other)} sub={(CS.otherLw == null ? "" : daSgn(CS.other - CS.otherLw) + " vs " + (lwD ? daDateLabel(lwD) : "last week") + " · ") + fmt(CS.vol ? (CS.other / CS.vol) * 100 : 0, 0) + "% of all pickups"} />}
        {CS && <OrgCard label="Box pickups" info="Box pickups of the whole company on the analysed day (part of the total volume, not added on top)." value={fmt(CS.box)} sub={CS.boxLw == null ? "" : daSgn(CS.box - CS.boxLw) + " vs " + (lwD ? daDateLabel(lwD) : "last week")} />}
        <OrgCard label="Active merchants" info="Merchants (sub-accounts inside their main account) with at least one pickup on the analysed day." value={fmt(T.active)} sub={"of " + fmt(T.merchants) + " accounts · " + (A.act[cur - 7] != null ? daSgn(T.active - (cur >= 7 ? P.ms.reduce((s, m) => s + (m.series[cur - 7] > 0 ? 1 : 0), 0) : 0)) + " vs last week" : "")} />
        <OrgCard label="Net impact vs baseline" info="Growers' gain + droppers' loss + absent merchants' loss against each merchant's baseline (last month's average pickups per working day), in pickups for the day." value={daSgn(T.impact)} accent={T.impact >= 0 ? COLORS.teal : COLORS.coral} sub="pickups for the day" />
        {cardTab("absent", "Absent", fmt(T.absent), daSgn(T.absLoss) + " pickups of baseline", COLORS.coral, DA_TABS[0][3])}
        {cardTab("dropper", "Droppers", fmt(T.dropper), daSgn(T.loss) + " vs baseline", COLORS.coral, DA_TABS[1][3])}
        {cardTab("grower", "Growers", fmt(T.grower), daSgn(T.gain) + " vs baseline", COLORS.teal, DA_TABS[2][3])}
        {cardTab("risk", "On risk", fmt(T.risk), "silent for more than 14 days", COLORS.amber, DA_TABS[3][3])}
        {cardTab("new", "New merchants", fmt(T.newM), NEW_PHRASE, COLORS.purple, DA_TABS[4][3])}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ ...UI.surface, padding: "12px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center" }}>Daily pickups this month<InfoTip text="Total pickups of the scope for each day. Click a bar to analyse that day." /></div>
          <DaBars P={P} A={A} i={cur} onPick={(k) => { setIdx(k); setOpen(null); }} />
        </div>
        <div style={{ ...UI.surface, padding: "12px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center" }}>Where the gap to the baseline comes from<InfoTip text="Growers add to the day, droppers and absent merchants take away, each against its own baseline. The net is the day's impact against last month's average." /></div>
          <DaImpact T={T} />
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, margin: "6px 0 8px", display: "flex", alignItems: "center" }}>By segment<InfoTip text="Click a segment to filter the merchant lists below to it. Volume change = against the same weekday last week; net impact = against last month's baseline." /></div>
      <div style={{ ...UI.table, overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ background: COLORS.card }}><th style={{ ...th, textAlign: "left" }}>Segment</th><th style={th}>Active</th><th style={th}>Volume</th><th style={th}>vs last week</th><th style={{ ...th, textAlign: "center" }} /><th style={th}>Absent</th><th style={th}>Droppers</th><th style={th}>Growers</th><th style={th}>On risk</th><th style={th}>Net impact</th><th style={{ ...th, textAlign: "center" }} /></tr></thead>
          <tbody>
            {segList.map((s) => { const a = A.seg[s], dv = a.vol - a.lw; return (
              <tr key={s} onClick={() => { setSegF(segF === s ? "all" : s); setOpen(null); setShowAll(false); }} style={{ borderTop: `1px solid ${COLORS.panelBorder}`, cursor: "pointer", background: segF === s ? THEME.color.navyTint : "transparent" }}>
                <td style={{ ...td, textAlign: "left", fontFamily: "inherit", fontWeight: 600, color: COLORS.blue }}>{DA_SEG_LABEL[s]}</td>
                <td style={td}>{fmt(a.active)}</td><td style={td}>{fmt(a.vol)}</td>
                <td style={{ ...td, color: dv >= 0 ? COLORS.teal : COLORS.coral }}>{daSgn(dv)}</td><td style={{ ...td, textAlign: "center" }}><DaDiv v={dv} mx={maxVol} /></td>
                <td style={td}>{fmt(a.absent)}</td><td style={td}>{fmt(a.dropper)}</td><td style={td}>{fmt(a.grower)}</td><td style={td}>{fmt(a.risk)}</td>
                <td style={{ ...td, color: a.impact >= 0 ? COLORS.teal : COLORS.coral, fontWeight: 700 }}>{daSgn(a.impact)}</td><td style={{ ...td, textAlign: "center" }}><DaDiv v={a.impact} mx={maxImp} /></td>
              </tr>); })}
            {CS && [["Other: no account manager or other segment", CS.other, CS.otherLw, false], ["Box pickups (inside the figures above)", CS.box, CS.boxLw, true]].map(([l, v, w, memo]) => { const dv = w == null ? 0 : v - w; return (
              <tr key={l} style={{ borderTop: `1px solid ${COLORS.panelBorder}`, color: memo ? COLORS.textMuted : COLORS.text }}>
                <td style={{ ...td, textAlign: "left", fontFamily: "inherit", fontWeight: memo ? 400 : 600, fontStyle: memo ? "italic" : "normal" }}>{l}</td><td style={td}>{"\u2014"}</td><td style={td}>{fmt(v)}</td>
                <td style={{ ...td, color: dv >= 0 ? COLORS.teal : COLORS.coral }}>{w == null ? "\u2014" : daSgn(dv)}</td><td /><td style={td}>{"\u2014"}</td><td style={td}>{"\u2014"}</td><td style={td}>{"\u2014"}</td><td style={td}>{"\u2014"}</td><td style={td}>{"\u2014"}</td><td />
              </tr>); })}
            <tr style={{ borderTop: `2px solid ${COLORS.panelBorder2}`, background: COLORS.card, fontWeight: 700 }}>
              <td style={{ ...td, textAlign: "left", fontFamily: "inherit" }}>{CS ? "Total, all pickups" : "Total"}</td><td style={td}>{fmt(CS ? CS.active : T.active)}</td><td style={td}>{fmt(vTot)}</td><td style={{ ...td, color: volDelta >= 0 ? COLORS.teal : COLORS.coral }}>{daSgn(volDelta)}</td><td />
              <td style={td}>{fmt(T.absent)}</td><td style={td}>{fmt(T.dropper)}</td><td style={td}>{fmt(T.grower)}</td><td style={td}>{fmt(T.risk)}</td><td style={{ ...td, color: T.impact >= 0 ? COLORS.teal : COLORS.coral }}>{daSgn(T.impact)}</td><td />
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, margin: "6px 0 8px" }}>Merchants</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {DA_TABS.map(([k, l, c]) => (<button key={k} onClick={() => { setTab(k); setOpen(null); setShowAll(false); }} style={{ ...UI.pill(tab === k), borderColor: tab === k ? c() : COLORS.panelBorder2, background: tab === k ? c() : COLORS.control, color: tab === k ? "#fff" : COLORS.textMuted }}>{(() => { const I = DA_TAB_ICON[k]; return I ? <I size={14} strokeWidth={1.75} aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }} /> : null; })()}{l} · {fmt(A.lists[k].length)}</button>))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {[["all", "All segments"]].concat(segList.map((s) => [s, DA_SEG_LABEL[s]])).map(([k, l]) => (<button key={k} onClick={() => { setSegF(k); setShowAll(false); }} style={UI.pill(segF === k)}>{l}</button>))}
        <span style={{ flex: 1 }} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setShowAll(false); }} placeholder="Search merchant, ID or AM" style={{ padding: "8px 12px", borderRadius: 12, border: `1px solid ${COLORS.panelBorder2}`, fontSize: 12.5, minWidth: 220, background: COLORS.panel }} />
        <button onClick={csv} style={UI.btnSmall}><Download size={14} strokeWidth={1.75} aria-hidden="true" />Download CSV</button>
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>{tabInfo[3]}</div>
      <div style={{ ...UI.table, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ background: COLORS.card }}>
            <th style={{ ...th, textAlign: "left" }}>#</th><th style={{ ...th, textAlign: "left" }}>Merchant</th><th style={{ ...th, textAlign: "left" }}>Segment</th><th style={th}>Today</th><th style={th}>{lwD ? daDateLabel(lwD) : "Last week"}</th><th style={th}>Change</th><th style={th}>Baseline / day</th><th style={th}>Impact</th><th style={th}>Month GR %</th><th style={th}>Inactive days</th>
          </tr></thead>
          <tbody>
            {shown.length === 0 ? <tr><td colSpan={10} style={{ padding: 16, textAlign: "center", color: COLORS.textFaint }}>No merchants</td></tr> : shown.map((r, k) => (
              <React.Fragment key={r.id}>
                <tr onClick={() => setOpen(open === r.id ? null : r.id)} style={{ borderTop: `1px solid ${COLORS.panelBorder}`, cursor: "pointer", background: open === r.id ? THEME.color.navyTint : "transparent" }}>
                  <td style={{ ...td, textAlign: "left", color: COLORS.textFaint }}>{k + 1}</td>
                  <td style={{ ...td, textAlign: "left", fontFamily: "inherit", whiteSpace: "normal", maxWidth: 260 }}><div style={{ fontWeight: 600, color: COLORS.text }}>{open === r.id ? "▾ " : "▸ "}{r.name}{r.subs > 0 && <span style={{ fontSize: 10, color: COLORS.textFaint, fontWeight: 400 }}> · incl. {r.subs} sub-account{r.subs > 1 ? "s" : ""}</span>}</div><div style={{ fontSize: 10.5, color: COLORS.textFaint }}>{r.am}</div></td>
                  <td style={{ ...td, textAlign: "left", fontFamily: "inherit", color: COLORS.textMuted }}>{DA_SEG_LABEL[r.seg]}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{fmt(r.v)}</td><td style={{ ...td, color: COLORS.textMuted }}>{r.lw == null ? "—" : fmt(r.lw)}</td>
                  <td style={{ ...td, color: r.lw == null ? COLORS.textFaint : r.v - r.lw >= 0 ? COLORS.teal : COLORS.coral }}>{r.lw == null ? "—" : daSgn(r.v - r.lw)}</td>
                  <td style={{ ...td, color: COLORS.textMuted }}>{r.base > 0 ? fmt(r.base, 1) : "—"}</td>
                  <td style={{ ...td, color: r.impact >= 0 ? COLORS.teal : COLORS.coral }}>{r.impact === 0 ? "—" : daSgn(r.impact)}</td>
                  <td style={{ ...td, color: r.gr == null ? COLORS.textFaint : r.gr >= 0 ? COLORS.teal : COLORS.coral }}>{r.gr == null ? "—" : daSgn(r.gr * 100, 1) + "%"}</td>
                  <td style={{ ...td, color: r.risk ? COLORS.amber : COLORS.textMuted }}>{r.inactive == null ? "—" : r.inactive}</td>
                </tr>
                {open === r.id && (<tr><td colSpan={10} style={{ padding: 0, borderTop: `1px solid ${COLORS.panelBorder}`, background: COLORS.card }}>
                  <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "minmax(280px, 1.2fr) 1fr", gap: 18, fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.6 }}>
                    <div>{daSpark(r, P, cur)}<div style={{ fontSize: 11, color: COLORS.textFaint }}>Last 28 days · <span style={{ color: COLORS.amber }}>●</span> reference weekdays · last dot = {daDateLabel(d)}</div></div>
                    <div>
                      <div>Business ID: <strong style={{ color: COLORS.text, fontFamily: THEME.font }}>{r.id}</strong> · {r.am}</div>
                      <div>Reference weekdays: {A.refs.map((k2) => daDateLabel(P.dates[k2]).slice(4) + " = " + fmt(r.series[k2])).join(" · ") || "none"}</div>
                      <div>Last two working days: {A.y != null ? daDateLabel(P.dates[A.y]).slice(4) + " = " + fmt(r.yv) : "—"}{A.db != null ? " · " + daDateLabel(P.dates[A.db]).slice(4) + " = " + fmt(r.dv) : ""}</div>
                      <div>This month so far {fmt(r.mtdAvg, 1)} per working day{r.base > 0 ? " vs " + fmt(r.base, 1) + " last month (" + (r.gr == null ? "—" : daSgn(r.gr * 100, 1) + "%") + ")" : " · no baseline last month"}.</div>
                      {r.status === "absent" && <div style={{ color: COLORS.coral }}>Absent: it picked up on a reference weekday and not today{r.seg === "Key-Account" ? " (Key Accounts have no 'strong yesterday' exception)" : ""}.</div>}
                    </div>
                  </div></td></tr>)}
              </React.Fragment>))}
          </tbody>
        </table>
      </div>
      {list.length > 10 && <div style={{ textAlign: "center", marginTop: 10 }}><button onClick={() => setShowAll(!showAll)} style={UI.btn}>{showAll ? "Show the top 10 only" : "Show all " + fmt(list.length)}</button></div>}
      <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 14, lineHeight: 1.5 }}>Baseline = a merchant's average pickups per working day of last month (Fridays excluded). Absent, dropper, grower and on-risk follow the daily merchant activity report rules (±15%). Pickups = parcels picked. Only the five commercial segments are included.</div>
    </div>
  );
}
