
// ============================================================================
// Current-month detail data (parcel issues, tickets, failed attempts), embedded for the roster only.
// Parcel issues come from mart.v_parcel_lifecycle, tickets from public.freshdesk_tickets_enriched and
// failed attempts from public.deliveries_attempts. Current month only (Oct 1-4); history is not embedded.
// ============================================================================
function mpCmScope() {
  return MP_MODE === "portfolio" ? MP_PF.parsed.map((p) => ({ id: p.item.id, name: p.item.name, item: p.item })) : [{ id: MP_MERCHANT.id, name: MP_MERCHANT.name, item: null }];
}
const mpCmDate = (dom) => "Oct " + dom;
function mpCmIssues(id) {
  if (!MP_CM_P.i[id]) {
    const o = { F: [], R: [], L: [], D: [], C: [] };
    const s = MP_CM && MP_CM.i[id];
    if (s) s.split("~").forEach((r) => { const f = r.split("|"); o[f[1]].push({ tracking: f[0], dom: Number(f[2]), date: mpCmDate(f[2]), hub: f[3], curHub: f[4], star: f[7], attempts: f[8], status: f[9], liability: f[10], amount: f[11], reason: f[12] }); });
    MP_CM_P.i[id] = o;
  }
  return MP_CM_P.i[id];
}
function mpCmIssueRows(type) {
  const out = [];
  mpCmScope().forEach((sc) => mpCmIssues(sc.id)[type].forEach((r) => out.push(MP_MODE === "portfolio" ? { ...r, merchant: sc.name, _item: sc.item } : r)));
  return out.sort((a, b) => b.dom - a.dom);
}
function mpCmTickets(id) {
  if (!MP_CM_P.t[id]) {
    const s = MP_CM && MP_CM.t[id];
    MP_CM_P.t[id] = s ? s.split("~").map((r) => { const f = r.split("|"); return { id: f[0], dom: Number(f[1]), date: mpCmDate(f[1]), status: f[2], agent: f[3] || "Unassigned", type: f[4] || "Untyped", category: f[5] || "Uncategorised", sub: f[6], tracking: f[7], comp: f[8] }; }) : [];
  }
  return MP_CM_P.t[id];
}
function mpCmTicketRows() {
  const out = [];
  mpCmScope().forEach((sc) => mpCmTickets(sc.id).forEach((t) => out.push(MP_MODE === "portfolio" ? { ...t, merchant: sc.name, _item: sc.item } : t)));
  return out.sort((a, b) => b.dom - a.dom);
}
// failed attempts: counts by day and reason, plus the latest 10 rows per merchant
function mpReasonSide(r) {
  const t = r.toLowerCase();
  if (t.startsWith("retry pickup") || t.startsWith("retry return") || t.includes("business") || t.includes("product issue") || t.includes("description / number of items") || r.includes("\u0627\u0644\u0648\u0635\u0641")) return "Merchant";
  if (t.includes("consignee") || t.includes("customer")) return "Customer";
  if (t.startsWith("waiting for data modification")) return "Address / phone data";
  return "Other";
}
const MP_SIDE_COLOR = { Customer: COLORS.chart, Merchant: COLORS.chart2, "Address / phone data": COLORS.sand, Other: COLORS.deco };   // chart theme: teal, light teal, sand, grey
function mpCmAttempts(id) {
  if (!MP_CM_P.a[id]) {
    const e = MP_CM && MP_CM.a[id];
    MP_CM_P.a[id] = e ? {
      counts: e.c.split(";").map((x) => { const [d, c, n] = x.split(",").map(Number); return { dom: d, code: c, n }; }),
      recent: e.r ? e.r.split(";").map((x) => { const [tn, d, c] = x.split(","); return { tracking: tn, dom: Number(d), date: mpCmDate(d), code: Number(c) }; }) : [],
    } : { counts: [], recent: [] };
  }
  return MP_CM_P.a[id];
}
function mpCmAttemptSummary() {
  const rs = MP_CM.rs, days = MP_CM.days;
  const byDay = Array.from({ length: days }, () => ({ Customer: 0, Merchant: 0, "Address / phone data": 0, Other: 0 }));
  const bySide = { Customer: 0, Merchant: 0, "Address / phone data": 0, Other: 0 };
  const byReason = rs.map(() => 0);
  const byMerchant = [];
  const recent = [];
  mpCmScope().forEach((sc) => {
    const a = mpCmAttempts(sc.id); let tot = 0;
    a.counts.forEach((c) => { const side = mpReasonSide(rs[c.code]); byDay[c.dom - 1][side] += c.n; bySide[side] += c.n; byReason[c.code] += c.n; tot += c.n; });
    if (tot) byMerchant.push({ label: sc.name, value: tot, item: sc.item });
    a.recent.forEach((r) => recent.push({ tracking: r.tracking, dom: r.dom, date: r.date, reason: rs[r.code], side: mpReasonSide(rs[r.code]), merchant: sc.name, _item: sc.item }));
  });
  recent.sort((x, y) => y.dom - x.dom);
  return { byDay, bySide, byReason, byMerchant, recent, total: Object.values(bySide).reduce((s, v) => s + v, 0) };
}

// ---- table with filters, CSV download and "show more" (the lists can be thousands of rows) ----
function MPDetailTable({ title, info, note, rows, columns, filterKeys, csvName }) {
  const [f, setF] = useState({});
  const [shown, setShown] = useState(50);
  const labels = { tracking: "Tracking #", hub: "Hub", star: "Star / courier", merchant: "Merchant", agent: "Agent", reason: "Reason", id: "Ticket ID", category: "Category" };
  const filtered = mpApplyFilters(rows, filterKeys, f);
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center" }}>{title} <span style={{ color: COLORS.textFaint, fontWeight: 400, marginLeft: 6 }}>({fmt(filtered.length)}{filtered.length !== rows.length ? " of " + fmt(rows.length) : ""})</span>{info && <InfoTip text={info} />}</div>
        <button onClick={() => downloadCsvMP(csvName, columns.map((c) => ({ key: c.key, label: c.label })), filtered)} style={UI.btnSmall}><Download size={14} strokeWidth={1.75} aria-hidden="true" />Download report</button>
      </div>
      {note && <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginBottom: 8 }}>{note}</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {filterKeys.map((k) => <MPFilterInput key={k} placeholder={labels[k] || k} value={f[k]} onChange={(v) => { setF((x) => ({ ...x, [k]: v })); setShown(50); }} />)}
      </div>
      <MPTable columns={columns} rows={filtered.slice(0, shown)} />
      {filtered.length > shown && <button onClick={() => setShown((s) => s + 50)} style={{ ...UI.btnSmall, marginTop: 8 }}>Show {Math.min(50, filtered.length - shown)} more ({fmt(filtered.length - shown)} left)</button>}
    </div>
  );
}
function MPCmStamp() {
  return <div style={{ fontSize: 11, color: COLORS.textFaint, margin: "0 0 10px" }}>Current month only: Oct 1–{MP_CM ? MP_CM.days : 4} ({MP_CM ? MP_CM.stamp : ""}). History is not embedded.</div>;
}
