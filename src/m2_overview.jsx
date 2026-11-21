
// ============================================================================
// Overview tabs
// ============================================================================
const MP_MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MP_RANGE_MIN = "2026-01-01", MP_RANGE_MAX = DATA.asOf;
function mpShortDate(d) { return MP_MON3[Number(d.slice(5, 7)) - 1] + " " + Number(d.slice(8, 10)); }
function mpMonthStart(m) { return m + "-01"; }
function mpMonthEnd(m) { const [y, mo] = m.split("-").map(Number); return m + "-" + String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0"); }
function mpMonthIdxOf(dateStr) { const i = MP_MONTH_KEYS.indexOf(dateStr.slice(0, 7)); return i < 0 ? MP_MONTHLY.length - 1 : Math.min(i, MP_MONTHLY.length - 1); }

// range -> the rows each chart/table plots, per granularity
function mpSeriesForRange(granularity, range) {
  const { from, to } = range;
  if (granularity === "Monthly") {
    const curMonth = MP_MONTHLY[MP_MONTHLY.length - 1].month;
    const rows = MP_MONTHLY.filter((m) => mpMonthEnd(m.month) >= from && mpMonthStart(m.month) <= to).map((m) => (m.month === curMonth ? { ...m, dsr_avg: null, asr_avg: null } : m)); // no DSR / ASR for the running month
    return { rows, labels: rows.map((m) => MP_MON3[Number(m.month.slice(5)) - 1]), kind: "month", partialLast: rows.length > 0 && rows[rows.length - 1].month === MP_MONTHLY[MP_MONTHLY.length - 1].month };
  }
  const allDays = MP_COMBINED_DAILY.filter((d) => d.date >= from && d.date <= to);
  if (granularity === "Weekly") {
    const w = weeklyFromDailyMP(allDays);
    return { rows: w, labels: w.map((x) => mpShortDate(x.start)), kind: "week", partialLast: w.length > 1 && w[w.length - 1].dayCount < 7 };
  }
  const rows = allDays.filter((d) => dayOfWeekName(d.date) !== "Friday"); // Fridays are non-working days: skipping them removes the weekly saw-tooth
  return { rows, labels: rows.map((d) => mpShortDate(d.date)), kind: "day", partialLast: false };
}

function MPDateRange({ range, setRange }) {
  const set = (k, v) => {
    if (!v) return;
    let from = k === "from" ? v : range.from, to = k === "to" ? v : range.to;
    from = from < MP_RANGE_MIN ? MP_RANGE_MIN : from > MP_RANGE_MAX ? MP_RANGE_MAX : from;
    to = to < MP_RANGE_MIN ? MP_RANGE_MIN : to > MP_RANGE_MAX ? MP_RANGE_MAX : to;
    if (from > to) { if (k === "from") to = from; else from = to; }
    setRange({ from, to });
  };
  const inp = { padding: "6px 9px", borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, fontSize: 12.5, fontFamily: MP_MONO, background: COLORS.panel, color: COLORS.text };
  const presets = [["YTD", MP_RANGE_MIN], ["Last 3 months", "2026-07-01"], ["Sep → Oct", "2026-09-01"]];
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: COLORS.textMuted }}>From</span>
      <input type="date" value={range.from} min={MP_RANGE_MIN} max={MP_RANGE_MAX} onChange={(e) => set("from", e.target.value)} style={inp} />
      <span style={{ fontSize: 12, color: COLORS.textMuted }}>to</span>
      <input type="date" value={range.to} min={MP_RANGE_MIN} max={MP_RANGE_MAX} onChange={(e) => set("to", e.target.value)} style={inp} />
      {presets.map(([l, f]) => (
        <button key={l} onClick={() => setRange({ from: f, to: MP_RANGE_MAX })} style={{ padding: "5px 10px", fontSize: 11.5, borderRadius: 999, border: `1px solid ${COLORS.panelBorder2}`, background: range.from === f && range.to === MP_RANGE_MAX ? COLORS.slateDim : COLORS.panel, color: COLORS.textMuted, cursor: "pointer" }}>{l}</button>
      ))}
      <InfoTip text="Filters every chart and table on this tab. Monthly shows every month the range touches (October is month-to-date). Daily and weekly detail exists from Sep 1. Hero cards, flags, issues and opportunities follow the month of the 'to' date." />
    </div>
  );
}

