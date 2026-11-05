
// ============================================================================
// UI primitives for the Merchant Profile and the AM Portfolio overview
// (hand-rolled SVG: no y-axis, no gridlines, value labels only where they carry the story)
// ============================================================================
const MP_MONO = "'IBM Plex Mono', monospace";

function mpCompact(n, d) {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e4) return Math.round(n / 1e3) + "K";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return d ? n.toFixed(d) : String(Math.round(n));
}
function mpPctStr(v, d) { return v == null || Number.isNaN(v) ? "—" : v.toFixed(d == null ? 1 : d) + "%"; }
const mpOk = (v) => v != null && !Number.isNaN(v);

function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  const hovered = useRef(false); // hover already opened it: a click must not close it again
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 6, verticalAlign: "middle", textTransform: "none", letterSpacing: 0 }}
      onMouseEnter={() => { hovered.current = true; setOpen(true); }} onMouseLeave={() => { hovered.current = false; setOpen(false); }}>
      <span tabIndex={0} aria-label="How this is calculated" onClick={(e) => { e.stopPropagation(); if (hovered.current) setOpen(true); else setOpen((o) => !o); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        style={{ width: 14, height: 14, borderRadius: 7, border: `1px solid ${COLORS.panelBorder2}`, color: COLORS.textFaint, fontSize: 9.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "help", fontFamily: MP_MONO, background: COLORS.panel }}>i</span>
      {open && (
        <span style={{ position: "absolute", left: -6, top: 20, zIndex: 60, width: 232, background: COLORS.text, color: "#fff", fontSize: 11.5, lineHeight: 1.45, fontWeight: 400, padding: "8px 10px", borderRadius: 8, boxShadow: "0 6px 18px rgba(27,35,51,0.25)", whiteSpace: "normal", textAlign: "left" }}>{text}</span>
      )}
    </span>
  );
}

function MPEmpty({ text }) {
  return <div style={{ fontSize: 12, color: COLORS.textFaint, padding: "26px 0", textAlign: "center" }}>{text || "No data for this period"}</div>;
}

function MPTooltip({ x, y, width, title, lines }) {
  const w = Math.max(96, Math.max(title.length, ...lines.map((l) => l.length)) * 6.1 + 18);
  const left = x > width * 0.62 ? x - w - 10 : x + 10;
  return (
    <g transform={`translate(${left}, ${y})`} style={{ pointerEvents: "none" }}>
      <rect x={0} y={0} width={w} height={22 + lines.length * 14} rx={6} fill={COLORS.text} opacity={0.95} />
      <text x={9} y={15} fontSize={10.5} fontWeight={700} fill="#fff">{title}</text>
      {lines.map((l, i) => <text key={i} x={9} y={30 + i * 14} fontSize={10.5} fill="#E6E9F0">{l}</text>)}
    </g>
  );
}

function mpTickIdx(n) {
  if (n <= 12) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil(n / 6); const idx = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  const last = idx[idx.length - 1];
  if (last !== n - 1) { if ((n - 1) - last >= Math.max(2, step * 0.6)) idx.push(n - 1); else idx[idx.length - 1] = n - 1; }
  return idx;
}

