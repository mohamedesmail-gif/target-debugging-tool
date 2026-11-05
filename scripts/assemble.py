"""Assemble the single-file Target Tracker component (dist/target_tracker.jsx).

Inputs  : src/*.jsx (code), data/*.json|txt (generated data, NOT in git: see data/README.md)
Output  : dist/target_tracker.jsx  (+ dist/head_patched.jsx for debugging)
Run     : python scripts/assemble.py
"""
import os, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[1]
os.chdir(ROOT / 'src')                      # all reads below are relative to src/ ...
(ROOT / 'dist').mkdir(exist_ok=True)        # ... and data lives in ../data, output in ../dist
R = lambda p: open(p, encoding='utf-8').read()

def mk(text):
    box = {'s': text}
    def rep(old, new, count=1, regex=False):
        if regex:
            box['s'], n = re.subn(old, new, box['s'], flags=re.S); assert n == count, (n, count, old[:70])
        else:
            n = box['s'].count(old); assert n == count, (n, count, old[:90]); box['s'] = box['s'].replace(old, new)
    return box, rep

# ---------------------------------------------------------------- tracker part
tb, trep = mk(R('tracker.jsx'))
import json as _json
_lines = tb['s'].split('\n'); assert _lines[3].startswith('const DATA = __DATA__')
_D = _json.load(open('../data/new_data_oct.json', encoding='utf-8'))
_ptd = _json.load(open('../data/ptd_sep1_4.json')); _td = _json.load(open('../data/td_oct1_4.json')); _asp = _json.load(open('../data/merchant_asp.json')); _dsr = _json.load(open('../data/merchant_dsr.json'))
for _am in _D['ams'].values():
    for _m in _am['merchants']:
        _m['ptd'] = _ptd.get(_m['id'], 0); _m['td'] = _td.get(_m['id'], 0)
        _m['dsrSep'], _m['sepPicked'] = _dsr.get(_m['id'], [None, 0])
        _v = _asp.get(_m['id'], [0, 0, 0, 0, 0, 0]); _m['aspRev'], _m['aspVas'], _m['aspDlv'], _m['pRev'], _m['pVas'], _m['pDlv'] = _v
_lines[3] = 'const DATA = __P.data;      // all data comes from the payload (dist/payload.json), built from the warehouse by jobs/refresh_payload.py\n'
_lines.insert(4, 'const ORG = __P.org;')
tb['s'] = '\n'.join(_lines)
trep('  const [selectedMerchant, setSelectedMerchant] = useState(null);\n  const openMerchantProfile = (m) => { setSelectedMerchant({ ...m, am: amName }); setScreen("profile"); };',
     '  const [profileBack, setProfileBack] = useState("tracker");\n  const [selectedMerchant, setSelectedMerchant] = useState(null);\n  const openMerchantProfile = (m, from) => { setSelectedMerchant({ ...m, am: m.am || amName }); setProfileBack(from || "tracker"); setScreen("profile"); };')
trep('"tracker" | "profile" \u2014 in-app navigation', '"tracker" | "profile" | "portfolio" \u2014 in-app navigation') if '"tracker" | "profile" \u2014 in-app navigation' in tb['s'] else None
trep('''  if (screen === "profile") {
    return <MerchantProfileScreen merchant={selectedMerchant} onBack={() => setScreen("tracker")} />;
  }''', '''  if (screen === "portfolio") {
    return <PortfolioScreen am={amName} amData={amData} analysis={analysis} onBack={() => setScreen("tracker")} onOpenMerchant={(m) => openMerchantProfile(m, "portfolio")} />;
  }
  if (screen === "profile") {
    return <MerchantProfileScreen merchant={selectedMerchant} onBack={() => setScreen(profileBack)} backLabel={profileBack === "portfolio" ? "\u2190 Back to portfolio overview" : "\u2190 Back to Target Tracker"} />;
  }''')

# growth status: Oct 1-4 vs Sep 1-4 (same days), both on parcels_picked
trep('      // Growth status: this month\'s avg daily (MTD) vs last month\'s (September) avg daily\n      const augAvgDaily = m.monthly.sep / WD_BY_MONTH.sep;\n      let growthStatus = null, growthPct = null;\n      if (augAvgDaily > 0) {\n        growthPct = ((m.mtdAvgDaily - augAvgDaily) / augAvgDaily) * 100;',
     '      // Growth status: the first N days of this month vs the SAME first N days of last month (same days, same metric: pickups)\n      const ptdAvgDaily = (m.ptd || 0) / DATA.wdPtd;\n      const tdAvgDaily = (m.td || 0) / DATA.wdElapsed;\n      let growthStatus = null, growthPct = null;\n      if (ptdAvgDaily > 0) {\n        growthPct = ((tdAvgDaily - ptdAvgDaily) / ptdAvgDaily) * 100;')