// ---- the chart set (shared by Overall overview and Current month) ----
function MPMetricCharts({ data }) {
  const { rows, labels, kind, partialLast } = data;
  if (!rows.length) return <MPBanner text="No data in this range for the chosen view — daily and weekly detail starts on Sep 1. Widen the range or switch to Monthly." />;
  const m = rows.map(mpRowMetrics);
  const hasFul = m.some((p) => p.ful > 0);
  const ins = (vals, o) => mpInsight({ values: vals, labels, kind, partialLast, ...o });
  const pctIns = (vals, good) => ins(vals, { rate: true, good, fmtFn: (v) => mpPctStr(v, 1) });
  const lostDam = m.map((p) => p.lost + p.dam);
  return (
    <>
      <MPSection title="Growth" />
      <MPGrid2>
        <MPChartCard title="Volume" info="Pickups per period, split LM vs Box (mart: ecomm, box and fulfillment pickups)." insight={ins(m.map((p) => p.vol), { good: "up" })}>
          <MPBarChart data={m.map((p, i) => ({ x: labels[i], LM: p.lm, Box: p.box, ...(hasFul ? { Fulfillment: p.ful } : {}) }))} xKey="x" stacked partialLast={partialLast}
            series={[{ key: "LM", label: "LM", color: COLORS.blue }, { key: "Box", label: "Box", color: COLORS.teal }, ...(hasFul ? [{ key: "Fulfillment", label: "Fulfillment", color: COLORS.purple }] : [])]} />
        </MPChartCard>
        <MPChartCard title="Revenue" info="Delivery revenue in EGP = shipping + VAS (mart: delivery_revenue_shipping and delivery_revenue_vas_total)." insight={ins(m.map((p) => p.rev), { good: "up" })}>
          <MPBarChart data={m.map((p, i) => ({ x: labels[i], Shipping: p.ship, VAS: p.vas }))} xKey="x" stacked partialLast={partialLast}
            series={[{ key: "Shipping", label: "Shipping", color: COLORS.amber }, { key: "VAS", label: "VAS", color: COLORS.purple }]} />
        </MPChartCard>
      </MPGrid2>
      {MP_MODE === "portfolio" && (
        <MPGrid2>
          <MPChartCard title="Active merchants" info="Merchants with at least one pickup in the period." insight={ins(m.map((p) => p.active), { good: "up" })}>
            <MPLineChart data={m.map((p, i) => ({ x: labels[i], v: p.active }))} xKey="x" series={[{ key: "v", label: "Active merchants", color: COLORS.blue }]} partialLast={partialLast} fmtFn={(v) => fmt(v)} />
          </MPChartCard>
        </MPGrid2>
      )}

      <MPSection title="Pricing & cost" />
      <MPGrid2>
        <MPChartCard title="ASP" info="Average selling price = revenue ÷ pickups. Shipping ASP uses shipping revenue, VAS ASP uses VAS revenue." insight={ins(m.map((p) => p.aspS), { good: "up", fmtFn: (v) => fmt(v, 1) })}>
          <div style={{ fontSize: 10.5, color: COLORS.textFaint, marginTop: -2 }}>Shipping (EGP / pickup)</div>
          <MPLineChart height={96} data={m.map((p, i) => ({ x: labels[i], v: p.aspS }))} xKey="x" series={[{ key: "v", label: "Shipping", color: COLORS.amber }]} zeroBase={false} partialLast={partialLast} fmtFn={(v) => fmt(v, 1)} />
          <div style={{ fontSize: 10.5, color: COLORS.textFaint, marginTop: 4 }}>VAS (EGP / pickup)</div>
          <MPLineChart height={96} data={m.map((p, i) => ({ x: labels[i], v: p.aspV }))} xKey="x" series={[{ key: "v", label: "VAS", color: COLORS.purple }]} zeroBase={false} partialLast={partialLast} fmtFn={(v) => fmt(v, 2)} />
        </MPChartCard>
        <MPChartCard title="Compensation" info="Compensation paid to merchants, in EGP (mart: compensation_amount). Lower is better." insight={ins(m.map((p) => p.comp), { good: "down" })}>
          <MPBarChart data={m.map((p, i) => ({ x: labels[i], Compensation: p.comp }))} xKey="x" series={[{ key: "Compensation", label: "Compensation", color: COLORS.coral }]} partialLast={partialLast} />
        </MPChartCard>
      </MPGrid2>

      <MPSection title="Service quality" />
      <MPGrid2>
        <MPChartCard title="DSR" info="Delivery success rate = dsr_numerator ÷ dsr_denominator from the mart. 'Low' means 65% or below. Complete periods only: recent parcels have no final outcome yet, so a running month or partial week is left blank." insight={pctIns(m.map((p) => p.dsr), "up")}>
          <MPLineChart data={m.map((p, i) => ({ x: labels[i], v: p.dsr }))} xKey="x" series={[{ key: "v", label: "DSR", color: COLORS.teal }]} zeroBase={false} yFormat="pct" partialLast={partialLast} />
        </MPChartCard>
        <MPChartCard title="ASR" info="Attempt success rate = asr_numerator ÷ asr_denominator from the mart (no value on days without delivery attempts). Complete periods only: a running month or partial week is left blank." insight={pctIns(m.map((p) => p.asr), "up")}>
          <MPLineChart data={m.map((p, i) => ({ x: labels[i], v: p.asr }))} xKey="x" series={[{ key: "v", label: "ASR", color: COLORS.blue }]} zeroBase={false} yFormat="pct" partialLast={partialLast} />
        </MPChartCard>
      </MPGrid2>

      <MPSection title="Issues" />
      <MPChartCard title="Lost & damaged" info="Parcels flagged lost or damaged in the period (mart: parcels_lost, parcels_damaged). Lower is better." insight={ins(lostDam, { good: "down" })}>
        <MPBarChart data={m.map((p, i) => ({ x: labels[i], Lost: p.lost, Damaged: p.dam }))} xKey="x" partialLast={partialLast} series={[{ key: "Lost", label: "Lost", color: COLORS.purple }, { key: "Damaged", label: "Damaged", color: COLORS.coral }]} />
      </MPChartCard>
    </>
  );
}

