// ============================================================================
// Live section (top of every view, above the targets): parcels created and picked up today, from fact.deliveries_live.
// The numbers come from live.json (built every minute by jobs/refresh_live.py from sql/live_rows.sql). The file holds one row per business,
// so each view adds up only the merchants of its own portfolio. docs/LIVE.md explains the feed.
//   window.PORTAL_CONFIG.liveUrl : where to read it (default "/live.json")
//   window.PORTAL_CONFIG.live    : a snapshot inside the page (used by the offline file, and as a fallback when the feed cannot be read)
// ============================================================================
const LIVE_EVERY_MS = 60000;
const LIVE_STALE_MIN = 15; // older than this: the dot turns grey and the card says how old the data is
const LIVE_COLS = ["id", "c_t", "c_ys", "c_b", "p_t", "p_ys", "p_b", "pc_t", "c_y", "c_yy", "p_y", "p_yy", "pc_y"];
const LiveStore = (() => {
  const cfg = (typeof window !== "undefined" && window.PORTAL_CONFIG) || {};
  const s = { data: null, snapshot: false, error: null, loading: false, subs: new Set(), timer: null, idx: null, okAt: null };
  const ok = (d) => d && Array.isArray(d.rows) && Array.isArray(d.cols) && d.cols.join() === LIVE_COLS.join();
  const set = (d, snapshot) => { s.data = d; s.snapshot = snapshot; s.idx = new Map(d.rows.map((r) => [r[0], r])); };
  if (ok(cfg.live)) set(cfg.live, true);
  const tell = () => s.subs.forEach((f) => f());
  s.load = () => {
    if (typeof fetch !== "function" || s.loading) return Promise.resolve();
    s.loading = true; tell();
    const url = cfg.liveUrl || "/live.json";
    return fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store", credentials: "same-origin" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((d) => { if (!ok(d)) throw new Error("unexpected live file"); set(d, false); s.error = null; s.okAt = Date.now(); })
      .catch((e) => { s.error = String((e && e.message) || e); })
      .then(() => { s.loading = false; tell(); });
  };
  s.start = () => { if (s.timer) return; s.load(); s.timer = setInterval(s.load, LIVE_EVERY_MS); };
  s.stop = () => { if (s.timer) { clearInterval(s.timer); s.timer = null; } };
  return s;
})();
function useLive() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    LiveStore.subs.add(f); LiveStore.start();
    return () => { LiveStore.subs.delete(f); if (!LiveStore.subs.size) LiveStore.stop(); };
  }, []);
  return LiveStore;
}
// minutes between the newest row of the feed and "now" in Cairo (the feed's clock is Cairo time)
function liveAgeMin(asOf) {
  try {
    const m = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/.exec(asOf || ""); if (!m) return null;
    const cairo = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
    const then = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return Math.max(0, Math.round((cairo - then) / 60000));
  } catch (e) { return null; }
}
const liveAgeText = (min) => (min == null ? "" : min < 60 ? min + " min ago" : min < 1440 ? Math.floor(min / 60) + " h ago" : Math.floor(min / 1440) + " d ago");
// which merchants a view adds up: the roster merchants of the AM / team / head / VP, or the new + last-month merchants of a sales rep
function liveScopeIds(kind, ent) {
  if (kind === "sales") return new Set((ent.newList || []).concat(ent.cohortList || [], ent.reactList || []).map((x) => x[0]));
  return new Set(leadScope(kind, ent).rows.map((r) => r.id));
}
const LIVE_NAME = (() => {
  const m = new Map();
  LEAD_ROWS.forEach((r) => m.set(r.id, { name: r.name, seg: r.seg, am: r.amName }));
  ORG.sales.forEach((x) => (x.newList || []).concat(x.cohortList || [], x.reactList || []).forEach((l) => { if (!m.has(l[0])) m.set(l[0], { name: l[1], seg: null, am: null }); }));
  return m;
})();
function liveSum(idx, ids) {
  const t = new Array(LIVE_COLS.length).fill(0), by = [];
  ids.forEach((id) => { const r = idx.get(id); if (!r) return; for (let i = 1; i < r.length; i++) t[i] += r[i]; by.push(r); });
  return { t, by };
}
const livePct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