function MPLineChart({ data, xKey, series, height = 170, fmtFn, yFormat, zeroBase = true, partialLast = false, refLines = [] }) {
  const W = 600, padL = 12, padR = 54, padB = 24;
  const padT = series.length > 1 ? 34 : 24;
  const iw = W - padL - padR, ih = height - padT - padB;
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const gid = "g" + String(React.useId()).replace(/[^a-zA-Z0-9]/g, "");
  const n = data.length;
  const f = fmtFn || (yFormat === "pct" ? (v) => mpPctStr(v, 1) : (v) => mpCompact(v));
  const vals = series.flatMap((s) => data.map((d) => d[s.key])).filter(mpOk);
  if (!n || !vals.length) return <MPEmpty />;
  const rvs = refLines.map((r) => r.value).filter(mpOk);
  let lo = Math.min(...vals, ...rvs), hi = Math.max(...vals, ...rvs);
  if (zeroBase) lo = Math.min(0, lo);
  else { const span = hi - lo || Math.abs(hi) * 0.1 || 1; lo -= span * 0.35; hi += span * 0.25; }
  if (hi === lo) hi = lo + 1;
  const x = (i) => padL + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const base = padT + ih;
  const onMove = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(n > 1 ? Math.max(0, Math.min(n - 1, Math.round(((px - padL) / iw) * (n - 1)))) : 0);
  };
  const solidTo = partialLast && n > 1 ? n - 1 : n;
  const path = (key, from, to) => {
    let d = "", pen = false;
    for (let i = from; i < to; i++) { const v = data[i][key]; if (mpOk(v)) { d += (pen ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); pen = true; } else pen = false; }
    return d;
  };
  const ticks = mpTickIdx(n);
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={series[0].color || COLORS.blue} stopOpacity="0.16" />
          <stop offset="100%" stopColor={series[0].color || COLORS.blue} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={padL} x2={W - padR} y1={base} y2={base} stroke={COLORS.panelBorder} strokeWidth={1} />
      {refLines.filter((r) => mpOk(r.value)).map((r, ri) => (
        <g key={ri}><line x1={padL} x2={W - padR} y1={y(r.value)} y2={y(r.value)} stroke={r.color || COLORS.textFaint} strokeWidth={1.2} strokeDasharray="5 4" />
          <text x={W - padR + 4} y={y(r.value) + 3.5} fontSize={9.5} fill={r.color || COLORS.textFaint}>{r.label}</text></g>
      ))}
      {series.length === 1 && data.slice(0, solidTo).every((d) => mpOk(d[series[0].key])) && solidTo > 1 && (
        <path d={`${path(series[0].key, 0, solidTo)} L${x(solidTo - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`} fill={`url(#${gid})`} />
      )}
      {series.map((s, si) => {
        const color = s.color || COLORS.blue;
        const ids = new Set();
        const present = data.map((d, i) => [d[s.key], i]).filter(([v]) => mpOk(v));
        if (present.length) {
          ids.add(present[present.length - 1][1]);
          if (n <= 6 && series.length === 1) present.forEach(([, i]) => ids.add(i));
          else if (series.length === 1) {
            const mx = present.reduce((a, b) => (b[0] > a[0] ? b : a)); const mn = present.reduce((a, b) => (b[0] < a[0] ? b : a));
            ids.add(mx[1]); if (mn[1] !== mx[1] && present.length > 4) ids.add(mn[1]);
          }
        }
        const placed = [];
        const labels = Array.from(ids).sort((a, b) => b - a).map((i) => {
          const v = data[i][s.key]; const px = x(i), py = y(v); const isLast = i === present[present.length - 1][1];
          const ov = placed.some((p) => Math.abs(p[0] - px) < 34 && Math.abs(p[1] - py) < 13);
          if (ov && !isLast) return null;
          placed.push([px, py]);
          const isMin = !isLast && series.length === 1 && v === Math.min(...present.map((p) => p[0]));
          const isFirst = i === present[0][1] && !isLast;
          return (
            <g key={i}>
              <circle cx={px} cy={py} r={isLast ? 3.6 : 3} fill={color} stroke="#fff" strokeWidth={1.5} />
              <text x={isLast ? px + 7 : isFirst ? px - 4 : px} y={isLast ? py + 3.5 : isMin ? py + 15 : py - 8} textAnchor={isLast || isFirst ? "start" : "middle"} fontSize={10.5} fontWeight={700} fill={color}
                stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{f(v)}</text>
            </g>
          );
        });
        return (
          <g key={s.key}>
            <path d={path(s.key, 0, solidTo)} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
            {partialLast && n > 1 && mpOk(data[n - 2][s.key]) && mpOk(data[n - 1][s.key]) && (
              <path d={`M${x(n - 2).toFixed(1)} ${y(data[n - 2][s.key]).toFixed(1)} L${x(n - 1).toFixed(1)} ${y(data[n - 1][s.key]).toFixed(1)}`} fill="none" stroke={color} strokeWidth={2.2} strokeDasharray="4 4" strokeLinecap="round" />
            )}
            {labels}
          </g>
        );
      })}
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={height - 7} fontSize={10} fill={COLORS.textFaint} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{String(data[i][xKey]) + (partialLast && i === n - 1 ? " · MTD" : "")}</text>
      ))}
      {series.length > 1 && (
        <g>{series.map((s, si) => { const off = series.slice(0, si).reduce((a, t) => a + t.label.length * 6.4 + 26, 0); return (
          <g key={s.key} transform={`translate(${padL + off}, 8)`}><circle cx={4} cy={0} r={3.5} fill={s.color || COLORS.blue} /><text x={11} y={3.5} fontSize={10.5} fill={COLORS.textMuted}>{s.label}</text></g>); })}</g>
      )}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={base} stroke={COLORS.textFaint} strokeDasharray="3 3" />
          {series.map((s) => mpOk(data[hover][s.key]) && <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r={4.5} fill={s.color || COLORS.blue} stroke="#fff" strokeWidth={2} />)}
          <MPTooltip x={x(hover)} y={padT - 6} width={W} title={String(data[hover][xKey])} lines={series.map((s) => `${s.label}: ${f(data[hover][s.key])}`)} />
        </g>
      )}
    </svg>
  );
}