trep('Growth status vs. last month:{" "}', 'Growth status vs. the same days last month:{" "}')
trep('{fmt(insight.growthPct, 1)}% MoM avg daily)', '{fmt(insight.growthPct, 1)}% avg daily, days 1\u2013{DATA.ptdDays} vs last month\'s days 1\u2013{DATA.ptdDays})')

# ---- org levels: states, navigation, routes, level bar, AM scorecards; the merchant-profile entry points are disabled
trep('  const [profileBack, setProfileBack] = useState("tracker");\n  const [selectedMerchant, setSelectedMerchant] = useState(null);\n  const openMerchantProfile = (m, from) => { setSelectedMerchant({ ...m, am: m.am || amName }); setProfileBack(from || "tracker"); setScreen("profile"); };',
     '  const [sess, setSess] = useState(hostSession || (AUTH_ENABLED ? null : AUTH_DEFAULT_SESSION));\n  const [loginMsg, setLoginMsg] = useState(null);\n  const viewerKey = sess ? sess.viewerKey : "vp";\n  const [leadTab, setLeadTab] = useState("all");\n  const [tlId, setTlId] = useState(ORG.tls[0].id);\n  const [salesId, setSalesId] = useState(ORG.sales[0].id);\n  const [dailySpec, setDailySpec] = useState(null);\n  const [dailyFrom, setDailyFrom] = useState("vp");')
trep('const [screen, setScreen] = useState("tracker");', 'const [screen, setScreen] = useState(hostSession ? viewerDefault(parseViewer(hostSession.viewerKey)).screen : "vp");')
trep(r'  if \(screen === "portfolio"\) \{.*?\n  \}\n  if \(screen === "profile"\) \{.*?\n  \}',
     """  const viewer = parseViewer(viewerKey), scope = scopeOf(viewer);
  const nav = {
    screen, leadTab, tlId, salesId, viewer, viewerKey, scope,
    can: { vp: scope.vp, tab: (k) => leadTabAllowed(scope, k), tl: (id) => scope.tls.has(id), am: (n) => scope.ams.has(n), sales: (id) => scope.sales.has(id) },
    allowedAms: AM_NAMES.filter((n) => scope.ams.has(n)),
    allowedTls: ORG.tls.filter((t) => scope.tls.has(t.id)),
    allowedSales: ORG.sales.filter((s) => scope.sales.has(s.id)),
    go: (level, id) => {
      if (level === "vp") setScreen("vp");
      else if (level === "heads") { const tabs = LEAD_TABS.filter(([k]) => k !== "all" && leadTabAllowed(scope, k)).map(([k]) => k); setLeadTab(tabs.includes(id) ? id : tabs[0]); setScreen("heads"); }
      else if (level === "tl") { const ok = ORG.tls.filter((t) => scope.tls.has(t.id)); setTlId(ok.some((t) => t.id === id) ? id : ok[0].id); setScreen("tl"); }
      else if (level === "sales") { const ok = ORG.sales.filter((s) => scope.sales.has(s.id)); setSalesId(ok.some((s) => s.id === id) ? id : ok[0].id); setScreen("sales"); }
      else if (level === "am") { if (!scope.ams.has(amName)) setAmName(AM_NAMES.find((n) => scope.ams.has(n))); setExpandedId(null); setScreen("tracker"); }
    },
    goAm: (name) => { if (!scope.ams.has(name)) return; setAmName(name); setExpandedId(null); setScreen("tracker"); },
    openDaily: (cur) => {
      let spec;
      if (cur === "vp") spec = { kind: "vp", ent: LEAD_VP_ENT };
      else if (cur === "heads") { const tabs = LEAD_TABS.filter(([k]) => k !== "all" && leadTabAllowed(scope, k)).map(([k]) => k); spec = { kind: "head", ent: LEAD_HEAD_BY_TEAM[tabs.includes(leadTab) ? leadTab : tabs[0]] }; }
      else if (cur === "tl") { const ok = ORG.tls.filter((t) => scope.tls.has(t.id)); spec = { kind: "tl", ent: ok.find((t) => t.id === tlId) || ok[0] }; }
      else if (cur === "sales") { const ok = ORG.sales.filter((x) => scope.sales.has(x.id)); spec = { kind: "sales", ent: ok.find((x) => x.id === salesId) || ok[0] }; }
      else spec = { kind: "am", ent: ORG.ams.find((a) => a.name === amName) };
      setDailySpec(spec); setDailyFrom(cur); setScreen("daily");
    },
    session: sess,
    signOut: () => { setSess(null); setLoginMsg(AUTH_MESSAGES.signedOut); setExpandedId(null); if (onSignOut) onSignOut(); },
  };
  const signIn = (account) => {
    const r = authorize(account);
    if (!r.ok) { setLoginMsg(r.message); return; }
    const d = viewerDefault(parseViewer(r.session.viewerKey));
    setLoginMsg(null); setExpandedId(null); setSess(r.session);
    if (d.tab) setLeadTab(d.tab);
    if (d.tlId) setTlId(d.tlId);
    if (d.salesId) setSalesId(d.salesId);
    if (d.am) setAmName(d.am);
    setScreen(d.screen);
  };
  if (!sess) return <LoginScreen message={loginMsg} onAccount={signIn} />;
  if (screen === "portfolio") {
    return <PortfolioScreen am={amName} amData={amData} analysis={analysis} onBack={() => setScreen("tracker")} />;
  }
  if (screen === "daily" && dailySpec) return <DailyAnalysisScreen nav={nav} spec={dailySpec} onBack={() => nav.go(dailyFrom === "heads" ? "heads" : dailyFrom, dailyFrom === "heads" ? leadTab : dailyFrom === "tl" ? tlId : dailyFrom === "sales" ? salesId : undefined)} />;
  if (screen === "vp") return <LeadershipScreen nav={nav} mode="vp" />;
  if (screen === "heads") return <LeadershipScreen nav={nav} mode="heads" />;
  if (screen === "tl") return <TLScreen nav={nav} />;
  if (screen === "sales") return <SalesScreen nav={nav} />;""", regex=True)
