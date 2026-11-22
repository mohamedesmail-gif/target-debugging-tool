
// ============================================================================
// Customers tab (merchant profile and portfolio overview): the consignees the parcels went to, grouped by consignee score.
// Data: data/consignee_scores.json (sql/pull_consignee_scores.sql), injected as __P.consignee:
//   { months: ["2026-09", ...], bands: ["High", "Medium", "Bad", "No data"], p: { businessId: [[monthIdx, bandIdx, parcels, delivered], ...] } }
// Consignee score = the consignee's delivery success rate in public.consignees_fraud_score:
//   70% or more -> High, 40% to below 70% -> Medium, below 40% -> Bad, 0 or no score -> No data.
// Parcel month = month of its confirmed delivery-attempt date. Delivered share = delivered parcels ÷ total parcels.
// ============================================================================
const CU_DATA = __P.consignee || null;
const CU_BANDS = ["High", "Medium", "Bad", "No data"];
const CU_RULE = { High: "consignee delivery success rate 70% or more", Medium: "40% to below 70%", Bad: "below 40%", "No data": "rate 0 or no score for the phone" };
const cuColor = (b) => ({ High: COLORS.chart, Medium: COLORS.amberFill, Bad: COLORS.coral, "No data": COLORS.deco }[b]);
const cuMonthLabel = (m) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4);

// totals per month and band for a list of business ids: t[monthIdx][band] = { p, d }
function cuTotals(ids) {
  if (!CU_DATA) return null;
  const nm = CU_DATA.months.length, t = Array.from({ length: nm }, () => Object.fromEntries(CU_BANDS.map((b) => [b, { p: 0, d: 0 }])));
  ids.forEach((id) => (CU_DATA.p[id] || []).forEach(([mi, bi, p, d]) => { const c = t[mi][CU_DATA.bands[bi]]; c.p += p; c.d += d; }));
  return t;
}
function cuSum(t, from, to) {
  const o = Object.fromEntries(CU_BANDS.map((b) => [b, { p: 0, d: 0 }]));
  for (let i = from; i <= to; i++) CU_BANDS.forEach((b) => { o[b].p += t[i][b].p; o[b].d += t[i][b].d; });
  return o;
}
const cuPct = (a, b) => (b > 0 ? (a / b) * 100 : null);

function MPCustomers() {
  const scope = mpCmScope();
  const t = useMemo(() => cuTotals(scope.map((s) => s.id)), [scope.map((s) => s.id).join(",")]);
  const months = CU_DATA ? CU_DATA.months : [];
  const [sel, setSel] = useState("all");
  if (!CU_DATA || !t) return <MPBanner text="Consignee scores are not loaded yet. They come from the refresh job (sql/pull_consignee_scores.sql), which writes data/consignee_scores.json." />;
  const from = sel === "all" ? 0 : Number(sel), to = sel === "all" ? months.length - 1 : Number(sel);
  const s = cuSum(t, from, to);
  const P = CU_BANDS.reduce((x, b) => x + s[b].p, 0), D = CU_BANDS.reduce((x, b) => x + s[b].d, 0);
  const period = sel === "all" ? (months.length ? cuMonthLabel(months[0]) + " – " + cuMonthLabel(months[months.length - 1]) : "") : cuMonthLabel(months[from]);
  if (!P) return <MPBanner text={"No parcels with a confirmed delivery date for this " + (MP_MODE === "portfolio" ? "portfolio" : "merchant") + " in " + period + "."} />;
  const td = { padding: "9px 14px", textAlign: "right", fontFamily: THEME.font, whiteSpace: "nowrap" };
  const chart = months.map((m, i) => ({ x: cuMonthLabel(m), ...Object.fromEntries(CU_BANDS.map((b) => [b, t[i][b].p])) }));
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <span style={UI.label}>Period (confirmed delivery date)</span>
        {[["all", "All months"]].concat(months.map((m, i) => [String(i), cuMonthLabel(m)])).map(([k, l]) => (
          <button key={k} onClick={() => setSel(k)} style={UI.pill(sel === k)}>{l}</button>
        ))}
      </div>
      <div className="tt-kpis" style={{ ...UI.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 12, marginBottom: 14 }}>
        <MPKpi label="Total parcels" value={fmt(P)} sub={period} info="Parcels with a confirmed delivery-attempt date in the period (public.delivery_attempts_asr, one row per tracking number)." />
        <MPKpi label="Delivered parcels" value={fmt(D)} sub={fmt(cuPct(D, P), 1) + "% of total parcels"} accent={COLORS.chart} info="Parcels with at least one successful delivery attempt. Delivered share = delivered parcels ÷ total parcels." />
        {CU_BANDS.map((b) => (
          <MPKpi key={b} label={b + " consignees"} value={fmt(cuPct(s[b].p, P), 1) + "%"} sub={fmt(s[b].p) + " parcels · " + (s[b].p ? fmt(cuPct(s[b].d, s[b].p), 1) + "% delivered" : "none")} accent={cuColor(b) === COLORS.deco ? COLORS.textMuted : cuColor(b)} info={"Share of the parcels whose consignee score is " + b + " (" + CU_RULE[b] + "), from public.consignees_fraud_score."} />
        ))}
      </div>
      <MPGrid2 min={480}>
        <MPChartCard title="Parcels by consignee score" info="Parcels per month, split by the consignee score of the phone they went to.">
          <MPBarChart data={chart} xKey="x" stacked series={CU_BANDS.map((b) => ({ key: b, label: b, color: cuColor(b) }))} />
        </MPChartCard>
        <div className="tt-scroll-x" style={{ ...UI.table, marginBottom: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: COLORS.card }}>
              <Th>Consignee score</Th><Th align="right">Parcels</Th><Th align="right">Share of parcels</Th><Th align="right">Delivered</Th><Th align="right">Delivered share</Th>
            </tr></thead>
            <tbody>
              {CU_BANDS.map((b) => (
                <tr key={b} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                  <td style={{ padding: "9px 14px", whiteSpace: "nowrap" }}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: cuColor(b), marginRight: 8 }} />{b}<div style={{ fontSize: 10.5, color: COLORS.textFaint, marginLeft: 18 }}>{CU_RULE[b]}</div></td>
                  <td style={td}>{fmt(s[b].p)}</td>
                  <td style={{ ...td, color: COLORS.textMuted }}>{fmt(cuPct(s[b].p, P), 1)}%</td>
                  <td style={td}>{fmt(s[b].d)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{s[b].p ? fmt(cuPct(s[b].d, s[b].p), 1) + "%" : "—"}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${COLORS.panelBorder2}`, background: COLORS.card, fontWeight: 700 }}>
                <td style={{ padding: "9px 14px" }}>Total</td><td style={td}>{fmt(P)}</td><td style={td}>100%</td><td style={td}>{fmt(D)}</td><td style={td}>{fmt(cuPct(D, P), 1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </MPGrid2>
      <div style={{ fontSize: 11.5, color: COLORS.textFaint, lineHeight: 1.5 }}>Consignee score = the delivery success rate of the consignee's phone in public.consignees_fraud_score: 70% or more = High, 40% to below 70% = Medium, below 40% = Bad, 0 or no score = No data. A parcel belongs to the month of its confirmed delivery-attempt date. Delivered share = delivered parcels ÷ total parcels.</div>
    </div>
  );
}
