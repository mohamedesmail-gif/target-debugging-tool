
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
  if (h && nav.can.tab(h.team)) items.push({ label: h.name, onClick: () => nav.go("heads", h.team) });
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
  return { ...mem, rows: LEAD_ROWS.filter((r) => names.has(r.amName)), sc, g: sc.g };
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
function LeadChip({ status }) {
  const c = LEAD_STATUS_COLOR[status];
  return <span style={{ background: c + "22", color: c, borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{status}</span>;
}
const LEAD_INFO = {
  status: "Achieved: pickups so far already reach the monthly target. On track: the run rate reaches it. At risk: the run rate is within 10% below it. Behind: further below. Run rate = pickups so far + the current daily average for each remaining working day, so it moves a lot early in the month.",
  target: "Everything here is measured against the monthly target of the targets sheet (for a team: the target set for the team).",
  daily: "Daily average = pickups so far ÷ working days elapsed. Target pace = the monthly target ÷ the working days of the month. Required daily average = what is still missing ÷ the working days that remain.",
};

// ---------- standing (where the team stands against targets) ----------
function StandingCards({ sc, kind, title }) {
  const isSales = kind === "sales";
  const p = sc.pickups, st = leadStanding(p.actual, p.target, 1);
  if (!st) return null;
  const color = LEAD_STATUS_COLOR[st.status];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 }}>
        <OrgCard label={isSales ? "Monthly new-pickups target" : "Monthly pickups target"} info={isSales ? ORG_INFO.newPickups : "The monthly pickups target from the targets sheet (for a team: as set for the team)."} value={fmt(p.target)} sub="from the targets sheet" />
        <OrgCard label={isSales ? "New pickups so far" : "Pickups so far"} info={LEAD_INFO.target} value={fmt(p.actual)} accent={color} sub={fmt(st.achv * 100, 1) + "% of the monthly target"}><OrgBar pct={Math.min(1, st.achv)} color={color} /></OrgCard>
        <OrgCard label="Daily average" info={LEAD_INFO.daily} value={fmt(st.avgDaily, 0)} accent={st.avgDaily >= st.needDaily ? COLORS.teal : COLORS.coral} sub={"target pace " + fmt(st.needDaily, 0) + " per working day (monthly target ÷ " + DATA.wdFull + ")"} />
        <OrgCard label="Required daily average" info={LEAD_INFO.daily} value={fmt(st.remainNeed, 0)} sub={"per working day for the remaining " + st.remaining + " working days, to reach the monthly target"} />
        <OrgCard label="Run rate" info={"Pickups so far + current daily average x " + st.remaining + " remaining working days. " + LEAD_INFO.status} value={fmt(st.projected, 0)} accent={st.projVsGoal >= 1 ? COLORS.teal : COLORS.coral} sub={fmt(st.projPct * 100, 1) + "% of the monthly target"} />
        <OrgCard label="Status" info={LEAD_INFO.status} value={<LeadChip status={st.status} />} sub={st.short > 0 ? fmt(st.short, 0) + " short of the monthly target" : "monthly target reached"} />
      </div>
      <div style={{ padding: "9px 14px", borderRadius: 10, marginBottom: 14, fontSize: 12.5, background: color + "14", border: `1px solid ${color}44`, color: COLORS.text }}>
        {st.status === "Achieved" ? title + " has reached the monthly target: " + fmt(p.actual) + " pickups against " + fmt(p.target) + "."
          : title + " is " + fmt(st.short, 0) + " pickups short of the monthly target with " + st.remaining + " working days left. At the current daily average of " + fmt(st.avgDaily, 0) + " the run rate ends the month at about " + fmt(st.projected, 0) + " (" + fmt(st.projPct * 100, 0) + "% of the monthly target); reaching the target needs " + fmt(st.remainNeed, 0) + " per working day for the rest of the month."}
      </div>
    </div>
  );
}
function LeadKpiRow({ sc, kind }) { return <OrgScoreCards sc={sc} kind={kind} skipPickups />; }

