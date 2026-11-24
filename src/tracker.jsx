import React, { useState, useMemo, useRef, useEffect } from "react";
import { TrendingDown, TrendingUp, ChevronRight, ChevronDown, ChevronUp, ChevronLeft, Info, ArrowRight, ArrowLeft, Search, X, Download, AlertCircle, AlertTriangle, RefreshCw, Rocket, Minus, Target, Calculator, CalendarDays, LogOut, PackageCheck, PackagePlus, PackageX, Package, Coins, Banknote, Scale, Repeat, UserCheck, UserMinus, UserPlus, UserX, Users, Briefcase, Truck, ShoppingBag, CircleCheck, LifeBuoy, CircleDot, Clock, HandCoins, CircleX, PieChart, Percent, Wallet, Sparkles, Gauge, Activity, Boxes, BellOff, Flame, Hourglass, BarChart3, Store, Layers } from "lucide-react";

const DATA = __DATA__; // injected by scripts/assemble.py from data/new_data_oct.json
// New-merchant window: first pickup from the 25th of last month up to the 25th of this month (DATA.newFrom / DATA.newTo, written by scripts/build_tracker_data.py).
// A payload built before this rule has no window dates, so the text falls back to "this month".
const NEW_DM = (iso) => parseInt(iso.slice(8), 10) + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(iso.slice(5, 7), 10) - 1];
const NEW_PHRASE = DATA.newFrom ? "first pickup " + NEW_DM(DATA.newFrom) + " – " + NEW_DM(DATA.newTo) : "first pickup this month";
const NEW_RULE = "first pickup from the 25th of last month up to the 25th of this month";

const COLORS = {   // built from src/theme.js (THEME.color): the names stay, the values follow the theme
  bg: THEME.color.page,                 // page
  panel: THEME.color.tile,              // inner tiles, table bodies, inputs
  card: THEME.color.card,               // main card
  control: THEME.color.control,         // neutral controls
  panelBorder: THEME.color.line,        // borders and dividers
  panelBorder2: THEME.color.lineStrong, // control outlines
  text: THEME.color.text,
  textMuted: THEME.color.text2,         // secondary text
  textFaint: THEME.color.soft,          // small functional text (labels, hints): AA on white and on the card colour
  icon: THEME.color.muted,              // icons, placeholders, disabled
  deco: THEME.color.deco,               // faint decoration
  navy: THEME.color.navy,               // primary action, selected state, links
  brand: THEME.color.brand,             // brand accent, sparingly
  teal: THEME.color.posText,            // positive, text-safe
  tealFill: THEME.color.pos,            // positive, bars and chart series
  tealDim: THEME.color.posBg,
  amber: THEME.color.warn,              // warning, text-safe
  amberFill: "#C2841A",                 // warning, bars and chart series
  amberDim: THEME.color.warnBg,
  coral: THEME.color.neg,               // negative
  coralDim: THEME.color.negBg,
  blue: THEME.color.navy,               // (legacy name) interactive colour = navy
  purple: THEME.color.violet,
  purpleDim: THEME.color.violetBg,
  chart: THEME.color.chart,             // chart accent (bars, lines)
  chart2: THEME.color.chart2,           // chart second tone
  chartTint: THEME.color.chartTint,     // chart light tone, area fills
  sand: THEME.color.sand,               // chart neutral
  slate: THEME.color.soft,
  slateDim: "#EDECE7",                  // progress tracks and neutral chips
};
// bars and chart series use the fill variants (the text variants are darker, for contrast)
const fillOf = (c) => (c === COLORS.teal ? COLORS.tealFill : c === COLORS.amber ? COLORS.amberFill : c);
// shared element styles: cards, tiles, controls. Components spread these so the whole portal changes in one place.
const UI = {
  card: { background: COLORS.card, border: `1px solid ${COLORS.panelBorder}`, borderRadius: THEME.radius.card, padding: THEME.space.card },
  tile: { background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: THEME.radius.tile, padding: "14px 16px" },
  surface: { background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: THEME.radius.tile },
  table: { background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: THEME.radius.tile, overflow: "hidden" },
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.2, borderRadius: THEME.radius.btn, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, color: COLORS.text, whiteSpace: "nowrap" },
  btnPrimary: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.2, borderRadius: THEME.radius.btn, border: `1px solid ${COLORS.navy}`, background: COLORS.navy, color: "#fff", whiteSpace: "nowrap" },
  btnSmall: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "6px 12px", fontSize: 12, fontWeight: 600, lineHeight: 1.2, borderRadius: 12, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, color: COLORS.text, whiteSpace: "nowrap" },
  pill: (on) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.2, borderRadius: THEME.radius.pill, border: `1px solid ${on ? COLORS.navy : COLORS.panelBorder}`, background: on ? COLORS.navy : COLORS.control, color: on ? "#fff" : COLORS.textMuted, whiteSpace: "nowrap" }),
  input: { padding: "8px 12px", borderRadius: THEME.radius.input, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, color: COLORS.text, fontSize: 12.5, lineHeight: 1.3, minWidth: 0, maxWidth: "100%" },
  label: { fontSize: 11.5, fontWeight: 500, color: COLORS.textMuted },
  eyebrow: { fontSize: 11, fontWeight: 600, color: COLORS.textFaint },
  title: { fontSize: 19, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.01em" },
  kpi: { fontSize: 24, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.015em" },
};

// status filter of the merchant detail tables (AM and sales views): the merchant groups of the cards
const STATUS_FILTERS = [["all", "All statuses"], ["Grower", "Growers"], ["Dropper", "Droppers"], ["Stable", "Stable"], ["Churned", "Churned"], ["New", "New"], ["Reactivation", "Reactivations"]];
function StatusFilter({ value, onChange, rows }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filter by status" style={{ ...UI.input, minWidth: 150, cursor: "pointer" }}>
      {STATUS_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}{rows ? " (" + (k === "all" ? rows.length : rows.filter((r) => r.standing === k).length) + ")" : ""}</option>)}
    </select>
  );
}