trep('      <div style={{ maxWidth: 1080, margin: "0 auto" }}>\n        {/* Header */}', '      <div style={{ maxWidth: 1080, margin: "0 auto" }}>\n        <LevelBar nav={nav} current="am" />\n        {/* Header */}')
trep('Phase 1 &middot; Pickups &middot; {DATA.month}', 'Scorecard &middot; {DATA.month}')
trep('        <AchievementBar pct={analysis.targetProgressPct} />', '        <AchievementBar pct={analysis.targetProgressPct} detail={fmt(analysis.totalActualMtdPickups) + " of " + fmt(analysis.thresholdDailyTarget) + " pickups"} />\n        <AmScoreCards amName={amName} an={analysis} />')
trep(r'<button\n\s+onClick=\{\(e\) => \{ e\.stopPropagation\(\); openMerchantProfile\(m\); \}\}.*?\{m\.name\}\n\s+</button>', '<span>{m.name}</span>', regex=True)
trep(r'\n          <div style=\{\{ marginTop: 4 \}\}>\n            <button\n              onClick=\{\(\) => onOpenProfile\(merchant\)\}.*?View full merchant profile.*?</button>\n          </div>', '', regex=True)
trep('<MerchantDrilldown merchant={m} weight={m.merchantTarget} onOpenProfile={openMerchantProfile} />', '<MerchantDrilldown merchant={m} weight={m.merchantTarget} />')

# ---- Merchant detail table: toggle Pickups / ASP
trep('  const [expandedId, setExpandedId] = useState(null);', '  const [expandedId, setExpandedId] = useState(null);\n  const [tableView, setTableView] = useState("pickups"); // "pickups" | "asp"')
trep('    const arr = [...analysis.merchants];', '    const aspC = aspContext(analysis.merchants, amName);\n    const arr = analysis.merchants.map((m) => aspFields(m, aspC));')
trep('  }, [analysis.merchants, sortKey, sortDir]);', '  }, [analysis.merchants, sortKey, sortDir, amName]);')
trep('      if (sortKey === "mtd") return dir * (a.mtd - b.mtd);', '      if (sortKey.startsWith("asp")) { const x = a[sortKey], y = b[sortKey]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return typeof x === "string" ? dir * x.localeCompare(y) : dir * (x - y); } // merchants without an ASP always last\n      if (sortKey === "mtd") return dir * (a.mtd - b.mtd);')
_ts = tb['s'].index('        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>\n          <div style={{ maxHeight: 520')
_te = tb['s'].index('        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: COLORS.textFaint, padding: "10px 4px"')
_old = tb['s'][_ts:_te]
_toggle = """        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "-6px 0 10px", flexWrap: "wrap" }}>
          {[["pickups", "Pickups"], ["asp", "ASP"]].map(([k, l]) => (
            <button key={k} onClick={() => { setTableView(k); setSortKey(k === "asp" ? "aspGapC" : "mtdAvgDaily"); setSortDir(k === "asp" ? "asc" : "desc"); setExpandedId(null); }} style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: "pointer", border: `1px solid ${tableView === k ? COLORS.text : COLORS.panelBorder2}`, background: tableView === k ? COLORS.text : COLORS.panel, color: tableView === k ? "#fff" : COLORS.textMuted }}>{l}</button>
          ))}
          <InfoTip text="Switch the table between pickups and ASP. ASP = delivery revenue ÷ delivered parcels, Oct 1–4, compared with the same days of September. Shipping ASP = (revenue − VAS) ÷ delivered; VAS ASP = VAS revenue ÷ delivered." />
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Search:</span>
          <input value={fid} onChange={(e) => setFid(e.target.value)} placeholder="Business ID" aria-label="Search business ID" style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, fontSize: 12.5, minWidth: 150, background: COLORS.panel }} />
          <input value={fname} onChange={(e) => setFname(e.target.value)} placeholder="Business name" aria-label="Search business name" style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, fontSize: 12.5, minWidth: 170, background: COLORS.panel }} />
          {(fid || fname) && <button onClick={() => { setFid(""); setFname(""); }} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, cursor: "pointer" }}>Clear</button>}
        </div>
        {tableView === "pickups" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "0 0 10px" }}>
            <span style={{ fontSize: 11.5, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".06em", marginRight: 2 }}>Compare with</span>
            {[["prev", "Last month"], ["target", "Merchants contribution"]].map(([k, l]) => (
              <button key={k} onClick={() => { setCmpView(k); setSortKey("mtdAvgDaily"); setSortDir("desc"); setExpandedId(null); }} style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: "pointer", border: `1px solid ${cmpView === k ? COLORS.text : COLORS.panelBorder2}`, background: cmpView === k ? COLORS.text : COLORS.panel, color: cmpView === k ? "#fff" : COLORS.textMuted }}>{l}</button>
            ))}
            <InfoTip text="Last month: this month's average per working day against the same days of last month, with GR % and run rate. Merchants contribution: each merchant's weight in the portfolio target (September × 1.60 ÷ working days), with achievement %." />
          </div>
        )}
        {tableView === "asp" ? (
          <AspMerchantTable rows={sortedMerchants} sortKey={sortKey} sortDir={sortDir} onSort={onSort} expandedId={expandedId} onRowClick={onRowClick} amName={amName} />
        ) : (
"""
tb['s'] = tb['s'][:_ts] + _toggle + _old.rstrip('\n') + "\n        )}\n" + tb['s'][_te:]