function LiveChip({ pct, label }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const up = pct >= 0, c = up ? COLORS.teal : COLORS.coral, v = Math.round(Math.abs(pct));
  return <span aria-label={label + " " + (up ? "up " : "down ") + v + " percent"} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: up ? COLORS.tealDim : COLORS.coralDim, color: c, borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}><span aria-hidden="true" style={{ fontSize: 9 }}>{up ? "▲" : "▼"}</span>{v > 999 ? "999%+" : v + "%"}</span>;
}
function LiveMerchants({ title, by, col, ci }) {
  const [q, setQ] = useState(""); const [all, setAll] = useState(false);
  const ql = q.trim().toLowerCase();
  const rows = by.filter((r) => r[col] > 0).map((r) => ({ id: r[0], c: r[ci.c], p: r[ci.p], ...(LIVE_NAME.get(r[0]) || {}) }))
    .filter((r) => !ql || ((r.name || "") + " " + r.id + " " + (r.am || "") + " " + leadSegLabel(r.seg)).toLowerCase().includes(ql))
    .sort((a, b) => (col === ci.cKey ? b.c - a.c : b.p - a.p));
  const shown = all ? rows : rows.slice(0, 50);
  const th = { padding: "7px 10px", textAlign: "left", fontSize: 11.5, color: COLORS.textMuted, fontWeight: 600, whiteSpace: "nowrap", background: COLORS.card };
  const td = { padding: "6px 10px", fontSize: 12.5, whiteSpace: "nowrap" }, num = { ...td, textAlign: "right" };
  return (
    <div role="region" aria-label={title} data-testid="live-list" style={{ ...UI.tile, marginTop: 12, background: COLORS.panel }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{title} · {fmt(rows.length)} merchants</h3>
        <span style={{ flex: 1 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, name, AM or segment" aria-label="Search the merchants in this live list" style={{ ...UI.input, minWidth: 220 }} />
      </div>
      {rows.length === 0 ? <div style={{ fontSize: 12.5, color: COLORS.textMuted }}>No merchants yet.</div> : (
        <div style={{ ...UI.table, overflowX: "auto", maxHeight: 420, overflowY: "auto" }} className="tt-scroll-x" data-tt="scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0 }}><tr>
              <th style={th}>Business ID</th><th style={th}>Merchant</th><th style={th}>Segment</th><th style={th}>Account manager</th>
              <th style={{ ...th, textAlign: "right" }}>Created</th><th style={{ ...th, textAlign: "right" }}>Picked up</th>
            </tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}>
                <td style={td}>{r.id}</td><td style={{ ...td, color: COLORS.text }}>{r.name || "—"}</td><td style={td}>{r.seg ? leadSegLabel(r.seg) : "—"}</td><td style={td}>{r.am || "—"}</td>
                <td style={num}>{fmt(r.c)}</td><td style={num}>{fmt(r.p)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {!all && rows.length > 50 && <button onClick={() => setAll(true)} style={{ ...UI.btn, marginTop: 10 }}>Show all {fmt(rows.length)}</button>}
    </div>
  );
}
function LiveSection({ kind, ent }) {
  const L = useLive();
  const [day, setDay] = useState("today"); // "today" | "yesterday"
  const [open, setOpen] = useState(null);   // "created" | "picked"
  const ids = useMemo(() => liveScopeIds(kind, ent), [kind, ent]);
  const live = L.data;
  const S = useMemo(() => (live ? liveSum(L.idx, ids) : null), [live, ids]);
  const card = { ...UI.card, padding: "16px 18px" };
  if (!live || !S) {
    return (
      <div data-testid="live-section" role="status" style={{ ...card, color: COLORS.textMuted, fontSize: 13 }}>
        {L.loading || !L.error ? "Loading the live numbers…" : "Live numbers are not available right now. They are read from " + ((window.PORTAL_CONFIG && window.PORTAL_CONFIG.liveUrl) || "/live.json") + " (" + L.error + ")."}
      </div>
    );
  }
  const T = S.t, x = (k) => T[LIVE_COLS.indexOf(k)];
  const age = liveAgeMin(live.asOf), fresh = !L.snapshot && !L.error && age != null && age <= LIVE_STALE_MIN;
  const clock = live.asOf.slice(11, 16);
  const isToday = day === "today";
  const hasBase = isToday && live.bwC > 0 && live.bwP > 0;
  const created = isToday ? x("c_t") : x("c_y"), picked = isToday ? x("p_t") : x("p_y");
  const created2 = isToday ? x("c_ys") : x("c_yy"), picked2 = isToday ? x("p_ys") : x("p_yy");
  const cBase = hasBase ? Math.round(x("c_b") / live.bwC) : null, pBase = hasBase ? Math.round(x("p_b") / live.bwP) : null;
  const done = isToday ? x("pc_t") : x("pc_y"), left = Math.max(0, created - done), donePct = created > 0 ? done / created : 0;
  const when = isToday ? "today" : "yesterday";
  const dayLabel = isToday ? "Today" : "Yesterday";
  const cmpLabel = isToday ? "At same time yesterday" : "The day before";
  const ci = { c: LIVE_COLS.indexOf(day === "today" ? "c_t" : "c_y"), p: LIVE_COLS.indexOf(day === "today" ? "p_t" : "p_y") };
  ci.cKey = ci.c;
  const col = (k) => (k === "created" ? ci.c : ci.p);
  const metric = (label, info, value, pctVsBase, base, second, secondPct) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: COLORS.textMuted }}>{label}<InfoTip text={info} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        <span style={{ ...UI.kpi, fontSize: 30 }}>{fmt(value)}</span>
        {hasBase && <LiveChip pct={pctVsBase} label="versus the baseline" />}
      </div>
      {hasBase && <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6 }}>vs baseline same minute {fmt(base)}</div>}
      <div style={{ borderTop: `1px solid ${COLORS.panelBorder}`, margin: "14px 0 12px" }} />
      <div style={{ fontSize: 13.5, color: COLORS.textMuted }}>{cmpLabel}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{fmt(second)}</span>
        <LiveChip pct={secondPct} label={"versus " + cmpLabel.toLowerCase()} />
      </div>
    </div>
  );
  return (
    <div data-testid="live-section">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, background: fresh ? COLORS.tealFill : COLORS.textFaint, flex: "0 0 auto" }} />
        <span data-testid="live-clock" style={{ fontSize: 14, color: COLORS.textMuted }}>
          {fresh ? "Live · " : L.snapshot ? "Snapshot · " : "Last update · "}{live.asOf.slice(0, 10) === live.day ? dayLabel : live.asOf.slice(0, 10)} {clock}{!fresh && age != null ? " · " + liveAgeText(age) : ""}
        </span>
        <span style={{ flex: 1 }} />
        <div role="group" aria-label="Day" style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setDay("today")} aria-pressed={isToday} style={UI.pill(isToday)}>Today</button>
          <button onClick={() => setDay("yesterday")} aria-pressed={!isToday} style={UI.pill(!isToday)}>Yesterday</button>
          <button onClick={() => L.load()} aria-label="Refresh the live numbers" title="Refresh" style={{ ...UI.pill(false), padding: "6px 10px" }}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" style={L.loading ? { animation: "tt-rot .8s linear infinite" } : undefined} /></button>
        </div>
      </div>
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 28 }}>
          {metric("Created " + when, "Parcels created " + when + ", from the warehouse live table (fact.deliveries_live). The day starts at 04:00 Cairo time, like the table's own created date. Deleted parcels are left out. " + (isToday ? "The comparison is the same minute yesterday." : ""), created, livePct(created, cBase), cBase, created2, livePct(created, created2))}
          {metric("Picked up " + when, "Parcels picked up " + when + ", whatever day they were created (the table's pickup date, which also starts at 04:00 Cairo time). " + (isToday ? "The comparison is the same minute yesterday." : ""), picked, livePct(picked, pBase), pBase, picked2, livePct(picked, picked2))}
        </div>
        <div style={{ borderTop: `1px solid ${COLORS.panelBorder}`, margin: "16px 0 14px" }} />
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, color: COLORS.textMuted }}>Picked up of created {when}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.amber }}>{fmt(left)} remaining</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.navy, letterSpacing: "-0.01em" }}>{fmt(done)}</span>
          <span style={{ fontSize: 13.5, color: COLORS.textMuted }}>of {fmt(created)} {"·"} {fmt(donePct * 100, 0)}%</span>
        </div>
        <OrgBar pct={donePct} color={fillOf(COLORS.teal)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12, marginTop: 16 }}>
          <button onClick={() => setOpen(open === "created" ? null : "created")} aria-expanded={open === "created"} style={{ ...UI.btnPrimary, padding: "14px 18px", fontSize: 14, borderRadius: 18 }}>Created by merchant</button>
          <button onClick={() => setOpen(open === "picked" ? null : "picked")} aria-expanded={open === "picked"} style={{ ...UI.btnPrimary, padding: "14px 18px", fontSize: 14, borderRadius: 18 }}>Picked up by merchant</button>
        </div>
        {open && <LiveMerchants key={open + day} title={(open === "created" ? "Created " : "Picked up ") + when + " by merchant"} by={S.by} col={col(open)} ci={ci} />}
      </div>
      <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 8, lineHeight: 1.5 }}>
        {kind === "sales" ? "Merchants of this sales rep (new this month, reactivations and last month's new merchants)." : "Merchants in this portfolio."} Source: fact.deliveries_live.{L.error && !L.snapshot ? " The last refresh failed (" + L.error + "); showing the last numbers read." : ""}{L.snapshot ? " This is a snapshot kept in the page; there is no live connection." : ""}
      </div>
    </div>
  );
}