function fmt(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "\u2014";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const MONTH_KEYS_ALL = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAMES_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_LABELS = Object.fromEntries(MONTH_KEYS_ALL.map((k, i) => [k, MONTH_NAMES_FULL[i]]));
// Working days (excl. Fridays) in each 2026 calendar month, used to convert a month's total into an avg daily figure
const WD_BY_MONTH = { jan: 26, feb: 24, mar: 27, apr: 26, may: 26, jun: 26, jul: 26, aug: 27, sep: 26, oct: 26, nov: 26, dec: 27 };
// complete months of the data (January .. last month) and the current month, from the payload (scripts/build_tracker_data.py)
const CUR_MONTH_IDX = parseInt(DATA.asOf.slice(5, 7), 10) - 1;
const HIST_MONTH_KEYS = DATA.monthKeys || MONTH_KEYS_ALL.slice(0, CUR_MONTH_IDX);
const HIST_MONTH_ORDER = HIST_MONTH_KEYS.map((k) => DATA.asOf.slice(0, 4) + "-" + String(MONTH_KEYS_ALL.indexOf(k) + 1).padStart(2, "0"));
const PREV_KEY = HIST_MONTH_KEYS[HIST_MONTH_KEYS.length - 1];          // last month
const CUR_MONTH_NAME = MONTH_NAMES_FULL[CUR_MONTH_IDX], PREV_MONTH_NAME = MONTH_LABELS[PREV_KEY];

const AM_NAMES = Object.keys(DATA.ams).sort((a, b) => DATA.ams[b].target - DATA.ams[a].target);

const GROWTH_PCT = 60; // fixed growth applied on top of each merchant's previous-month (September) total
const GROWTH_THRESHOLD_PCT = 15; // +/- this % on MoM avg daily => Grower / Dropper, else Stable
const ACHIEVEMENT_THRESHOLD = 100; // achievement is always measured against the monthly target of the targets sheet (100%)

// Per-AM analysis (categories, own targets, hit / missed, growth, totals). Module level so the leadership views can run it for every AM.
function analyzeAm(amData, workingDays) {
    const days = Math.max(1, Number(workingDays) || 1);
    const target = amData.target;
    const base = amData.base || 1;
    // Target daily avg = pickups needed THIS MONTH (day 1 -> last day) to reach Target, spread over all working days.
    // Basis is Target (80% of the monthly target), not the full monthly target — consistent with how the AM is actually judged.
    const avgDailyTarget = ((ACHIEVEMENT_THRESHOLD / 100) * target) / days;
    const elapsedDays = DATA.wdElapsed;
    const remainingDays = Math.max(0, days - elapsedDays);

    // Target avg daily (per merchant) = (previous month achievement, ecomm+fulfillment only, x growth) / working days
    const merchants = amData.merchants.map((m) => {
      const hasAug = m.monthly[PREV_KEY] > 0; // has a previous-month baseline
      let category;
      if (m.newThisMonth) {
        category = "New";
      } else if (m.reactivated) {   // 25th-to-25th months: no pickup in the previous window, pickups since the 25th of last month (scripts/build_tracker_data.py)
        category = "Reactivation";
      } else if (m.mtdAvgDaily <= 0) {
        category = "Churned";
      } else {
        category = "Existing";
      }

      // New (this month) and Churned merchants have no meaningful baseline to hold a target
      // against, so target / delta / achievement% / below-own-target are all left undefined
      // rather than calculated against a fabricated or zero target.
      const hasTarget = category !== "New" && category !== "Churned";
      const merchantTarget = hasTarget ? (m.monthly[PREV_KEY] * (1 + GROWTH_PCT / 100)) / days : null;
      const deviation = hasTarget ? m.mtdAvgDaily - merchantTarget : null;
      const contribution = hasTarget && merchantTarget ? m.mtdAvgDaily / merchantTarget : null;
      const gapContributionPct = hasTarget && merchantTarget
        ? (Math.max(0, merchantTarget - m.mtdAvgDaily) / merchantTarget) * 100
        : null;
      const missedTarget = hasTarget ? m.mtdAvgDaily < merchantTarget : false;

      // Growth status: this month's avg daily (MTD) vs last month's (September) avg daily
      const augAvgDaily = m.monthly.sep / WD_BY_MONTH.sep;
      let growthStatus = null, growthPct = null;
      if (augAvgDaily > 0) {
        growthPct = ((m.mtdAvgDaily - augAvgDaily) / augAvgDaily) * 100;
        if (growthPct >= GROWTH_THRESHOLD_PCT) growthStatus = "Grower";
        else if (growthPct <= -GROWTH_THRESHOLD_PCT) growthStatus = "Dropper";
        else growthStatus = "Stable";
      }

      // Same days of last month (PMTD): average per working day, change in pickups per day, growth rate, and the run rate to month end
      const pmtdAvgDaily = DATA.wdPtd ? (m.ptd || 0) / DATA.wdPtd : 0;
      const momDelta = m.mtdAvgDaily - pmtdAvgDaily;
      const momPct = pmtdAvgDaily > 0 ? (momDelta / pmtdAvgDaily) * 100 : null;
      const runRate = m.mtd + m.mtdAvgDaily * remainingDays;
      // GR % decides the status: +15% or more = Grower, -15% or less = Dropper, in between = Stable. "standing" also holds New and Churned, so the five groups add up to the portfolio.
      const growthStatusG = momPct == null ? null : momPct >= GROWTH_THRESHOLD_PCT ? "Grower" : momPct <= -GROWTH_THRESHOLD_PCT ? "Dropper" : "Stable";
      const standing = category === "New" ? "New" : category === "Churned" ? "Churned" : category === "Reactivation" ? "Reactivation" : growthStatusG || "Grower";   // the six groups add up to the portfolio
      return {
        ...m,
        merchantTarget, hasAug, hasTarget, deviation, contribution, category, missedTarget,
        gapContributionPct,
        growthStatus: growthStatusG, growthPct: momPct, standing,
        pmtdAvgDaily, pmtdTotal: m.ptd || 0, momDelta, momPct, runRate,
      };
    });

    const totalActualMtdDaily = merchants.reduce((s, m) => s + m.mtdAvgDaily, 0);
    const totalActualMtdPickups = merchants.reduce((s, m) => s + m.mtd, 0);
    // Bottom-up target sum only includes merchants that actually have a target (Existing/Reactivation).
    // This is informational only and is NOT expected to equal the AM's official target (see note under table).
    const targetedMerchants = merchants.filter((m) => m.hasTarget);
    const bottomUpDailyTarget = targetedMerchants.reduce((s, m) => s + m.merchantTarget, 0);
    // TRUE current achievement: actual pickups delivered so far, as a % of the FULL monthly target.
    // (Not a daily-rate/pace comparison, which would behave like a projection rather than a current, factual figure.)
    const achievementPct = target ? (totalActualMtdPickups / target) * 100 : 0;
    // The AM is judged against the 80% bar, not 100% of the month's target
    const thresholdTotal = (ACHIEVEMENT_THRESHOLD / 100) * target;
    const gapToThresholdAbs = Math.max(0, thresholdTotal - totalActualMtdPickups); // total pickups still short of the 80% bar, right now
    // Daily pace needed over the REMAINING days of the month to still close that gap by month end
    const remainingDaily = remainingDays > 0 ? gapToThresholdAbs / remainingDays : (gapToThresholdAbs > 0 ? gapToThresholdAbs : 0);

    const estimatedTotal = remainingDays * totalActualMtdDaily + totalActualMtdPickups;
    const estimatedPct = target ? (estimatedTotal / target) * 100 : 0;

    const byStatus = (cat) => {
      const list = merchants.filter((m) => m.category === cat);
      return { count: list.length, missed: list.filter((m) => m.missedTarget).length };
    };
    const existingStats = byStatus("Existing");
    const newStats = byStatus("New");
    const reactivationStats = byStatus("Reactivation");
    const churnedStats = byStatus("Churned");
    const growerCount = merchants.filter((m) => m.standing === "Grower").length;
    const dropperCount = merchants.filter((m) => m.standing === "Dropper").length;
    const stableCount = merchants.filter((m) => m.standing === "Stable").length;
    const churnedCount = churnedStats.count;
    const newCount = newStats.count;
    const reactivationCount = reactivationStats.count;

    // Breakdown of the gap to the 80% achievement threshold, by merchant (no portfolio-wide total — see note under table)
    // Progress toward Target (Target = 80% of the monthly target): 100% means Target reached
    const targetProgressPct = thresholdTotal ? (totalActualMtdPickups / thresholdTotal) * 100 : 0;
    const gapToThresholdPct = Math.max(0, 100 - targetProgressPct);
    const missedBreakdown = targetedMerchants
      .map((m) => ({ id: m.id, name: m.name, shortfall: Math.max(0, m.merchantTarget - m.mtdAvgDaily) }))
      .filter((m) => m.shortfall > 0)
      .sort((a, b) => b.shortfall - a.shortfall);

    return {
      days, target, base, avgDailyTarget, thresholdDailyTarget: thresholdTotal,
      merchants, totalActualMtdDaily, totalActualMtdPickups, achievementPct, targetProgressPct, remainingDaily,
      elapsedDays, remainingDays, estimatedTotal, estimatedPct, bottomUpDailyTarget,
      existingStats, newStats, reactivationStats, churnedStats, growerCount, dropperCount, stableCount, churnedCount, newCount, reactivationCount,
      gapToThresholdPct, gapToThresholdAbs, missedBreakdown,
    };
}

export default function TargetTracker({ session: hostSession, onSignOut } = {}) {
  const [amName, setAmName] = useState(AM_NAMES[0]);
  const [workingDays, setWorkingDays] = useState(DATA.wdFull);
  const [sortKey, setSortKey] = useState("mtdAvgDaily");
  const [sortDir, setSortDir] = useState("desc");
  const [expandedId, setExpandedId] = useState(null);
  const [fid, setFid] = useState(""); const [fname, setFname] = useState(""); // business ID / business name search of the merchant table
  const [stF, setStF] = useState("all"); // status filter of the merchant table (one of STATUS_FILTERS)
  const [cmpView, setCmpView] = useState("prev"); // pickups table: "prev" = against last month (PMTD), "target" = against each merchant's own target
  const [screen, setScreen] = useState("tracker"); // "tracker" | "profile" — in-app navigation, no separate tab/page
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const openMerchantProfile = (m) => { setSelectedMerchant({ ...m, am: amName }); setScreen("profile"); };

  const amData = DATA.ams[amName];

  const analysis = useMemo(() => analyzeAm(amData, workingDays), [amData, workingDays]);

  const sortedAll = useMemo(() => {
    const arr = [...analysis.merchants];
    const dir = sortDir === "asc" ? 1 : -1;
    const num = (v) => (v === null || v === undefined ? -Infinity : v);
    arr.sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      if (sortKey === "category") return dir * a.category.localeCompare(b.category);
      if (sortKey === "target") return dir * (num(a.merchantTarget) - num(b.merchantTarget));
      if (sortKey === "tDelta") return dir * (num(a.deviation) - num(b.deviation));
      if (sortKey === "contribution") return dir * (num(a.contribution) - num(b.contribution));
      if (sortKey === "gapContribution") return dir * (num(a.gapContributionPct) - num(b.gapContributionPct));
      if (sortKey === "delta") return dir * (num(a.momDelta) - num(b.momDelta));
      if (sortKey === "momPct") return dir * (num(a.momPct) - num(b.momPct));
      if (sortKey === "pmtdAvgDaily") return dir * (a.pmtdAvgDaily - b.pmtdAvgDaily);
      if (sortKey === "pmtdTotal") return dir * (a.pmtdTotal - b.pmtdTotal);
      if (sortKey === "runRate") return dir * (a.runRate - b.runRate);
      if (sortKey === "mtd") return dir * (a.mtd - b.mtd);
      return dir * (a.mtdAvgDaily - b.mtdAvgDaily);
    });
    return arr;
  }, [analysis.merchants, sortKey, sortDir]);

  const sortedMerchants = sortedAll.filter((m) => (stF === "all" || m.standing === stF) && (!fid.trim() || String(m.id).toLowerCase().includes(fid.trim().toLowerCase())) && (!fname.trim() || String(m.name).toLowerCase().includes(fname.trim().toLowerCase())));
  const onSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const onRowClick = (id) => setExpandedId(expandedId === id ? null : id);

  if (screen === "profile") {
    return <MerchantProfileScreen merchant={selectedMerchant} onBack={() => setScreen("tracker")} />;
  }

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, fontFamily: THEME.font, minHeight: "100%" }} className="tt-shell">
      

      <div className="tt-wrap">
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...UI.eyebrow, marginBottom: 6 }}>
            Phase 1 &middot; Pickups &middot; {DATA.month}
          </div>
          <h1 style={{ ...UI.title, fontSize: 19, margin: "0 0 10px" }}>Target Tracker</h1>
          <select
            value={amName} aria-label="Account manager"
            onChange={(e) => { setAmName(e.target.value); setExpandedId(null); }}
            style={{ ...UI.input, fontSize: 16, fontWeight: 600, padding: "9px 14px", cursor: "pointer" }}
          >
            {nav.allowedAms.map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
          <div style={{ color: COLORS.textMuted, fontSize: 12.5, marginTop: 8 }}>
            account manager &middot; {amData.base} merchants &middot; data as of {DATA.asOf}
          </div>
        </div>

        <AchievementBar pct={analysis.targetProgressPct} />

        {/* Working days input */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ ...UI.tile, padding: "12px 16px" }}>
            <label style={{ ...UI.label, display: "block", marginBottom: 4 }} htmlFor="tt-wd">Working days (excl. Fridays)</label>
            <input id="tt-wd" type="number" value={workingDays} onChange={(e) => setWorkingDays(e.target.value === "" ? "" : Number(e.target.value))}
              style={{ background: "transparent", border: "none", color: COLORS.text, fontSize: 19, fontWeight: 600, fontFamily: THEME.font, width: "100%", padding: 0 }} />
          </div>
        </div>

        {/* Growers / droppers / stable by GR % */}
        <SectionLabel>Merchants &middot; growers, droppers, stable, churned, new, reactivations (adds up to {amData.base})</SectionLabel>
        <div className="tt-kpis" style={{ ...UI.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 12, marginBottom: 22 }}>
          <StatCard label="Growers" value={analysis.growerCount} sub={`${fmt((analysis.growerCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 GR +15% or more`} accent={COLORS.teal} />
          <StatCard label="Droppers" value={analysis.dropperCount} sub={`${fmt((analysis.dropperCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 GR -15% or less`} accent={COLORS.coral} />
          <StatCard label="Stable" value={analysis.stableCount} sub={`${fmt((analysis.stableCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 GR between -15% and +15%`} accent={COLORS.blue} />
          <StatCard label="Churned" value={analysis.churnedCount} sub={`${fmt((analysis.churnedCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 no pickups this month yet`} accent={COLORS.slate} />
          <StatCard label="New" value={analysis.newCount} sub={`${fmt((analysis.newCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 first pickup since the 25th`} accent={COLORS.purple} />
          <StatCard label="Reactivations" value={analysis.reactivationCount} sub={`${fmt((analysis.reactivationCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 back since the 25th`} accent={COLORS.chart} />
        </div>

        {/* Gap to Target summary */}
        {analysis.gapToThresholdPct > 0 && (
          <div role="alert" style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", padding: "14px 18px", borderRadius: THEME.radius.tile, marginBottom: 22, background: COLORS.coralDim, border: `1px solid ${THEME.color.line}` }}>
            <span style={{ ...UI.kpi, fontSize: 24, color: COLORS.coral }}>{fmt(analysis.gapToThresholdPct, 1)}%</span>
            <span style={{ fontSize: 13, color: COLORS.textMuted }}>
              short of the monthly target ({fmt(analysis.gapToThresholdAbs)} pickups still needed) &mdash; currently at {fmt(analysis.targetProgressPct, 1)}% of the monthly target; {cmpView === "target" ? "the table below shows how much each merchant contributes." : "the table below shows how each merchant moves against the same days of last month."}
            </span>
          </div>
        )}

        {/* Table */}
        <SectionLabel>Merchant detail &middot; click a row for more</SectionLabel>
        <div style={{ ...UI.table, marginBottom: 14 }}>
          <div className="tt-scroll-x" data-tt="scroll" style={{ maxHeight: 520, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: COLORS.card, zIndex: 2 }}>
                  <Th onClick={() => onSort("name")} active={sortKey === "name"} dir={sortDir}>Merchant</Th>
                  {cmpView === "target" ? (<>
                  <Th onClick={() => onSort("target")} active={sortKey === "target"} dir={sortDir} align="right">Merchant weight</Th>
                  <Th onClick={() => onSort("mtdAvgDaily")} active={sortKey === "mtdAvgDaily"} dir={sortDir} align="right">MTD avg daily</Th>
                  <Th onClick={() => onSort("mtd")} active={sortKey === "mtd"} dir={sortDir} align="right">MTD total volume</Th>
                  <Th onClick={() => onSort("tDelta")} active={sortKey === "tDelta"} dir={sortDir} align="right">Delta</Th>
                  <Th onClick={() => onSort("contribution")} active={sortKey === "contribution"} dir={sortDir} align="right">Achievement %</Th>
                  </>) : (<>
                  <Th onClick={() => onSort("mtdAvgDaily")} active={sortKey === "mtdAvgDaily"} dir={sortDir} align="right">MTD avg daily</Th>
                  <Th onClick={() => onSort("pmtdAvgDaily")} active={sortKey === "pmtdAvgDaily"} dir={sortDir} align="right">PMTD avg daily</Th>
                  <Th onClick={() => onSort("delta")} active={sortKey === "delta"} dir={sortDir} align="right">Delta</Th>
                  <Th onClick={() => onSort("momPct")} active={sortKey === "momPct"} dir={sortDir} align="right">GR %</Th>
                  <Th onClick={() => onSort("mtd")} active={sortKey === "mtd"} dir={sortDir} align="right">MTD total volume</Th>
                  <Th onClick={() => onSort("pmtdTotal")} active={sortKey === "pmtdTotal"} dir={sortDir} align="right">PMTD total volume</Th>
                  <Th onClick={() => onSort("runRate")} active={sortKey === "runRate"} dir={sortDir} align="right">Run rate</Th>
                  </>)}
                  <Th onClick={() => onSort("category")} active={sortKey === "category"} dir={sortDir} align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {sortedMerchants.map((m) => (
                  <React.Fragment key={m.id}>
                    <tr onClick={() => onRowClick(m.id)} style={{ borderTop: `1px solid ${COLORS.panelBorder}`, cursor: "pointer", background: expandedId === m.id ? THEME.color.navyTint : "transparent" }}>
                      <td style={{ padding: "9px 14px", fontSize: 12.5, color: COLORS.text, maxWidth: 220 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          {expandedId === m.id ? <ChevronDown size={13} color={COLORS.textFaint} /> : <ChevronRight size={13} color={COLORS.textFaint} />}
                          <button
                            onClick={(e) => { e.stopPropagation(); openMerchantProfile(m); }}
                            style={{ color: COLORS.navy, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left", textDecoration: "none" }}
                            title="Open merchant profile"
                          >
                            {m.name}
                          </button>
                          {!m.hasAug && <span style={{ fontSize: 9.5, color: COLORS.textFaint }}>(no Sep baseline)</span>}
                        </span>
                      </td>
                      {cmpView === "target" ? (<>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: COLORS.textMuted }}>{m.hasTarget ? fmt(m.merchantTarget, 1) : "\u2014"}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font }}>{fmt(m.mtdAvgDaily, 1)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: COLORS.textMuted }}>{fmt(m.mtd)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: !m.hasTarget ? COLORS.textFaint : m.deviation >= 0 ? COLORS.teal : COLORS.coral }}>{m.hasTarget ? `${m.deviation >= 0 ? "+" : ""}${fmt(m.deviation, 1)}` : "\u2014"}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: COLORS.textMuted }}>{m.hasTarget ? `${fmt(m.contribution * 100, 0)}%` : "\u2014"}</td>
                      </>) : (<>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font }}>{fmt(m.mtdAvgDaily, 1)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: COLORS.textMuted }}>{fmt(m.pmtdAvgDaily, 1)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: m.pmtdAvgDaily <= 0 && m.mtdAvgDaily <= 0 ? COLORS.textFaint : m.momDelta >= 0 ? COLORS.teal : COLORS.coral }}>{m.pmtdAvgDaily <= 0 && m.mtdAvgDaily <= 0 ? "\u2014" : `${m.momDelta >= 0 ? "+" : ""}${fmt(m.momDelta, 1)}`}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: m.momPct == null ? COLORS.textFaint : m.momPct >= 0 ? COLORS.teal : COLORS.coral }}>{m.momPct == null ? "\u2014" : `${m.momPct >= 0 ? "+" : ""}${fmt(m.momPct, 1)}%`}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: COLORS.textMuted }}>{fmt(m.mtd)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: COLORS.textMuted }}>{fmt(m.pmtdTotal)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, color: COLORS.textMuted }}>{fmt(m.runRate, 0)}</td>
                      </>)}
                      <td style={{ padding: "9px 14px", textAlign: "right" }}><CategoryBadge category={m.category} /></td>
                    </tr>
                    {expandedId === m.id && (
                      <tr>
                        <td colSpan={cmpView === "target" ? 8 : 9} style={{ padding: 0, borderTop: `1px solid ${COLORS.panelBorder}` }}>
                          <MerchantDrilldown merchant={m} weight={m.merchantTarget} onOpenProfile={openMerchantProfile} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {cmpView === "target" && tableView !== "asp" && (   // explanation of the Merchants contribution columns only (the last-month footnote was removed on request)
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: COLORS.textFaint, padding: "10px 4px", lineHeight: 1.5 }}>
          <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{"Merchant weight = the daily average this merchant is expected to contribute to the portfolio target: (September \u00d7 1.60) \u00f7 working days. Delta = MTD avg daily \u2212 merchant weight; Achievement % = MTD avg daily \u00f7 merchant weight. Weights are calculated per merchant, so they do not add up to the AM's official target. New and Churned merchants have no weight."}</span>
        </div>
        )}
      </div>
    </div>
  );
}

