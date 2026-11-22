
// ============================================================================
// Org levels: VP -> Heads -> Team leaders -> Sales & AMs (targets from October_Targets_2026.xlsx, hierarchy included)
//   Pickups : portfolio pickups (AMs) vs the monthly target; for Sales: pickups of merchants created this month.
//   ASP     : delivery revenue total / parcels delivered, Oct 1-4 (target as given: no growth factor).
//   AM retention : merchants active in September that have a pickup in October so far (target = minimum).
//   Sales churn  : last month's acquisitions (end-of-September snapshot owner) with no pickup yet this month (target = maximum).
// ============================================================================
const ORG_HEAD = Object.fromEntries(ORG.heads.map((h) => [h.id, h]));
const ORG_TL = Object.fromEntries(ORG.tls.map((t) => [t.id, t]));
const ORG_SALES = Object.fromEntries(ORG.sales.map((s) => [s.id, s]));
const ORG_AM = Object.fromEntries(ORG.ams.map((a) => [a.name, a]));
const ORG_PACE = ORG.wdElapsed / DATA.wdFull; // share of the month's working days that has passed
const ORG_AM_PICKED = {};
ORG.ams.forEach((a) => { ORG_AM_PICKED[a.name] = DATA.ams[a.name].merchants.reduce((s, m) => s + m.mtd, 0); });

function orgAgg(ams, sales) {
  const z = { pickups: 0, pickTarget: 0, aspNum: 0, aspDen: 0, retBase: 0, retKept: 0, retW: 0, retWT: 0, aspWT: 0, aspW: 0, newPicked: 0, newDelivered: 0, newRevenue: 0, newTarget: 0, newMerchants: 0, cohort: 0, churned: 0, churnW: 0, churnWT: 0 };
  ams.forEach((a) => {
    z.pickups += ORG_AM_PICKED[a.name]; z.pickTarget += a.t.pickups; z.aspNum += a.a.aspNum; z.aspDen += a.a.aspDen; z.retBase += a.a.retBase; z.retKept += a.a.retKept;
    z.aspWT += a.t.asp * a.t.pickups; z.aspW += a.t.pickups;
    if (a.t.retention != null) { z.retWT += a.t.retention * a.t.pickups; z.retW += a.t.pickups; }
  });
  sales.forEach((s) => {
    z.newPicked += s.a.newPicked; z.newDelivered += s.a.newDelivered; z.newRevenue += s.a.newRevenue; z.newTarget += s.t.newPickups; z.newMerchants += s.a.newMerchants; z.cohort += s.a.cohort; z.churned += s.a.cohortChurned;
    if (s.t.churn != null) { z.churnWT += s.t.churn * s.t.newPickups; z.churnW += s.t.newPickups; }
  });
  return z;
}
function orgMembers(kind, ent) {
  if (kind === "am") return { ams: [ent], sales: [] };
  if (kind === "sales") return { ams: [], sales: [ent] };
  if (kind === "tl") return { ams: ORG.ams.filter((a) => a.tlId === ent.id), sales: ORG.sales.filter((s) => s.tlId === ent.id) };
  if (kind === "head") return { ams: ORG.ams.filter((a) => a.headId === ent.id), sales: ORG.sales.filter((s) => s.headId === ent.id) };
  return { ams: ORG.ams, sales: ORG.sales };
}
// one scorecard per entity: every metric as {actual, target, implied}
function orgScore(kind, ent) {
  const { ams, sales } = orgMembers(kind, ent);
  const g = orgAgg(ams, sales);
  const t = ent.t || {};
  const isSales = kind === "sales";
  const pickTarget = kind === "vp" ? g.pickTarget : isSales ? t.newPickups : t.pickups;
  const aspTarget = kind === "vp" ? (g.aspW ? g.aspWT / g.aspW : null) : t.asp;
  const aspActual = isSales ? (g.newDelivered ? g.newRevenue / g.newDelivered : null) : (g.aspDen ? g.aspNum / g.aspDen : null);
  const retTarget = kind === "am" ? t.retention : kind === "tl" && t.retention != null ? t.retention : g.retW ? g.retWT / g.retW : null;
  const churnTarget = isSales ? t.churn : g.churnW ? g.churnWT / g.churnW : null;
  const freshTarget = kind === "vp" ? g.newTarget : t.fresh != null ? t.fresh : null;
  return {
    pickups: { actual: isSales ? g.newPicked : g.pickups, target: pickTarget },
    asp: { actual: aspActual, target: aspTarget, base: isSales ? g.newDelivered : g.aspDen },
    fresh: isSales || kind === "am" ? null : { actual: g.newPicked, target: freshTarget },
    retention: kind === "sales" || !g.retBase ? null : { actual: g.retKept / g.retBase, target: retTarget, implied: kind !== "am" && !(kind === "tl" && t.retention != null), base: g.retBase },
    churn: kind === "am" || !g.cohort ? null : { actual: g.churned / g.cohort, target: churnTarget, implied: !isSales, base: g.cohort },
    weights: ent.w, g,
  };
}
const orgPct = (v, d = 1) => (v == null || Number.isNaN(v) ? "—" : (v * 100).toFixed(d) + "%");

// ---------- small UI ----------
function OrgBar({ pct, color }) {
  return <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, pct * 100))} style={{ height: 6, borderRadius: 999, background: COLORS.slateDim, overflow: "hidden", marginTop: 8 }}><div style={{ width: Math.max(2, Math.min(100, pct * 100)) + "%", height: "100%", borderRadius: 999, background: fillOf(color) }} /></div>;
}
function orgPaceColor(ach) { return ach >= ORG_PACE ? COLORS.teal : COLORS.coral; }

function OrgCard({ label, info, value, sub, accent, children }) {
  return (
    <div style={{ ...UI.tile }}>
      <KpiHead label={label} info={info} />
      <div style={{ ...UI.kpi, color: accent || COLORS.text }}>{value}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 12, color: COLORS.textMuted }}>{sub}</div>}
      {children}
    </div>
  );
}
const ORG_INFO = {
  pickups: "Portfolio pickups this month so far (Oct 1–4) vs the monthly target. Green = ahead of the share of the month already worked (" + ORG.wdElapsed + " of " + DATA.wdFull + " working days), red = behind.",
  newPickups: "Pickups this month of merchants whose FIRST pickup is in the new-merchant window, from the 25th of last month up to the 25th of this month (public.businesses.firstpickuppickedupat, the same date as the mart's joining date) and who have this sales rep as owner. Early in the month this is small by nature.",
  fresh: "Pickups from merchants acquired this month by the sales reps in this team (the 'Fresh Sales Target' in the sheet).",
  asp: "ASP = (shipping revenue + VAS revenue) ÷ delivered parcels, Oct 1–4. The target is taken straight from the sheet, with no growth percentage. Green = at or above target.",
  aspFresh: "ASP of the merchants this sales rep acquired this month: (shipping revenue + VAS revenue) ÷ delivered parcels, Oct 1–4. Target from the sheet.",
  retention: "Share of merchants that were active in September (any pickup) that already have a pickup in October. Provisional: many simply haven't picked up yet, so the figure rises through the month. Target = minimum retention from the sheet.",
  churn: "Of the merchants these sales reps activated last month (first pickup in the previous window, from the 25th of two months ago up to the 25th of last month; owner as of the end-of-last-month snapshot in public.businesses_monthly_snapshot), the share with no pickup yet this month. Provisional until month end. Target = maximum churn: for Growth and Key sales the sheet's 'Churn%' column (0.81–0.86) is read as RETENTION, so max churn = 1 minus it (14–19%); the Startups unlabelled 0.25 is max churn 25%.",
};