# AM select + portfolio button
trep(r'(          <select\n            value=\{amName\}.*?          </select>\n)',
     r'''          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
\1            <button onClick={() => setScreen("portfolio")} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${COLORS.blue}`, background: COLORS.panel, color: COLORS.blue, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Portfolio overview →</button>
          </div>
''', regex=True)
# StatCard + AchievementBar info icons
trep('function StatCard({ label, value, sub, footnote, accent }) {', 'function StatCard({ label, value, sub, footnote, accent, info }) {')
trep('marginBottom: 4 }}>{label}</div>', 'marginBottom: 4, display: "flex", alignItems: "center" }}>{label}{info && <InfoTip text={info} />}</div>')
trep('>Achievement vs. Target</span>', '>Pickups achievement vs. monthly target<InfoTip text="Pickups so far \u00f7 the monthly pickups target from the targets sheet. 100% means the target is reached. ASP and retention have their own targets in the cards below." /></span>')
trep('{fmt(pct, 1)}% of Target', '{fmt(pct, 1)}% of monthly target')
infos = [
 ('<StatCard label="Monthly target"', "AM's pickup target for the month, from the October targets sheet."),
 ('<StatCard label="Target daily avg"', "Monthly target \u00f7 working days in the month: the pickups per working day the month needs on average."),
 ('<StatCard label={`Actual daily avg', "Pickups so far this month \u00f7 working days elapsed (Fridays excluded)."),
 ('<StatCard label="Run rate (month end)"', "Run rate = pickups so far + the current daily average \u00d7 the remaining working days: where the month ends if the pace does not change."),
 ('<StatCard label="Growers"', "Merchants whose average pickups per working day so far is at least 15% above the same days of last month (GR % of +15% or more). A merchant with no pickups in the same days of last month and pickups now counts as a grower."),
 ('<StatCard label="Droppers"', "Merchants whose average pickups per working day so far is at least 15% below the same days of last month (GR % of -15% or less), and who still have pickups this month."),
 ('<StatCard label="Stable"', "Merchants whose GR % is between -15% and +15%."),
 ('<StatCard label="Churned"', "Merchants with no pickups yet this month."),
 ('<StatCard label="New"', "Merchants that joined this month."),
]
for k, t in infos:
    trep(k, k.replace('<StatCard ', '<StatCard info="' + t.replace('"', '&quot;') + '" ', 1))
trep('label="Monthly target"', 'label="Monthly pickups target"')

# ---------------------------------------------------------------- head (loaders/helpers)
hb, hrep = mk(R('head.jsx'))
hrep('// MERCHANT PROFILE SCREEN (Phase 2, now live) \u2014 real data pulled from\n// mart.mart_merchant_metrics for business_id ImbeR25m9 (Trend Hub).\n// Prefixed MP_ to avoid any collision with Target Tracker\'s own DATA/consts.',
     '// MERCHANT PROFILE + AM PORTFOLIO OVERVIEW \u2014 one set of components, two modes (MP_MODE).\n// Data comes from mart.v_merchant_monthly_wide / v_merchant_daily_wide / v_parcel_lifecycle plus\n// public.businesses (website) and public.business_invitations (sub-accounts).\n// Prefixed MP_ to avoid any collision with Target Tracker\'s own DATA/consts.')
hrep('let MP_X = { source: null, sourcePct: null, locations: [] };',
     'let MP_X = { source: null, sourcePct: null, locations: [], website: null, parentId: null, parentName: null, nSubs: 0 };\nlet MP_MODE = "merchant"; // "merchant" | "portfolio"\nlet MP_PF = null;         // portfolio context (AM name, merchants, parsed monthly packs, stats)\nlet MP_CUR_WD = 0;        // working days (Fridays excluded) elapsed in the current month')