function MPBarChart({ data, xKey, series, height = 170, stacked = false, fmtFn, partialLast = false }) {
  const W = 600, padL = 8, padR = 8, padB = 24;
  const padT = series.length > 1 ? 36 : 24;
  const iw = W - padL - padR, ih = height - padT - padB;
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const n = data.length;
  const f = fmtFn || ((v) => mpCompact(v));
  if (!n) return <MPEmpty />;
  const tot = (d) => (stacked ? series.reduce((s, t) => s + (d[t.key] || 0), 0) : Math.max(...series.map((t) => d[t.key] || 0)));
  const hi = Math.max(1, ...data.map(tot));
  const slot = iw / n, gap = Math.max(4, slot * 0.3), groupW = slot - gap;
  const bw = stacked || series.length === 1 ? Math.min(54, groupW) : Math.min(34, groupW / series.length);
  const y = (v) => padT + ih - (v / hi) * ih;
  const base = padT + ih;
  const totals = data.map(tot);
  const maxI = totals.indexOf(Math.max(...totals));
  const showAll = n <= 12 && (stacked || series.length === 1 || n * series.length <= 14);
  const onMove = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.floor((px - padL) / slot))));
  };
  const ticks = mpTickIdx(n);
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <line x1={padL} x2={W - padR} y1={base} y2={base} stroke={COLORS.panelBorder} strokeWidth={1} />
      {data.map((d, i) => {
        const groupWidth = stacked || series.length === 1 ? bw : bw * series.length;
        const x0 = padL + i * slot + (slot - groupWidth) / 2;
        const isPartial = partialLast && i === n - 1;
        let acc = 0;
        return (
          <g key={i} opacity={hover == null || hover === i ? 1 : 0.55}>
            {series.map((s, si) => {
              const v = d[s.key] || 0; const color = s.color || COLORS.blue;
              if (stacked) { const top = y(acc + v), h = y(acc) - top; acc += v; return <rect key={s.key} x={x0} y={top} width={bw} height={Math.max(0, h)} fill={color} opacity={isPartial ? 0.5 : 1} rx={si === series.length - 1 ? 3 : 0} />; }
              const bx = x0 + si * bw; return <rect key={s.key} x={bx} y={y(v)} width={bw - 2} height={Math.max(0, base - y(v))} fill={color} opacity={isPartial ? 0.5 : 1} rx={3} />;
            })}
            {(showAll || i === maxI || i === n - 1) && (stacked || series.length === 1) && (
              <text x={x0 + bw / 2} y={y(totals[i]) - 6} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={COLORS.text}>{f(totals[i])}</text>
            )}
            {!stacked && series.length > 1 && series.map((s, si) => (showAll || (i === n - 1) || totals[i] === (d[s.key] || 0) && i === maxI) && (d[s.key] || 0) > 0 ? (
              <text key={s.key} x={x0 + si * bw + (bw - 2) / 2} y={y(d[s.key] || 0) - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill={s.color || COLORS.blue}>{f(d[s.key] || 0)}</text>) : null)}
          </g>
        );
      })}
      {ticks.map((i) => (
        <text key={i} x={partialLast && i === n - 1 ? padL + (i + 1) * slot - 2 : padL + i * slot + slot / 2} y={height - 7} fontSize={10} fill={COLORS.textFaint} textAnchor={partialLast && i === n - 1 ? "end" : "middle"}>{String(data[i][xKey]) + (partialLast && i === n - 1 ? " · MTD" : "")}</text>
      ))}
      {series.length > 1 && (
        <g>{series.map((s, si) => { const off = series.slice(0, si).reduce((a, t) => a + t.label.length * 6.4 + 26, 0); return (
          <g key={s.key} transform={`translate(${padL + off}, 8)`}><rect x={0} y={-4} width={8} height={8} rx={2} fill={s.color || COLORS.blue} /><text x={13} y={3.5} fontSize={10.5} fill={COLORS.textMuted}>{s.label}</text></g>); })}</g>
      )}
      {hover != null && <MPTooltip x={padL + hover * slot + slot / 2} y={padT - 6} width={W} title={String(data[hover][xKey])} lines={series.map((s) => `${s.label}: ${f(data[hover][s.key] || 0)}`)} />}
    </svg>
  );
}

