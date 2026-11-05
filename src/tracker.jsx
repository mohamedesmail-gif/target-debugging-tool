import React, { useState, useMemo, useRef, useEffect } from "react";
import { TrendingDown, TrendingUp, ChevronRight, ChevronDown, Info } from "lucide-react";

const DATA = __DATA__; // injected by scripts/assemble.py from data/new_data_oct.json

const COLORS = {   // Bosta look: the red and the dark green-grey of the login screen, soft warm greys
  bg: "#FAFAFA",
  panel: "#FFFFFF",
  panelBorder: "#E6EAE9",
  panelBorder2: "#D5DAD9",
  text: "#2B3F3A",
  textMuted: "#5F726D",
  textFaint: "#8A9A96",
  teal: "#17936B",
  tealDim: "#E3F4EC",
  amber: "#B4770F",
  amberDim: "#FBF0DD",
  coral: "#C8372B",
  coralDim: "#FCECE9",
  blue: "#E8321F",
  purple: "#7C5CDB",
  purpleDim: "#EFEAFB",
  slate: "#6E7F7A",
  slateDim: "#EEF2F0",
};

function fmt(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "\u2014";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const MONTH_LABELS = { jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June", jul: "July", aug: "August", sep: "September", oct: "October" };
// Working days (excl. Fridays) in each 2026 calendar month, used to convert a month's total into an avg daily figure
const WD_BY_MONTH = { jan: 26, feb: 24, mar: 27, apr: 26, may: 26, jun: 26, jul: 26, aug: 27, sep: 26, oct: 26 };
const HIST_MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep"];
const HIST_MONTH_ORDER = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

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
      const hasAug = m.monthly.sep > 0; // has a previous-month (September) baseline
      const activeBeforeAug = m.monthly.jul > 0 || m.monthly.aug > 0;
      let category;
      if (m.newThisMonth) {
        category = "New";
      } else if (m.mtdAvgDaily <= 0) {
        category = "Churned";
      } else if ((m.prevFull || 0) <= 0 && activeBeforeAug) {
        category = "Reactivation";
      } else {
        category = "Existing";
      }

      // New (this month) and Churned merchants have no meaningful baseline to hold a target
      // against, so target / delta / achievement% / below-own-target are all left undefined
      // rather than calculated against a fabricated or zero target.
      const hasTarget = category !== "New" && category !== "Churned";
      const merchantTarget = hasTarget ? (m.monthly.sep * (1 + GROWTH_PCT / 100)) / days : null;
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
      const standing = category === "New" ? "New" : category === "Churned" ? "Churned" : growthStatusG || "Grower";
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
      existingStats, newStats, reactivationStats, churnedStats, growerCount, dropperCount, stableCount, churnedCount, newCount,
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

  const sortedMerchants = sortedAll.filter((m) => (!fid.trim() || String(m.id).toLowerCase().includes(fid.trim().toLowerCase())) && (!fname.trim() || String(m.name).toLowerCase().includes(fname.trim().toLowerCase())));
  const onSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const onRowClick = (id) => setExpandedId(expandedId === id ? null : id);

  if (screen === "profile") {
    return <MerchantProfileScreen merchant={selectedMerchant} onBack={() => setScreen("tracker")} />;
  }

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, fontFamily: "'Lato', 'Helvetica Neue', Arial, sans-serif", minHeight: "100%", padding: "28px 20px 60px", boxSizing: "border-box" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" />

      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", color: COLORS.textFaint, textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 6 }}>
            Phase 1 &middot; Pickups &middot; {DATA.month}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>Target Tracker</div>
          <select
            value={amName}
            onChange={(e) => { setAmName(e.target.value); setExpandedId(null); }}
            style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder2}`, borderRadius: 8, color: COLORS.text, fontSize: 20, fontWeight: 600, fontFamily: "'Lato', 'Helvetica Neue', Arial, sans-serif", padding: "8px 14px", outline: "none", cursor: "pointer", maxWidth: "100%" }}
          >
            {nav.allowedAms.map((n) => (<option key={n} value={n} style={{ background: COLORS.panel }}>{n}</option>))}
          </select>
          <div style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 6 }}>
            account manager &middot; {amData.base} merchants &middot; data as of {DATA.asOf}
          </div>
        </div>

        <AchievementBar pct={analysis.targetProgressPct} />

        {/* Working days input */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Working days (excl. Fridays)</div>
            <input type="number" value={workingDays} onChange={(e) => setWorkingDays(e.target.value === "" ? "" : Number(e.target.value))}
              style={{ background: "transparent", border: "none", outline: "none", color: COLORS.text, fontSize: 19, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", width: "100%" }} />
          </div>
        </div>

        {/* Row 1: headline stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 22 }}>
          <StatCard label="Monthly target" value={fmt(analysis.target)} sub="" />
          <StatCard label="Target daily avg" value={fmt(analysis.avgDailyTarget)} sub={"monthly target \u00f7 working days"} />
          <StatCard label={`Actual daily avg (MTD, ${analysis.elapsedDays}d)`} value={fmt(analysis.totalActualMtdDaily)} sub="pickups / day" />
          <StatCard label="Run rate (month end)" value={`\u2248 ${fmt(analysis.estimatedTotal)}`} sub={`${fmt(analysis.estimatedPct, 1)}% of monthly target`}
            accent={analysis.estimatedPct >= 100 ? COLORS.teal : COLORS.coral} />
        </div>

        {/* Growers / droppers / stable by GR % */}
        <SectionLabel>Merchants &middot; growers, droppers, stable, churned, new (adds up to {amData.base})</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 22 }}>
          <StatCard label="Growers" value={analysis.growerCount} sub={`${fmt((analysis.growerCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 GR +15% or more`} accent={COLORS.teal} />
          <StatCard label="Droppers" value={analysis.dropperCount} sub={`${fmt((analysis.dropperCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 GR -15% or less`} accent={COLORS.coral} />
          <StatCard label="Stable" value={analysis.stableCount} sub={`${fmt((analysis.stableCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 GR between -15% and +15%`} accent={COLORS.blue} />
          <StatCard label="Churned" value={analysis.churnedCount} sub={`${fmt((analysis.churnedCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 no pickups this month yet`} accent={COLORS.slate} />
          <StatCard label="New" value={analysis.newCount} sub={`${fmt((analysis.newCount / (analysis.base || 1)) * 100, 0)}% of merchants \u00b7 joined this month`} accent={COLORS.purple} />
        </div>

        {/* Gap to Target summary */}
        {analysis.gapToThresholdPct > 0 && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "14px 16px", borderRadius: 10, marginBottom: 22, background: COLORS.coralDim, border: `1px solid ${COLORS.coral}` }}>
            <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: COLORS.coral }}>{fmt(analysis.gapToThresholdPct, 1)}%</span>
            <span style={{ fontSize: 13, color: COLORS.textMuted }}>
              short of the monthly target ({fmt(analysis.gapToThresholdAbs)} pickups still needed) &mdash; currently at {fmt(analysis.targetProgressPct, 1)}% of the monthly target; {cmpView === "target" ? "the table below shows how much each merchant contributes." : "the table below shows how each merchant moves against the same days of last month."}
            </span>
          </div>
        )}

        {/* Table */}
        <SectionLabel>Merchant detail &middot; click a row for more</SectionLabel>
        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "#F0F2F6", zIndex: 1 }}>
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
                    <tr onClick={() => onRowClick(m.id)} style={{ borderTop: `1px solid ${COLORS.panelBorder}`, cursor: "pointer", background: expandedId === m.id ? "rgba(76,110,245,0.06)" : "transparent" }}>
                      <td style={{ padding: "9px 14px", fontSize: 12.5, color: COLORS.text, maxWidth: 220 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          {expandedId === m.id ? <ChevronDown size={13} color={COLORS.textFaint} /> : <ChevronRight size={13} color={COLORS.textFaint} />}
                          <button
                            onClick={(e) => { e.stopPropagation(); openMerchantProfile(m); }}
                            style={{ color: COLORS.blue, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textDecoration: "none", borderBottom: `1px dotted ${COLORS.blue}` }}
                            title="Open merchant profile"
                          >
                            {m.name}
                          </button>
                          {!m.hasAug && <span style={{ fontSize: 9.5, color: COLORS.textFaint }}>(no Sep baseline)</span>}
                        </span>
                      </td>
                      {cmpView === "target" ? (<>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}>{m.hasTarget ? fmt(m.merchantTarget, 1) : "\u2014"}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(m.mtdAvgDaily, 1)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}>{fmt(m.mtd)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: !m.hasTarget ? COLORS.textFaint : m.deviation >= 0 ? COLORS.teal : COLORS.coral }}>{m.hasTarget ? `${m.deviation >= 0 ? "+" : ""}${fmt(m.deviation, 1)}` : "\u2014"}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}>{m.hasTarget ? `${fmt(m.contribution * 100, 0)}%` : "\u2014"}</td>
                      </>) : (<>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(m.mtdAvgDaily, 1)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}>{fmt(m.pmtdAvgDaily, 1)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: m.pmtdAvgDaily <= 0 && m.mtdAvgDaily <= 0 ? COLORS.textFaint : m.momDelta >= 0 ? COLORS.teal : COLORS.coral }}>{m.pmtdAvgDaily <= 0 && m.mtdAvgDaily <= 0 ? "\u2014" : `${m.momDelta >= 0 ? "+" : ""}${fmt(m.momDelta, 1)}`}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: m.momPct == null ? COLORS.textFaint : m.momPct >= 0 ? COLORS.teal : COLORS.coral }}>{m.momPct == null ? "\u2014" : `${m.momPct >= 0 ? "+" : ""}${fmt(m.momPct, 1)}%`}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}>{fmt(m.mtd)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}>{fmt(m.pmtdTotal)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}>{fmt(m.runRate, 0)}</td>
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

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: COLORS.textFaint, padding: "10px 4px", lineHeight: 1.5 }}>
          <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>
            {cmpView === "target" ? "Merchant weight = the daily average this merchant is expected to contribute to the portfolio target: (September \u00d7 1.60) \u00f7 working days. Delta = MTD avg daily \u2212 merchant weight; Achievement % = MTD avg daily \u00f7 merchant weight. Weights are calculated per merchant, so they do not add up to the AM's official target. New and Churned merchants have no weight." : null}{cmpView === "target" ? null : <>
            PMTD = the same days of last month (days 1&ndash;{DATA.ptdDays}); avg daily = pickups &divide; working days of that period. Delta = MTD avg daily &minus; PMTD avg daily; GR % = Delta &divide; PMTD avg daily (no GR % when the merchant had no pickups in that period). MTD total volume is compared with PMTD total volume. Run rate = MTD pickups + MTD avg daily &times; the remaining working days.
          </>}</span>
        </div>
      </div>
    </div>
  );
}

function AchievementBar({ pct, detail }) {
  // pct = progress toward Target (100% = Target reached). The bar's full width IS the Target.
  const clampedPct = Math.max(0, Math.min(100, pct));
  const barColor = pct >= 100 ? COLORS.teal : COLORS.coral;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Achievement vs. Target</span>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: barColor }}>{fmt(pct, 1)}% of Target{detail ? <span style={{ fontSize: 11.5, fontWeight: 500, color: COLORS.textMuted }}> &middot; {detail}</span> : null}</span>
      </div>
      <div style={{ position: "relative", height: 14, borderRadius: 7, background: COLORS.slateDim, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${clampedPct}%`, background: barColor, borderRadius: 7, transition: "width 0.3s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: COLORS.textFaint, marginTop: 4 }}>
        <span>0%</span>
        <span>Target</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, footnote, accent }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: accent || COLORS.text }}>{value}</div>
      <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 }}>{sub}</div>
      {footnote && <div style={{ fontSize: 10, color: COLORS.textFaint, marginTop: 2 }}>{footnote}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11.5, letterSpacing: "0.08em", color: COLORS.textMuted, textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", margin: "0 2px 8px" }}>
      {children}
    </div>
  );
}

function CategoryBadge({ category }) {
  const map = {
    Existing: { bg: "rgba(76,110,245,0.10)", fg: COLORS.blue, border: "rgba(76,110,245,0.35)" },
    New: { bg: COLORS.purpleDim, fg: COLORS.purple, border: "rgba(124,92,219,0.35)" },
    Reactivation: { bg: COLORS.tealDim, fg: COLORS.teal, border: "rgba(14,155,130,0.35)" },
    Churned: { bg: COLORS.coralDim, fg: COLORS.coral, border: "rgba(214,69,69,0.35)" },
    Active: { bg: COLORS.tealDim, fg: COLORS.teal, border: "rgba(14,155,130,0.35)" },
  };
  const c = map[category];
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
      {category}
    </span>
  );
}

function Th({ children, onClick, active, dir, align }) {
  return (
    <th onClick={onClick} style={{ padding: "10px 14px", textAlign: align || "left", fontSize: 11, color: active ? COLORS.text : COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", cursor: onClick ? "pointer" : "default", userSelect: "none", fontFamily: "'IBM Plex Mono', monospace" }}>
      {children}{active ? (dir === "asc" ? " \u25b2" : " \u25bc") : ""}
    </th>
  );
}

function buildInsight(m, weight) {
  if (m.newThisMonth) {
    return { newThisMonth: true };
  }

  const joinMonth = m.jd ? m.jd.slice(0, 7) : null;
  // Recent-quarter window used for the "active X of Y months" / consistency messaging
  const monthOrder = ["2026-07", "2026-08", "2026-09"];
  const monthKeys = ["jul", "aug", "sep"];
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
    if (m.mtdAvgDaily >= weight) achievedLabels.push("October (MTD)");
  }

  // Highest avg daily volume EVER reached (full available history, Jan-Sep + current MTD), and which month
  const histApplicable = HIST_MONTH_KEYS.filter((k, i) => joinMonth === null || joinMonth <= HIST_MONTH_ORDER[i]);
  const histPoints = histApplicable.map((k) => ({ label: MONTH_LABELS[k], value: m.monthly[k] / WD_BY_MONTH[k] }));
  histPoints.push({ label: "October (MTD)", value: m.mtdAvgDaily });
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
    <div style={{ padding: "16px 20px 18px 38px", background: "#FAFBFC", fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.7 }}>
      <div style={{ marginBottom: 8 }}>
        Business ID: <strong style={{ color: COLORS.text, fontFamily: "'IBM Plex Mono', monospace" }}>{merchant.id}</strong>
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
          <strong style={{ color: COLORS.purple }}>New this month.</strong> No prior history to compare yet.
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
              {"\u26a0\ufe0f"} Churned {"\u2014"} 0 pickups recorded so far this month.
            </div>
          )}
          {insight.isReactivation && (
            <div style={{ color: COLORS.teal }}>
              {"\u{1F504}"} Reactivated {"\u2014"} had zero pickups in September but is active again this month.
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
              {"\u{1F680}"} Ramping up {"\u2014"} still building volume this soon after joining; may have more upside than tenure alone suggests.
            </div>
          )}
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => onOpenProfile(merchant)}
              style={{ display: "inline-block", fontSize: 11.5, padding: "6px 12px", borderRadius: 7, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, color: COLORS.blue, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              View full merchant profile {"\u2192"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