function OrgScoreCards({ sc, kind, skipPickups }) {
  const isSales = kind === "sales";
  const p = sc.pickups, a = sc.asp, f = sc.fresh, r = sc.retention, c = sc.churn;
  const pAch = p.target ? p.actual / p.target : null;
  return (
    <div className="tt-kpis" style={{ ...UI.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: 12, marginBottom: 18 }}>
      {!skipPickups && (<OrgCard label={isSales ? "New pickups" : "Pickups"} info={isSales ? ORG_INFO.newPickups : ORG_INFO.pickups} value={fmt(p.actual)} accent={pAch != null ? orgPaceColor(pAch) : undefined}
        sub={p.target ? `${orgPct(pAch)} of ${fmt(p.target)} target` : "no target"}>{pAch != null && <OrgBar pct={pAch} color={orgPaceColor(pAch)} />}</OrgCard>)}
      <OrgCard label={isSales ? "ASP (fresh sales)" : "ASP"} info={isSales ? ORG_INFO.aspFresh : kind === "vp" ? ORG_INFO.asp + " The sheet has no ASP target for the VP: it is the average of the AMs' ASP targets, each weighted by that AM's pickups target (the same average the heads' targets give, within 0.03)." : ORG_INFO.asp} value={a.actual == null ? "—" : fmt(a.actual, 1)}
        accent={a.actual != null && a.target ? (a.actual >= a.target ? COLORS.teal : COLORS.coral) : undefined} sub={a.target ? `target ${fmt(a.target, 1)} · ${a.actual != null ? (a.actual >= a.target ? "+" : "") + fmt(a.actual - a.target, 1) : "—"}${isSales ? " · " + fmt(a.base) + " delivered" : ""}` : "no target"} />
      {isSales && <OrgCard label="New accounts (MTD)" info={"Merchants with a " + NEW_RULE + " and who have this sales rep as owner (the accounts behind the new pickups)."} value={fmt(sc.g.newMerchants)} sub={NEW_PHRASE} />}
      {f && <OrgCard label="Fresh sales (new pickups)" info={ORG_INFO.fresh} value={fmt(f.actual)} accent={f.target ? orgPaceColor(f.actual / f.target) : undefined} sub={f.target ? `${orgPct(f.actual / f.target)} of ${fmt(f.target)} target` : "no target"}>{f.target ? <OrgBar pct={f.actual / f.target} color={orgPaceColor(f.actual / f.target)} /> : null}</OrgCard>}
      {r && <OrgCard label="Retention (portfolios)" info={ORG_INFO.retention} value={orgPct(r.actual)} sub={<span>{r.target != null ? `target ≥ ${orgPct(r.target)}${r.implied ? " (implied)" : ""}` : "no target"} · {fmt(r.base)} merchants · <em>provisional</em></span>} />}
      {c && <OrgCard label="Churn (last month's new merchants)" info={ORG_INFO.churn} value={orgPct(c.actual)} sub={<span>{c.target != null ? `target ≤ ${orgPct(c.target)}${c.implied ? " (implied)" : ""}` : "no target"} · {fmt(c.base)} merchants · <em>provisional</em></span>} />}
    </div>
  );
}