function StandingTable({ title, info, rows, mode, onRow, renderDetail }) {
  const [open, setOpen] = useState(null);
  const isSales = mode === "sales";
  const th = { padding: "9px 12px", textAlign: "left", fontSize: 10.5, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, whiteSpace: "nowrap" };
  const td = { padding: "9px 12px", whiteSpace: "nowrap", verticalAlign: "top" };
  const mono = { fontFamily: "'IBM Plex Mono', monospace" };
  const pct1 = (a) => fmt(a * 100, 1) + "% of the monthly target";
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center" }}>{title}{info && <InfoTip text={info} />}</div>
      <div style={{ overflowX: "auto", border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, background: COLORS.panel }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ background: "#F5F6F9", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
            <th style={th}>Name</th><th style={th}>{isSales ? "New pickups / monthly target" : "Pickups / monthly target"}</th><th style={th}>Daily avg: actual / target pace</th><th style={th}>Run rate</th><th style={th}>Short of monthly target</th><th style={th}>Status</th><th style={th} />
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = r.sc.pickups, st = leadStanding(p.actual, p.target, 1), expanded = open === r.key;
              return (
                <React.Fragment key={r.key}>
                  <tr onClick={() => (renderDetail ? setOpen(expanded ? null : r.key) : onRow && onRow(r))} style={{ borderTop: `1px solid ${COLORS.panelBorder}`, cursor: renderDetail || onRow ? "pointer" : "default", background: expanded ? "rgba(76,110,245,0.06)" : "transparent" }}>
                    <td style={td}><div style={{ fontWeight: 600, color: renderDetail || onRow ? COLORS.blue : COLORS.text }}>{renderDetail && (expanded ? "▾ " : "▸ ")}{r.name}</div>{r.sub && <div style={{ fontSize: 10.5, color: COLORS.textFaint }}>{r.sub}</div>}</td>
                    <td style={td}>{st ? <div><span style={{ ...mono, fontWeight: 600, color: LEAD_STATUS_COLOR[st.status] }}>{fmt(p.actual)}</span><span style={{ color: COLORS.textFaint, fontSize: 11 }}> / {fmt(st.goal)}</span><div style={{ fontSize: 10.5, color: COLORS.textMuted }}>{pct1(st.achv)}</div></div> : "—"}</td>
                    <td style={{ ...td, ...mono }}>{st ? <span><span style={{ color: st.avgDaily >= st.needDaily ? COLORS.teal : COLORS.coral, fontWeight: 600 }}>{fmt(st.avgDaily, 0)}</span><span style={{ color: COLORS.textFaint }}> / {fmt(st.needDaily, 0)}</span></span> : "—"}</td>
                    <td style={td}>{st ? <div><span style={{ ...mono, fontWeight: 600, color: st.projVsGoal >= 1 ? COLORS.teal : COLORS.coral }}>{fmt(st.projected, 0)}</span><div style={{ fontSize: 10.5, color: COLORS.textMuted }}>{pct1(st.projPct)}</div></div> : "—"}</td>
                    <td style={{ ...td, ...mono }}>{st ? (st.short > 0 ? fmt(st.short, 0) : "—") : "—"}</td>
                    <td style={td}>{st ? <LeadChip status={st.status} /> : "—"}</td>
                    <td style={td}>{r.open && <span onClick={(e) => { e.stopPropagation(); r.open(); }} style={{ color: COLORS.blue, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>Open</span>}</td>
                  </tr>
                  {expanded && renderDetail && (<tr><td colSpan={7} style={{ padding: 0, borderTop: `1px solid ${COLORS.panelBorder}`, background: "#FAFBFC" }}><div style={{ padding: "14px 18px" }}>{renderDetail(r)}</div></td></tr>)}
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
      <div style={{ fontWeight: 700, fontSize: 15, margin: "6px 0 10px", display: "flex", alignItems: "center" }}>{title}{info && <InfoTip text={info} />}</div>
      {children}
    </div>
  );
}
function LeadBase({ sc, rows }) {
  const g = sc.g, portfolio = rows.length, active = rows.filter((r) => r.mtd > 0).length, base = g.retBase, kept = g.retKept, churned = base - kept;
  const rate = (x) => (base ? fmt((x / base) * 100, 1) + "%" : "—");
  return (
    <LeadSection title="Base" info="The merchant base of this scope. Active = at least one pickup this month so far. Retention and churn follow the AM definition: of the merchants active in September, the share that already has a pickup this month (retained) or not yet (churned). Provisional until month end.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <OrgCard label="Total portfolio" info="Merchants assigned to the AMs in this scope." value={fmt(portfolio)} sub="merchants" />
        <OrgCard label="Active merchants" info="Merchants with at least one pickup this month so far." value={fmt(active)} sub={portfolio ? fmt((active / portfolio) * 100, 1) + "% of the portfolio" : ""} />
        <OrgCard label="Churned merchants" info="Merchants active in September with no pickup yet this month. Provisional: many simply have not picked up yet." value={fmt(churned)} accent={COLORS.coral} sub={"of " + fmt(base) + " active in September"} />
        <OrgCard label="Retention rate" info="Merchants active in September that already have a pickup this month ÷ merchants active in September." value={rate(kept)} sub={"provisional · " + fmt(kept) + " retained"} />
        <OrgCard label="Churn rate" info="1 − retention rate." value={rate(churned)} sub="provisional" />
      </div>
    </LeadSection>
  );
}
function leadFreshOutside(sales) { let s = 0; sales.forEach((x) => x.newList.forEach((r) => { if (!LEAD_ROSTER.has(r[0])) s += r[3]; })); return s; }
function LeadActivity({ sc, sales }) {
  const g = sc.g, el = DATA.wdElapsed;
  const fresh = g.newPicked, outside = leadFreshOutside(sales), total = g.pickups + outside, contr = total ? fresh / total : null;
  const a = sc.asp, f = sc.fresh;
  return (
    <LeadSection title="Activity" info="Pickups and ASP of this scope this month so far. Fresh sales = pickups of merchants whose first pickup was this month and who have a sales owner.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <OrgCard label="Total pickups" info="Pickups of the portfolio this month so far." value={fmt(g.pickups)} sub="pickups" />
        <OrgCard label="Avg daily pickups" info="Total pickups ÷ working days elapsed." value={fmt(g.pickups / el, 1)} sub={"per working day (" + el + " elapsed)"} />
        <OrgCard label="Total ASP" info={ORG_INFO.asp} value={a.actual == null ? "—" : fmt(a.actual, 2)} accent={a.actual != null && a.target ? (a.actual >= a.target ? COLORS.teal : COLORS.coral) : undefined} sub={a.target ? "target " + fmt(a.target, 1) : "no target"} />
        <OrgCard label="Fresh sales pickups" info="Pickups of new merchants (first pickup this month) owned by the sales reps of this scope." value={fmt(fresh)} sub={f && f.target ? fmt((fresh / f.target) * 100, 1) + "% of " + fmt(f.target) + " target" : "no target"} />
        <OrgCard label="Fresh sales contribution" info={"Fresh sales pickups ÷ total pickups of the scope (portfolio pickups plus fresh pickups of merchants that are not in an AM portfolio, so nothing is counted twice: " + fmt(outside) + " here)."} value={contr == null ? "—" : fmt(contr * 100, 1) + "%"} sub={"of " + fmt(total) + " total pickups"} />
      </div>
    </LeadSection>
  );
}

function RankTable({ title, info, list, cols, note }) {
  const th = { padding: "6px 8px", textAlign: "left", fontSize: 10, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600, whiteSpace: "nowrap" };
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2, display: "flex", alignItems: "center" }}>{title}{info && <InfoTip text={info} />}</div>
      {note && <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 6 }}>{note}</div>}
      {list.length === 0 ? <div style={{ fontSize: 12, color: COLORS.textFaint, padding: "6px 0" }}>None</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr><th style={th}>#</th>{cols.map((c) => <th key={c.h} style={{ ...th, textAlign: c.a === "r" ? "right" : "left" }}>{c.h}</th>)}</tr></thead>
            <tbody>{list.map((r, i) => (
              <tr key={r.id + ":" + i} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                <td style={{ padding: "5px 8px", color: COLORS.textFaint }}>{i + 1}</td>
                {cols.map((c) => <td key={c.h} style={{ padding: "5px 8px", textAlign: c.a === "r" ? "right" : "left", fontFamily: c.a === "r" ? "'IBM Plex Mono', monospace" : undefined, whiteSpace: c.a === "r" ? "nowrap" : "normal", maxWidth: c.a === "r" ? undefined : 230 }}>{c.v(r)}</td>)}
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
  ["pickups-target", "Pickups target: hit and did not hit"],
  ["asp-target", "ASP target: positive and negative gap contributors"],
  ["retention-target", "Retention target: retained and churned merchants"],
  ["fresh-target", "Fresh sales target: top and bottom fresh merchants"],
  ["churn-target", "Churn target: last month's new merchants retained and churned"],
  ["pickups", "Merchants by pickups: top and bottom"],
  ["asp", "Merchants by ASP: top and bottom"],
  ["growth", "Growers and droppers"],
  ["dsr", "Low DSR merchants"],
  ["vas", "VAS users: top and bottom"],
];
function LeadLists({ rows, sales, sc }) {
  const [view, setView] = useState("pickups-target");
  const [minP, setMinP] = useState(LEAD_MIN_PARCELS);
  const T = sc.asp.target;
  const L = useMemo(() => {
    const minN = Math.max(1, Number(minP) || 1);
    const active = rows.filter((r) => r.mtd > 0);
    const elig = rows.filter((r) => r.dl >= minN);
    const fresh = []; sales.forEach((s) => s.newList.forEach((x) => fresh.push({ id: x[0], name: x[1], amName: s.name, fp: x[2], picked: x[3], dlv: x[4] })));
    const cohort = []; sales.forEach((s) => s.cohortList.forEach((x) => cohort.push({ id: x[0], name: x[1], amName: s.name, oct: x[3], sep: x[6] })));
    const targeted = rows.filter((r) => r.hasTarget);
    const lowDsr = rows.filter((r) => r.dsrSep != null && r.dsrSep <= 65 && r.sepPicked > 0);
    const withDsr = rows.filter((r) => r.dsrSep != null && r.sepPicked > 0);
    const aspRows = rows.filter((r) => r.dl > 0);
    const D = aspRows.reduce((s, r) => s + r.dl, 0), P = D ? aspRows.reduce((s, r) => s + r.rev, 0) / D : null;
    const gapRows = T != null && D ? aspRows.map((r) => ({ ...r, share: r.dl / D, gapC: (r.dl / D) * (r.asp - T) })) : [];
    const retained = rows.filter((r) => r.sepPicked > 0 && r.td > 0), churnedM = rows.filter((r) => r.sepPicked > 0 && r.td === 0);
    return {
      topPick: leadPair(rows, (r) => r.mtd, "desc"), botPick: leadPair(active, (r) => r.mtd, "asc"),
      topAsp: leadPair(elig, (r) => r.asp, "desc"), botAsp: leadPair(elig, (r) => r.asp, "asc"),
      topFresh: leadPair(fresh, (r) => r.picked, "desc"), botFresh: leadPair(fresh, (r) => r.picked, "asc"),
      hit: leadPair(targeted.filter((r) => !r.missedTarget), (r) => r.deviation, "desc"), missed: leadPair(targeted.filter((r) => r.missedTarget), (r) => r.deviation, "asc"),
      nHit: targeted.filter((r) => !r.missedTarget).length, nMissed: targeted.filter((r) => r.missedTarget).length,
      retTop: leadPair(retained, (r) => r.td, "desc"), retBot: leadPair(churnedM, (r) => r.sepPicked, "desc"), nRet: retained.length, nChurnM: churnedM.length,
      cohRet: leadPair(cohort.filter((r) => r.oct > 0), (r) => r.oct, "desc"), cohChurn: leadPair(cohort.filter((r) => r.oct === 0), (r) => r.sep, "desc"),
      nCohRet: cohort.filter((r) => r.oct > 0).length, nCohChurn: cohort.filter((r) => r.oct === 0).length,
      lowDsr: leadPair(lowDsr, (r) => r.sepPicked, "desc"), nLow: lowDsr.length, lowShare: withDsr.reduce((s, r) => s + r.sepPicked, 0) ? lowDsr.reduce((s, r) => s + r.sepPicked, 0) / withDsr.reduce((s, r) => s + r.sepPicked, 0) : null,
      growers: leadPair(rows.filter((r) => r.gain > 0), (r) => r.gain, "desc"), droppers: leadPair(rows.filter((r) => r.gain < 0), (r) => r.gain, "asc"),
      gapNeg: leadPair(gapRows.filter((r) => r.gapC < 0), (r) => r.gapC, "asc"), gapPos: leadPair(gapRows.filter((r) => r.gapC > 0), (r) => r.gapC, "desc"), P,
      vasTop: leadPair(rows.filter((r) => r.vasRev > 0), (r) => r.vasRev, "desc"),
      vasBot: elig.slice().sort((a, b) => a.vasAsp - b.vasAsp || b.dl - a.dl || (a.id < b.id ? -1 : 1)).slice(0, 10),
    };
  }, [rows, sales, minP, T]);
  const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 12, marginBottom: 16 };
  const minTxt = "At least " + (Number(minP) || 1) + " delivered parcels.";
  const colsPick = [rankName(), { h: "Pickups", a: "r", v: (r) => fmt(r.mtd) }, { h: "Avg daily", a: "r", v: (r) => fmt(r.mtdAvgDaily, 1) }];
  const colsAsp = [rankName(), { h: "ASP", a: "r", v: (r) => fmt(r.asp, 2) }, { h: "Parcels", a: "r", v: (r) => fmt(r.dl) }];
  const colsFresh = [{ h: "Merchant", v: (r) => (<div><div style={{ color: COLORS.text }}>{r.name}</div><div style={{ fontSize: 10.5, color: COLORS.textFaint }}>{r.amName} (sales)</div></div>) }, { h: "Pickups", a: "r", v: (r) => fmt(r.picked) }, { h: "First pickup", a: "r", v: (r) => r.fp }];
  const colsHit = [rankName(), { h: "Avg daily", a: "r", v: (r) => fmt(r.mtdAvgDaily, 1) }, { h: "Own target", a: "r", v: (r) => fmt(r.merchantTarget, 1) }, { h: "Achievement", a: "r", v: (r) => fmt(r.contribution * 100, 0) + "%" }, { h: "Δ per day", a: "r", v: (r) => lsgn(r.deviation, 1) }];
  const colsGrow = [rankName(), { h: "Oct 1–4", a: "r", v: (r) => fmt(r.td) }, { h: "Sep 1–4", a: "r", v: (r) => fmt(r.ptd) }, { h: "Change", a: "r", v: (r) => lsgn(r.gain, 0) }, { h: "%", a: "r", v: (r) => (r.ptd > 0 ? lsgn((r.gain / r.ptd) * 100, 0) + "%" : "—") }];
  const colsGap = [rankName(), { h: "ASP Oct 1–4", a: "r", v: (r) => fmt(r.asp, 2) }, { h: "ASP Sep 1–4", a: "r", v: (r) => (r.paspP == null ? "—" : fmt(r.paspP, 2)) }, { h: "ASP change", a: "r", v: (r) => (r.paspP == null ? "—" : lsgn(r.asp - r.paspP, 2)) }, { h: "Parcel share", a: "r", v: (r) => fmt(r.share * 100, 2) + "%" }, { h: "Gap contribution", a: "r", v: (r) => lsgn(r.gapC, 3) }];
  const colsVas = [rankName(), { h: "VAS revenue", a: "r", v: (r) => fmt(r.vasRev) }, { h: "VAS ASP", a: "r", v: (r) => (r.vasAsp == null ? "—" : fmt(r.vasAsp, 2)) }, { h: "Parcels", a: "r", v: (r) => fmt(r.dl) }];
  const colsDsr = [rankName(), { h: "Sep DSR", a: "r", v: (r) => fmt(r.dsrSep, 1) + "%" }, { h: "Sep pickups", a: "r", v: (r) => fmt(r.sepPicked) }];
  const colsRet = [rankName(), { h: "Sep pickups", a: "r", v: (r) => fmt(r.sepPicked) }, { h: "Oct 1–4", a: "r", v: (r) => fmt(r.td) }];
  const colsCoh = [{ h: "Merchant", v: (r) => (<div><div style={{ color: COLORS.text }}>{r.name}</div><div style={{ fontSize: 10.5, color: COLORS.textFaint }}>{r.amName} (sales)</div></div>) }, { h: "Sep pickups", a: "r", v: (r) => fmt(r.sep) }, { h: "Oct pickups", a: "r", v: (r) => fmt(r.oct) }];
  return (
    <LeadSection title="Top 10 and Bottom 10" info="Merchant rankings for this scope, one list at a time. The first lists follow the targets (pickups, ASP, retention, fresh sales, churn); the others are for exploring. Ties are broken by Business ID. Merchant names are not clickable here: a merchant is opened from the AM's portfolio overview.">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: COLORS.textMuted }}>Show</span>
        <select value={view} onChange={(e) => setView(e.target.value)} aria-label="Top and bottom list" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder2}`, borderRadius: 8, color: COLORS.text, fontSize: 13, fontWeight: 600, padding: "6px 10px", maxWidth: "100%" }}>
          {LEAD_VIEWS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {(view === "asp" || view === "vas") && (<><span style={{ fontSize: 12, color: COLORS.textMuted, display: "inline-flex", alignItems: "center" }}>Min. delivered parcels<InfoTip text="A merchant with very few parcels has a meaningless ASP, so the ASP and VAS lists only include merchants above this number." /></span>
        <input type="number" min="1" value={minP} onChange={(e) => setMinP(e.target.value)} style={{ width: 70, padding: "5px 8px", borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, fontSize: 12 }} /></>)}
      </div>
      {view === "pickups-target" && (<div style={grid2}>
        <RankTable title={"Top 10 merchants that hit their pickups target (" + fmt(L.nHit) + " in total)"} list={L.hit} cols={colsHit} info="Existing and reactivated merchants whose daily average is at or above their own target; ranked by pickups per day above target." />
        <RankTable title={"Top 10 merchants that did not hit their pickups target (" + fmt(L.nMissed) + " in total)"} list={L.missed} cols={colsHit} info="Ranked by pickups per day below the merchant's own target." />
      </div>)}
      {view === "asp-target" && (<div style={grid2}>
        <RankTable title="Top 10 positive ASP gap contributors" list={L.gapPos} cols={colsGap} note={T == null ? "No ASP target for this scope." : "Scope ASP " + (L.P == null ? "—" : fmt(L.P, 2)) + " vs ASP target " + fmt(T, 2) + ". Contribution = parcel share × (merchant ASP − target)."} info="Merchants lifting the scope's ASP above its target the most." />
        <RankTable title="Top 10 negative ASP gap contributors" list={L.gapNeg} cols={colsGap} info="Merchants pulling the scope's ASP below its target the most (same logic as the ASP view of the AM table)." />
      </div>)}
      {view === "retention-target" && (<div style={grid2}>
        <RankTable title={"Top 10 churned merchants (" + fmt(L.nChurnM) + " in total)"} list={L.retBot} cols={colsRet} note="Active in September, no pickup yet this month; largest September volume first (the volume at risk). Provisional." info="Retention target view: the merchants that count as churned so far, ranked by the volume they had in September." />
      </div>)}
      {view === "fresh-target" && (<div style={grid2}>
        <RankTable title="Top 10 fresh sales merchants by pickups" list={L.topFresh} cols={colsFresh} note="Merchants whose first pickup was this month, owned by a sales rep of this scope." info="Fresh sales target view: the new merchants that deliver the most." />
        <RankTable title="Bottom 10 fresh sales merchants by pickups" list={L.botFresh} cols={colsFresh} />
      </div>)}
      {view === "churn-target" && (<div style={grid2}>
        <RankTable title={"Top 10 retained new merchants of last month (" + fmt(L.nCohRet) + " in total)"} list={L.cohRet} cols={colsCoh} note="Merchants whose first pickup was last month and who already pick up this month." info="Churn target view (sales): last month's new merchants that stayed." />
        <RankTable title={"Top 10 churned new merchants of last month (" + fmt(L.nCohChurn) + " in total)"} list={L.cohChurn} cols={colsCoh} note="No pickup yet this month; largest September volume first. Provisional." info="Churn target view (sales): last month's new merchants that have not picked up yet." />
      </div>)}
      {view === "pickups" && (<div style={grid2}>
        <RankTable title="Top 10 merchants by pickups" list={L.topPick} cols={colsPick} info="Pickups this month so far; avg daily = pickups ÷ working days elapsed." />
        <RankTable title="Bottom 10 merchants by pickups" list={L.botPick} cols={colsPick} note="Active merchants only (at least one pickup)." />
      </div>)}
      {view === "asp" && (<div style={grid2}>
        <RankTable title="Top 10 merchants by ASP" list={L.topAsp} cols={colsAsp} note={minTxt} />
        <RankTable title="Bottom 10 merchants by ASP" list={L.botAsp} cols={colsAsp} note={minTxt} />
      </div>)}
      {view === "growth" && (<div style={grid2}>
        <RankTable title="Top 10 growers (gained volume)" list={L.growers} cols={colsGrow} info="Pickups Oct 1–4 compared with Sep 1–4 (same days), largest gain first." />
        <RankTable title="Top 10 droppers (lost volume)" list={L.droppers} cols={colsGrow} info="Largest loss in pickups, Oct 1–4 compared with Sep 1–4." />
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
function LeadMain({ kind, ent, sc: scIn }) {
  const S = useMemo(() => leadScope(kind, ent), [kind, ent]);
  return (<div><LeadBase sc={S.sc} rows={S.rows} /><LeadActivity sc={S.sc} sales={S.sales} /><LeadLists rows={S.rows} sales={S.sales} sc={S.sc} /></div>);
}

// ---------- screens ----------
function LeadShell({ nav, current, children }) {
  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, fontFamily: "'Lato', 'Helvetica Neue', Arial, sans-serif", minHeight: "100%", padding: "28px 20px 60px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <LevelBar nav={nav} current={current} />
        {children}
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 8, lineHeight: 1.5 }}>Data as of {ORG.asOf} · targets from October_Targets_2026.xlsx. Pickups are this month so far; ASP, retention and fresh sales use Oct 1–4. New acquisitions = merchants whose first pickup was this month and who have a sales owner.</div>
      </div>
    </div>
  );
}
function LeadershipScreen({ nav, mode }) {
  // mode "vp": the company (tab All, no tab strip). mode "heads": one tab per team, only the teams the person may see.
  const tabs = mode === "vp" ? [["all", "All"]] : LEAD_TABS.filter(([k]) => k !== "all" && nav.can.tab(k));
  const tab = tabs.some(([k]) => k === nav.leadTab) ? nav.leadTab : tabs[0][0];
  const isAll = tab === "all", head = isAll ? null : LEAD_HEAD_BY_TEAM[tab];
  const kind = isAll ? "vp" : "head", ent = isAll ? LEAD_VP_ENT : head;
  const sc = useMemo(() => orgScore(kind, ent), [kind, ent]);
  const title = isAll ? "Sameh Shaheen" : head.name, who = isAll ? "the heads" : "the team";
  const rows = isAll
    ? ORG.heads.map((h) => ({ key: h.id, name: h.name, sub: LEAD_TAB_LABEL[h.team], sc: orgScore("head", h), open: nav.can.tab(h.team) ? () => nav.go("heads", h.team) : null }))
    : ORG.tls.filter((t) => t.headId === head.id).map((t) => ({ key: t.id, name: t.name, sub: "team leader", sc: orgScore("tl", t), open: nav.can.tl(t.id) ? () => nav.go("tl", t.id) : null }));
  const direct = isAll ? [] : ORG.sales.filter((s) => s.headId === head.id && !s.tlId).map((s) => ({ key: s.id, name: s.name, sub: "reports to the head", sc: orgScore("sales", s), open: nav.can.sales(s.id) ? () => nav.go("sales", s.id) : null }));
  return (
    <LeadShell nav={nav} current={mode}>
      <div style={{ fontSize: 11, letterSpacing: "0.12em", color: COLORS.textFaint, textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>Scorecard · {DATA.month}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{title}</div>
      <div style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 14 }}>{isAll ? "VP · " + ORG.heads.length + " heads · " + ORG.tls.length + " team leaders · " + ORG.ams.length + " AMs · " + ORG.sales.length + " sales" : "Head · " + LEAD_TAB_LABEL[tab] + " · " + rows.length + " team leaders"}</div>
      {mode === "heads" && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 6, marginBottom: 16, borderBottom: `1px solid ${COLORS.panelBorder}` }}>
          {tabs.map(([k, l]) => (<button key={k} onClick={() => nav.go("heads", k)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: "8px 8px 0 0", cursor: "pointer", flex: "0 0 auto", border: `1px solid ${tab === k ? COLORS.text : "transparent"}`, background: tab === k ? COLORS.text : "transparent", color: tab === k ? "#fff" : COLORS.textMuted }}>{l}</button>))}
        </div>
      )}
      <LeadSection title={"Where " + who + " stand" + (isAll ? "" : "s") + " against targets"} info="Pickups so far against the monthly target, the run rate at the current daily average, and the other targets. Shown before the main view.">
        <StandingCards sc={sc} kind={kind} title={isAll ? "The company" : "The team"} />
        <LeadKpiRow sc={sc} kind={kind} />
        <StandingTable title={isAll ? "Heads" : "Team leaders"} info={isAll ? "One row per head: where each team stands. Click a row to open that team in the Heads view." : "One row per team leader. Open one to see the AMs and sales underneath."} rows={rows} mode="mix" onRow={(r) => r.open && r.open()} />
        {direct.length > 0 && <StandingTable title="Sales reporting directly to this head" rows={direct} mode="sales" onRow={(r) => r.open && r.open()} />}
      </LeadSection>
      <div style={{ fontWeight: 700, fontSize: 17, margin: "22px 0 4px" }}>Main view</div>
      <LeadMain key={tab} kind={kind} ent={ent} />
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
        {nav.can.am(a.name) && <button onClick={() => nav.goAm(a.name)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, color: COLORS.blue, cursor: "pointer" }}>Open the Target Tracker for {a.name}</button>}
      </div>
      <StandingCards sc={sc} kind="am" title={a.name} />
      <LeadKpiRow sc={sc} kind="am" />
      <LeadMain kind="am" ent={a} />
    </div>
  );
}
function SalesDetailPanel({ s, nav }) {
  const sc = useMemo(() => orgScore("sales", s), [s]);
  const th = { padding: "6px 8px", textAlign: "left", fontSize: 10, color: COLORS.textFaint, textTransform: "uppercase", fontWeight: 600 };
  const mono = { fontFamily: "'IBM Plex Mono', monospace" };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name} · business level</div>
        {nav.can.sales(s.id) && <button onClick={() => nav.go("sales", s.id)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, color: COLORS.blue, cursor: "pointer" }}>Open the sales view for {s.name}</button>}
      </div>
      <StandingCards sc={sc} kind="sales" title={s.name} />
      <LeadKpiRow sc={sc} kind="sales" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 12 }}>
        <RankTable title={"New merchants this month (" + s.newList.length + ")"} list={s.newList.slice(0, 10).map((x) => ({ id: x[0], name: x[1], fp: x[2], picked: x[3], dlv: x[4], rev: x[5] }))} cols={[{ h: "Merchant", v: (r) => r.name }, { h: "First pickup", a: "r", v: (r) => r.fp }, { h: "Pickups", a: "r", v: (r) => fmt(r.picked) }, { h: "ASP", a: "r", v: (r) => (r.dlv ? fmt(r.rev / r.dlv, 1) : "—") }]} note="Top 10 by pickups." />
        <RankTable title={"Last month's new merchants (" + s.cohortList.length + ")"} list={s.cohortList.slice(0, 10).map((x) => ({ id: x[0], name: x[1], oct: x[3], sep: x[6] }))} cols={[{ h: "Merchant", v: (r) => r.name }, { h: "Sep pickups", a: "r", v: (r) => fmt(r.sep) }, { h: "Oct pickups", a: "r", v: (r) => fmt(r.oct) }, { h: "Status", v: (r) => <span style={{ color: r.oct > 0 ? COLORS.teal : COLORS.coral, fontWeight: 600 }}>{r.oct > 0 ? "Active" : "No pickup yet"}</span> }]} note="First 10; no pickup yet is shown first." />
      </div>
    </div>
  );
}
function TLScreen({ nav }) {
  const list = nav.allowedTls;
  const t = list.find((x) => x.id === nav.tlId) || list[0];
  if (!t) return <LeadShell nav={nav} current="tl"><div>No team leader in your scope.</div></LeadShell>;
  const h = ORG_HEAD[t.headId];
  const sc = useMemo(() => orgScore("tl", t), [t]);
  const amRows = ORG.ams.filter((a) => a.tlId === t.id).map((a) => ({ key: a.name, name: a.name, sub: LEAD_TAB_LABEL[a.team], sc: orgScore("am", a), open: nav.can.am(a.name) ? () => nav.goAm(a.name) : null, am: a }));
  const salesRows = ORG.sales.filter((s) => s.tlId === t.id).map((s) => ({ key: s.id, name: s.name, sub: "sales", sc: orgScore("sales", s), open: nav.can.sales(s.id) ? () => nav.go("sales", s.id) : null, s }));
  return (
    <LeadShell nav={nav} current="tl">
      <OrgCrumbs items={leadCrumbs(nav, t.headId, null, t.name)} />
      <OrgSelect value={t.id} onChange={(id) => nav.go("tl", id)} options={list.map((x) => ({ value: x.id, label: x.name }))} />
      <div style={{ color: COLORS.textMuted, fontSize: 13, margin: "6px 0 18px" }}>team leader · {LEAD_TAB_LABEL[t.team]} · reports to {h.name}</div>
      <LeadSection title="Where the team stands against targets" info="The team leader's own targets, then every AM and sales rep underneath. Open a row to see that person's business-level details here.">
        <StandingCards sc={sc} kind="tl" title="The team" />
        <LeadKpiRow sc={sc} kind="tl" />
        {amRows.length > 0 && <StandingTable title="Account managers" info="Click an AM to see the details of that AM (base, activity and merchant rankings) without leaving this screen." rows={amRows} mode="am" renderDetail={(r) => <AmDetailPanel am={r.am} nav={nav} />} />}
        {salesRows.length > 0 && <StandingTable title="Sales" info="Click a sales rep to see the new merchants and last month's cohort." rows={salesRows} mode="sales" renderDetail={(r) => <SalesDetailPanel s={r.s} nav={nav} />} />}
      </LeadSection>
      <div style={{ fontWeight: 700, fontSize: 17, margin: "22px 0 4px" }}>Main view (whole team)</div>
      <LeadMain key={t.id} kind="tl" ent={t} />
    </LeadShell>
  );
}