hrep('function mpParsePacks(mpack, dpack) {', 'const MP_M_EXTRA = ["active_merchants", "vas_merchants", "new_merchants"], MP_D_EXTRA = ["active_merchants"];\nfunction mpParsePacks(mpack, dpack, portfolio) {\n  const mf = portfolio ? MP_M_FIELDS.concat(MP_M_EXTRA) : MP_M_FIELDS, df = portfolio ? MP_D_FIELDS.concat(MP_D_EXTRA) : MP_D_FIELDS;')
hrep('MP_M_FIELDS.forEach((f, j) => { o[f] = v[j]; });', 'mf.forEach((f, j) => { o[f] = v[j]; });')
hrep('MP_D_FIELDS.forEach((f, j) => { o[f] = v[j]; });', 'df.forEach((f, j) => { o[f] = v[j]; });')
hrep('  const x = (store.x && store.x[merchant.id]) || {};\n', '  const x = (store.x && store.x[merchant.id]) || {};\n  MP_MODE = "merchant"; MP_PF = null;\n')
hrep('MP_X = { source: x.s || null, sourcePct: x.sp == null ? null : x.sp, locations: x.l || [] };\n  mpBuildSamples(merchant.id);',
     'MP_X = { source: x.s || null, sourcePct: x.sp == null ? null : x.sp, locations: x.l || [], website: x.w || null, parentId: x.pid || null, parentName: x.pn || null, nSubs: x.ns || 0 };\n  MP_CUR_WD = MP_DAILY_CUR.filter((d) => dayOfWeekName(d.date) !== "Friday").length;\n  mpBuildSamples(merchant.id);')
hrep('function mpPct100(r, k) {', r'''function mpParseMonthly(mpack) {
  return mpack.split(";").map((seg, i) => {
    const v = seg.split(",").map(Number); const o = { month: MP_MONTH_KEYS[i] };
    MP_M_FIELDS.forEach((f, j) => { o[f] = v[j]; });
    return o;
  });
}
async function mpLoadPortfolio(am, amData, analysis) {
  const store = await mpLoadStore();
  const pf = store.pf && store.pf[am];
  if (!pf && !(analysis && analysis.synthetic)) throw new Error("No merchants are assigned to " + am + " yet, so there is no portfolio to show.");
  const { monthly, daily } = mpParsePacks(pf[0], pf[1], true);
  MP_MODE = "portfolio";
  MP_MERCHANT = { id: "", name: am, segment: "", accountManager: am, joinDate: "", lastActivity: null };
  MP_MONTHLY = monthly;
  MP_DAILY_PREV = daily.filter((d) => d.date < MP_CUR_MONTH_START);
  MP_DAILY_CUR = daily.filter((d) => d.date >= MP_CUR_MONTH_START);
  MP_COMBINED_DAILY = MP_DAILY_PREV.concat(MP_DAILY_CUR);
  MP_CUR_WD = MP_DAILY_CUR.filter((d) => dayOfWeekName(d.date) !== "Friday").length;
  const parsed = [];
  let subs = 0, parents = 0, websites = 0;
  const segCount = {};
  analysis.merchants.forEach((m) => {
    const e = store.p[m.id]; const x = (store.x && store.x[m.id]) || {};
    if (e) parsed.push({ item: { ...m, am }, monthly: mpParseMonthly(e[0]) });
    if (x.pid) subs++; if (x.ns) parents++; if (x.w) websites++;
    segCount[m.seg] = (segCount[m.seg] || 0) + 1;
  });
  const n = analysis.merchants.length || 1;
  const segmentMix = Object.entries(segCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, c]) => s + " " + Math.round((c / n) * 100) + "%").join(" · ");
  MP_PF = { am, target: amData.target, team: amData.team || "", count: amData.base, analysis, parsed, stats: { subs, parents, websites, segmentMix } };
  MP_X = { source: null, sourcePct: null, locations: [], website: null, parentId: null, parentName: null, nSubs: 0 };
}
// top merchants of the portfolio for one month and one field (clickable items)
function mpPfRank(monthIdx, key, topN) {
  if (!MP_PF) return [];
  return MP_PF.parsed.map((p) => ({ label: p.item.name, value: p.monthly[monthIdx][key] || 0, item: p.item })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, topN);
}

function mpPct100(r, k) {''')
hrep('    const out = { week: w.week, dayCount: w.days.length };', '    const out = { week: w.week, dayCount: w.days.length, start: w.days[0].date };')