function MPPeriodTable({ data }) {
  if (!data.rows.length) return null;
  const labelName = data.kind === "month" ? "Month" : data.kind === "week" ? "Week of" : "Day";
  const cols = mpTableCols().map((c, i) => (i === 0 ? { ...c, label: labelName } : c));
  const dayPrev = data.kind === "day" ? (rows, i) => rows.findIndex((x) => x._date === mpAddDays(rows[i]._date, -7)) : undefined;
  return (
    <>
      <MPSection title="Period by period" />
      <MPHeatLegend />
      <MPTable columns={cols} rows={mpMetricTableRows(data.rows.map((r, i) => ({ ...r, _partial: data.partialLast && i === data.rows.length - 1 })), (r, i) => data.labels[i] + (data.partialLast && i === data.rows.length - 1 ? " (MTD)" : ""))} tol={MP_TOL} prevOf={dayPrev} />
    </>
  );
}

// ---- flags ----
function MPFlagChips({ monthIdx }) {
  const cur = MP_MONTHLY[monthIdx];
  if (MP_MODE === "portfolio") {
    const pf = MP_PF, st = pf.stats;
    const dIdx = mpDsrIdx(monthIdx), dm = MP_MONTHLY[dIdx];
    const lowDsr = dm.dsr_avg != null && dm.dsr_avg <= 0.65;
    const vasShare = cur.active_merchants ? Math.round((cur.vas_merchants / cur.active_merchants) * 100) : 0;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
        <MPChip label="Merchants" value={`${pf.count} · ${cur.active_merchants} active in ${MP_MON3[Number(cur.month.slice(5)) - 1]}`} info="Merchants currently assigned to this AM; 'active' = at least one pickup in the selected month." />
        <MPChip label="Segments" value={st.segmentMix} info="Merchant segment as tagged in the mart, share of this AM's merchants." />
        <MPChip label="DSR status" value={(lowDsr ? "Low DSR" : "Healthy") + (dIdx !== monthIdx ? " (" + mpMonthLabel(dIdx) + ")" : "")} tone={lowDsr ? "coral" : "teal"} info={"Portfolio DSR of " + mpMonthLabel(dIdx) + (dIdx !== monthIdx ? ", the last complete month (DSR is not shown for a running month)" : "") + ". Low = 65% or below."} />
        <MPChip label="Seasonality" value="Coming soon" tag="soon" info="Seasonality tagging is coming soon." />
        <MPChip label="VAS adoption" value={`${vasShare}% of active merchants`} tone={vasShare >= 50 ? "teal" : "amber"} info="Active merchants with any VAS revenue in the selected month ÷ active merchants." />
        <MPChip label="Sub-accounts" value={`${st.subs} sub · ${st.parents} parent`} tone="purple" info="Sub-account = accepted invitation under a parent in public.business_invitations. Parent = has accepted sub-accounts." />
        <MPChip label="Websites known" value={`${st.websites} of ${pf.count}`} info="Merchants with a website in public.businesses." />
        <MPChip label="FB ads" value="Coming soon" tag="soon" info="Facebook ads detection is not available yet." />
      </div>
    );
  }
  const flags = computeFlagsMP(monthIdx);
  const dIdx = mpDsrIdx(monthIdx), dm = MP_MONTHLY[dIdx];
  const lowD = dm.dsr_avg != null && dm.dsr_avg <= 0.65;
  const subInfo = "Sub-account = accepted invitation under a main account (public.business_invitations). " + (MP_X.parentId
    ? "This is a sub-account. Main account ID: " + MP_X.parentId + (MP_X.nSubs ? ". It also has " + MP_X.nSubs + " sub-account" + (MP_X.nSubs > 1 ? "s" : "") + "." : ".")
    : MP_X.nSubs ? "This is a main account with " + MP_X.nSubs + " sub-account" + (MP_X.nSubs > 1 ? "s" : "") + "." : "This is a main account with no sub-accounts.");
  const sub = MP_X.parentId ? { v: "Sub-account of " + (MP_X.parentName || MP_X.parentId) + (MP_X.nSubs ? " · also parent of " + MP_X.nSubs : ""), tone: "purple" }
    : MP_X.nSubs ? { v: "Parent · " + MP_X.nSubs + " sub-account" + (MP_X.nSubs > 1 ? "s" : ""), tone: "blue" } : { v: "Main account" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
      <MPChip label="Segment" value={MP_MERCHANT.segment || "—"} info="Merchant segment as tagged in the mart." />
      <MPChip label="Lifecycle" value={flags.lifecycle} tone={flags.lifecycle === "Retained" ? "teal" : flags.lifecycle === "Reactivated" ? "purple" : "blue"}
        info="New = joined in the selected month. Retained = active last month and this month. Reactivated = inactive last month, active before, active now. Active = any pickup in the month." />
      <MPChip label="Account" value={sub.v} tone={sub.tone} info={subInfo} />
      <MPChip label="Seasonality" value="Coming soon" tag="soon" info="Seasonality tagging is coming soon." />
      <MPChip label="DSR status" value={(lowD ? "Low DSR" : "Healthy") + (dIdx !== monthIdx ? " (" + mpMonthLabel(dIdx) + ")" : "")} tone={lowD ? "coral" : "teal"} info={"Low DSR when the DSR of " + mpMonthLabel(dIdx) + " is 65% or below" + (dIdx !== monthIdx ? " (last complete month: DSR is not shown for a running month)." : ".")} />
      <MPChip label="VAS" value={flags.vasFlag} tone={flags.vasFlag === "None" ? "coral" : flags.vasFlag === "Full" ? "teal" : "amber"}
        info="Core VAS types with revenue in the selected month or the 2 before: Insurance, Next-day, Allow to open, Extra COD, Flexship, Materials. 0 None · 1 Single · 2–5 Multiple · 6 Full." />
      <MPChip label="Creation source" value={MP_X.source ? MP_X.source + (MP_X.sourcePct != null ? " (" + MP_X.sourcePct + "%)" : "") : "n/a"} info="Most common way this merchant's parcels were created since Jul 1 (mart.v_parcel_lifecycle)." />
      <MPChip label="Website" value={MP_X.website ? <a href={"https://" + MP_X.website} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.blue, textDecoration: "none" }}>{MP_X.website}</a> : "n/a"} info="public.businesses.website, shown as the domain." />
      <MPChip label="FB ads" value="Coming soon" tag="soon" info="Facebook ads detection is not available yet." />
      <MPChip label="Pickup locations" value={MP_X.locations.length ? MP_X.locations.join("  |  ") : "n/a"} info="Top 2 pickup city / zone by parcels since Jul 1 (mart.v_parcel_lifecycle). City and zone, not street addresses." />
    </div>
  );
}