// Ranked horizontal bars: label, thin bar, value and share. Clickable when onItemClick is given.
function MPRankBars({ data, fmtFn, maxRows = 8, onItemClick, color, showShare = true, emptyText }) {
  const f = fmtFn || ((v) => fmt(v));
  const rows = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value).slice(0, maxRows);
  const sum = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (!rows.length) return <MPEmpty text={emptyText || "Nothing to show"} />;
  const max = rows[0].value;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingBottom: 4 }}>
      {rows.map((d, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(70px, 34%) 1fr auto", gap: 10, alignItems: "center", fontSize: 12 }}>
          <div onClick={onItemClick && d.item ? () => onItemClick(d.item) : undefined} title={d.label}
            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: onItemClick && d.item ? COLORS.blue : COLORS.textMuted, cursor: onItemClick && d.item ? "pointer" : "default" }}>{d.label}</div>
          <div style={{ height: 8, borderRadius: 4, background: COLORS.slateDim }}>
            <div style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, height: "100%", borderRadius: 4, background: d.color || color || COLORS.blue }} />
          </div>
          <div style={{ fontFamily: MP_MONO, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{f(d.value)}{showShare && sum > 0 && <span style={{ color: COLORS.textFaint, fontWeight: 400 }}> · {Math.round((d.value / sum) * 100)}%</span>}</div>
        </div>
      ))}
    </div>
  );
}