hrep('const MP_D_FIELDS = ["ecomm_pickups", "fulfillment_pickups", "box_pickups", "parcels_picked", "parcels_delivered", "delivery_revenue_total", "delivery_revenue_vas_total", "dsr", "asr", "fake_attempts", "rto_without_attempt", "parcels_lost", "parcels_damaged", "compensation_amount"];',
     'const MP_D_FIELDS = ["ecomm_pickups", "fulfillment_pickups", "box_pickups", "parcels_picked", "parcels_delivered", "delivery_revenue_total", "delivery_revenue_vas_total", "dsr_num", "dsr_den", "asr_num", "asr_den", "fake_attempts", "rto_without_attempt", "parcels_lost", "parcels_damaged", "compensation_amount"];')
hrep('    o.dsr = o.dsr < 0 ? null : o.dsr / 10000;\n    o.asr = o.asr < 0 ? null : o.asr / 10000;\n    return o;\n  });\n  return { monthly, daily };',
     '    o.dsr = o.dsr_den > 0 ? o.dsr_num / o.dsr_den : null; // exact: ratio of sums, so any window can be re-aggregated\n    o.asr = o.asr_den > 0 ? o.asr_num / o.asr_den : null;\n    return o;\n  });\n  return { monthly, daily };')
a = hb['s'].index('function weeklyFromDailyMP('); b = hb['s'].index('function computeFlagsMP(')
hb['s'] = hb['s'][:a] + r"""// ---- same-length period helpers: every aggregate is built from daily rows (ratio of sums for DSR / ASR) ----
const MP_SUM_KEYS = ["ecomm_pickups", "fulfillment_pickups", "box_pickups", "parcels_picked", "parcels_delivered", "delivery_revenue_total", "delivery_revenue_vas_total", "dsr_num", "dsr_den", "asr_num", "asr_den", "fake_attempts", "rto_without_attempt", "parcels_lost", "parcels_damaged", "compensation_amount"];
function mpPfActive(dates) {
  if (!MP_PF || !MP_PF.dateIdx) return null;
  const idx = dates.map((d) => MP_PF.dateIdx[d]).filter((i) => i != null);
  return MP_PF.parsed.filter((p) => idx.some((i) => p.daily[i] > 0)).length; // distinct merchants with a pickup in the window
}
function mpAggregate(days, partial) {
  const out = { dayCount: days.length, start: days.length ? days[0].date : null, end: days.length ? days[days.length - 1].date : null };
  MP_SUM_KEYS.forEach((k) => { out[k] = days.reduce((s, d) => s + (d[k] || 0), 0); });
  out.dsr = out.dsr_den > 0 ? out.dsr_num / out.dsr_den : null;
  out.asr = out.asr_den > 0 ? out.asr_num / out.asr_den : null;
  if (partial) { out.dsr = null; out.asr = null; out.partial = true; } // DSR / ASR are cohort-based: never aggregated over a partial period
  if (MP_MODE === "portfolio") out.active_merchants = mpPfActive(days.map((d) => d.date));
  return out;
}
function mpWeeksOf(daily) {
  const weeks = {}; const order = [];
  daily.forEach((d) => {
    const dt = new Date(d.date + "T00:00:00Z");
    const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const key = "W" + Math.ceil(((dt - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7); // Sunday-start weeks
    if (!weeks[key]) { weeks[key] = { week: key, days: [] }; order.push(key); }
    weeks[key].days.push(d);
  });
  return order.map((k) => weeks[k]);
}
function weeklyFromDailyMP(daily) { return mpWeeksOf(daily).map((w) => ({ week: w.week, ...mpAggregate(w.days, w.days.length < 7) })); }
function weekOfMonthFromDailyMP(daily) {
  const buckets = {};
  daily.forEach((d) => { const key = "Week " + Math.ceil(dayOfMonth(d.date) / 7); (buckets[key] = buckets[key] || []).push(d); });
  return Object.keys(buckets).sort().map((label) => ({ label, ...mpAggregate(buckets[label], buckets[label].length < 7) }));
}
// DSR / ASR are shown for complete periods only: when the month is still running, use the last complete month
function mpDsrIdx(monthIdx) { return monthIdx === MP_MONTHLY.length - 1 ? monthIdx - 1 : monthIdx; }
// month-to-date vs the SAME days of the previous month (or two complete months)
function mpTdPair(monthIdx) {
  if (monthIdx === MP_MONTHLY.length - 1) {
    const n = MP_DAILY_CUR.length;
    const mo = (i) => MP_MON3[Number(MP_MONTHLY[i].month.slice(5)) - 1];
    return { td: true, cur: mpAggregate(MP_DAILY_CUR, true), prev: mpAggregate(MP_DAILY_PREV.filter((d) => dayOfMonth(d.date) <= n), true), label: mo(monthIdx - 1) + " 1–" + n, curLabel: mo(monthIdx) + " 1–" + n };
  }
  if (monthIdx < 1) return { td: false, cur: MP_MONTHLY[monthIdx], prev: null, label: "", curLabel: "" };
  return { td: false, cur: MP_MONTHLY[monthIdx], prev: MP_MONTHLY[monthIdx - 1], label: MP_MON3[Number(MP_MONTHLY[monthIdx - 1].month.slice(5)) - 1], curLabel: "" };
}

""" + hb['s'][b:]
hrep('if (e) parsed.push({ item: { ...m, am }, monthly: mpParseMonthly(e[0]) });', 'if (e) parsed.push({ item: { ...m, am }, monthly: mpParseMonthly(e[0]), daily: e[1].split(";").map((seg) => Number(seg.split(",")[3])) });')
hrep('MP_PF = { am, target: amData.target, team: amData.team || "", count: amData.base, analysis, parsed, stats: { subs, parents, websites, segmentMix } };',
     'const dateIdx = {}; MP_COMBINED_DAILY.forEach((d, i) => { dateIdx[d.date] = i; });\n  MP_PF = { am, target: amData.target, team: amData.team || "", count: amData.base, analysis, parsed, dateIdx, stats: { subs, parents, websites, segmentMix } };')