function AchievementBar({ pct, detail }) {
  // pct = progress toward Target (100% = Target reached). The bar's full width IS the Target.
  const clampedPct = Math.max(0, Math.min(100, pct));
  const barColor = pct >= 100 ? COLORS.teal : COLORS.coral;
  return (
    <div style={{ ...UI.card, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: COLORS.textMuted }}>Achievement vs. Target</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: barColor }}>{fmt(pct, 1)}% of Target{detail ? <span style={{ fontSize: 11.5, color: COLORS.textMuted }}> &middot; {detail}</span> : null}</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clampedPct)} aria-label="Achievement vs. target" style={{ position: "relative", height: 8, borderRadius: 999, background: COLORS.slateDim, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${clampedPct}%`, background: fillOf(barColor), borderRadius: 999, transition: "width 0.3s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: COLORS.textFaint, marginTop: 4 }}>
        <span>0%</span>
        <span>Target</span>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// ICONS: one Lucide outline icon per KPI, chosen from the card label, shown in a soft tinted tile
// (the same pattern as the reference dashboard). Order matters: the first matching rule wins.
// Tone only colours the tile; the meaning of a number is still carried by its own text colour.
// ---------------------------------------------------------------------------
const KPI_ICON_RULES = [
  [/churn rate|churned|churn/i, UserMinus, "neg"], [/retention/i, Repeat, "pos"],
  [/absent/i, BellOff, "neg"], [/dropper/i, TrendingDown, "neg"], [/grower|growing/i, TrendingUp, "pos"], [/on risk|at risk/i, Flame, "warn"],
  [/quiet today/i, Hourglass, "warn"], [/net impact/i, Scale, "navy"],
  [/^stable/i, Minus, "neutral"], [/reactivat/i, RefreshCw, "teal"], [/^new\b|new accounts|new merchants|newcomer/i, UserPlus, "violet"], [/active merchants/i, Users, "navy"], [/total portfolio|portfolio size/i, Briefcase, "navy"],
  [/fresh sales|new pickups|new-pickups/i, PackagePlus, "violet"], [/target daily/i, CalendarDays, "navy"], [/pickups target|achievement|target/i, Target, "navy"],
  [/lost/i, PackageX, "neg"], [/pickups|volume|parcels|orders/i, Package, "navy"],
  [/asp gap|net asp/i, Scale, "warn"], [/asp/i, Coins, "navy"], [/revenue/i, Banknote, "pos"], [/gm2|margin/i, PieChart, "pos"], [/wallet/i, Wallet, "navy"], [/vas/i, Sparkles, "violet"],
  [/dsr|asr|success|delivered/i, Truck, "pos"], [/failed|failure/i, CircleX, "neg"],
  [/compensation/i, HandCoins, "warn"], [/pending/i, Clock, "warn"], [/open/i, CircleDot, "neg"], [/tickets/i, LifeBuoy, "navy"],
  [/daily avg|daily average|avg daily|per day|working days/i, CalendarDays, "navy"], [/run rate/i, Gauge, "navy"], [/status/i, Activity, "navy"], [/shipping|plan/i, Layers, "navy"],
];
const KPI_TONES = {
  navy: [THEME.color.navyTint, THEME.color.navy], pos: [THEME.color.posBg, THEME.color.posText], neg: [THEME.color.negBg, THEME.color.neg],
  warn: [THEME.color.warnBg, THEME.color.warn], violet: [THEME.color.violetBg, THEME.color.violet], neutral: [THEME.color.control, THEME.color.text2],
};
function kpiIconFor(label) {
  const t = typeof label === "string" ? label : "";
  const hit = KPI_ICON_RULES.find((r) => r[0].test(t));
  return hit ? { Icon: hit[1], tone: hit[2] } : { Icon: BarChart3, tone: "neutral" };
}
function IconTile({ icon: Icon, tone = "navy", size = 30 }) {
  const [bg, fg] = KPI_TONES[tone] || KPI_TONES.navy;
  return <span aria-hidden="true" style={{ flex: "0 0 auto", width: size, height: size, borderRadius: Math.round(size * 0.33), background: bg, color: fg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon size={Math.round(size * 0.53)} strokeWidth={1.75} /></span>;
}
// label row of a KPI card: icon tile, label, optional info tip
function KpiHead({ label, info, icon, tone }) {
  const d = kpiIconFor(label);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
      <IconTile icon={icon || d.Icon} tone={tone || d.tone} />
      <div style={{ ...UI.label, display: "flex", alignItems: "center", minWidth: 0 }}>{label}{info && <InfoTip text={info} />}</div>
    </div>
  );
}

function StatCard({ label, value, sub, footnote, accent }) {
  return (
    <div style={{ ...UI.tile }}>
      <KpiHead label={label} />
      <div style={{ ...UI.kpi, color: accent || COLORS.text }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>
      {footnote && <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 3 }}>{footnote}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <h2 style={{ ...UI.eyebrow, margin: "0 2px 10px" }}>{children}</h2>;
}

function CategoryBadge({ category }) {
  const map = {
    Existing: { bg: THEME.color.navyTint, fg: COLORS.navy },
    New: { bg: COLORS.purpleDim, fg: COLORS.purple },
    Reactivation: { bg: COLORS.tealDim, fg: COLORS.teal },
    Churned: { bg: COLORS.coralDim, fg: COLORS.coral },
    Active: { bg: COLORS.tealDim, fg: COLORS.teal },
  };
  const c = map[category];
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>
      {category}
    </span>
  );
}

function Th({ children, onClick, active, dir, align }) {
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined} onClick={onClick} style={{ padding: "10px 14px", textAlign: align || "left", fontSize: 11.5, fontWeight: 600, color: active ? COLORS.text : COLORS.textMuted, cursor: onClick ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>
      {children}{active ? (dir === "asc" ? <ChevronUp size={12} strokeWidth={2} aria-hidden="true" style={{ verticalAlign: "-2px", marginLeft: 3 }} /> : <ChevronDown size={12} strokeWidth={2} aria-hidden="true" style={{ verticalAlign: "-2px", marginLeft: 3 }} />) : null}
    </th>
  );
}

function buildInsight(m, weight) {
  if (m.newThisMonth) {
    return { newThisMonth: true };
  }

  const joinMonth = m.jd ? m.jd.slice(0, 7) : null;
  // Recent-quarter window used for the "active X of Y months" / consistency messaging
  const monthOrder = HIST_MONTH_ORDER.slice(-3);
  const monthKeys = HIST_MONTH_KEYS.slice(-3);
  const applicableIdx = monthOrder.map((mo, i) => (joinMonth === null || joinMonth <= mo ? i : -1)).filter((i) => i >= 0);

  const applicableLabels = applicableIdx.map((i) => MONTH_LABELS[monthKeys[i]]);
  const activeIdx = applicableIdx.filter((i) => m.monthly[monthKeys[i]] > 0);
  const gapLabels = applicableIdx.filter((i) => !(m.monthly[monthKeys[i]] > 0)).map((i) => MONTH_LABELS[monthKeys[i]]);
  const consistent = applicableIdx.length >= 2 && gapLabels.length === 0;

  const achievedLabels = [];
  if (weight) {
    applicableIdx.forEach((i) => {
      const monthAvgDaily = m.monthly[monthKeys[i]] / WD_BY_MONTH[monthKeys[i]];
      if (monthAvgDaily >= weight) achievedLabels.push(MONTH_LABELS[monthKeys[i]]);
    });
    if (m.mtdAvgDaily >= weight) achievedLabels.push(CUR_MONTH_NAME + " (MTD)");
  }

  // Highest avg daily volume EVER reached (full available history, Jan-Sep + current MTD), and which month
  const histApplicable = HIST_MONTH_KEYS.filter((k, i) => joinMonth === null || joinMonth <= HIST_MONTH_ORDER[i]);
  const histPoints = histApplicable.map((k) => ({ label: MONTH_LABELS[k], value: m.monthly[k] / WD_BY_MONTH[k] }));
  histPoints.push({ label: CUR_MONTH_NAME + " (MTD)", value: m.mtdAvgDaily });
  const best = histPoints.reduce((a, b) => (b.value > a.value ? b : a), histPoints[0]);

  // Lost volume (churned only): avg monthly pickup TOTAL across active (non-zero) months in full history before going quiet
  const histActive = histApplicable.filter((k) => m.monthly[k] > 0);
  let avgMonthlyVolume = null;
  if (m.category === "Churned" && histActive.length > 0) {
    avgMonthlyVolume = histActive.reduce((s, k) => s + m.monthly[k], 0) / histActive.length;
  }

  return {
    newThisMonth: false,
    rampingUp: m.newPrevMonth,
    isChurned: m.category === "Churned",
    isReactivation: m.category === "Reactivation",
    workingMonths: activeIdx.length,
    applicableLabels,
    consistent,
    gapLabels,
    achievedLabels,
    maxLabel: best.label,
    maxAvg: best.value,
    avgMonthlyVolume,
    growthStatus: m.growthStatus,
    growthPct: m.growthPct,
  };
}

function MerchantDrilldown({ merchant, weight, onOpenProfile }) {
  const insight = buildInsight(merchant, weight);

  return (
    <div style={{ padding: "16px 20px 18px 38px", background: COLORS.card, fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.7 }}>
      <div style={{ marginBottom: 8 }}>
        Business ID: <strong style={{ color: COLORS.text, fontFamily: THEME.font }}>{merchant.id}</strong>
      </div>
      <div style={{ marginBottom: 8 }}>
        Joined: <strong style={{ color: COLORS.text }}>{merchant.jd || "\u2014"}</strong>
      </div>
      {insight.isChurned && (
        <div style={{ marginBottom: 8 }}>
          Last activity: <strong style={{ color: COLORS.coral }}>{merchant.lastActivity || "\u2014"}</strong>
          {insight.avgMonthlyVolume !== null && (
            <span>
              {" "}&middot; Lost volume: <strong style={{ color: COLORS.coral }}>{"\u2248"} {fmt(insight.avgMonthlyVolume)} pickups/month</strong> (avg of tracked months before going quiet)
            </span>
          )}
        </div>
      )}
      {insight.newThisMonth ? (
        <div>
          <strong style={{ color: COLORS.purple }}>New merchant</strong> (first pickup {merchant.jd || "\u2014"}). Measured from the 25th of last month: {fmt(merchant.mtd)} pickups{merchant.preNew ? ` (${fmt(merchant.preNew)} of them before the 1st)` : ""}, {fmt(merchant.mtdAvgDaily, 1)} per working day over {merchant.wdMeasured || DATA.wdElapsed} working days. No earlier history to compare yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <strong style={{ color: COLORS.text }}>{merchant.category} merchant</strong> &middot; active {insight.workingMonths} of the last {insight.applicableLabels.length} tracked month{insight.applicableLabels.length === 1 ? "" : "s"} ({insight.applicableLabels.join(", ")}).{" "}
            {insight.applicableLabels.length < 2 ? (
              <span>Not enough history yet to call it consistent.</span>
            ) : insight.consistent ? (
              <span style={{ color: COLORS.teal }}>Consistent {"\u2014"} picked up every tracked month.</span>
            ) : (
              <span style={{ color: COLORS.coral }}>Inconsistent {"\u2014"} no activity in {insight.gapLabels.join(", ")}.</span>
            )}
          </div>
          {insight.isChurned && (
            <div style={{ color: COLORS.coral }}>
              <AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 5 }} />Churned {"\u2014"} 0 pickups recorded so far this month.
            </div>
          )}
          {insight.isReactivation && (
            <div style={{ color: COLORS.teal }}>
              <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 5 }} />Reactivated {"\u2014"} had zero pickups in September but is active again this month.
            </div>
          )}
          {insight.growthStatus && (
            <div>
              Growth status vs. last month:{" "}
              <strong style={{ color: insight.growthStatus === "Grower" ? COLORS.teal : insight.growthStatus === "Dropper" ? COLORS.coral : COLORS.textMuted }}>
                {insight.growthStatus}
              </strong>{" "}
              ({insight.growthPct >= 0 ? "+" : ""}{fmt(insight.growthPct, 1)}% MoM avg daily)
            </div>
          )}
          {insight.rampingUp && (
            <div style={{ color: COLORS.purple }}>
              <Rocket size={14} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 5 }} />Ramping up {"\u2014"} still building volume this soon after joining; may have more upside than tenure alone suggests.
            </div>
          )}
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => onOpenProfile(merchant)}
              style={{ ...UI.btnSmall, color: COLORS.navy }}
            >
              View full merchant profile <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