// ---- insight (the one-line story under each chart title) ----
const mpArrow = (ch, flat) => (flat ? "•" : ch > 0 ? "▲" : "▼");
function mpTone(ch, good, flat) { if (flat || good == null) return "flat"; return (ch > 0) === (good === "up") ? "good" : "bad"; }
function mpInsight({ values, labels, kind, fmtFn, rate, good, partialLast }) {
  const n = values.length; const f = fmtFn || ((v) => mpCompact(v));
  if (kind === "day") {
    if (n < 10) return null;
    const avg = (a) => { const t = a.filter(mpOk); return t.length ? t.reduce((s, v) => s + v, 0) / t.length : null; };
    const l7 = avg(values.slice(-7)), p7 = avg(values.slice(-14, -7));
    if (l7 == null || p7 == null || !p7) return null;
    const ch = rate ? l7 - p7 : ((l7 - p7) / p7) * 100; const flat = rate ? Math.abs(ch) < 0.3 : Math.abs(ch) < 1;
    return { text: `Last 7 days avg ${f(l7)} · ${mpArrow(ch, flat)} ${Math.abs(ch).toFixed(rate ? 1 : 0)}${rate ? " pts" : "%"} vs the 7 before`, tone: mpTone(ch, good, flat) };
  }
  const end = partialLast ? n - 2 : n - 1;
  if (end < 1 || !mpOk(values[end]) || !mpOk(values[end - 1])) return null;
  const cur = values[end], prev = values[end - 1];
  const ch = rate ? cur - prev : prev ? ((cur - prev) / prev) * 100 : null;
  if (ch == null) return null;
  const flat = rate ? Math.abs(ch) < 0.3 : Math.abs(ch) < 1;
  const pool = values.slice(0, end + 1).filter(mpOk); const mx = Math.max(...pool); const mxi = values.indexOf(mx);
  let text = `${labels[end]} ${f(cur)} · ${mpArrow(ch, flat)} ${Math.abs(ch).toFixed(rate ? 1 : 0)}${rate ? " pts" : "%"} vs ${labels[end - 1]}`;
  if (!rate && end >= 3 && mxi !== end && mx > 0) text += ` · peak ${labels[mxi]} ${f(mx)}`;
  return { text, tone: mpTone(ch, good, flat) };
}
function mpDeltaOf(cur, prev, o) {
  if (!mpOk(cur) || !mpOk(prev)) return null;
  const ch = o.rate ? cur - prev : prev ? ((cur - prev) / prev) * 100 : null;
  if (ch == null) return null;
  const flat = o.rate ? Math.abs(ch) < 0.3 : Math.abs(ch) < 1;
  return { text: `${mpArrow(ch, flat)} ${Math.abs(ch).toFixed(o.rate ? 1 : 0)}${o.rate ? " pts" : "%"} vs ${o.label}`, tone: mpTone(ch, o.good, flat) };
}