hrep('let MP_CUR_WD = 0;', 'let MP_CUR_WD = 0;\nlet MP_CM = null;      // current-month detail: parcel issues, tickets, failed attempts (embedded, roster only)\nlet MP_CM_P = { i: {}, t: {}, a: {} };')
hrep('  mpBuildSamples(merchant.id);', '  MP_CM = store.cm || null; MP_CM_P = { i: {}, t: {}, a: {} };')
hrep('  MP_MODE = "portfolio";\n', '  MP_MODE = "portfolio";\n  MP_CM = store.cm || null; MP_CM_P = { i: {}, t: {}, a: {} };\n')

# ---- filtered group of merchants: the portfolio view built from the merchants' own packs
hrep('async function mpLoadPortfolio(am, amData, analysis) {', 'async function mpLoadPortfolio(am, amData, analysis, subset) {')
hrep('  const { monthly, daily } = mpParsePacks(pf[0], pf[1], true);\n  MP_MODE = "portfolio";', '  const list = subset || analysis.merchants;\n  const { monthly, daily } = (subset || !pf) ? mpAggregateSubset(store, list) : mpParsePacks(pf[0], pf[1], true);\n  MP_MODE = "portfolio";')
hrep('  analysis.merchants.forEach((m) => {\n    const e = store.p[m.id];', '  list.forEach((m) => {\n    const e = store.p[m.id];')
hrep('  const n = analysis.merchants.length || 1;', '  const n = list.length || 1;')
hrep('MP_PF = { am, target: amData.target, team: amData.team || "", count: amData.base, analysis, parsed,', 'MP_PF = { am, target: amData.target, team: amData.team || "", kind: amData.kind || "account manager", skipped: amData.skipped || 0, count: list.length, total: amData.base, filtered: !!subset, analysis: subset ? mpSubsetAnalysis(subset) : analysis, parsed,')
hrep('// top merchants of the portfolio for one month and one field (clickable items)', r"""// Sum of the selected merchants. Additive fields are exact; DSR is exact too when weighted by pickups (its denominator is the
// pickups of the cohort); ASR weighted by pickups is approximate (within about 1 point) for months before October.
function mpAggregateSubset(store, merchants) {
  const ADD = MP_M_FIELDS.filter((f) => f !== "dsr" && f !== "asr");
  const monthly = MP_MONTH_KEYS.map((mk) => { const o = { month: mk }; ADD.forEach((f) => { o[f] = 0; }); o.dsr_avg = null; o.asr_avg = null; o.active_merchants = 0; o.vas_merchants = 0; o.new_merchants = 0; return o; });
  const w = monthly.map(() => ({ dn: 0, dd: 0, an: 0, ad: 0 }));
  let days = null;
  merchants.forEach((m) => {
    const e = store.p[m.id]; if (!e) return;
    const p = mpParsePacks(e[0], e[1]);
    p.monthly.forEach((r, i) => {
      ADD.forEach((f) => { monthly[i][f] += r[f] || 0; });
      if ((r.parcels_picked || 0) > 0) monthly[i].active_merchants++;
      if ((r.delivery_revenue_vas_total || 0) > 0) monthly[i].vas_merchants++;
      const wt = r.parcels_picked || 0;
      if (r.dsr_avg != null && wt > 0) { w[i].dn += r.dsr_avg * wt; w[i].dd += wt; }
      if (r.asr_avg != null && wt > 0) { w[i].an += r.asr_avg * wt; w[i].ad += wt; }
    });
    if (!days) days = p.daily.map((d) => { const o = { date: d.date }; MP_D_FIELDS.forEach((f) => { o[f] = 0; }); o.active_merchants = 0; return o; });
    p.daily.forEach((d, i) => { MP_D_FIELDS.forEach((f) => { days[i][f] += d[f] || 0; }); if ((d.parcels_picked || 0) > 0) days[i].active_merchants++; });
  });
  monthly.forEach((o, i) => { o.dsr_avg = w[i].dd ? w[i].dn / w[i].dd : null; o.asr_avg = w[i].ad ? w[i].an / w[i].ad : null; });
  (days || []).forEach((d) => { d.dsr = d.dsr_den > 0 ? d.dsr_num / d.dsr_den : null; d.asr = d.asr_den > 0 ? d.asr_num / d.asr_den : null; });
  merchants.forEach((m) => { const i = MP_MONTH_KEYS.indexOf(String(m.jd || "").slice(0, 7)); if (i >= 0) monthly[i].new_merchants++; });
  return { monthly, daily: days || [] };
}
function mpSubsetAnalysis(merchants) {
  return { merchants, growerCount: merchants.filter((m) => m.standing === "Grower").length, dropperCount: merchants.filter((m) => m.standing === "Dropper").length, stableCount: merchants.filter((m) => m.standing === "Stable").length, churnedCount: merchants.filter((m) => m.category === "Churned").length, newCount: merchants.filter((m) => m.category === "New").length };
}

// top merchants of the portfolio for one month and one field (clickable items)""")