// compact cell for the tables
function OrgCell({ m, kind, d }) {
  if (!m || m.actual == null) return <span style={{ color: COLORS.textFaint }}>—</span>;
  if (kind === "cum") {
    const ach = m.target ? m.actual / m.target : null;
    return <div><span style={{ fontFamily: THEME.font, fontWeight: 600, color: ach != null ? orgPaceColor(ach) : COLORS.text }}>{fmt(m.actual)}</span><span style={{ color: COLORS.textFaint, fontSize: 11 }}> / {m.target ? fmt(m.target) : "—"}</span><div style={{ fontSize: 10.5, color: COLORS.textMuted }}>{ach != null ? orgPct(ach) : ""}</div></div>;
  }
  if (kind === "asp") {
    const ok = m.target ? m.actual >= m.target : null;
    return <div><span style={{ fontFamily: THEME.font, fontWeight: 600, color: ok == null ? COLORS.text : ok ? COLORS.teal : COLORS.coral }}>{fmt(m.actual, 1)}</span><span style={{ color: COLORS.textFaint, fontSize: 11 }}> / {m.target ? fmt(m.target, 1) : "—"}</span></div>;
  }
  return <div title={m.base ? "Based on " + fmt(m.base) + " merchants" : undefined}><span style={{ fontFamily: THEME.font, fontWeight: 600 }}>{orgPct(m.actual)}</span>{m.target != null ? <span style={{ color: COLORS.textFaint, fontSize: 11 }}> {kind === "ret" ? "≥" : "≤"} {orgPct(m.target, 0)}{m.implied ? "*" : ""}</span> : <span style={{ color: COLORS.textFaint, fontSize: 11 }}> no target</span>}{m.base ? <div style={{ fontSize: 10.5, color: COLORS.textMuted }}>n = {fmt(m.base)}</div> : null}</div>;
}
function OrgTable({ title, info, rows, mode, onRow }) {
  // mode "am": pickups, ASP, retention | "sales": new pickups, ASP, churn | "mix": all five (heads, team leaders)
  const cols = mode === "am" ? [["Pickups", "pickups", "cum"], ["ASP", "asp", "asp"], ["Retention", "retention", "ret"]]
    : mode === "sales" ? [["New pickups", "pickups", "cum"], ["ASP (fresh)", "asp", "asp"], ["Churn", "churn", "churn"]]
    : [["Pickups", "pickups", "cum"], ["ASP", "asp", "asp"], ["Fresh sales", "fresh", "cum"], ["Retention", "retention", "ret"], ["Churn", "churn", "churn"]];
  const th = { padding: "9px 12px", textAlign: "left", fontSize: 11.5, color: COLORS.textMuted, fontWeight: 600, whiteSpace: "nowrap" };
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center" }}>{title}{info && <InfoTip text={info} />}</div>
      <div style={{ ...UI.table, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.panelBorder}` }}><th style={th}>Name</th>{cols.map((c) => <th key={c[0]} style={th}>{c[0]}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} onClick={() => onRow && onRow(r)} style={{ borderTop: `1px solid ${COLORS.panelBorder}`, cursor: onRow ? "pointer" : "default" }}>
                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}><div style={{ fontWeight: 600, color: onRow ? COLORS.blue : COLORS.text }}>{r.name}</div>{r.sub && <div style={{ fontSize: 10.5, color: COLORS.textFaint }}>{r.sub}</div>}</td>
                {cols.map((c) => <td key={c[0]} style={{ padding: "9px 12px", whiteSpace: "nowrap" }}><OrgCell m={r.sc[c[1]]} kind={c[2]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mode !== "am" && <div style={{ fontSize: 10.5, color: COLORS.textFaint, marginTop: 6 }}>* implied target (weighted average of the targets underneath). Retention and churn are provisional until month end.</div>}
    </div>
  );
}

// ---------- navigation ----------
function BrandMark() {
  return <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 10, background: COLORS.brand, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Target size={17} strokeWidth={2} /></span>;
}
function LevelBar({ nav, current }) {
  const sc = nav.scope;
  const pills = [];
  if (sc.vp) pills.push(["vp", "VP"]);
  if (sc.heads.size) pills.push(["heads", "Heads"]);
  if (sc.tls.size) pills.push(["tl", "Team leaders"]);
  if (sc.sales.size) pills.push(["sales", "Sales"]);
  if (sc.ams.size) pills.push(["am", "AMs"]);
  return (
    <header className="tt-bar" style={{ marginBottom: 20 }}>
      <BrandMark />
      <span style={{ ...UI.label, marginRight: 4 }}>View level</span>
      <nav aria-label="View level" className="tt-bar" style={{ gap: 6 }}>
        {pills.map(([k, l]) => (
          <button key={k} onClick={() => nav.go(k)} aria-current={current === k ? "page" : undefined} style={UI.pill(current === k)}>{l}</button>
        ))}
        <InfoTip text="VP is the company view; Heads has one tab per team; team leaders show their AMs and sales. Only the levels your access allows are shown." />
      </nav>
      <div className="tt-bar-actions">
        {nav.openDaily && <button data-testid="daily-btn" onClick={() => nav.openDaily(current)} style={UI.btn}><CalendarDays size={15} strokeWidth={1.75} aria-hidden="true" />Daily analysis</button>}
        {nav.openSimulator && <button data-testid="sim-btn" onClick={() => nav.openSimulator()} style={UI.btnPrimary}><Calculator size={15} strokeWidth={1.75} aria-hidden="true" />Pricing simulator</button>}
        {AUTH_ENABLED && (<>
          <span data-testid="user-chip" style={{ fontSize: 12.5, color: COLORS.text }}><strong>{nav.session.name}</strong><span style={{ color: COLORS.textMuted }}> · {authRoleOf(nav.session)}</span></span>
          <InfoTip text="Your access level comes from your sign-in: VP sees everything; a head his own team; a team leader his AMs and sales; an AM or sales rep only their own view. With the data embedded in this file the screens are scoped but the data is still in the page: real enforcement needs the backend (docs/ACCESS.md)." />
          <button onClick={() => nav.signOut()} style={UI.btnSmall}><LogOut size={14} strokeWidth={1.75} aria-hidden="true" />Sign out</button></>)}
      </div>
    </header>
  );
}
function OrgCrumbs({ items }) {
  return <nav aria-label="Breadcrumb" style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>{items.map((it, i) => (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{i > 0 && <ChevronRight size={13} strokeWidth={1.75} color={COLORS.icon} aria-hidden="true" />}{it.onClick ? <span role="link" tabIndex={0} onClick={it.onClick} onKeyDown={(ev) => { if (ev.key === "Enter") it.onClick(); }} style={{ color: COLORS.navy, fontWeight: 500, cursor: "pointer" }}>{it.label}</span> : <strong style={{ color: COLORS.text, fontWeight: 600 }}>{it.label}</strong>}</span>))}</nav>;
}
function OrgShell({ nav, current, children }) {
  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, fontFamily: THEME.font, minHeight: "100%" }} className="tt-shell">
      <div className="tt-wrap">
        <LevelBar nav={nav} current={current} />
        {children}
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 8, lineHeight: 1.5 }}>Data as of {ORG.asOf} · targets from October_Targets_2026.xlsx. ASP = (shipping revenue + VAS revenue) ÷ delivered parcels. New merchants = merchants with a {NEW_RULE} and a sales owner (public.businesses); last month's window comes from public.businesses_monthly_snapshot.</div>
      </div>
    </div>
  );
}
function OrgSelect({ value, onChange, options }) {
  return <select value={value} aria-label="Select" onChange={(e) => onChange(e.target.value)} style={{ ...UI.input, fontSize: 16, fontWeight: 600, padding: "9px 14px", cursor: "pointer" }}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}

// ---------- Sales view: same layout as the AM view (achievement bar, score cards, headline stats, merchant detail table, Pickups / ASP toggle) ----------
function salesWorkingDays(from, to) { // working days (Fridays excluded) from..to, both included
  let n = 0;
  for (let t = new Date(from + "T00:00:00Z").getTime(), end = new Date(to + "T00:00:00Z").getTime(); t <= end; t += 864e5) if (new Date(t).getUTCDay() !== 5) n++;
  return Math.max(1, n);
}
function SalesScreen({ nav }) {
  const s = nav.allowedSales.find((x) => x.id === nav.salesId) || nav.allowedSales[0];
  const [fid, setFid] = useState(""); const [fname, setFname] = useState("");
  const [view, setView] = useState("pickups"); // "pickups" | "asp"
  const [sortKey, setSortKey] = useState("mtdAvg"); const [sortDir, setSortDir] = useState("desc");
  const [openId, setOpenId] = useState(null);
  const [pfOpen, setPfOpen] = useState(false);
  const [profM, setProfM] = useState(null); // merchant profile opened from the table (same as the AM view)
  const [cmp, setCmp] = useState("prev"); // pickups table: "prev" = against last month, "target" = against the rep's monthly target
  const sc = orgScore("sales", s), g = sc.g;
  const p = sc.pickups, a = sc.asp, ch = sc.churn;
  const el = DATA.wdElapsed, full = DATA.wdFull, rem = Math.max(0, full - el);
  const goal = p.target || 0, pk = p.actual, ofTarget = goal ? pk / goal : 0, col = ofTarget >= 1 ? COLORS.teal : COLORS.coral;
  const avgDaily = el ? pk / el : 0, run = pk + avgDaily * rem, runPct = goal ? run / goal : 0;
  const prevEnd = new Date(new Date(DATA.asOf.slice(0, 8) + "01T00:00:00Z").getTime() - 864e5).toISOString().slice(0, 10);
  const all = [
    ...s.newList.map((r) => ({ id: r[0], name: r[1], fp: r[2], mtd: r[3], dl: r[4], rev: r[5], prev: null, group: "New", status: "New" })),
    ...s.cohortList.map((r) => ({ id: r[0], name: r[1], fp: r[2], mtd: r[3], dl: r[4], rev: r[5], prev: r[6], group: "Last month's new", status: r[3] > 0 ? "Active" : "Churned" })),
  ].map((r) => {
    const mtdAvg = el ? r.mtd / el : 0, prevAvg = r.prev == null ? null : r.prev / salesWorkingDays(r.fp, prevEnd);
    const delta = prevAvg == null ? null : mtdAvg - prevAvg, gr = prevAvg > 0 ? (delta / prevAvg) * 100 : null;
    const standing = r.group === "New" ? "New" : r.mtd <= 0 ? "Churned" : gr == null ? "Stable" : gr >= GROWTH_THRESHOLD_PCT ? "Grower" : gr <= -GROWTH_THRESHOLD_PCT ? "Dropper" : "Stable";   // same ±15% rule as the AM view
    return { ...r, standing, mtdAvg, prevAvg, delta, gr, run: r.mtd + mtdAvg * rem, asp: r.dl ? r.rev / r.dl : null, ofGoal: goal ? r.mtd / goal : null, shareP: pk ? r.mtd / pk : null, runOfGoal: goal ? (r.mtd + mtdAvg * rem) / goal : null };
  });
  const t = s.tlId ? ORG_TL[s.tlId] : null, h = ORG_HEAD[s.headId];
  const match = (r) => (!fid || r.id.toLowerCase().includes(fid.toLowerCase())) && (!fname || String(r.name).toLowerCase().includes(fname.toLowerCase()));
  const shown = all.filter(match);
  // ASP view: the same gap-contribution logic as the AM view, against this sales rep's ASP target
  const T = s.t.asp, elig = all.filter((r) => r.dl > 0), D = elig.reduce((x, r) => x + r.dl, 0), REV = elig.reduce((x, r) => x + r.rev, 0), P = D ? REV / D : null;
  const leadById = useMemo(() => new Map(LEAD_ROWS.map((x) => [x.id, x])), []);
  const aspBase = all.map((r) => { const L = leadById.get(r.id); return { ...r, aspDlv: r.dl || 0, aspRev: r.rev || 0, aspVas: L ? L.aspVas || 0 : 0, pDlv: L ? L.pDlv || 0 : 0, pRev: L ? L.pRev || 0 : 0 }; });
  const aspC = aspContext(aspBase, s.name, T);
  const aspRows = aspBase.filter(match).map((r) => aspFields(r, aspC));
  const keyOf = (r, k) => (k === "name" ? r.name : k === "group" ? r.group : k === "status" ? r.status : k === "fp" ? r.fp : r[k]);
  const sorted = (list) => list.slice().sort((x, y) => { const u = keyOf(x, sortKey), v = keyOf(y, sortKey); if (u == null && v == null) return 0; if (u == null) return 1; if (v == null) return -1; return typeof u === "string" ? (sortDir === "asc" ? 1 : -1) * u.localeCompare(v) : (sortDir === "asc" ? 1 : -1) * (u - v); });
  const onSort = (k) => { if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } };
  const inp = { padding: "8px 12px", borderRadius: 12, border: `1px solid ${COLORS.panelBorder2}`, fontSize: 12.5, minWidth: 170, background: COLORS.panel };
  const mono = { padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, whiteSpace: "nowrap" };
  const sgn = (v, d) => (v == null ? "—" : (v >= 0 ? "+" : "−") + fmt(Math.abs(v), d));
  const dcol = (v) => (v == null ? COLORS.textFaint : v >= 0 ? COLORS.teal : COLORS.coral);
  const nameCell = (r, open) => (<td style={{ padding: "9px 14px", fontSize: 12.5, color: COLORS.text, maxWidth: 240 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{open ? <ChevronDown size={13} color={COLORS.textFaint} /> : <ChevronRight size={13} color={COLORS.textFaint} />}<button onClick={(e) => { e.stopPropagation(); openProfile(r); }} title="Open merchant profile" style={{ color: COLORS.navy, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left" }}>{r.name}</button></span><div style={{ fontSize: 10.5, color: COLORS.textFaint, marginLeft: 18 }}>{r.group} · first pickup {r.fp}</div></td>);
  const drill = (r, cols) => (
    <tr><td colSpan={cols} style={{ padding: 0, borderTop: `1px solid ${COLORS.panelBorder}` }}>
      <div style={{ padding: "14px 20px 16px 38px", background: COLORS.card, fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.7 }}>
        <div>Business ID: <strong style={{ color: COLORS.text, fontFamily: THEME.font }}>{r.id}</strong> · first pickup <strong style={{ color: COLORS.text }}>{r.fp}</strong> · {r.group === "New" ? <span style={{ color: COLORS.purple }}>New this month: no history to compare with yet.</span> : <span>acquired last month (owner as of the end-of-month snapshot).</span>}</div>
        <div>This month so far: <strong style={{ color: COLORS.text }}>{fmt(r.mtd)}</strong> pickups ({fmt(r.mtdAvg, 1)} per working day), <strong style={{ color: COLORS.text }}>{fmt(r.dl)}</strong> delivered parcels, revenue <strong style={{ color: COLORS.text }}>{fmt(r.rev)}</strong> EGP, ASP <strong style={{ color: COLORS.text }}>{r.asp == null ? "—" : fmt(r.asp, 2)}</strong>.</div>
        {r.prev != null && <div>Last month: <strong style={{ color: COLORS.text }}>{fmt(r.prev)}</strong> pickups in total, about {fmt(r.prevAvg, 1)} per working day from the first pickup. {r.status === "Churned" ? <span style={{ color: COLORS.coral }}>No pickup yet this month (provisional until month end).</span> : null}</div>}
      </div>
    </td></tr>);
  if (profM) return <MerchantProfileScreen merchant={profM} onBack={() => setProfM(null)} backLabel="Back to the sales view" />;
  const openProfile = (r) => { const L = leadById.get(r.id); setProfM(L ? { ...L, am: L.amName } : { id: r.id, name: r.name, am: s.name, seg: "", jd: r.fp }); };
  if (pfOpen) {
    const byId = new Map(LEAD_ROWS.map((r) => [r.id, r]));
    const pfm = all.map((r) => byId.get(r.id)).filter(Boolean);
    const pfAn = { ...mpSubsetAnalysis(pfm), synthetic: true };
    return <PortfolioScreen am={s.name} amData={{ target: goal, team: s.team, base: pfm.length, kind: "sales", skipped: all.length - pfm.length }} analysis={pfAn} onBack={() => setPfOpen(false)} />;
  }
  return (
    <OrgShell nav={nav} current="sales">
      <OrgCrumbs items={leadCrumbs(nav, s.headId, s.tlId, s.name)} />
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <OrgSelect value={s.id} onChange={(id) => { nav.go("sales", id); setOpenId(null); }} options={nav.allowedSales.map((x) => ({ value: x.id, label: x.name }))} />
        <button onClick={() => setPfOpen(true)} style={{ ...UI.btn, color: COLORS.navy }}>Portfolio overview<ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" /></button>
      </div>
      <div style={{ color: COLORS.textMuted, fontSize: 13, margin: "6px 0 18px" }}>sales · {s.team} · {all.length} merchants (new this month and last month's acquisitions) · data as of {DATA.asOf}</div>
      <AchievementBar pct={ofTarget * 100} detail={fmt(pk) + " of " + fmt(goal) + " new pickups"} />
      <TargetSections sc={sc} kind="sales" ent={s} over={{ actual: pk, target: goal, avgDaily, projected: run, projPct: runPct, needDaily: goal / full }} />
      <SectionLabel>Merchants &middot; growers, droppers, stable, churned, new (adds up to {all.length})</SectionLabel>
      <div className="tt-kpis" style={{ ...UI.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 12, marginBottom: 22 }}>
        {[["Growers", "Grower", COLORS.teal, "GR +15% or more", "Last month's new merchants whose average per working day this month is at least 15% above last month's."],
          ["Droppers", "Dropper", COLORS.coral, "GR -15% or less", "Last month's new merchants whose average per working day this month is at least 15% below last month's."],
          ["Stable", "Stable", COLORS.blue, "GR between -15% and +15%", "Last month's new merchants within 15% of last month's average per working day."],
          ["Churned", "Churned", COLORS.slate, "no pickups this month yet", "Last month's new merchants with no pickup yet this month. Provisional until month end."],
          ["New", "New", COLORS.purple, NEW_PHRASE, "Merchants with a " + NEW_RULE + " and who have this sales rep as owner."]].map(([l, k, c, sub, info]) => {
          const n = all.filter((r) => r.standing === k).length;
          return <StatCard key={k} info={info} label={l} value={n} sub={fmt((n / (all.length || 1)) * 100, 0) + "% of merchants · " + sub} accent={c} />;
        })}
      </div>
      {pk < goal && goal > 0 && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "14px 16px", borderRadius: 10, marginBottom: 22, background: COLORS.coralDim, border: `1px solid ${COLORS.coral}` }}>
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: THEME.font, color: COLORS.coral }}>{fmt((1 - ofTarget) * 100, 1)}%</span>
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>short of the monthly target ({fmt(goal - pk)} new pickups still needed) &mdash; currently at {fmt(ofTarget * 100, 1)}% of the monthly target.</span>
        </div>
      )}
      <SectionLabel>Merchant detail &middot; click a row for more</SectionLabel>
      <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "-6px 0 10px", flexWrap: "wrap" }}>
        {[["pickups", "Pickups"], ["asp", "ASP"]].map(([k, l]) => (
          <button key={k} onClick={() => { setView(k); setSortKey(k === "asp" ? "aspGapC" : "mtdAvg"); setSortDir(k === "asp" ? "asc" : "desc"); setOpenId(null); }} style={UI.pill(view === k)}>{l}</button>
        ))}
        <InfoTip text="Switch the table between pickups and ASP. ASP = (shipping revenue + VAS revenue) ÷ delivered parcels, Oct 1–4, against this sales rep's ASP target." />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: COLORS.textMuted }}>Search:</span>
        <input value={fid} onChange={(e) => setFid(e.target.value)} placeholder="Business ID" style={inp} />
        <input value={fname} onChange={(e) => setFname(e.target.value)} placeholder="Business name" style={inp} />
        {(fid || fname) && <button onClick={() => { setFid(""); setFname(""); }} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 12, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, cursor: "pointer" }}>Clear</button>}
      </div>
      {view === "pickups" && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "0 0 10px" }}>
          <span style={{ fontSize: 11.5, color: COLORS.textFaint, marginRight: 2 }}>Compare with</span>
          {[["prev", "Last month"], ["target", "Merchants contribution"]].map(([k, l]) => (
            <button key={k} onClick={() => { setCmp(k); setSortKey(k === "target" ? "mtd" : "mtdAvg"); setSortDir("desc"); setOpenId(null); }} style={UI.pill(cmp === k)}>{l}</button>
          ))}
          <InfoTip text="Last month: this month's average per working day against last month's, with GR % and run rate. Merchants contribution: how much of this sales rep's monthly new-pickups target each merchant brings. Sales merchants have no weight of their own, so the table shows each merchant's share of the rep's target." />
        </div>
      )}
      {view === "pickups" ? (
        <div style={{ ...UI.surface, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ maxHeight: 520, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ position: "sticky", top: 0, background: COLORS.card, zIndex: 1 }}>
                <Th onClick={() => onSort("name")} active={sortKey === "name"} dir={sortDir}>Merchant</Th>
                {cmp === "target" ? (<>
                <Th onClick={() => onSort("mtd")} active={sortKey === "mtd"} dir={sortDir} align="right">MTD total volume</Th>
                <Th onClick={() => onSort("ofGoal")} active={sortKey === "ofGoal"} dir={sortDir} align="right">% of rep target</Th>
                <Th onClick={() => onSort("shareP")} active={sortKey === "shareP"} dir={sortDir} align="right">Share of rep pickups</Th>
                <Th onClick={() => onSort("run")} active={sortKey === "run"} dir={sortDir} align="right">Run rate</Th>
                <Th onClick={() => onSort("runOfGoal")} active={sortKey === "runOfGoal"} dir={sortDir} align="right">Run rate % of target</Th>
                </>) : (<>
                <Th onClick={() => onSort("mtdAvg")} active={sortKey === "mtdAvg"} dir={sortDir} align="right">MTD avg daily</Th>
                <Th onClick={() => onSort("prevAvg")} active={sortKey === "prevAvg"} dir={sortDir} align="right">Last month avg daily</Th>
                <Th onClick={() => onSort("delta")} active={sortKey === "delta"} dir={sortDir} align="right">Delta</Th>
                <Th onClick={() => onSort("gr")} active={sortKey === "gr"} dir={sortDir} align="right">GR %</Th>
                <Th onClick={() => onSort("mtd")} active={sortKey === "mtd"} dir={sortDir} align="right">MTD total volume</Th>
                <Th onClick={() => onSort("prev")} active={sortKey === "prev"} dir={sortDir} align="right">Last month total volume</Th>
                <Th onClick={() => onSort("run")} active={sortKey === "run"} dir={sortDir} align="right">Run rate</Th>
                </>)}
                <Th onClick={() => onSort("status")} active={sortKey === "status"} dir={sortDir} align="right">Status</Th>
              </tr></thead>
              <tbody>
                {shown.length === 0 ? <tr><td colSpan={cmp === "target" ? 7 : 9} style={{ padding: 16, textAlign: "center", color: COLORS.textFaint }}>No merchants</td></tr> : sorted(shown).map((r) => (
                  <React.Fragment key={r.id}>
                    <tr onClick={() => setOpenId(openId === r.id ? null : r.id)} style={{ borderTop: `1px solid ${COLORS.panelBorder}`, cursor: "pointer", background: openId === r.id ? THEME.color.navyTint : "transparent" }}>
                      {nameCell(r, openId === r.id)}
                      {cmp === "target" ? (<>
                      <td style={mono}>{fmt(r.mtd)}</td>
                      <td style={{ ...mono, color: COLORS.textMuted }}>{r.ofGoal == null ? "—" : fmt(r.ofGoal * 100, 2) + "%"}</td>
                      <td style={{ ...mono, color: COLORS.textMuted }}>{r.shareP == null ? "—" : fmt(r.shareP * 100, 1) + "%"}</td>
                      <td style={{ ...mono, color: COLORS.textMuted }}>{fmt(r.run, 0)}</td>
                      <td style={{ ...mono, color: COLORS.textMuted }}>{r.runOfGoal == null ? "—" : fmt(r.runOfGoal * 100, 2) + "%"}</td>
                      </>) : (<>
                      <td style={mono}>{fmt(r.mtdAvg, 1)}</td>
                      <td style={{ ...mono, color: COLORS.textMuted }}>{r.prevAvg == null ? "—" : fmt(r.prevAvg, 1)}</td>
                      <td style={{ ...mono, color: dcol(r.delta) }}>{sgn(r.delta, 1)}</td>
                      <td style={{ ...mono, color: dcol(r.gr) }}>{r.gr == null ? "—" : sgn(r.gr, 1) + "%"}</td>
                      <td style={{ ...mono, color: COLORS.textMuted }}>{fmt(r.mtd)}</td>
                      <td style={{ ...mono, color: COLORS.textMuted }}>{r.prev == null ? "—" : fmt(r.prev)}</td>
                      <td style={{ ...mono, color: COLORS.textMuted }}>{fmt(r.run, 0)}</td>
                      </>)}
                      <td style={{ padding: "9px 14px", textAlign: "right" }}><CategoryBadge category={r.status} /></td>
                    </tr>
                    {openId === r.id && drill(r, cmp === "target" ? 7 : 9)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <AspMerchantTable rows={sorted(aspRows)} sortKey={sortKey} sortDir={sortDir} onSort={onSort} amName={s.name} target={T} onOpenMerchant={openProfile} />
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: COLORS.textFaint, padding: "10px 4px", lineHeight: 1.5 }}>
        <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>New merchants have no last-month baseline, so Delta and GR % show &mdash; for them. For last month's acquisitions, "Last month" is their pickups in last month divided by the working days from their first pickup to the month end, compared with this month's pickups per working day so far. Churned = no pickup yet this month (provisional). Run rate = MTD pickups + MTD avg daily &times; the remaining working days.</span>
      </div>
    </OrgShell>
  );
}

// ASP and retention for one AM, shown in the main Target Tracker next to the pickups target
function AmScoreCards({ amName, an }) {
  const a = ORG_AM[amName];
  if (!a) return null;
  const sc = orgScore("am", a);
  // the AM screen has an adjustable working-days input, so its pickups numbers come from the screen's own analysis
  const over = { actual: an.totalActualMtdPickups, target: an.thresholdDailyTarget, avgDaily: an.totalActualMtdDaily, projected: an.estimatedTotal, projPct: (an.estimatedPct || 0) / 100, needDaily: an.avgDailyTarget };
  return <TargetSections sc={sc} kind="am" over={over} ent={a} />;
}

// ---------- Merchant detail table, ASP view: "Merchant ASP Gap Contribution Analysis" ----------
// Eligible merchant = at least one delivered parcel in the period. Portfolio ASP = SUM(revenue) / SUM(delivered), never a simple average.
//   Parcel Share = merchant parcels / portfolio parcels
//   ASP Gap Contribution = Parcel Share x (Merchant ASP - Target ASP)        (the column adds up to Portfolio ASP - Target ASP)
//   Revenue Gap to Target = (Target ASP - Merchant ASP) x merchant parcels   (positive = extra revenue needed at the same volume)
//   Merchant Group = parcel share >= / < the MEDIAN parcel share of eligible merchants  x  ASP >= / < target
function aspContext(merchants, amName, target) {
  const am = ORG_AM[amName];
  const dl = (x) => x.aspDlv || 0, rv = (x) => x.aspRev || 0;
  const vasRev = (x) => (x.aspVasRev != null ? x.aspVasRev : x.aspVas) || 0;           // raw VAS revenue (rows may be raw or already enriched)
  const elig = merchants.filter((x) => dl(x) > 0);
  const D = elig.reduce((s, x) => s + dl(x), 0), REV = elig.reduce((s, x) => s + rv(x), 0), VAS = elig.reduce((s, x) => s + vasRev(x), 0);
  const shares = elig.map((x) => dl(x) / D).sort((p, q) => p - q);
  const h = Math.floor(shares.length / 2);
  const median = shares.length ? (shares.length % 2 ? shares[h] : (shares[h - 1] + shares[h]) / 2) : null;
  const vasAsps = elig.map((x) => vasRev(x) / dl(x)).sort((p, q) => p - q);
  return {
    target: target !== undefined ? target : am ? am.t.asp : null, D, REV, asp: D > 0 ? REV / D : null, median, nElig: elig.length, nAll: merchants.length,
    vasAvg: D > 0 ? VAS / D : null, shipAvg: D > 0 ? (REV - VAS) / D : null, vasP75: vasAsps.length ? vasAsps[Math.ceil(0.75 * vasAsps.length) - 1] : null,
  };
}
function aspFields(m, c) {
  const rev = m.aspRev || 0, vas = m.aspVas || 0, dl = m.aspDlv || 0, pr = m.pRev || 0, pdl = m.pDlv || 0;
  const elig = dl > 0, T = c ? c.target : null;
  const aspTotal = elig ? rev / dl : null, aspPrev = pdl > 0 ? pr / pdl : null;
  const share = elig && c && c.D > 0 ? dl / c.D : null;
  const ok = aspTotal != null && T != null;
  return {
    ...m, aspTotal, aspShip: elig ? (rev - vas) / dl : null, aspVas: elig ? vas / dl : null, aspVasRev: vas, aspPrev,
    aspChg: aspTotal != null && aspPrev ? ((aspTotal - aspPrev) / aspPrev) * 100 : null,
    aspShare: share,
    aspGapC: ok && share != null ? share * (aspTotal - T) : null,
    aspDev: ok ? aspTotal - T : null,
    aspRevGap: ok ? (T - aspTotal) * dl : null,
    aspGroup: ok && share != null && c.median != null ? (share >= c.median ? "High Volume" : "Low Volume") + ", " + (aspTotal >= T ? "High ASP" : "Low ASP") : null,
    aspContrib: c && c.D > 0 && elig ? rev / c.D : null,                                   // points of the portfolio ASP this merchant supplies
    aspNeed: ok ? (aspTotal < T ? (T / aspTotal - 1) * 100 : 0) : null,                      // rise of its own ASP needed to hit the target
  };
}
const ASP_GROUP_COLOR = { "High Volume, Low ASP": [COLORS.coralDim, COLORS.coral], "Low Volume, Low ASP": [COLORS.amberDim, COLORS.amber], "High Volume, High ASP": [COLORS.tealDim, COLORS.teal], "Low Volume, High ASP": [THEME.color.navyTint, COLORS.blue] };
function aspAnalysis(rows, c) {
  const T = c.target;
  const el = rows.filter((r) => r.aspTotal != null && T != null);
  const byGap = el.slice().sort((a, b) => a.aspGapC - b.aspGapC);
  const grp = (g) => el.filter((r) => r.aspGroup === g);
  const below = el.filter((r) => r.aspTotal < T);
  return {
    el, neg: byGap.filter((r) => r.aspGapC < 0).slice(0, 5), pos: byGap.slice().reverse().filter((r) => r.aspGapC > 0).slice(0, 5),
    G: { hvla: grp("High Volume, Low ASP"), lvla: grp("Low Volume, Low ASP"), hvha: grp("High Volume, High ASP"), lvha: grp("Low Volume, High ASP") },
    below, revGapBelow: below.reduce((s, r) => s + Math.max(0, r.aspRevGap), 0),
    sumGap: el.reduce((s, r) => s + r.aspGapC, 0), sumRev: el.reduce((s, r) => s + (r.aspRev || 0), 0), sumDl: el.reduce((s, r) => s + (r.aspDlv || 0), 0),
  };
}
const aspSgn = (v, d) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v), d);
function aspGapHover(m, c) {
  if (m.aspGapC == null) return undefined;
  if (m.aspGapC < 0) return "Pulls the portfolio ASP " + fmt(Math.abs(m.aspGapC), 3) + " EGP per parcel below the target. Every +1 EGP on its ASP adds only " + fmt(m.aspShare, 3) + " to the portfolio ASP. Click the row for ideas.";
  return "Lifts the portfolio ASP by " + fmt(m.aspGapC, 3) + " EGP per parcel. Nothing to fix.";
}
function AspBox({ title, children, open = true }) {
  return (
    <details open={open} style={{ ...UI.surface, padding: "9px 14px", marginBottom: 12, fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 12.5, color: COLORS.text }}>{title}</summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}
function AspTop5({ title, list, info }) {
  return (
    <div style={{ ...UI.surface, padding: "12px 14px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 500, color: COLORS.textMuted, marginBottom: 6, display: "flex", alignItems: "center" }}>{title}<InfoTip text={info} /></div>
      {list.length === 0 ? <div style={{ fontSize: 12, color: COLORS.textFaint }}>None</div> : list.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "2px 0" }}>
          <span style={{ color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
          <span style={{ fontFamily: THEME.font, color: r.aspGapC < 0 ? COLORS.coral : COLORS.teal, whiteSpace: "nowrap" }}>{aspSgn(r.aspGapC, 2)}</span>
        </div>
      ))}
    </div>
  );
}
function AspSummary({ rows, c, an }) {
  const T = c.target, gap = c.asp - T;
  const q = [["High Volume, Low ASP", an.G.hvla.length], ["Low Volume, Low ASP", an.G.lvla.length], ["High Volume, High ASP", an.G.hvha.length], ["Low Volume, High ASP", an.G.lvha.length]];
  return (
    <div>
      <div className="tt-kpis" style={{ ...UI.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 12, marginBottom: 12 }}>
        <OrgCard label="Total revenues" info="Total delivery revenue of the merchants with at least one delivered parcel, Oct 1–4 (EGP)." value={fmt(c.REV)} sub="EGP" />
        <OrgCard label="Delivered parcels" info="Delivered parcels of the eligible merchants, Oct 1–4." value={fmt(c.D)} sub={c.nElig + " eligible of " + c.nAll + " merchants"} />
        <OrgCard label="Portfolio ASP" info="Total revenues ÷ total delivered parcels. Never the simple average of the merchants' ASPs." value={fmt(c.asp, 2)} accent={gap >= 0 ? COLORS.teal : COLORS.coral} sub={"target " + fmt(T, 2)} />
        <OrgCard label="Net ASP gap" info="Portfolio ASP minus target ASP, in EGP per parcel. It is the total of the ASP Gap Contribution column: each merchant is responsible for a part of it." value={aspSgn(gap, 2)} accent={gap >= 0 ? COLORS.teal : COLORS.coral} sub={gap >= 0 ? "at or above target" : "portfolio is " + fmt(Math.abs(gap), 2) + " EGP per parcel short"} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {q.map(([g, n]) => (<span key={g} style={{ background: ASP_GROUP_COLOR[g][0], color: ASP_GROUP_COLOR[g][1], borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{g}: {n}</span>))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 12, marginBottom: 12 }}>
        <AspTop5 title="Five merchants causing most of the gap" list={an.neg} info="The most negative ASP Gap Contribution (EGP per parcel): each number is how much of the portfolio gap that merchant causes. Raising its ASP to the target would lift the portfolio ASP by that amount." />
        <AspTop5 title="Five merchants lifting the portfolio most" list={an.pos} info="The most positive ASP Gap Contribution (EGP per parcel): these merchants push the portfolio ASP above the target. Nothing to fix here." />
      </div>
    </div>
  );
}
function AspInterpretation({ an, c }) {
  const T = c.target;
  const nm = (r) => r.name + " (" + aspSgn(r.aspGapC, 2) + " EGP/parcel, ASP " + fmt(r.aspTotal, 1) + ")";
  const list = (arr, f) => (arr.length ? arr.slice(0, 3).map(f).join("; ") : "none");
  const hvla = an.G.hvla.slice().sort((a, b) => a.aspGapC - b.aspGapC);
  const hvha = an.G.hvha.slice().sort((a, b) => b.aspGapC - a.aspGapC);
  const byRev = an.below.slice().sort((a, b) => b.aspRevGap - a.aspRevGap);
  const top5Rev = byRev.slice(0, 5).reduce((s, r) => s + Math.max(0, r.aspRevGap), 0);
  const li = (head, body) => (<div style={{ padding: "3px 0" }}><strong style={{ color: COLORS.text }}>{head}:</strong> {body}</div>);
  return (
    <AspBox title="Business interpretation">
      {li("Largest negative contribution to portfolio ASP", list(an.neg, nm))}
      {li("High Volume, Low ASP: investigate first", list(hvla, nm))}
      {li("High Volume, High ASP: supporting the portfolio", list(hvha, (r) => r.name + " (" + aspSgn(r.aspGapC, 2) + " EGP/parcel, ASP " + fmt(r.aspTotal, 1) + ")"))}
      {li("Largest Revenue Gap to Target", list(byRev, (r) => r.name + " (" + fmt(r.aspRevGap) + " EGP)"))}
      {li("Size of the opportunity", fmt(an.revGapBelow) + " EGP of benchmark revenue gap across " + an.below.length + " merchants below the target; the five largest hold " + (an.revGapBelow ? fmt((top5Rev / an.revGapBelow) * 100, 0) : 0) + "% of it. It is a benchmark, not a forecast: not every merchant can realistically reach " + fmt(T, 1) + " immediately.")}
      <div style={{ marginTop: 6 }}>A merchant's ASP performance (Deviation) is not the same as its weight in the portfolio (Gap Contribution): a small merchant far below target moves the portfolio little, a large one slightly below can move it a lot. A low ASP does not necessarily mean poor performance: product mix, delivery zones, service mix and commercial agreements can explain it.</div>
    </AspBox>
  );
}
// Scenario maths (portfolio = revenue REV on D delivered parcels, merchant = revenue r on d parcels, share s = d / D):
//   merchant ASP +x EGP per parcel      -> portfolio ASP + x * s              (everyone else unchanged)
//   merchant parcels + q%, same ASP a   -> portfolio ASP = (REV + a*q*d) / (D + q*d)
//   merchant VAS ASP up to a benchmark  -> same as an ASP increase of (benchmark - its VAS ASP)
function aspScenario(m, c, kind, v) {
  const s = m.aspShare, a = m.aspTotal, P = c.asp, T = c.target, G = P - T;
  let P2, label, mAsp = a;
  if (kind === "asp") { P2 = P + v * s; mAsp = a + v; label = "ASP +" + fmt(v, 2) + " EGP per parcel (" + fmt(a, 2) + " → " + fmt(a + v, 2) + ")"; }
  else if (kind === "pct") { const x = a * v; P2 = P + x * s; mAsp = a + x; label = "ASP +" + fmt(v * 100, 0) + "% (" + fmt(a, 2) + " → " + fmt(a + x, 2) + ")"; }
  else if (kind === "vol") { const dl = v * m.aspDlv; P2 = (c.REV + a * dl) / (c.D + dl); label = "+" + fmt(v * 100, 0) + "% more parcels at the same ASP"; }
  else { P2 = P + v.x * s; mAsp = a + v.x; label = v.label; }
  const dP = P2 - P;
  const effect = dP === 0 ? "no change" : dP > 0 ? (G < 0 ? "closes " + fmt((dP / -G) * 100, 1) + "% of the gap" : "adds " + aspSgn(dP, 3) + " to the portfolio ASP") : (G < 0 ? "widens the gap by " + fmt((-dP / -G) * 100, 1) + "%" : "lowers the portfolio ASP by " + fmt(-dP, 3));
  return { label, P: P2, gap: P2 - T, dP, effect };
}
function AspDrilldown({ m, c }) {
  const dash = (v, d) => (v == null ? "—" : fmt(v, d));
  const pdl = m.pDlv || 0, T = c ? c.target : null;
  const ok = c && m.aspTotal != null && m.aspShare != null && T != null && c.asp != null;
  const mono = { fontFamily: THEME.font };
  const grid = { display: "grid", gridTemplateColumns: "minmax(250px, 2.2fr) 1fr 1fr 1.6fr", gap: 8, fontSize: 12.5, padding: "3px 0", alignItems: "baseline" };
  const head = (t) => <div style={{ margin: "14px 0 4px", fontWeight: 700, fontSize: 12.5, color: COLORS.text }}>{t}</div>;
  const table = (rows) => (
    <div>
      <div style={{ ...grid, fontSize: 11.5, fontWeight: 500, color: COLORS.textMuted }}><span /><span>Portfolio ASP</span><span>Gap to target</span><span>Effect</span></div>
      <div style={{ ...grid, color: COLORS.textMuted }}><span>Today</span><span style={mono}>{fmt(c.asp, 2)}</span><span style={mono}>{aspSgn(c.asp - T, 2)}</span><span /></div>
      {rows.map((r, i) => (<div key={i} style={grid}><span style={{ color: COLORS.text }}>{r.label}</span><span style={mono}>{fmt(r.P, 3)}</span><span style={mono}>{aspSgn(r.gap, 3)}</span><span style={{ color: r.dP > 0 ? COLORS.teal : r.dP < 0 ? COLORS.coral : COLORS.textMuted, fontWeight: 600 }}>{r.effect}</span></div>))}
    </div>
  );
  let body = null;
  if (ok) {
    const s = m.aspShare, a = m.aspTotal, P = c.asp, G = P - T, gc = m.aspGapC;
    const upRows = [0.5, 1, 2, 5].map((x) => aspScenario(m, c, "asp", x)).concat([aspScenario(m, c, "pct", 0.1)]);
    const volRows = [0.1, 0.25, 0.5].map((q) => aspScenario(m, c, "vol", q));
    const vasM = m.aspVas || 0, shM = m.aspShip || 0;
    const vasRows = [];
    if (c.vasAvg != null && vasM < c.vasAvg) vasRows.push(aspScenario(m, c, "x", { x: c.vasAvg - vasM, label: "VAS ASP up to the portfolio average (" + fmt(vasM, 2) + " → " + fmt(c.vasAvg, 2) + ")" }));
    if (c.vasP75 != null && vasM < c.vasP75) vasRows.push(aspScenario(m, c, "x", { x: c.vasP75 - vasM, label: "VAS ASP up to the top quarter of merchants (" + fmt(vasM, 2) + " → " + fmt(c.vasP75, 2) + ")" }));
    const levers = [{ t: "raising its ASP by 10%", dP: upRows[4].dP }].concat(vasRows.length ? [{ t: "lifting its VAS ASP to the portfolio average", dP: vasRows[0].dP }] : []).concat(volRows[1].dP > 0 ? [{ t: "growing its parcels by 25%", dP: volRows[1].dP }] : []);
    const best = levers.slice().sort((x, y) => y.dP - x.dP)[0];
    body = (
      <div>
        <div style={{ padding: "8px 12px", background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 8, color: COLORS.text, marginBottom: 4 }}>
          <strong>In simple words.</strong> The portfolio must average <strong>{fmt(T, 2)}</strong> EGP per parcel and today averages <strong>{fmt(P, 2)}</strong>, so {fmt(Math.abs(G), 2)} is {G < 0 ? "missing" : "extra"}. {m.name} delivers {fmt(s * 100, 1)}% of the parcels and averages {fmt(a, 2)} per parcel, so it {gc < 0 ? "pulls the portfolio average down by " + fmt(Math.abs(gc), 3) : "lifts the portfolio average by " + fmt(gc, 3)}: that is the number in the gap column. A small merchant moves the portfolio only a little: every +1 EGP per parcel it earns lifts the portfolio average by just {fmt(s, 3)}. So the useful question is not "can it reach {fmt(T, 0)}?" but "which realistic step helps most?". The steps below are arithmetic, not predictions.
        </div>
        {head("If this merchant's ASP goes up")}
        {table(upRows)}
        {head("If this merchant sends more parcels (same ASP)")}
        {table(volRows)}
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 2 }}>{a < P ? "Its ASP is below the portfolio average, so more parcels at this ASP make the portfolio average worse: fix the price or the VAS first, push volume later." : "Its ASP is above the portfolio average, so more parcels at this ASP help the portfolio average."}</div>
        {head("Where does its ASP come from: shipping or VAS?")}
        <div style={{ ...grid, fontSize: 11.5, fontWeight: 500, color: COLORS.textMuted }}><span /><span>This merchant</span><span>Portfolio</span><span>Difference</span></div>
        {[["Shipping ASP", shM, c.shipAvg], ["VAS ASP", vasM, c.vasAvg]].map(([l, x, y]) => (<div key={l} style={grid}><span style={{ color: COLORS.text }}>{l}</span><span style={mono}>{fmt(x, 2)}</span><span style={mono}>{fmt(y, 2)}</span><span style={{ ...mono, color: x - y < 0 ? COLORS.coral : COLORS.teal }}>{aspSgn(x - y, 2)}</span></div>))}
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, margin: "2px 0 4px" }}>{vasM === 0 ? "This merchant earns no VAS revenue at all." : vasM < c.vasAvg ? "VAS revenue is below the portfolio average." : "VAS revenue is at or above the portfolio average."} {shM < c.shipAvg ? "Shipping revenue per parcel is also below the portfolio average (price plan or delivery zones)." : ""}</div>
        {vasRows.length > 0 && table(vasRows)}
        {head("Suggested focus")}
        <div style={{ color: COLORS.text }}>{best && best.dP > 0 ? "The biggest of these levers is " + best.t + ": it would lift the portfolio ASP by " + aspSgn(best.dP, 3) + (G < 0 ? " and close " + fmt((best.dP / -G) * 100, 1) + "% of the gap." : ".") : "None of these steps lifts the portfolio ASP."} {gc >= 0 ? "This merchant already lifts the portfolio, so protect its ASP." : ""}</div>
      </div>
    );
  }
  return (
    <div style={{ padding: "14px 20px 16px 38px", background: COLORS.card, color: COLORS.textMuted, lineHeight: 1.55 }}>
      <div style={{ marginBottom: 8, fontSize: 12.5 }}>Business ID: <strong style={{ color: COLORS.text, ...mono }}>{m.id}</strong></div>
      {body}
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 12.5, color: COLORS.text }}>Numbers behind it (Oct 1–4 vs Sep 1–4)</summary>
        <div style={{ marginTop: 6 }}>
          {[["Delivered parcels", fmt(m.aspDlv || 0), fmt(pdl)], ["Delivery revenue (EGP)", fmt(m.aspRev || 0), fmt(m.pRev || 0)], ["   of which shipping", fmt((m.aspRev || 0) - (m.aspVasRev || 0)), fmt((m.pRev || 0) - (m.pVas || 0))], ["   of which VAS", fmt(m.aspVasRev || 0), fmt(m.pVas || 0)], ["Merchant ASP", dash(m.aspTotal, 2), dash(m.aspPrev, 2)], ["Shipping ASP", dash(m.aspShip, 2), pdl > 0 ? fmt(((m.pRev || 0) - (m.pVas || 0)) / pdl, 2) : "—"], ["VAS ASP", dash(m.aspVas, 2), pdl > 0 ? fmt((m.pVas || 0) / pdl, 2) : "—"]].map(([l, x, y]) => (
            <div key={l} style={{ display: "grid", gridTemplateColumns: "210px 120px 130px", gap: 8, fontSize: 12.5, padding: "2px 0" }}><span>{l}</span><strong style={mono}>{x}</strong><span style={{ ...mono, color: COLORS.textFaint }}>{y}</span></div>
          ))}
        </div>
      </details>
    </div>
  );
}
function AspHowTo({ rows, c }) {
  const ex = rows.find((r) => r.aspTotal != null && r.aspGapC != null && r.aspGapC < 0) || rows.find((r) => r.aspTotal != null && r.aspGapC != null);
  const T = c.target, gapP = c.asp - T;
  const line = (term, text) => (<div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, padding: "3px 0" }}><strong style={{ color: COLORS.text, fontWeight: 600 }}>{term}</strong><span>{text}</span></div>);
  return (
    <AspBox title="How to read this table">
      <div style={{ padding: "7px 10px", marginBottom: 6, background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 8, color: COLORS.text }}>
        <strong>The gap column in simple words.</strong> Think of the whole portfolio as one team that must average <strong>{fmt(T, 2)}</strong> EGP per parcel. Today the team averages <strong>{fmt(c.asp, 2)}</strong>, so {fmt(Math.abs(gapP), 2)} EGP per parcel is {gapP < 0 ? "missing" : "extra"}. Every merchant is a team member: the more parcels it delivers, the more it counts. <strong>The number in "ASP Gap Contribution" is how much that member pulls the team average down (negative) or up (positive).</strong> It is not a to-do of "reach the target": a small merchant with a low ASP pulls the team down a little, a big merchant a lot.
      </div>
      {line("Merchant ASP", "(Shipping revenue + VAS revenue) ÷ delivered parcels (Oct 1–4). Only merchants with at least one delivered parcel are in the table.")}
      {line("Parcel Share", "Merchant parcels ÷ portfolio parcels (" + fmt(c.D) + ").")}
      {line("ASP Gap Contribution", "Parcel Share × (Merchant ASP − Target ASP), in EGP per parcel. The column adds up to the portfolio gap (" + aspSgn(gapP, 2) + ").")}
      {line("Revenue Gap to Target", "(Target ASP − Merchant ASP) × merchant parcels, in EGP. Positive = extra revenue needed at the same volume; negative = already above the benchmark. A benchmark, not a forecast.")}
      {line("Merchant Group", "Volume: Parcel Share at or above the median of the eligible merchants (" + (c.median == null ? "—" : fmt(c.median * 100, 2) + "%, about " + fmt(c.median * c.D) + " parcels") + ") = High Volume, otherwise Low. ASP: at or above the target = High ASP, otherwise Low.")}
      {line("Change vs Sep 1–4", "Compares the merchant's ASP with the same days of September.")}
      {ex && T != null && (
        <div style={{ marginTop: 6, padding: "7px 10px", background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 8, color: COLORS.text }}>
          Example · <strong>{ex.name}</strong>: ASP = {fmt(ex.aspRev)} ÷ {fmt(ex.aspDlv)} = <strong>{fmt(ex.aspTotal, 2)}</strong>; share = {fmt(ex.aspDlv)} ÷ {fmt(c.D)} = <strong>{fmt(ex.aspShare * 100, 2)}%</strong>; gap contribution = {fmt(ex.aspShare * 100, 2)}% × ({fmt(ex.aspTotal, 2)} − {fmt(T, 2)}) = <strong>{aspSgn(ex.aspGapC, 3)}</strong>; revenue gap = ({fmt(T, 2)} − {fmt(ex.aspTotal, 2)}) × {fmt(ex.aspDlv)} = <strong>{aspSgn(ex.aspRevGap, 0)}</strong> EGP; group: <strong>{ex.aspGroup}</strong>.
        </div>
      )}
    </AspBox>
  );
}
function AspMerchantTable({ rows, sortKey, sortDir, onSort, amName, target, onOpenMerchant }) {
  const c = aspContext(rows, amName, target);
  if (c.target == null || c.D <= 0) return <MPBanner text="No ASP target or no delivered parcels yet, so the ASP analysis cannot be shown." />;
  const an = aspAnalysis(rows, c);
  const el = rows.filter((r) => r.aspTotal != null);
  const td = { padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, whiteSpace: "nowrap" };
  const colored = (v) => (v == null ? COLORS.textFaint : v < 0 ? COLORS.coral : COLORS.teal);
  const sub = (t) => <div style={{ fontSize: 9.5, fontWeight: 400, textTransform: "none", letterSpacing: 0, color: COLORS.textFaint }}>{t}</div>;
  const csvCols = [["name", "Merchant"], ["aspDlv", "Parcels"], ["aspTotal", "Merchant ASP"], ["aspShare", "Parcel Share"], ["aspGapC", "ASP Gap Contribution"], ["aspRevGap", "Revenue Gap to Target"], ["aspGroup", "Merchant Group"]].map(([key, label]) => ({ key, label }));
  return (
    <div>
      <AspSummary rows={rows} c={c} an={an} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <button onClick={() => downloadCsvMP("asp_gap_contribution_" + String(amName).replace(/\s+/g, "_") + ".csv", csvCols, el)} style={{ fontSize: 11.5, padding: "6px 12px", borderRadius: 12, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, color: COLORS.blue, cursor: "pointer" }}>Download table (CSV)</button>
      </div>
      <div style={{ ...UI.surface, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ maxHeight: 560, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: COLORS.card, zIndex: 1 }}>
                <Th onClick={() => onSort("name")} active={sortKey === "name"} dir={sortDir}>Merchant</Th>
                <Th onClick={() => onSort("aspDlv")} active={sortKey === "aspDlv"} dir={sortDir} align="right">Parcels{sub("delivered")}</Th>
                <Th onClick={() => onSort("aspTotal")} active={sortKey === "aspTotal"} dir={sortDir} align="right">Merchant ASP{sub("EGP / parcel")}</Th>
                <Th onClick={() => onSort("aspShare")} active={sortKey === "aspShare"} dir={sortDir} align="right">Parcel Share{sub("% of portfolio")}</Th>
                <Th onClick={() => onSort("aspGapC")} active={sortKey === "aspGapC"} dir={sortDir} align="right">ASP Gap Contribution{sub("gap it causes, EGP / parcel")}</Th>
                <Th onClick={() => onSort("aspRevGap")} active={sortKey === "aspRevGap"} dir={sortDir} align="right">Revenue Gap to Target{sub("EGP")}</Th>
                <Th onClick={() => onSort("aspGroup")} active={sortKey === "aspGroup"} dir={sortDir}>Merchant Group</Th>
                <Th onClick={() => onSort("aspChg")} active={sortKey === "aspChg"} dir={sortDir} align="right">Change vs Sep 1–4{sub("supplementary")}</Th>
              </tr>
            </thead>
            <tbody>
              {el.map((m) => (
                <React.Fragment key={m.id}>
                  <tr style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                    <td style={{ padding: "9px 14px", fontSize: 12.5, color: COLORS.text, maxWidth: 220 }}>{onOpenMerchant ? <button onClick={() => onOpenMerchant(m)} title="Open merchant profile" style={{ color: COLORS.navy, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left" }}>{m.name}</button> : m.name}</td>
                    <td style={{ ...td, color: COLORS.textMuted }}>{fmt(m.aspDlv)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmt(m.aspTotal, 2)}</td>
                    <td style={td}>{m.aspShare == null ? "—" : fmt(m.aspShare * 100, 2) + "%"}</td>
                    <td title={aspGapHover(m, c)} style={{ ...td, color: colored(m.aspGapC) }}>{m.aspGapC == null ? "—" : aspSgn(m.aspGapC, 2)}</td>
                    <td style={{ ...td, color: m.aspRevGap == null ? COLORS.textFaint : m.aspRevGap > 0 ? COLORS.coral : COLORS.teal }}>{m.aspRevGap == null ? "—" : aspSgn(m.aspRevGap, 0)}</td>
                    <td style={{ padding: "9px 14px", whiteSpace: "nowrap" }}>{m.aspGroup ? <span style={{ background: ASP_GROUP_COLOR[m.aspGroup][0], color: ASP_GROUP_COLOR[m.aspGroup][1], borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 600 }}>{m.aspGroup}</span> : "—"}</td>
                    <td title={m.aspPrev == null ? undefined : "Sep 1–4: " + fmt(m.aspPrev, 2)} style={{ ...td, color: m.aspChg == null ? COLORS.textFaint : m.aspChg >= 0 ? COLORS.teal : COLORS.coral }}>{m.aspChg == null ? "—" : (m.aspChg >= 0 ? "▲ " : "▼ ") + fmt(Math.abs(m.aspChg), 1) + "%"}</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