// ---- portfolio-only story blocks ----
function MPPortfolioBlocks({ monthIdx, onOpenMerchant }) {
  const pf = MP_PF; const cur = MP_MONTHLY[monthIdx];
  const rank = mpPfRank(monthIdx, "parcels_picked", 8);
  const total = pf.parsed.reduce((s, p) => s + (p.monthly[monthIdx].parcels_picked || 0), 0);
  const top5 = rank.slice(0, 5).reduce((s, r) => s + r.value, 0);
  const share = total ? Math.round((top5 / total) * 100) : 0;
  const a = pf.analysis;
  const mix = [{ label: "Hit target", value: a.hitCount, color: COLORS.teal }, { label: "Didn't hit target", value: a.missedCount, color: COLORS.coral }, { label: "Churned", value: a.churnedCount, color: COLORS.slate }, { label: "New", value: a.newCount, color: COLORS.purple }];
  const growth = ["Grower", "Stable", "Dropper"].map((g) => ({ label: g, value: a.merchants.filter((m) => m.growthStatus === g).length, color: g === "Grower" ? COLORS.teal : g === "Dropper" ? COLORS.coral : COLORS.slate }));
  return (
    <>
      <MPSection title="Who drives this portfolio" />
      <MPGrid2>
        <MPChartCard title="Top merchants" info={"Top merchants by pickups in " + MP_MON3[Number(cur.month.slice(5)) - 1] + ". Click a name to open its profile."} insight={total ? { text: `Top 5 = ${share}% of ${mpCompact(total)} pickups`, tone: share >= 70 ? "bad" : "flat" } : null}>
          <MPRankBars data={rank.map((r) => ({ label: r.label, value: r.value, item: r.item }))} onItemClick={onOpenMerchant} fmtFn={(v) => mpCompact(v)} />
        </MPChartCard>
        <MPChartCard title="Where merchants stand now" info="Current month, month-to-date. Hit/missed = existing merchants vs their own target; churned = no pickups yet this month; new = joined this month. Growth compares this month's daily average so far with the same days of last month: ±15% = Grower/Dropper.">
          <MPRankBars data={mix} fmtFn={(v) => fmt(v)} />
          <div style={{ fontSize: 10.5, color: COLORS.textFaint, margin: "10px 0 6px" }}>Growth vs the same days last month</div>
          <MPRankBars data={growth} fmtFn={(v) => fmt(v)} />
        </MPChartCard>
      </MPGrid2>
    </>
  );
}