open('../dist/head_patched.jsx', 'w', encoding='utf-8').write(hb['s'])

# ---------------------------------------------------------------- comparison (kept, adapted)
cb, crep = mk('')
if False:
  pass


# ---------------------------------------------------------------- embedded data (new store incl. portfolio packs + website/sub-account meta)
b64 = open('../data/profile_store.b64').read().strip()
tail = ('// ---- embedded profile data (generated from mart.v_merchant_monthly_wide / v_merchant_daily_wide / v_parcel_lifecycle / public.businesses / public.business_invitations, as of 2026-10-04) ----\n'
        '// {"p": {business_id: [monthlyPack, dailyPack]}, "x": {...}, "pf": {account_manager: [...]}, "cm": {current-month parcel issues, tickets, failed attempts}}\n'
        'const MP_DATA_B64 = __P.store;\n')

out = tb['s'] + '\n' + hb['s'] + R('m1_prims.jsx') + R('m2_overview.jsx') + R('m5_compare.jsx') + R('m6_cm.jsx') + R('m3_issues.jsx') + R('m7_org.jsx') + R('m8_lead.jsx') + R('m10_daily.jsx') + R('m9_auth.jsx') + R('m4_screens.jsx') + '\n' + tail
# the window labels in the source say "Oct 1-4" / "Sep 1-4": fill them with the days of the data (ORG.days)
_N = _json.load(open('../data/org_final.json', encoding='utf-8'))['days']
out = out.replace('Oct 1\u20134', 'Oct 1\u2013%d' % _N).replace('Sep 1\u20134', 'Sep 1\u2013%d' % _N)
# ---- no data inside the app: the code is wrapped so that it is built from a payload; the payload is a separate file
_head_imports = re.match(r'((?:import [^\n]*\n)+)', out).group(1)
_body = out[len(_head_imports):].replace('export default function TargetTracker(', 'function TargetTrackerApp(')
LOADER = r"""
// Data loader: the app contains no data. The payload ({data, org, store}) is read from props.payload, or fetched from
// props.payloadUrl / window.PORTAL_CONFIG.payloadUrl (default "/payload.json"). jobs/refresh_payload.py builds it from the warehouse.
export default function TargetTracker(props = {}) {
  const [payload, setPayload] = useState(props.payload || null);
  const [error, setError] = useState(null);
  const url = props.payloadUrl || (typeof window !== "undefined" && window.PORTAL_CONFIG && window.PORTAL_CONFIG.payloadUrl) || "/payload.json";
  useEffect(() => {
    if (payload) return undefined;
    let live = true;
    fetch(url, { credentials: "same-origin" }).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then((p) => { if (live) setPayload(p); }).catch((e) => { if (live) setError(String(e.message || e)); });
    return () => { live = false; };
  }, [url]);
  const App = useMemo(() => (payload ? __buildApp(payload) : null), [payload]);
  if (error) return <div style={{ fontFamily: "'Lato', Arial, sans-serif", color: "#A24A3C", padding: 40, textAlign: "center" }}>Could not load the data ({error}). Check that {url} is reachable.</div>;
  if (!App) return <div style={{ fontFamily: "'Lato', Arial, sans-serif", color: "#5F726D", padding: 40, textAlign: "center" }}>Loading the data...</div>;
  return <App {...props} />;
}
"""
out = _head_imports + LOADER + "\nfunction __buildApp(__P) {\n" + _body + "\nreturn TargetTrackerApp;\n}\n"
_store = open('../data/profile_store.b64').read().strip()
_acc = '../data/access_hashed.json'
_payload = {'access': _json.load(open(_acc)) if os.path.exists(_acc) else {}, 'data': _D, 'org': _json.load(open('../data/org_final.json', encoding='utf-8')), 'store': _store}
open('../dist/payload.json', 'w', encoding='utf-8').write(_json.dumps(_payload, ensure_ascii=False, separators=(',', ':')))
print('payload MB', os.path.getsize('../dist/payload.json') / 1e6)
open('../dist/target_tracker.jsx', 'w', encoding='utf-8').write(out)
print('assembled MB', len(out) / 1e6)