function MPInsightLine({ ins }) {
  if (!ins) return null;
  const color = ins.tone === "good" ? COLORS.teal : ins.tone === "bad" ? COLORS.coral : COLORS.textMuted;
  return <div style={{ fontSize: 12, color, margin: "0 0 8px", fontWeight: 500 }}>{ins.text}</div>;
}
function MPChartCard({ title, info, insight, children }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, padding: "14px 16px 10px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: insight ? 2 : 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</span>{info && <InfoTip text={info} />}
      </div>
      <MPInsightLine ins={insight} />
      {children}
    </div>
  );
}
function MPGrid2({ children, min }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min || 340}px, 1fr))`, gap: 14 }}>{children}</div>;
}
function MPSection({ title }) {
  return <div style={{ margin: "24px 0 10px", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.textFaint, fontFamily: MP_MONO, fontWeight: 600 }}>{title}</div>;
}
function MPDeltaChip({ d }) {
  const c = d.tone === "good" ? [COLORS.tealDim, COLORS.teal] : d.tone === "bad" ? [COLORS.coralDim, COLORS.coral] : [COLORS.slateDim, COLORS.slate];
  return <span style={{ background: c[0], color: c[1], borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 700 }}>{d.text}</span>;
}
function MPKpi({ label, value, sub, delta, info, accent, prev }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, padding: "13px 15px" }}>
      <div style={{ fontSize: 10.5, color: COLORS.textFaint, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6, display: "flex", alignItems: "center" }}>{label}{info && <InfoTip text={info} />}</div>
      <div style={{ fontFamily: MP_MONO, fontSize: 22, fontWeight: 700, color: accent || COLORS.text, lineHeight: 1.1 }}>{value}</div>
      <div style={{ marginTop: 7, display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: COLORS.textMuted, flexWrap: "wrap" }}>{delta && <MPDeltaChip d={delta} />}{sub && <span>{sub}</span>}</div>
      {prev && <div style={{ marginTop: 5, fontSize: 11, color: COLORS.textFaint, fontFamily: MP_MONO }}>{prev}</div>}
    </div>
  );
}

function MPChip({ label, value, tone, tag, info }) {
  const map = { coral: [COLORS.coralDim, COLORS.coral], teal: [COLORS.tealDim, COLORS.teal], amber: [COLORS.amberDim, COLORS.amber], purple: [COLORS.purpleDim, COLORS.purple], blue: ["rgba(76,110,245,0.10)", COLORS.blue] };
  const c = map[tone] || [COLORS.slateDim, COLORS.textMuted];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: c[0], color: c[1], borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <span style={{ color: COLORS.textFaint, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
      {tag && <span style={{ fontSize: 9.5, color: COLORS.textFaint, border: `1px dashed ${COLORS.panelBorder2}`, borderRadius: 4, padding: "1px 4px" }}>{tag}</span>}
      {info && <InfoTip text={info} />}
    </div>
  );
}
function MPPillRow({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} style={{ padding: "6px 13px", fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: "pointer", border: `1px solid ${active === t ? COLORS.text : COLORS.panelBorder2}`, background: active === t ? COLORS.text : COLORS.panel, color: active === t ? "#fff" : COLORS.textMuted }}>{t}</button>
      ))}
    </div>
  );
}
function MPBanner({ text }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: COLORS.amberDim, border: `1px solid #EEDDBB`, borderRadius: 8, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: "#8A5D0A" }}>
      <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} /><span>{text}</span>
    </div>
  );
}
function MPFilterInput({ placeholder, value, onChange }) {
  return <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.panelBorder2}`, fontSize: 12, minWidth: 120 }} />;
}
function mpApplyFilters(rows, fields, filterState) {
  return rows.filter((r) => fields.every((f) => !filterState[f] || String(r[f] || "").toLowerCase().includes(filterState[f].toLowerCase())));
}

// ---- conditional-format table: every cell is coloured by its change vs the previous period ----
const MP_HEAT = { good: "rgba(14,155,130,0.17)", bad: "rgba(214,69,69,0.16)", flat: "rgba(120,130,145,0.11)" };
function mpHeatFill(c, rows, i, mode, tol, prevOf) {
  if (!c.heat) return undefined;
  if (rows[i]._partial) return undefined;
  const v = rows[i][c.key];
  if (!mpOk(v)) return undefined;
  let pi;
  if (mode === "pair") pi = i === 0 ? 1 : -1;
  else if (prevOf) pi = prevOf(rows, i); else pi = i - 1;
  if (pi == null || pi < 0 || pi >= rows.length) return undefined;
  const p = rows[pi][c.key];
  if (!mpOk(p)) return undefined;
  let rel;
  if (p === 0) rel = v === 0 ? 0 : v > 0 ? Infinity : -Infinity; else rel = ((v - p) / Math.abs(p)) * 100;
  if (Math.abs(rel) <= tol) return MP_HEAT.flat;
  return (rel > 0) === (c.heat === "up") ? MP_HEAT.good : MP_HEAT.bad;
}
const MP_TOL = 2; // fixed: a change within +/-2% of the previous period counts as stable
function MPHeatLegend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px", fontSize: 12, color: COLORS.textMuted }}>
      <span style={{ display: "inline-flex", gap: 8 }}>
        {[["good", "better"], ["flat", "stable"], ["bad", "worse"]].map(([k, l]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: MP_HEAT[k], border: `1px solid ${COLORS.panelBorder}` }} />{l}</span>
        ))}
      </span>
      <InfoTip text="Each cell is compared with the previous period of the same length (same weekday last week for daily). Within ±2% is stable (grey), better is green, worse is red. Lost, damaged and compensation are better when they fall. A month-to-date row is never coloured against a full period." />
    </div>
  );
}
function MPTable({ columns, rows, mode = "seq", tol = 2, prevOf, onRowClick }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, background: COLORS.panel }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead><tr style={{ background: "#F5F6F9", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
          {columns.map((c) => <th key={c.key} style={{ textAlign: c.align || "left", padding: "8px 12px", fontWeight: 700, color: COLORS.textMuted, whiteSpace: "nowrap", fontSize: 11 }}>{c.label}</th>)}
        </tr></thead>
        <tbody>
          {rows.length === 0 ? (<tr><td colSpan={columns.length} style={{ padding: "16px 12px", textAlign: "center", color: COLORS.textFaint }}>No records</td></tr>) :
            rows.map((r, i) => (
              <tr key={i} onClick={onRowClick ? () => onRowClick(r) : undefined} style={{ borderBottom: `1px solid ${COLORS.panelBorder}`, cursor: onRowClick ? "pointer" : "default" }}>
                {columns.map((c) => {
                  const raw = r[c.key];
                  const fill = mpHeatFill(c, rows, i, mode, tol, prevOf);
                  return <td key={c.key} style={{ padding: "8px 12px", textAlign: c.align || "left", fontFamily: c.mono ? MP_MONO : "inherit", whiteSpace: "nowrap", background: fill, fontWeight: r._highlight ? 700 : 400 }}>{c.fmt ? (mpOk(raw) ? c.fmt(raw) : "—") : (raw == null ? "—" : raw)}</td>;
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- metric table (volume, revenue, ASP, DSR, ASR, lost, damaged, compensation) ----
function mpRowMetrics(r) {
  const lm = r.ecomm_pickups || 0, ful = r.fulfillment_pickups || 0, box = r.box_pickups || 0, vol = lm + ful + box;
  const rev = r.delivery_revenue_total || 0, vas = r.delivery_revenue_vas_total || 0;
  const ship = r.delivery_revenue_shipping != null ? r.delivery_revenue_shipping : rev - vas;
  return { vol, lm, ful, box, rev, vas, ship, aspS: vol ? ship / vol : null, aspV: vol ? vas / vol : null, dsr: mpPct100(r, "dsr"), asr: mpPct100(r, "asr"), lost: r.parcels_lost || 0, dam: r.parcels_damaged || 0, fake: r.fake_attempts || 0, rto: r.rto_without_attempt || 0, comp: r.compensation_amount || 0, active: r.active_merchants };
}
function mpMetricTableRows(rows, labelFn) {
  return rows.map((r, i) => ({ label: labelFn(r, i), _date: r.date, ...mpRowMetrics(r), _highlight: r._highlight, _partial: r._partial }));
}
function mpTableCols() {
  const cols = [
    { key: "label", label: "Period" },
    { key: "vol", label: "Volume", align: "right", mono: true, fmt: (v) => fmt(v), heat: "up" },
    { key: "rev", label: "Revenue", align: "right", mono: true, fmt: (v) => fmt(v), heat: "up" },
    { key: "aspS", label: "ASP ship", align: "right", mono: true, fmt: (v) => fmt(v, 1), heat: "up" },
    { key: "aspV", label: "ASP VAS", align: "right", mono: true, fmt: (v) => fmt(v, 2), heat: "up" },
    { key: "dsr", label: "DSR", align: "right", mono: true, fmt: (v) => v.toFixed(1) + "%", heat: "up" },
    { key: "asr", label: "ASR", align: "right", mono: true, fmt: (v) => v.toFixed(1) + "%", heat: "up" },
    { key: "lost", label: "Lost", align: "right", mono: true, fmt: (v) => fmt(v), heat: "down" },
    { key: "dam", label: "Damaged", align: "right", mono: true, fmt: (v) => fmt(v), heat: "down" },
    { key: "comp", label: "Compensation", align: "right", mono: true, fmt: (v) => fmt(v), heat: "down" },
  ];
  if (MP_MODE === "portfolio") cols.splice(1, 0, { key: "active", label: "Active merchants", align: "right", mono: true, fmt: (v) => fmt(v), heat: "up" });
  return cols;
}
const MP_METRIC_COLS = null; // replaced by mpTableCols() (kept so older references fail loudly rather than silently)
