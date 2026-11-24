
// ============================================================================
// Leadership views: VP & Heads (team tabs), Team leaders (AM / Sales layer), and the permission model.
//   VP        sees every head, team leader, AM and sales rep.
//   Head      sees the team leaders, AMs and sales of his own team only.
//   TL        sees the AMs and sales of his own team only.
//   AM, Sales see their own view only.
// NOTE: with the data embedded in the file, this scoping only shapes the screens: the whole data set is still inside the page.
//       Real enforcement needs the backend (docs/ARCHITECTURE.md, T5 and T7).
// ============================================================================
const LEAD_TABS = [["all", "All"], ["Key", "Key Accounts"], ["Growth - Fashion", "Growth Fashion"], ["Growth - General Trade", "Growth General Trade"], ["Growth - Cosmatics", "Growth Cosmetics"], ["Startups", "Startups"]];
const LEAD_TAB_LABEL = Object.fromEntries(LEAD_TABS);
const LEAD_HEAD_BY_TEAM = Object.fromEntries(ORG.heads.map((h) => [h.team, h]));
const LEAD_MIN_PARCELS = 30;

// one row per roster merchant, with the per-AM analysis (category, own target, hit / missed, growth) and the ASP / VAS / DSR inputs
const LEAD_ROWS = [];
ORG.ams.forEach((a) => {
  analyzeAm(DATA.ams[a.name], DATA.wdFull).merchants.forEach((m) => {
    const dl = m.aspDlv || 0, rev = m.aspRev || 0, vas = m.aspVas || 0;
    LEAD_ROWS.push({ ...m, amName: a.name, team: a.team, tlId: a.tlId, headId: a.headId, dl, rev, asp: dl > 0 ? rev / dl : null, paspP: (m.pDlv || 0) > 0 ? (m.pRev || 0) / m.pDlv : null, vasRev: vas, vasAsp: dl > 0 ? vas / dl : null, gain: (m.td || 0) - (m.ptd || 0) });
  });
});
const LEAD_ROSTER = new Set(LEAD_ROWS.map((r) => r.id));
// VP only: merchants outside the five target segments (Box, no segment, other segments) with pickups this month, from DATA.vpExtra.
// They go through the same per-merchant analysis, so every VP list, card and segment row treats them like the other segments.
const LEAD_EXTRA_ROWS = [];
Object.entries(DATA.vpExtra || {}).forEach(([g, grp]) => {
  analyzeAm({ target: 0, base: grp.merchants.length, merchants: grp.merchants }, DATA.wdFull).merchants.forEach((m) => {
    const dl = m.aspDlv || 0, rev = m.aspRev || 0, vas = m.aspVas || 0;
    LEAD_EXTRA_ROWS.push({ ...m, seg: g, amName: m.am || "No account manager", team: null, tlId: null, headId: null, vpOnly: true, dl, rev, asp: dl > 0 ? rev / dl : null, paspP: (m.pDlv || 0) > 0 ? (m.pRev || 0) / m.pDlv : null, vasRev: vas, vasAsp: dl > 0 ? vas / dl : null, gain: (m.td || 0) - (m.ptd || 0) });
  });
});

// Sales reps' merchants (new, last month's new, reactivations) that are in no AM portfolio (DATA.salesExtra). They count in the views of the
// sales rep's team leader and head and in the VP view, through the same per-merchant analysis.
const SALES_EXTRA_ROWS = [];
analyzeAm({ target: 0, base: ((DATA.salesExtra || {}).merchants || []).length, merchants: (DATA.salesExtra || {}).merchants || [] }, DATA.wdFull).merchants.forEach((m) => {
  const dl = m.aspDlv || 0, rev = m.aspRev || 0, vas = m.aspVas || 0, sr = ORG.sales.find((x) => x.name === m.salesRep);
  SALES_EXTRA_ROWS.push({ ...m, amName: m.am || "No account manager", team: sr ? sr.team : null, tlId: sr ? sr.tlId : null, headId: sr ? sr.headId : null, salesOnly: true, dl, rev, asp: dl > 0 ? rev / dl : null, paspP: (m.pDlv || 0) > 0 ? (m.pRev || 0) / m.pDlv : null, vasRev: vas, vasAsp: dl > 0 ? vas / dl : null, gain: (m.td || 0) - (m.ptd || 0) });
});
const LEAD_BY_ID = new Map(LEAD_ROWS.concat(LEAD_EXTRA_ROWS, SALES_EXTRA_ROWS).map((r) => [r.id, r]));

