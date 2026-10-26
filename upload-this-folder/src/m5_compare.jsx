
// ============================================================================
// Comparison tab. Every comparison uses periods of the SAME length:
//   month-to-date vs the same days of the previous month, week-to-date vs the same days of the previous week.
// The current value is always shown first, followed by the same-length periods before it.
// ============================================================================
const MP_DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function mpDayLabel(date) { return MP_DOW[new Date(date + "T00:00:00Z").getUTCDay()].slice(0, 3) + " " + mpShortDate(date); }
function mpMetricFmt(metric) { return metric.isPct ? (v) => (mpOk(v) ? v.toFixed(1) + "%" : "—") : (v) => (mpOk(v) ? fmt(v, metric.decimals || 0) : "—"); }

function MPSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, fontSize: 12.5, background: COLORS.panel, color: COLORS.text }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// current value first, then every earlier period of the same length, each with "current vs this"
function MPValueStrip({ items, metric }) {
  if (!items.length) return null;
  const f = mpMetricFmt(metric);
  const good = MP_GOOD[metric.key] || "up";
  const curV = metric.getVal(items[0].row);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, display: "flex", alignItems: "center" }}>
        {metric.label}: current and earlier same-length periods<InfoTip text="The first card is the current value. Every other card shows an earlier period of the same length, with how the current value compares to it." />
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {items.slice(0, 7).map((it, i) => {
          const v = metric.getVal(it.row);
          const d = i === 0 ? null : mpDeltaOf(curV, v, { rate: !!metric.isPct, good, label: "" });
          return (
            <div key={i} style={{ minWidth: 128, flex: "0 0 auto", background: i === 0 ? "rgba(76,110,245,0.08)" : COLORS.panel, border: `1px solid ${i === 0 ? COLORS.blue : COLORS.panelBorder}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: i === 0 ? COLORS.blue : COLORS.textFaint, fontWeight: 600, whiteSpace: "nowrap" }}>{it.label}{i === 0 ? " · current" : ""}</div>
              <div style={{ fontFamily: MP_MONO, fontSize: 17, fontWeight: 700, margin: "3px 0 5px" }}>{f(v)}</div>
              {d ? <MPDeltaChip d={{ text: d.text.replace(/ vs $/, ""), tone: d.tone }} /> : <span style={{ fontSize: 10.5, color: COLORS.textFaint }}>baseline</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mpWeekItem(w, n) { const d = w.days.slice(0, n); return { label: "Wk of " + mpShortDate(w.days[0].date) + (n < 7 ? ` (first ${n}d)` : ""), row: mpAggregate(d, d.length < 7), n: d.length }; }

function MPComparison() {
  const days = MP_COMBINED_DAILY;
  const last = days[days.length - 1];
  const curIdx = MP_MONTHLY.length - 1;
  const weeks = mpWeeksOf(days);
  const [level, setLevel] = useState("Day");
  const [sub, setSub] = useState("Same weekday last week");
  const [metricKey, setMetricKey] = useState("volume");
  const [weekday, setWeekday] = useState(MP_DOW[new Date(last.date + "T00:00:00Z").getUTCDay()]);
  const [dom, setDom] = useState(dayOfMonth(last.date));
  const [pos, setPos] = useState(Math.ceil(MP_DAILY_CUR.length / 7));
  const [dayA, setDayA] = useState(last.date);
  const [dayB, setDayB] = useState(days[days.length - 2].date);
  const [wkA, setWkA] = useState(weeks.length - 1);
  const [wkB, setWkB] = useState(Math.max(0, weeks.length - 2));
  const [monA, setMonA] = useState(curIdx);
  const [monB, setMonB] = useState(curIdx - 1);
  const metrics = mpMetricList();
  const metric = metrics.find((m) => m.key === metricKey) || metrics[0];
  const subs = level === "Day" ? ["Previous day", "Same weekday last week", "Same date last month", "Custom"] : level === "Week" ? ["Previous week", "Same week last month", "Custom"] : ["Previous month", "Custom"];
  const changeLevel = (l) => { setLevel(l); setSub(l === "Day" ? "Same weekday last week" : l === "Week" ? "Previous week" : "Previous month"); };

  let items = [], banner = null, controls = null;
  const dayOf = (date) => days.find((d) => d.date === date);
  if (level === "Day") {
    if (sub === "Previous day") items = days.slice(-14).reverse().map((d) => ({ label: mpDayLabel(d.date), row: d }));
    else if (sub === "Same weekday last week") {
      items = days.filter((d) => MP_DOW[new Date(d.date + "T00:00:00Z").getUTCDay()] === weekday).reverse().map((d) => ({ label: mpDayLabel(d.date), row: d }));
      controls = <MPSelect value={weekday} onChange={setWeekday} options={MP_DOW.map((w) => ({ value: w, label: w }))} />;
    } else if (sub === "Same date last month") {
      const a = MP_DAILY_CUR.find((d) => dayOfMonth(d.date) === Number(dom)), b = MP_DAILY_PREV.find((d) => dayOfMonth(d.date) === Number(dom));
      if (a && b) items = [{ label: mpDayLabel(a.date), row: a }, { label: mpDayLabel(b.date), row: b }];
      else banner = "That date has no data yet in the current month.";
      controls = <MPSelect value={String(dom)} onChange={(v) => setDom(Number(v))} options={MP_DAILY_CUR.map((d) => ({ value: String(dayOfMonth(d.date)), label: "Day " + dayOfMonth(d.date) }))} />;
    } else {
      const opts = days.map((d) => ({ value: d.date, label: mpDayLabel(d.date) }));
      items = [dayOf(dayA), dayOf(dayB)].filter(Boolean).map((d) => ({ label: mpDayLabel(d.date), row: d }));
      controls = <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><MPSelect value={dayA} onChange={setDayA} options={opts} /><span style={{ fontSize: 12, color: COLORS.textMuted }}>vs</span><MPSelect value={dayB} onChange={setDayB} options={opts} /></span>;
    }
  } else if (level === "Week") {
    const k = weeks[weeks.length - 1].days.length;
    if (sub === "Previous week") {
      items = weeks.slice().reverse().filter((w) => w.days.length >= k).map((w) => mpWeekItem(w, k));
      if (k < 7) banner = `The current week has ${k} day${k > 1 ? "s" : ""} so far, so each earlier week is cut to its first ${k} day${k > 1 ? "s" : ""}.`;
    } else if (sub === "Same week last month") {
      const posOf = (d) => Math.ceil(dayOfMonth(d.date) / 7);
      const a = MP_DAILY_CUR.filter((d) => posOf(d) === Number(pos));
      const maxDom = a.length ? Math.max(...a.map((d) => dayOfMonth(d.date))) : 0;
      const b = MP_DAILY_PREV.filter((d) => posOf(d) === Number(pos) && dayOfMonth(d.date) <= maxDom);
      if (a.length) {
        items = [{ label: `${mpMonthLabel(curIdx)} W${pos} (days ${dayOfMonth(a[0].date)}–${maxDom})`, row: mpAggregate(a, a.length < 7) }, { label: `${mpMonthLabel(curIdx - 1)} W${pos} (days ${dayOfMonth(a[0].date)}–${maxDom})`, row: mpAggregate(b, a.length < 7) }];
        if (a.length < 7) banner = `Week ${pos} of ${mpMonthLabel(curIdx)} has ${a.length} day${a.length > 1 ? "s" : ""} so far, so it is compared with the same days of ${mpMonthLabel(curIdx - 1)}.`;
      }
      controls = <MPSelect value={String(pos)} onChange={(v) => setPos(Number(v))} options={Array.from({ length: Math.ceil(MP_DAILY_CUR.length / 7) }, (_, i) => ({ value: String(i + 1), label: "Week " + (i + 1) + " of month" }))} />;
    } else {
      const A = weeks[wkA], B = weeks[wkB];
      const n = Math.min(A.days.length, B.days.length);
      items = [mpWeekItem(A, n), mpWeekItem(B, n)];
      if (A.days.length !== B.days.length) banner = `The two weeks have different lengths, so both are cut to their first ${n} days.`;
      const opts = weeks.map((w, i) => ({ value: String(i), label: "Wk of " + mpShortDate(w.days[0].date) + ` (${w.days.length}d)` }));
      controls = <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><MPSelect value={String(wkA)} onChange={(v) => setWkA(Number(v))} options={opts} /><span style={{ fontSize: 12, color: COLORS.textMuted }}>vs</span><MPSelect value={String(wkB)} onChange={(v) => setWkB(Number(v))} options={opts} /></span>;
    }
  } else {
    const tdp = mpTdPair(curIdx);
    const full = (i) => ({ label: mpMonthLabel(i), row: MP_MONTHLY[i] });
    if (sub === "Previous month") {
      items = [{ label: tdp.curLabel, row: tdp.cur }, { label: tdp.label, row: tdp.prev }];
      banner = `${mpMonthLabel(curIdx)} is month-to-date, so it is compared with the same days of ${mpMonthLabel(curIdx - 1)} (${tdp.curLabel.split(" ")[1]} vs ${tdp.label.split(" ")[1]}), not with the full month.`;
    } else {
      const opts = MP_MONTHLY.map((m, i) => ({ value: String(i), label: mpMonthLabel(i) + (i === curIdx ? " (MTD)" : "") }));
      controls = <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><MPSelect value={String(monA)} onChange={(v) => setMonA(Number(v))} options={opts} /><span style={{ fontSize: 12, color: COLORS.textMuted }}>vs</span><MPSelect value={String(monB)} onChange={(v) => setMonB(Number(v))} options={opts} /></span>;
      if (monA !== curIdx && monB !== curIdx) items = [full(monA), full(monB)];
      else if (monA === monB) banner = "Pick two different months.";
      else {
        const other = monA === curIdx ? monB : monA;
        if (other === curIdx - 1) {
          const cur = { label: tdp.curLabel, row: tdp.cur }, prv = { label: tdp.label, row: tdp.prev };
          items = monA === curIdx ? [cur, prv] : [prv, cur];
          banner = `${mpMonthLabel(curIdx)} is month-to-date, so it is compared with the same days of ${mpMonthLabel(curIdx - 1)}, not with the full month.`;
        } else banner = `${mpMonthLabel(curIdx)} is month-to-date and daily detail only exists from Sep 1, so it can only be compared with September (same days) or two complete months can be compared with each other.`;
      }
    }
  }

  const chrono = items.slice().reverse();
  const f = mpMetricFmt(metric);
  const chartData = chrono.map((it) => ({ x: it.label, v: metric.getVal(it.row) }));
  const dayPrev = level === "Day" ? (rows, i) => rows.findIndex((x) => x._date && x._date === mpAddDays(rows[i]._date, -7)) : undefined;
  const tableRows = mpMetricTableRows(chrono.map((it, i) => ({ ...it.row, _highlight: i === chrono.length - 1 })), (r, i) => chrono[i].label);
  return (
    <div>
      <MPPillRow tabs={["Day", "Week", "Month"]} active={level} onChange={changeLevel} />
      <MPPillRow tabs={subs} active={sub} onChange={setSub} />
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>Metric to compare:</span>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: `2px solid ${COLORS.blue}`, fontSize: 12.5, fontWeight: 700, color: COLORS.blue, background: COLORS.panel }}>
          {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        {controls}
        <InfoTip text="Periods are always the same length: month-to-date vs the same days of the previous month, week-to-date vs the same days of the previous week. Never a partial period against a full one." />
      </div>
      {banner && <MPBanner text={banner} />}
      {items.length >= 2 ? (
        <>
          <MPMetricDeltaCard metric={metric} rowA={items[0].row} rowB={items[1].row} labelA={items[0].label} labelB={items[1].label} />
          <MPValueStrip items={items} metric={metric} />
          <MPChartCard title={metric.label} info={MP_CMP_INFO}>
            {chartData.length <= 8
              ? <MPBarChart data={chartData} xKey="x" series={[{ key: "v", label: metric.label, color: COLORS.blue }]} fmtFn={f} />
              : <MPLineChart data={chartData} xKey="x" series={[{ key: "v", label: metric.label, color: COLORS.blue }]} fmtFn={f} zeroBase={!metric.isPct} />}
          </MPChartCard>
          <MPSection title="All metrics, same-length periods" />
          <MPHeatLegend />
          <MPTable columns={mpTableCols()} rows={tableRows} tol={MP_TOL} prevOf={dayPrev} />
        </>
      ) : null}
    </div>
  );
}