function MPOverallOverview({ range, setRange, granularity, setGranularity, monthIdx, onOpenMerchant }) {
  const data = mpSeriesForRange(granularity, range);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <MPDateRange range={range} setRange={setRange} />
        <MPPillRow tabs={["Daily", "Weekly", "Monthly"]} active={granularity} onChange={setGranularity} />
      </div>
      <MPFlagChips monthIdx={monthIdx} />
      {granularity === "Daily" && <div style={{ fontSize: 11, color: COLORS.textFaint, margin: "8px 0 0" }}>Daily view skips Fridays (non-working days).</div>}
      {MP_MODE === "portfolio" && <MPPortfolioBlocks monthIdx={monthIdx} onOpenMerchant={onOpenMerchant} />}
      <MPMetricCharts data={data} />
      <MPPeriodTable data={data} />
    </div>
  );
}

function MPCurrentMonthOverview({ granularity, setGranularity }) {
  const monthRow = MP_MONTHLY[MP_MONTHLY.length - 1];
  const days = MP_DAILY_CUR;
  let data;
  if (granularity === "Monthly") { const tdp = mpTdPair(MP_MONTHLY.length - 1); data = { rows: [tdp.prev, tdp.cur], labels: [tdp.label, tdp.curLabel], kind: "month", partialLast: false }; }
  else if (granularity === "Weekly") { const w = weeklyFromDailyMP(days); data = { rows: w, labels: w.map((x) => mpShortDate(x.start)), kind: "week", partialLast: false }; }
  else { const rows = days.filter((d) => dayOfWeekName(d.date) !== "Friday"); data = { rows, labels: rows.map((d) => mpShortDate(d.date)), kind: "day", partialLast: false }; }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
        <MPPillRow tabs={["Daily", "Weekly", "Monthly"]} active={granularity} onChange={setGranularity} />
        <div style={{ padding: "9px 18px", borderRadius: 999, background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.purple})`, color: "#fff", fontFamily: MP_MONO, fontWeight: 700, fontSize: 13.5, boxShadow: "0 4px 14px rgba(76,110,245,0.3)" }}>
          Current month: {monthRow.month}
        </div>
      </div>
      <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4 }}>{MP_CUR_NAME} so far: {days.length} calendar days of data ({MP_CUR_WD} working days). {granularity === "Monthly" ? "Monthly view compares the same days of both months." : granularity === "Daily" ? "Daily view skips Fridays." : ""}</div>
      <MPMetricCharts data={data} />
      <MPPeriodTable data={data} />
    </div>
  );
}