// ---------- permissions ----------
function parseViewer(key) {
  if (!key || key === "vp") return { kind: "vp" };
  const [k, ...rest] = key.split(":"), id = rest.join(":");
  return { kind: { h: "head", t: "tl", a: "am", s: "sales" }[k], id };
}
function scopeOf(v) {
  const s = { vp: v.kind === "vp", heads: new Set(), tls: new Set(), ams: new Set(), sales: new Set() };
  const addTeam = (pred) => { ORG.tls.filter((t) => pred(t)).forEach((t) => s.tls.add(t.id)); ORG.ams.filter((a) => pred(a)).forEach((a) => s.ams.add(a.name)); ORG.sales.filter((x) => pred(x)).forEach((x) => s.sales.add(x.id)); };
  if (v.kind === "vp") { ORG.heads.forEach((h) => s.heads.add(h.id)); addTeam(() => true); }
  else if (v.kind === "head") { s.heads.add(v.id); addTeam((e) => e.headId === v.id); }
  else if (v.kind === "tl") { s.tls.add(v.id); ORG.ams.filter((a) => a.tlId === v.id).forEach((a) => s.ams.add(a.name)); ORG.sales.filter((x) => x.tlId === v.id).forEach((x) => s.sales.add(x.id)); }
  else if (v.kind === "am") s.ams.add(v.id);
  else if (v.kind === "sales") s.sales.add(v.id);
  return s;
}
function leadTabAllowed(scope, tab) {
  if (tab === "all") return scope.vp;
  const h = LEAD_HEAD_BY_TEAM[tab];
  return !!h && scope.heads.has(h.id);
}
function viewerDefault(v) { // where a person lands
  if (v.kind === "vp") return { screen: "vp", tab: "all" };
  if (v.kind === "head") return { screen: "heads", tab: ORG_HEAD[v.id].team };
  if (v.kind === "tl") return { screen: "tl", tlId: v.id };
  if (v.kind === "am") return { screen: "tracker", am: v.id };
  return { screen: "sales", salesId: v.id };
}
function leadCrumbs(nav, headId, tlId, lastLabel) {
  const items = [];
  if (nav.can.vp) items.push({ label: ORG.vp.name + " (VP)", onClick: () => nav.go("vp") });
  const h = ORG_HEAD[headId];
  if (h && nav.can.tab(h.team)) items.push({ label: LEAD_TAB_LABEL[h.team], onClick: () => nav.go("heads", h.team) });
  else if (h && !nav.can.vp) { /* the viewer is below this head: no crumb */ }
  const t = tlId ? ORG_TL[tlId] : null;
  if (t && nav.can.tl(t.id)) items.push({ label: t.name, onClick: () => nav.go("tl", t.id) });
  items.push({ label: lastLabel });
  return items;
}
// ---------- numbers of a scope (VP / head / team leader / AM) ----------
function leadScope(kind, ent) {
  const mem = orgMembers(kind, ent);
  const names = new Set(mem.ams.map((a) => a.name));
  const sc = orgScore(kind, ent);
  const rows = LEAD_ROWS.filter((r) => names.has(r.amName)), seen = new Set(rows.map((r) => r.id));
  // + the merchants of the scope's sales reps (new, last month's new, reactivations), also when they are in no AM portfolio
  mem.sales.forEach((s) => (s.newList || []).concat(s.cohortList || [], s.reactList || []).forEach((x) => { const r = LEAD_BY_ID.get(x[0]); if (r && !seen.has(r.id)) { rows.push(r); seen.add(r.id); } }));
  if (kind === "vp") LEAD_EXTRA_ROWS.concat(SALES_EXTRA_ROWS).forEach((r) => { if (!seen.has(r.id)) { rows.push(r); seen.add(r.id); } });   // the VP also sees Box / no-segment merchants
  return { ...mem, rows, sc, g: sc.g };
}
// where a pickups figure stands against its goal (the monthly target of the targets sheet, factor 1)
function leadStanding(actual, target, factor) {
  if (!target) return null;
  const full = DATA.wdFull, elapsed = DATA.wdElapsed, remaining = Math.max(0, full - elapsed);
  const goal = target * factor, avgDaily = elapsed ? actual / elapsed : 0;
  const projected = actual + avgDaily * remaining;
  const short = Math.max(0, goal - actual);
  const status = actual >= goal ? "Achieved" : projected >= goal ? "On track" : projected >= 0.9 * goal ? "At risk" : "Behind";
  return { goal, avgDaily, projected, short, needDaily: goal / full, remainNeed: remaining > 0 ? short / remaining : short, achv: actual / goal, pctMonthly: actual / target, projPct: projected / target, projVsGoal: projected / goal, status, remaining };
}
const LEAD_STATUS_COLOR = { Achieved: COLORS.teal, "On track": COLORS.teal, "At risk": COLORS.amber, Behind: COLORS.coral };
const LEAD_STATUS_BG = { Achieved: COLORS.tealDim, "On track": COLORS.tealDim, "At risk": COLORS.amberDim, Behind: COLORS.coralDim };
function LeadChip({ status }) {
  const c = LEAD_STATUS_COLOR[status];
  return <span style={{ background: LEAD_STATUS_BG[status], color: c, borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{status}</span>;
}
const LEAD_INFO = {
  status: "Achieved: pickups so far already reach the monthly target. On track: the run rate reaches it. At risk: the run rate is within 10% below it. Behind: further below. Run rate = pickups so far + the current daily average for each remaining working day, so it moves a lot early in the month.",
  target: "Everything here is measured against the monthly target of the targets sheet (for a team: the target set for the team).",
  daily: "Daily average = pickups so far ÷ working days elapsed. Target pace = the monthly target ÷ the working days of the month.",
};

// ---------- standing (where the team stands against targets) ----------
// Three sections, the same on every view: Pickups, ASP, Retention (Churn for sales reps).
// `over` lets a screen pass its own pickups numbers (the AM screen has an adjustable working-days input).
function TargetSections({ sc, kind, over, ent }) {
  const isSales = kind === "sales" || sc.salesOnly;   // a sales rep, or a team of sales reps only: pickups = new pickups (new merchants + reactivations)
  const p = sc.pickups, a = sc.asp, f = sc.fresh, r = sc.retention, c = sc.churn;
  const actual = over ? over.actual : p.actual, target = over ? over.target : p.target;
  const st = leadStanding(actual, target, 1);
  const color = st ? LEAD_STATUS_COLOR[st.status] : COLORS.text;
  const avgDaily = over ? over.avgDaily : st ? st.avgDaily : null;
  const projected = over ? over.projected : st ? st.projected : null;
  const projPct = over ? over.projPct : st ? st.projPct : null;
  const needDaily = over ? over.needDaily : st ? st.needDaily : null;
  const grid = (min) => ({ ...UI.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, " + min + "px), 1fr))", gap: 12 });
  const aspGap = a.actual != null && a.target ? a.actual - a.target : null;
  const retOk = r && r.target != null ? r.actual >= r.target : null, churnOk = c && c.target != null ? c.actual <= c.target : null;
  return (
    <div>
      {ent && <LeadSection title="Live"><LiveSection kind={kind} ent={ent} /></LeadSection>}
      <LeadSection title="Pickups" info={LEAD_INFO.target}>
        <div className="tt-kpis" style={grid(180)}>
          <OrgCard label={isSales ? "Monthly new-pickups target" : "Monthly pickups target"} info={isSales ? ORG_INFO.newPickups : "The monthly pickups target (for a team: as set for the team)."} value={target ? fmt(target) : "—"} />
          <OrgCard label={isSales ? "New pickups so far" : "Pickups so far"} info={LEAD_INFO.target} value={fmt(actual)} accent={st ? color : undefined} sub={st ? fmt(st.achv * 100, 1) + "% of the monthly target" : "no target"}>{st && <OrgBar pct={Math.min(1, st.achv)} color={color} />}</OrgCard>
          {f && <OrgCard label="Fresh sales pickups" info="Pickups of the new merchants (first pickup in the new-merchant window, counted from the 25th of last month) and the reactivations (no pickup in the previous 25th-to-25th month, back since the 25th of last month; counted from the 25th) owned by the sales reps of this scope." value={fmt(f.actual)} sub={f.target ? fmt((f.actual / f.target) * 100, 1) + "% of " + fmt(f.target) + " target" : "no target"} />}
          <OrgCard label="Daily average" info={LEAD_INFO.daily} value={avgDaily == null ? "—" : fmt(avgDaily, 0)} accent={avgDaily != null && needDaily != null ? (avgDaily >= needDaily ? COLORS.teal : COLORS.coral) : undefined} sub={needDaily != null ? "target pace " + fmt(needDaily, 0) + " per working day" : ""} />
          <OrgCard label="Run rate" info={"Pickups so far + current daily average x remaining working days. " + LEAD_INFO.status} value={projected == null ? "—" : fmt(projected, 0)} accent={projPct != null ? (projPct >= 1 ? COLORS.teal : COLORS.coral) : undefined} sub={projPct != null ? fmt(projPct * 100, 1) + "% of the monthly target" : ""} />
          <OrgCard label="Status" info={LEAD_INFO.status} value={st ? <LeadChip status={st.status} /> : "—"} sub={st ? (st.short > 0 ? fmt(st.short, 0) + " short of the monthly target" : "monthly target reached") : "no target"} />
        </div>
      </LeadSection>
      <LeadSection title="ASP" info={isSales ? ORG_INFO.aspFresh : ORG_INFO.asp}>
        <div className="tt-kpis" style={grid(180)}>
          <OrgCard label="ASP target" info={ORG_INFO.asp} value={a.target ? fmt(a.target, 1) : "—"} sub={a.target ? "" : "no target"} />
          <OrgCard label="Current ASP" info={isSales ? ORG_INFO.aspFresh : ORG_INFO.asp} value={a.actual == null ? "—" : fmt(a.actual, 1)} accent={aspGap == null ? undefined : aspGap >= 0 ? COLORS.teal : COLORS.coral} sub={a.base ? fmt(a.base) + " delivered parcels" : ""} />
          <OrgCard label="Gap" info="Current ASP minus the ASP target, in EGP per parcel. Green = at or above target." value={aspGap == null ? "—" : lsgn(aspGap, 1)} accent={aspGap == null ? undefined : aspGap >= 0 ? COLORS.teal : COLORS.coral} sub="EGP per parcel vs target" />
        </div>
      </LeadSection>
      {(r || c || kind === "am") && (
        <LeadSection title={r || kind === "am" ? "Retention" : "Churn"} info={r || kind === "am" ? ORG_INFO.retention : ORG_INFO.churn}>
          <div className="tt-kpis" style={grid(180)}>
            {(r || kind === "am") && (<>
              <OrgCard label="Retention target" info={ORG_INFO.retention} value={r && r.target != null ? "≥ " + orgPct(r.target) : "—"} sub={r && r.target != null ? (r.implied ? "weighted from the team" : "") : "no retention target for this team"} />
              <OrgCard label="Current retention" info={ORG_INFO.retention} value={r ? orgPct(r.actual) : "—"} accent={retOk == null ? undefined : retOk ? COLORS.teal : COLORS.coral} sub={r ? fmt(r.base) + " merchants active last month · provisional" : ""} />
            </>)}
            {c && (<>
              <OrgCard label="Churn target" info={ORG_INFO.churn} value={c.target != null ? "≤ " + orgPct(c.target) : "—"} sub={c.target != null ? (c.implied ? "weighted from the team" : "") : "no target"} />
              <OrgCard label="Current churn" info={ORG_INFO.churn} value={orgPct(c.actual)} accent={churnOk == null ? undefined : churnOk ? COLORS.teal : COLORS.coral} sub={fmt(c.base) + " merchants · provisional"} />
            </>)}
          </div>
        </LeadSection>
      )}
    </div>
  );
}
function StandingCards({ sc, kind, ent }) { return <TargetSections sc={sc} kind={kind} ent={ent} />; }
function LeadKpiRow() { return null; }

function StandingTable({ title, info, rows, mode, onRow, renderDetail }) {
  const [open, setOpen] = useState(null);
  const isSales = mode === "sales";
  const th = { padding: "9px 12px", textAlign: "left", fontSize: 11.5, color: COLORS.textMuted, fontWeight: 600, whiteSpace: "nowrap" };
  const td = { padding: "9px 12px", whiteSpace: "nowrap", verticalAlign: "top" };
  const mono = { fontFamily: THEME.font };
  const pct1 = (a) => fmt(a * 100, 1) + "% of the monthly target";
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ fontWeight: 600, fontSize: 14, margin: "0 0 10px", display: "flex", alignItems: "center" }}>{title}{info && <InfoTip text={info} />}</h3>
      <div className="tt-scroll-x" data-tt="scroll" style={{ ...UI.table, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.panelBorder}` }}>
            <th style={th}>Name</th><th style={th}>{isSales ? "New pickups / monthly target" : "Pickups / monthly target"}</th><th style={th}>Achievement %</th><th style={th}>Daily avg: actual / target pace</th><th style={th}>Run rate</th><th style={th}>Short of monthly target</th><th style={th}>Status</th><th style={th} />
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = r.sc.pickups, st = leadStanding(p.actual, p.target, 1), expanded = open === r.key;
              return (
                <React.Fragment key={r.key}>
                  <tr onClick={() => (renderDetail ? setOpen(expanded ? null : r.key) : onRow && onRow(r))} style={{ borderTop: `1px solid ${COLORS.panelBorder}`, cursor: renderDetail || onRow ? "pointer" : "default", background: expanded ? THEME.color.navyTint : "transparent" }}>
                    <td style={td}><div style={{ fontWeight: 600, color: renderDetail || onRow ? COLORS.navy : COLORS.text, display: "flex", alignItems: "center", gap: 4 }}>{renderDetail && (expanded ? <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" /> : <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />)}{r.name}</div>{r.sub && <div style={{ fontSize: 10.5, color: COLORS.textFaint }}>{r.sub}</div>}</td>
                    <td style={td}>{st ? <div><span style={{ ...mono, fontWeight: 600, color: LEAD_STATUS_COLOR[st.status] }}>{fmt(p.actual)}</span><span style={{ color: COLORS.textFaint, fontSize: 11 }}> / {fmt(st.goal)}</span></div> : "—"}</td>
                    <td style={{ ...td, ...mono, fontWeight: 700, color: st ? LEAD_STATUS_COLOR[st.status] : COLORS.textFaint }}>{st ? fmt(st.achv * 100, 1) + "%" : "—"}</td>
                    <td style={{ ...td, ...mono }}>{st ? <span><span style={{ color: st.avgDaily >= st.needDaily ? COLORS.teal : COLORS.coral, fontWeight: 600 }}>{fmt(st.avgDaily, 0)}</span><span style={{ color: COLORS.textFaint }}> / {fmt(st.needDaily, 0)}</span></span> : "—"}</td>
                    <td style={td}>{st ? <div><span style={{ ...mono, fontWeight: 600, color: st.projVsGoal >= 1 ? COLORS.teal : COLORS.coral }}>{fmt(st.projected, 0)}</span><div style={{ fontSize: 10.5, color: COLORS.textMuted }}>{pct1(st.projPct)}</div></div> : "—"}</td>
                    <td style={{ ...td, ...mono }}>{st ? (st.short > 0 ? fmt(st.short, 0) : "—") : "—"}</td>
                    <td style={td}>{st ? <LeadChip status={st.status} /> : "—"}</td>
                    <td style={td}>{r.open && <span role="link" tabIndex={0} onClick={(e) => { e.stopPropagation(); r.open(); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); r.open(); } }} style={{ color: COLORS.navy, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>Open<ArrowRight size={13} strokeWidth={1.75} aria-hidden="true" /></span>}</td>
                  </tr>
                  {expanded && renderDetail && (<tr><td colSpan={8} style={{ padding: 0, borderTop: `1px solid ${COLORS.panelBorder}`, background: COLORS.card }}><div style={{ padding: "14px 18px" }}>{renderDetail(r)}</div></td></tr>)}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- main view sections ----------
function LeadSection({ title, info, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ fontWeight: 600, fontSize: 15, margin: "6px 0 10px", display: "flex", alignItems: "center" }}>{title}{info && <InfoTip text={info} />}</h2>
      {children}
    </div>
  );
}
// ---------- Activity analysis (month to date) ----------
// The Daily analysis idea over the whole month so far: every merchant is compared with the same days of last month
// (growers / droppers at +/-15% GR, as in the AM view). Every card opens the list of merchants behind its number.
const LEAD_SEG_LABEL = { "Key-Account": "Key Accounts", "Growth-Fashion": "Growth Fashion", "Growth-Cosmetics": "Growth Cosmetics", "Growth-General-Trade": "Growth General Trade", Startups: "Startups", Box: "Box", "No segment": "No segment", "Other segments": "Other segments" };
const leadSegLabel = (x) => LEAD_SEG_LABEL[x] || "Other";
const ACT_GROUPS = [
  ["Grower", "Growers", COLORS.teal, "Merchants whose average pickups per working day so far is at least 15% above the same days of last month. A merchant with no pickups in those days and pickups now counts as a grower."],
  ["Dropper", "Droppers", COLORS.coral, "Merchants whose average pickups per working day so far is at least 15% below the same days of last month, and who still have pickups this month."],
  ["Stable", "Stable", COLORS.blue, "Merchants whose GR % is between -15% and +15%."],
  ["Churned", "Churned", COLORS.slate, "Merchants with no pickups yet this month. Provisional until month end."],
  ["New", "New", COLORS.purple, "Merchants with a first pickup from the 25th of last month up to the 25th of this month. Their pickups, revenue and averages count from the 25th of last month (not from the 1st), and these numbers are part of every total."],
  ["Reactivation", "Reactivations", COLORS.chart, "Merchants active before, with no pickup in the previous 25th-to-25th month (the 25th of two months ago to the 24th of last month) and pickups again since the 25th of last month; their numbers count from the 25th of last month. Their pickups, revenue and every other number count in the portfolio totals."],
];
function ActCard({ label, info, value, sub, accent, active, onClick, count }) {
  return (
    <div onClick={onClick} style={{ ...UI.tile, cursor: "pointer", outline: active ? `2px solid ${COLORS.navy}` : "none", outlineOffset: -1, position: "relative" }}>
      <KpiHead label={label} info={info} />
      <div style={{ ...UI.kpi, color: accent || COLORS.text }}>{value}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 12, color: COLORS.textMuted }}>{sub}</div>}
      <button aria-label={"Show the merchants behind " + label} aria-expanded={!!active} onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ ...UI.btnSmall, marginTop: 8, padding: "4px 10px", fontSize: 11.5 }}>
        {active ? "Hide merchants" : "View merchants"}<ChevronRight size={13} strokeWidth={1.75} aria-hidden="true" style={{ transform: active ? "rotate(90deg)" : "none" }} />
      </button>
    </div>
  );
}
function ActMerchantList({ title, rows, sortBy }) {
  const [q, setQ] = useState(""); const [all, setAll] = useState(false);
  const ql = q.trim().toLowerCase();
  const list = rows.filter((r) => !ql || (r.name + " " + r.id + " " + r.amName + " " + leadSegLabel(r.seg)).toLowerCase().includes(ql)).slice().sort(sortBy || ((a, b) => b.mtd - a.mtd));
  const shown = all ? list : list.slice(0, 50);
  const th = { padding: "7px 10px", textAlign: "left", fontSize: 11.5, color: COLORS.textMuted, fontWeight: 600, whiteSpace: "nowrap", background: COLORS.card };
  const td = { padding: "6px 10px", fontSize: 12.5, whiteSpace: "nowrap" };
  const num = { ...td, textAlign: "right" };
  return (
    <div role="region" aria-label={title} data-testid="act-list" style={{ ...UI.card, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{title} · {fmt(list.length)} merchants</h3>
        <span style={{ flex: 1 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, name, AM or segment" aria-label="Search the merchants in this list" style={{ ...UI.input, minWidth: 220 }} />
      </div>
      {list.length === 0 ? <div style={{ fontSize: 12.5, color: COLORS.textMuted }}>No merchants.</div> : (
        <div style={{ ...UI.table, overflowX: "auto", maxHeight: 460, overflowY: "auto" }} className="tt-scroll-x" data-tt="scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0 }}><tr>
              <th style={th}>Business ID</th><th style={th}>Merchant</th><th style={th}>Segment</th><th style={th}>Account manager</th>
              <th style={{ ...th, textAlign: "right" }}>MTD pickups</th><th style={{ ...th, textAlign: "right" }}>Same days last month</th><th style={{ ...th, textAlign: "right" }}>Delta</th><th style={{ ...th, textAlign: "right" }}>GR %</th>
            </tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                <td style={td}>{r.id}</td><td style={{ ...td, color: COLORS.text }}>{r.name}</td><td style={td}>{leadSegLabel(r.seg)}</td><td style={td}>{r.amName}</td>
                <td style={num}>{fmt(r.mtd)}</td><td style={num}>{fmt(r.ptd || 0)}</td>
                <td style={{ ...num, color: r.mtd - (r.ptd || 0) >= 0 ? COLORS.teal : COLORS.coral }}>{lsgn(r.mtd - (r.ptd || 0), 0)}</td>
                <td style={num}>{r.momPct == null ? "—" : lsgn(r.momPct, 1) + "%"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {!all && list.length > 50 && <button onClick={() => setAll(true)} style={{ ...UI.btn, marginTop: 10 }}>Show all {fmt(list.length)}</button>}
    </div>
  );
}
function ActivityAnalysis({ rows, sc }) {
  const [open, setOpen] = useState(null);
  const g = sc.g;
  const stats = useMemo(() => {
    const by = {}; ACT_GROUPS.forEach(([k]) => (by[k] = []));
    rows.forEach((r) => { if (by[r.standing]) by[r.standing].push(r); });
    const mtd = rows.reduce((x, r) => x + (r.mtd || 0), 0), ptd = rows.reduce((x, r) => x + (r.ptd || 0), 0);
    const segs = {}; rows.forEach((r) => { const k = LEAD_SEG_LABEL[r.seg] ? r.seg : "Other"; const o = segs[k] || (segs[k] = { n: 0, active: 0, mtd: 0, ptd: 0 }); o.n++; if (r.mtd > 0) o.active++; o.mtd += r.mtd || 0; o.ptd += r.ptd || 0; });
    return { by, mtd, ptd, active: rows.filter((r) => r.mtd > 0), newRows: rows.filter((r) => r.newThisMonth), segs };
  }, [rows]);
  const n = rows.length || 1, pct = (x) => fmt((x / n) * 100, 0) + "% of merchants";
  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const lists = {
    portfolio: ["Total portfolio", rows],
    pickups: ["Total pickups", stats.active, (a, b) => b.mtd - a.mtd],
    active: ["Active merchants", stats.active],
    net: ["Net change vs the same days of last month", rows.filter((r) => (r.mtd || 0) !== (r.ptd || 0)), (a, b) => Math.abs(b.mtd - (b.ptd || 0)) - Math.abs(a.mtd - (a.ptd || 0))],
    newm: ["New merchants", stats.newRows],
  };
  ACT_GROUPS.forEach(([k, l]) => { lists[k] = [l, stats.by[k]]; });
  const cur = open ? lists[open] : null;
  const grid = { ...UI.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 12, marginBottom: 12 };
  const net = stats.mtd - stats.ptd;
  const segKeys = Object.keys(stats.segs);
  return (
    <LeadSection title="Activity analysis" info="Month to date. Every merchant is compared with the same days of last month. Click a card to see the merchants behind it.">
      <div className="tt-kpis" style={grid}>
        <ActCard label="Total portfolio" info="Merchants assigned to the AMs in this scope (account manager from public.businesses). The VP also sees Box and no-segment merchants that picked up this month." value={fmt(rows.length)} sub="merchants" active={open === "portfolio"} onClick={() => toggle("portfolio")} />
        <ActCard label="Total pickups" info="Pickups of the portfolio this month so far (every merchant of the scope, reactivations included; for the VP also Box and no-segment merchants). A new merchant counts from the 25th of last month." value={fmt(stats.mtd)} sub={lsgn(net, 0) + " vs the same days of last month"} active={open === "pickups"} onClick={() => toggle("pickups")} />
        <ActCard label="Active merchants" info="Merchants with at least one pickup this month so far." value={fmt(stats.active.length)} sub={pct(stats.active.length)} active={open === "active"} onClick={() => toggle("active")} />
        <ActCard label="Net change" info="Pickups so far minus the pickups of the same days of last month, summed over the merchants." value={lsgn(net, 0)} accent={net >= 0 ? COLORS.teal : COLORS.coral} sub="pickups vs last month" active={open === "net"} onClick={() => toggle("net")} />
        <ActCard label="New merchants" info={"Merchants with a " + NEW_RULE + ". Their pickups, revenue and averages count from the 25th of last month (not from the 1st), and these numbers are part of every total."} value={fmt(stats.newRows.length)} sub={NEW_PHRASE} active={open === "newm"} onClick={() => toggle("newm")} />
      </div>
      <div className="tt-kpis" style={{ ...grid, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))" }}>   {/* the six groups on one row */}
        {ACT_GROUPS.map(([k, l, c, info]) => <ActCard key={k} label={l} info={info} value={fmt(stats.by[k].length)} accent={c} sub={pct(stats.by[k].length)} active={open === k} onClick={() => toggle(k)} />)}
      </div>
      {cur && <ActMerchantList key={open} title={cur[0]} rows={cur[1]} sortBy={cur[2]} />}
      {segKeys.length > 1 && (
        <div style={{ ...UI.table, overflowX: "auto", marginTop: 14 }} className="tt-scroll-x" data-tt="scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ background: COLORS.card }}>{["Segment", "Merchants", "Active", "MTD pickups", "Same days last month", "Change"].map((h, i) => <th key={h} style={{ padding: "8px 12px", textAlign: i ? "right" : "left", fontSize: 11.5, color: COLORS.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>{segKeys.map((k) => { const o = stats.segs[k]; return (
              <tr key={k} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                <td style={{ padding: "7px 12px" }}>{leadSegLabel(k)}</td><td style={{ padding: "7px 12px", textAlign: "right" }}>{fmt(o.n)}</td><td style={{ padding: "7px 12px", textAlign: "right" }}>{fmt(o.active)}</td>
                <td style={{ padding: "7px 12px", textAlign: "right" }}>{fmt(o.mtd)}</td><td style={{ padding: "7px 12px", textAlign: "right" }}>{fmt(o.ptd)}</td>
                <td style={{ padding: "7px 12px", textAlign: "right", color: o.mtd - o.ptd >= 0 ? COLORS.teal : COLORS.coral }}>{lsgn(o.mtd - o.ptd, 0)}</td>
              </tr>); })}</tbody>
          </table>
        </div>
      )}
    </LeadSection>
  );
}

function RankTable({ title, info, list, cols, note }) {
  const th = { padding: "6px 8px", textAlign: "left", fontSize: 11.5, color: COLORS.textMuted, fontWeight: 600, whiteSpace: "nowrap" };
  return (
    <div style={{ ...UI.card, padding: "14px 16px" }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, display: "flex", alignItems: "center" }}>{title}{info && <InfoTip text={info} />}</div>
      {note && <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 6 }}>{note}</div>}
      {list.length === 0 ? <div style={{ fontSize: 12, color: COLORS.textFaint, padding: "6px 0" }}>None</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr><th style={th}>#</th>{cols.map((c) => <th key={c.h} style={{ ...th, textAlign: c.a === "r" ? "right" : "left" }}>{c.h}</th>)}</tr></thead>
            <tbody>{list.map((r, i) => (
              <tr key={r.id + ":" + i} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                <td style={{ padding: "5px 8px", color: COLORS.textFaint }}>{i + 1}</td>
                {cols.map((c) => <td key={c.h} style={{ padding: "5px 8px", textAlign: c.a === "r" ? "right" : "left", fontFamily: c.a === "r" ? THEME.font : undefined, whiteSpace: c.a === "r" ? "nowrap" : "normal", maxWidth: c.a === "r" ? undefined : 230 }}>{c.v(r)}</td>)}
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
const rankName = (sub) => ({ h: "Merchant", v: (r) => (<div><div style={{ color: COLORS.text }}>{r.name}</div><div style={{ fontSize: 10.5, color: COLORS.textFaint }}>{r.amName}</div></div>) });
const leadCmp = (f, dir) => (a, b) => (dir === "desc" ? f(b) - f(a) : f(a) - f(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const leadPair = (list, f, dir, n = 10) => list.slice().sort(leadCmp(f, dir)).slice(0, n);
const lsgn = (v, d) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v), d);

const LEAD_VIEWS = [
  ["pickups-growth", "Pickups: MTD avg daily vs PMTD (GR %)"],
  ["asp-growth", "ASP: MTD vs PMTD (GR %)"],
  ["dsr", "Low DSR merchants"],
  ["vas", "VAS users: top and bottom"],
];
function LeadLists({ rows, sales, sc }) {
  const [view, setView] = useState("pickups-growth");
  const [minP, setMinP] = useState(LEAD_MIN_PARCELS);
  const L = useMemo(() => {
    const minN = Math.max(1, Number(minP) || 1);
    const elig = rows.filter((r) => r.dl >= minN);
    const lowDsr = rows.filter((r) => r.dsrSep != null && r.dsrSep <= 65 && r.sepPicked > 0);
    const withDsr = rows.filter((r) => r.dsrSep != null && r.sepPicked > 0);
    // pickups: MTD avg daily vs PMTD avg daily (the same days of last month), ranked by the change in pickups per day
    const pk = rows.filter((r) => r.mtdAvgDaily > 0 || r.pmtdAvgDaily > 0);
    // ASP: MTD ASP vs PMTD ASP, merchants with enough delivered parcels now and a PMTD ASP to compare with
    const aspRows = elig.filter((r) => r.paspP != null && r.paspP > 0).map((r) => ({ ...r, aspDelta: r.asp - r.paspP, aspGr: ((r.asp - r.paspP) / r.paspP) * 100 }));
    return {
      pkUp: leadPair(pk.filter((r) => r.momDelta > 0), (r) => r.momDelta, "desc"), pkDown: leadPair(pk.filter((r) => r.momDelta < 0), (r) => r.momDelta, "asc"),
      nPkUp: pk.filter((r) => r.momDelta > 0).length, nPkDown: pk.filter((r) => r.momDelta < 0).length,
      aspUp: leadPair(aspRows.filter((r) => r.aspDelta > 0), (r) => r.aspDelta, "desc"), aspDown: leadPair(aspRows.filter((r) => r.aspDelta < 0), (r) => r.aspDelta, "asc"),
      nAspUp: aspRows.filter((r) => r.aspDelta > 0).length, nAspDown: aspRows.filter((r) => r.aspDelta < 0).length,
      lowDsr: leadPair(lowDsr, (r) => r.sepPicked, "desc"), nLow: lowDsr.length, lowShare: withDsr.reduce((s, r) => s + r.sepPicked, 0) ? lowDsr.reduce((s, r) => s + r.sepPicked, 0) / withDsr.reduce((s, r) => s + r.sepPicked, 0) : null,
      vasTop: leadPair(rows.filter((r) => r.vasRev > 0), (r) => r.vasRev, "desc"),
      vasBot: elig.slice().sort((a, b) => a.vasAsp - b.vasAsp || b.dl - a.dl || (a.id < b.id ? -1 : 1)).slice(0, 10),
    };
  }, [rows, sales, minP]);
  const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))", gap: 12, marginBottom: 16 };
  const gr = (v) => (v == null ? "—" : lsgn(v, 1) + "%");
  const colsPk = [rankName(), { h: "MTD avg daily", a: "r", v: (r) => fmt(r.mtdAvgDaily, 1) }, { h: "PMTD avg daily", a: "r", v: (r) => fmt(r.pmtdAvgDaily, 1) }, { h: "Delta", a: "r", v: (r) => lsgn(r.momDelta, 1) }, { h: "GR %", a: "r", v: (r) => gr(r.momPct) }];
  const colsAspG = [rankName(), { h: "MTD ASP", a: "r", v: (r) => fmt(r.asp, 2) }, { h: "PMTD ASP", a: "r", v: (r) => fmt(r.paspP, 2) }, { h: "Delta", a: "r", v: (r) => lsgn(r.aspDelta, 2) }, { h: "GR %", a: "r", v: (r) => gr(r.aspGr) }, { h: "Parcels", a: "r", v: (r) => fmt(r.dl) }];
  const colsVas = [rankName(), { h: "VAS revenue", a: "r", v: (r) => fmt(r.vasRev) }, { h: "VAS ASP", a: "r", v: (r) => (r.vasAsp == null ? "—" : fmt(r.vasAsp, 2)) }, { h: "Parcels", a: "r", v: (r) => fmt(r.dl) }];
  const colsDsr = [rankName(), { h: "Sep DSR", a: "r", v: (r) => fmt(r.dsrSep, 1) + "%" }, { h: "Sep pickups", a: "r", v: (r) => fmt(r.sepPicked) }];
  const days = "days 1–" + DATA.ptdDays;
  return (
    <LeadSection title="Top 10 and Bottom 10" info="Merchant rankings for this scope, one list at a time. Pickups and ASP compare this month so far (MTD) with the same days of last month (PMTD). Ties are broken by Business ID. Merchant names are not clickable here: a merchant is opened from the AM's portfolio overview.">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: COLORS.textMuted }}>Show</span>
        <select value={view} onChange={(e) => setView(e.target.value)} aria-label="Top and bottom list" style={{ ...UI.input, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {LEAD_VIEWS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {(view === "asp-growth" || view === "vas") && (<><span style={{ fontSize: 12, color: COLORS.textMuted, display: "inline-flex", alignItems: "center" }}>Min. delivered parcels<InfoTip text="A merchant with very few parcels has a meaningless ASP, so the ASP and VAS lists only include merchants above this number." /></span>
        <input type="number" min="1" value={minP} aria-label="Minimum delivered parcels" onChange={(e) => setMinP(e.target.value)} style={{ ...UI.input, width: 80 }} /></>)}
      </div>
      {view === "pickups-growth" && (<div style={grid2}>
        <RankTable title={"Top 10 merchants by pickups growth (" + fmt(L.nPkUp) + " growing)"} list={L.pkUp} cols={colsPk} note={"MTD avg daily vs PMTD avg daily (last month's " + days + "); ranked by the gain in pickups per day."} info="Avg daily = pickups ÷ working days of the period. Delta = MTD avg daily − PMTD avg daily. GR % = Delta ÷ PMTD avg daily (— when there were no pickups in the PMTD period)." />
        <RankTable title={"Bottom 10 merchants by pickups growth (" + fmt(L.nPkDown) + " dropping)"} list={L.pkDown} cols={colsPk} note="Ranked by the loss in pickups per day." info="The merchants whose avg daily pickups fell the most against the same days of last month." />
      </div>)}
      {view === "asp-growth" && (<div style={grid2}>
        <RankTable title={"Top 10 merchants by ASP growth (" + fmt(L.nAspUp) + " growing)"} list={L.aspUp} cols={colsAspG} note={"MTD ASP vs PMTD ASP (last month's " + days + "). At least " + (Number(minP) || 1) + " delivered parcels."} info="ASP = (shipping revenue + VAS revenue) ÷ delivered parcels. Delta = MTD ASP − PMTD ASP, in EGP per parcel; ranked by the gain. GR % = Delta ÷ PMTD ASP." />
        <RankTable title={"Bottom 10 merchants by ASP growth (" + fmt(L.nAspDown) + " dropping)"} list={L.aspDown} cols={colsAspG} note="Ranked by the loss in ASP per parcel." info="The merchants whose ASP fell the most against the same days of last month." />
      </div>)}
      {view === "dsr" && (<div style={{ marginBottom: 16 }}>
        <RankTable title={"Low DSR merchants: " + fmt(L.nLow) + " at or below 65% (" + (L.lowShare == null ? "—" : fmt(L.lowShare * 100, 1) + "% of September volume") + ")"} list={L.lowDsr} cols={colsDsr} info="September DSR (the last complete month) at or below 65%, largest September volume first (top 10 shown)." />
      </div>)}
      {view === "vas" && (<div style={grid2}>
        <RankTable title="Top 10 VAS users" list={L.vasTop} cols={colsVas} info="Highest VAS revenue, Oct 1–4." />
        <RankTable title="Bottom 10 VAS users" list={L.vasBot} cols={colsVas} note={"Lowest VAS ASP among merchants with at least " + (Number(minP) || 1) + " delivered parcels; equal VAS ASP: more parcels first."} info="Merchants with volume but little or no VAS revenue: the VAS opportunity." />
      </div>)}
    </LeadSection>
  );
}
function LeadMain({ kind, ent }) {
  const S = useMemo(() => leadScope(kind, ent), [kind, ent]);
  return (<div><ActivityAnalysis rows={S.rows} sc={S.sc} /><LeadLists rows={S.rows} sales={S.sales} sc={S.sc} /></div>);
}

// ---------- screens ----------
function LeadShell({ nav, current, children }) {
  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, fontFamily: THEME.font, minHeight: "100%" }} className="tt-shell">
      <div className="tt-wrap">
        <LevelBar nav={nav} current={current} />
        {children}
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 8, lineHeight: 1.5 }}>Data as of {ORG.asOf} · targets from the targets table of the month (public.commercial_monthly_targets). Pickups are this month so far (a new merchant from the 25th of last month); ASP and retention use Oct 1–4; fresh sales pickups (new merchants and reactivations) count from the 25th of last month. Team leader, head and VP lists also hold the merchants of their sales reps (new, last month's new, reactivations), also when they are in no AM portfolio. A team of sales reps only shows its fresh-sales numbers under Pickups and ASP. New merchants = merchants with a {NEW_RULE} and a sales owner.</div>
      </div>
    </div>
  );
}
// pill strip used for the Totals / breakdown tabs
function LeadTabs({ items, active, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="tt-scroll-x" data-tt="scroll" style={{ display: "flex", gap: 6, whiteSpace: "nowrap", paddingBottom: 8, marginBottom: 14 }}>
      {items.map(([k, l]) => (<button key={k} role="tab" aria-selected={active === k} onClick={() => onChange(k)} style={{ ...UI.pill(active === k), flex: "0 0 auto" }}>{l}</button>))}
    </div>
  );
}
// team leader: own cards, then Totals and a team member drop-down (AMs and sales of the team)
function TLPanel({ tl, nav, withCards = true }) {
  const [mem, setMem] = useState("");
  const sc = useMemo(() => orgScore("tl", tl), [tl]);
  const ams = ORG.ams.filter((a) => a.tlId === tl.id), sales = ORG.sales.filter((x) => x.tlId === tl.id);
  const am = mem.startsWith("a:") ? ams.find((a) => a.name === mem.slice(2)) : null, sl = mem.startsWith("s:") ? sales.find((x) => x.id === mem.slice(2)) : null;
  return (
    <div>
      {withCards && <StandingCards sc={sc} kind="tl" ent={tl} />}
      <div className="tt-bar" style={{ marginBottom: 14 }}>
        <button role="tab" aria-selected={!mem} onClick={() => setMem("")} style={UI.pill(!mem)}>Totals</button>
        <label style={{ ...UI.label, marginLeft: 6 }} htmlFor={"mem-" + tl.id}>Team member</label>
        <select id={"mem-" + tl.id} value={mem} onChange={(e) => setMem(e.target.value)} aria-label="Team member" style={{ ...UI.input, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <option value="">Choose a team member…</option>
          {ams.length > 0 && <optgroup label="Account managers">{ams.map((a) => <option key={a.name} value={"a:" + a.name}>{a.name}</option>)}</optgroup>}
          {sales.length > 0 && <optgroup label="Sales">{sales.map((x) => <option key={x.id} value={"s:" + x.id}>{x.name}</option>)}</optgroup>}
        </select>
      </div>
      {am ? <AmDetailPanel am={am} nav={nav} /> : sl ? <SalesDetailPanel s={sl} nav={nav} /> : <LeadMain key={"tl" + tl.id} kind="tl" ent={tl} />}
    </div>
  );
}
// head: own cards, then Totals and one tab per team leader
function HeadPanel({ head, nav }) {
  const tls = ORG.tls.filter((t) => t.headId === head.id);
  const direct = ORG.sales.filter((x) => x.headId === head.id && !x.tlId);
  const [sub, setSub] = useState("totals");
  const sc = useMemo(() => orgScore("head", head), [head]);
  const items = [["totals", "Totals"], ...tls.map((t) => ["t:" + t.id, t.name]), ...(direct.length ? [["direct", "Direct sales"]] : [])];
  const active = items.some(([k]) => k === sub) ? sub : "totals";
  const tl = active.startsWith("t:") ? tls.find((t) => t.id === active.slice(2)) : null;
  return (
    <div>
      <StandingCards sc={sc} kind="head" ent={head} />
      <LeadTabs items={items} active={active} onChange={setSub} label="Team leaders" />
      {active === "totals" && <LeadMain key={"h" + head.id} kind="head" ent={head} />}
      {tl && <TLPanel key={tl.id} tl={tl} nav={nav} withCards />}
      {active === "direct" && <DirectSales sales={direct} nav={nav} />}
    </div>
  );
}
function DirectSales({ sales, nav }) {
  const [id, setId] = useState("");
  const sl = sales.find((x) => x.id === id);
  return (
    <div>
      <div className="tt-bar" style={{ marginBottom: 14 }}>
        <label style={UI.label} htmlFor="mem-direct">Team member</label>
        <select id="mem-direct" value={id} onChange={(e) => setId(e.target.value)} aria-label="Team member" style={{ ...UI.input, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <option value="">Choose a team member…</option>
          {sales.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      {sl ? <SalesDetailPanel s={sl} nav={nav} /> : <div style={{ fontSize: 13, color: COLORS.textMuted }}>Sales reporting directly to the head. Choose a team member to see the details.</div>}
    </div>
  );
}
function LeadershipScreen({ nav, mode }) {
  // mode "vp": company cards, then Totals + one tab per segment head. mode "heads": one tab per segment (only the ones the person may see).
  const headTabs = LEAD_TABS.filter(([k]) => k !== "all" && nav.can.tab(k));
  const tabs = mode === "vp" ? [["all", "All"]] : headTabs;
  const tab = tabs.some(([k]) => k === nav.leadTab) ? nav.leadTab : tabs[0][0];
  const isAll = tab === "all", head = isAll ? null : LEAD_HEAD_BY_TEAM[tab];
  const [vpSub, setVpSub] = useState("totals");
  const sc = useMemo(() => orgScore("vp", LEAD_VP_ENT), []);
  const vpItems = [["totals", "Totals"], ...headTabs.map(([k, l]) => [k, l])];
  const vpActive = vpItems.some(([k]) => k === vpSub) ? vpSub : "totals";
  const title = isAll ? ORG.vp.name : LEAD_TAB_LABEL[tab];
  return (
    <LeadShell nav={nav} current={mode}>
      <div style={{ ...UI.eyebrow, marginBottom: 6 }}>Scorecard · {DATA.month}</div>
      <h1 style={{ ...UI.title, margin: "0 0 4px" }}>{title}</h1>
      <div style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 14 }}>{isAll ? "VP · " + ORG.heads.length + " segments · " + ORG.tls.length + " team leaders · " + ORG.ams.length + " AMs · " + ORG.sales.length + " sales" : "Head · " + ORG.tls.filter((t) => t.headId === head.id).length + " team leaders"}</div>
      {mode === "heads" && <LeadTabs items={tabs} active={tab} onChange={(k) => nav.go("heads", k)} label="Segments" />}
      {isAll ? (
        <div>
          <StandingCards sc={sc} kind="vp" ent={LEAD_VP_ENT} />
          <LeadTabs items={vpItems} active={vpActive} onChange={setVpSub} label="Heads" />
          {vpActive === "totals" ? <LeadMain key="vp" kind="vp" ent={LEAD_VP_ENT} /> : <HeadPanel key={vpActive} head={LEAD_HEAD_BY_TEAM[vpActive]} nav={nav} />}
        </div>
      ) : <HeadPanel key={tab} head={head} nav={nav} />}
    </LeadShell>
  );
}
const LEAD_VP_ENT = { t: {}, w: null };

function AmDetailPanel({ am, nav }) {
  const a = ORG_AM[am.name], sc = useMemo(() => orgScore("am", a), [a]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name} · business level</div>
        {nav.can.am(a.name) && <button onClick={() => nav.goAm(a.name)} style={{ ...UI.btnSmall, color: COLORS.navy }}>Open the Target Tracker for {a.name}<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
      </div>
      <StandingCards sc={sc} kind="am" title={a.name} ent={a} />
      <LeadKpiRow sc={sc} kind="am" />
      <LeadMain kind="am" ent={a} />
    </div>
  );
}
function SalesDetailPanel({ s, nav }) {
  const sc = useMemo(() => orgScore("sales", s), [s]);
  const th = { padding: "6px 8px", textAlign: "left", fontSize: 11.5, color: COLORS.textMuted, fontWeight: 600 };
  const mono = { fontFamily: THEME.font };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name} · business level</div>
        {nav.can.sales(s.id) && <button onClick={() => nav.go("sales", s.id)} style={{ ...UI.btnSmall, color: COLORS.navy }}>Open the sales view for {s.name}<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
      </div>
      <StandingCards sc={sc} kind="sales" title={s.name} ent={s} />
      <LeadKpiRow sc={sc} kind="sales" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))", gap: 12 }}>
        <RankTable title={"New merchants this month (" + s.newList.length + ")"} list={s.newList.slice(0, 10).map((x) => ({ id: x[0], name: x[1], fp: x[2], picked: x[3], dlv: x[4], rev: x[5] }))} cols={[{ h: "Merchant", v: (r) => r.name }, { h: "First pickup", a: "r", v: (r) => r.fp }, { h: "Pickups", a: "r", v: (r) => fmt(r.picked) }, { h: "ASP", a: "r", v: (r) => (r.dlv ? fmt(r.rev / r.dlv, 1) : "—") }]} note="Top 10 by pickups." />
        <RankTable title={"Last month's new merchants (" + s.cohortList.length + ")"} list={s.cohortList.slice(0, 10).map((x) => ({ id: x[0], name: x[1], oct: x[3], sep: x[6] }))} cols={[{ h: "Merchant", v: (r) => r.name }, { h: "Sep pickups", a: "r", v: (r) => fmt(r.sep) }, { h: "Oct pickups", a: "r", v: (r) => fmt(r.oct) }, { h: "Status", v: (r) => <span style={{ color: r.oct > 0 ? COLORS.teal : COLORS.coral, fontWeight: 600 }}>{r.oct > 0 ? "Active" : "No pickup yet"}</span> }]} note="First 10; no pickup yet is shown first." />
        {(s.reactList || []).length > 0 && <RankTable title={"Reactivations (" + s.reactList.length + ")"} list={s.reactList.slice(0, 10).map((x) => ({ id: x[0], name: x[1], fp: x[2], picked: x[3] }))} cols={[{ h: "Merchant", v: (r) => r.name }, { h: "First pickup", v: (r) => r.fp }, { h: "Oct pickups", a: "r", v: (r) => fmt(r.picked) }]} note="No pickup from the 25th of two months ago to the 24th of last month, back since the 25th of last month. First 10 by pickups; they count in the new pickups." />}
      </div>
    </div>
  );
}
function TLScreen({ nav }) {
  const list = nav.allowedTls;
  const t = list.find((x) => x.id === nav.tlId) || list[0];
  if (!t) return <LeadShell nav={nav} current="tl"><div>No team leader in your scope.</div></LeadShell>;
  return (
    <LeadShell nav={nav} current="tl">
      <OrgCrumbs items={leadCrumbs(nav, t.headId, null, t.name)} />
      <OrgSelect value={t.id} onChange={(id) => nav.go("tl", id)} options={list.map((x) => ({ value: x.id, label: x.name }))} />
      <div style={{ color: COLORS.textMuted, fontSize: 13, margin: "6px 0 18px" }}>team leader · {LEAD_TAB_LABEL[t.team]}</div>
      <TLPanel key={t.id} tl={t} nav={nav} />
    </LeadShell>
  );
}
