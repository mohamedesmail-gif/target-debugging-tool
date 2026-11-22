
// ============================================================================
// Comparison card + screens
// ============================================================================
const MP_GOOD = { volume: "up", revenue_ship: "up", revenue_vas: "up", asp_ship: "up", asp_vas: "up", dsr: "up", asr: "up", active_merchants: "up", fake_attempts: "down", rto: "down", lost: "down", damaged: "down", compensation: "down" };
const MP_CMP_INFO = "The same metric across all available periods; the two periods being compared are in the card above.";
function mpMetricList() {
  const list = MP_METRICS.slice();
  if (MP_MODE === "portfolio") list.push({ key: "active_merchants", label: "Active merchants", getVal: (r) => (r.active_merchants == null ? null : r.active_merchants) });
  return list;
}

function MPMetricDeltaCard({ metric, rowA, rowB, labelA, labelB }) {
  const a = metric.getVal(rowA), b = metric.getVal(rowB);
  if (a == null || b == null) return <MPBanner text={metric.isPct ? metric.label + " is only shown for complete periods: recent parcels have no final outcome yet, so it is not aggregated over a running month or a partial week. Pick complete weeks or months (or single days) to compare it." : metric.label + " has no value for one of the two periods (e.g. no delivery attempts that day), so there is nothing to compare."} />;
  const dec = metric.decimals || (metric.isPct ? 1 : 0);
  const unit = metric.isPct ? "%" : "";
  const diff = a - b;
  const rel = b ? (diff / Math.abs(b)) * 100 : null;
  const flat = metric.isPct ? Math.abs(diff) < 0.3 : rel != null && Math.abs(rel) < 1;
  const good = MP_GOOD[metric.key] || "up";
  const tone = flat ? "flat" : (diff > 0) === (good === "up") ? "good" : "bad";
  const color = tone === "good" ? COLORS.teal : tone === "bad" ? COLORS.coral : COLORS.textMuted;
  const bg = tone === "good" ? COLORS.tealDim : tone === "bad" ? COLORS.coralDim : COLORS.slateDim;
  const big = metric.isPct ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pts` : rel == null ? `${diff > 0 ? "+" : ""}${fmt(diff, dec)}` : `${diff > 0 ? "+" : ""}${rel.toFixed(rel > -10 && rel < 10 ? 1 : 0)}%`;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "16px 18px", ...UI.card, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: COLORS.textMuted, display: "flex", alignItems: "center" }}>{metric.label}<InfoTip text={"Difference between the two selected periods. " + (good === "down" ? "Lower is better for this metric." : "Higher is better for this metric.")} /></div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 6, background: bg, color, borderRadius: THEME.radius.input, padding: "4px 14px", ...UI.kpi }}><MPTrendText text={(flat ? "•" : diff > 0 ? "▲" : "▼") + " " + big} /></div>
      </div>
      <div style={{ display: "flex", gap: 26 }}>
        {[[labelA, a], [labelB, b]].map(([l, v], i) => (
          <div key={i}><div style={{ fontSize: 11, color: COLORS.textFaint }}>{l}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(v, dec)}{unit}</div></div>
        ))}
      </div>
    </div>
  );
}

function MPHero({ monthIdx }) {
  const tdp = mpTdPair(monthIdx);                 // month-to-date vs the SAME days of the previous month (or full vs full)
  const cur = MP_MONTHLY[monthIdx];
  const m = mpRowMetrics(cur);                    // value shown
  const a = mpRowMetrics(tdp.cur), b = tdp.prev ? mpRowMetrics(tdp.prev) : null; // like-for-like basis of every change chip
  const mon = mpMonthLabel(monthIdx) + (tdp.td ? " (MTD)" : "");
  const d = (x, y, good, rate) => (b ? mpDeltaOf(x, y, { good, rate, label: tdp.label }) : null);
  const dIdx = mpDsrIdx(monthIdx);                // DSR / ASR: complete periods only
  const dm = mpRowMetrics(MP_MONTHLY[dIdx]), dp = dIdx > 0 ? mpRowMetrics(MP_MONTHLY[dIdx - 1]) : null;
  const rd = (x, y) => (dp && x != null && y != null ? mpDeltaOf(x, y, { rate: true, good: "up", label: mpMonthLabel(dIdx - 1) }) : null);
  const rateNote = dIdx !== monthIdx ? " Shown for " + mpMonthLabel(dIdx) + ", the last complete month: recent parcels have no final outcome yet, so DSR / ASR are never aggregated over a running month." : "";
  const pv = (txt) => (b && txt != null ? tdp.label + ": " + txt : null);              // previous period, absolute
  const pr = (v) => (dp && v != null ? mpMonthLabel(dIdx - 1) + ": " + mpPctStr(v) : null);
  const cards = (MP_MODE === "portfolio" ? [
    ["Active merchants", fmt(cur.active_merchants), "of " + MP_PF.count + (MP_PF.filtered ? " filtered" : " assigned"), d(a.active, b && b.active, "up"), "Merchants with at least one pickup in the period.", pv(b && fmt(b.active))],
    ["Volume", fmt(m.vol), "pickups", d(a.vol, b && b.vol, "up"), "Pickups (LM + Box + Fulfillment).", pv(b && fmt(b.vol))],
    ["Revenue", fmt(m.rev), "EGP", d(a.rev, b && b.rev, "up"), "Delivery revenue in EGP = shipping + VAS.", pv(b && fmt(b.rev))],
    ["ASP", fmt(m.asp, 1), "EGP / delivered parcel", d(a.asp, b && b.asp, "up"), "Portfolio ASP = (shipping revenue + VAS revenue) ÷ delivered parcels of all the merchants shown. Never an average of merchant ASPs.", pv(b && b.asp != null ? fmt(b.asp, 1) : null)],
  ] : [
    ["Volume", fmt(m.vol), "pickups", d(a.vol, b && b.vol, "up"), "Pickups (LM + Box + Fulfillment).", pv(b && fmt(b.vol))],
    ["Revenue", fmt(m.rev), "EGP", d(a.rev, b && b.rev, "up"), "Delivery revenue in EGP = shipping + VAS.", pv(b && fmt(b.rev))],
    ["ASP", fmt(m.asp, 1), "EGP / delivered parcel", d(a.asp, b && b.asp, "up"), "(Shipping revenue + VAS revenue) ÷ delivered parcels.", pv(b && b.asp != null ? fmt(b.asp, 1) : null)],
  ]).concat([
    ["DSR", mpPctStr(dm.dsr), dIdx !== monthIdx ? "last complete month" : "", rd(dm.dsr, dp && dp.dsr), "Delivery success rate = dsr_numerator ÷ dsr_denominator. Low = 65% or below." + rateNote, pr(dp && dp.dsr)],
    ["ASR", mpPctStr(dm.asr), dIdx !== monthIdx ? "last complete month" : "", rd(dm.asr, dp && dp.asr), "Attempt success rate = asr_numerator ÷ asr_denominator." + rateNote, pr(dp && dp.asr)],
    ["Compensation", fmt(m.comp), "EGP", d(a.comp, b && b.comp, "down"), "Compensation paid to merchants. Lower is better.", pv(b && fmt(b.comp))],
  ]);
  const note = tdp.td ? " Change chips compare " + tdp.curLabel + " with " + tdp.label + " (same number of days); DSR and ASR compare complete months." : "";
  return (
    <MPGrid2 min={160}>
      {cards.map(([l, v, s, dl, info, prevAbs]) => <MPKpi key={l} prev={prevAbs} label={l + " · " + (l === "DSR" || l === "ASR" ? mpMonthLabel(dIdx) : mon)} value={v} sub={s} delta={dl} info={info + note} accent={l === "DSR" && dm.dsr != null && dm.dsr <= 65 ? COLORS.coral : COLORS.text} />)}
    </MPGrid2>
  );
}

function MerchantProfileView({ onBack, backLabel, onOpenMerchant, topSlot }) {
  const [mainTab, setMainTab] = useState("Profile Overview");
  const [overviewSubTab, setOverviewSubTab] = useState("Overall overview");
  const [issuesSubTab, setIssuesSubTab] = useState("Operational");
  const [range, setRange] = useState({ from: MP_RANGE_MIN, to: MP_RANGE_MAX });
  const [granularity, setGranularity] = useState("Monthly");
  const [curGran, setCurGran] = useState("Daily");
  const monthIdx = mpMonthIdxOf(range.to);
  const portfolio = MP_MODE === "portfolio";
  return (
    <div className="tt-shell" style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: THEME.font, color: COLORS.text }}>
      <div className="tt-wrap">
        <button onClick={onBack} style={{ ...UI.btn, marginBottom: 14 }}><ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />{backLabel || "Back to Target Tracker"}</button>
        {topSlot}
        <div style={{ marginBottom: 18 }}>
          {portfolio && <div style={{ ...UI.eyebrow, marginBottom: 4 }}>Portfolio overview</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{ ...UI.title, fontSize: 19, margin: 0 }}>{MP_MERCHANT.name}</h1>
            {!portfolio && <PricingCalculatorButton merchantId={MP_MERCHANT.id} merchantName={MP_MERCHANT.name} canSeeMargin={prcCanSeeMargin()} />}
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 2 }}>
            {portfolio ? `${MP_PF.kind || "account manager"} · ${MP_PF.filtered ? MP_PF.count + " of " + MP_PF.total + " merchants (filtered)" : MP_PF.count + " merchants"} · ${MP_PF.team} · ${MP_PF.kind === "sales" ? "Oct new-pickups target " + fmt(MP_PF.target) + " (all new and last-month merchants of the rep)" : "Oct target " + fmt(MP_PF.target) + " pickups (whole portfolio)"}` :
              `${MP_MERCHANT.id} · ${MP_MERCHANT.accountManager} · ${MP_MERCHANT.segment} · joined ${MP_MERCHANT.joinDate}${MP_MERCHANT.lastActivity ? " · last pickup " + MP_MERCHANT.lastActivity : ""}`}
          </div>
        </div>

        {portfolio && MP_PF.skipped > 0 && <MPBanner text={MP_PF.skipped + " of this sales rep's merchants are not in an account-manager portfolio yet, so they have no daily history here and are left out of this overview."} />}
        {portfolio && MP_PF.filtered && <MPBanner text={"Filtered view of " + MP_PF.count + " merchants. DSR is exact; ASR for months before October is approximate (within about 1 point) because the mart only exposes each merchant's monthly ASR."} />}
        <MPHero monthIdx={monthIdx} />

        <div role="tablist" className="tt-scroll-x" data-tt="scroll" style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.panelBorder}`, margin: "22px 0 16px" }}>
          {["Profile Overview", "Issues", "Customers"].concat(portfolio ? [] : ["Opportunities"].concat(prcCanUse() ? ["Pricing"] : [])).concat(portfolio ? ["Analysis", "Debugger"] : []).map((t) => (
            <button key={t} role="tab" aria-selected={mainTab === t} onClick={() => setMainTab(t)} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, border: "none", background: "transparent", color: mainTab === t ? COLORS.navy : COLORS.textMuted, borderBottom: mainTab === t ? `2px solid ${COLORS.navy}` : "2px solid transparent", borderRadius: 0, marginBottom: -1, whiteSpace: "nowrap" }}>{t}</button>
          ))}
        </div>

        {mainTab === "Profile Overview" && (<>
          <MPPillRow tabs={["Overall overview", "Comparison", "Current month overview"]} active={overviewSubTab} onChange={setOverviewSubTab} />
          {overviewSubTab === "Overall overview" && <MPOverallOverview range={range} setRange={setRange} granularity={granularity} setGranularity={setGranularity} monthIdx={monthIdx} onOpenMerchant={onOpenMerchant} />}
          {overviewSubTab === "Comparison" && <MPComparison />}
          {overviewSubTab === "Current month overview" && <MPCurrentMonthOverview granularity={curGran} setGranularity={setCurGran} />}
        </>)}
        {mainTab === "Issues" && (<>
          <MPPillRow tabs={["Operational", "CX"]} active={issuesSubTab} onChange={setIssuesSubTab} />
          {issuesSubTab === "Operational" && <MPOperationalIssues monthIdx={monthIdx} onOpenMerchant={onOpenMerchant} />}
          {issuesSubTab === "CX" && <MPCxIssues onOpenMerchant={onOpenMerchant} />}
        </>)}
        
        {mainTab === "Opportunities" && !portfolio && <MPOpportunities monthIdx={monthIdx} />}
        {mainTab === "Pricing" && !portfolio && <MPPricingTab canSeeMargin={prcCanSeeMargin()} />}
        {mainTab === "Customers" && <MPCustomers />}
        {(mainTab === "Analysis" || mainTab === "Debugger") && (
          <div style={{ background: COLORS.card, border: `1px dashed ${COLORS.panelBorder2}`, borderRadius: THEME.radius.card, padding: "30px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{mainTab} · to be added</div>
            <div style={{ fontSize: 12.5, color: COLORS.textMuted, maxWidth: 520, margin: "0 auto", lineHeight: 1.55 }}>Placeholder so the {mainTab} tab is not forgotten. Its content still needs to be defined.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MPLoadShell({ onBack, backLabel, title, status, error, topSlot }) {
  return (
    <div className="tt-shell" style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: THEME.font, color: COLORS.text }}>
      <div className="tt-wrap">
        <button onClick={onBack} style={{ ...UI.btn, marginBottom: 14 }}><ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />{backLabel || "Back to Target Tracker"}</button>
        {topSlot}
        <h1 style={{ ...UI.title, fontSize: 19, margin: "0 0 8px" }}>{title}</h1>
        {status === "loading" ? <div role="status" style={{ fontSize: 13, color: COLORS.textMuted }}>Loading&hellip;</div> : <MPBanner text={error || "Could not load this view."} />}
      </div>
    </div>
  );
}

function MerchantProfileScreen({ merchant, onBack, backLabel }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    mpLoadProfile(merchant)
      .then(() => { if (alive) setStatus("ready"); })
      .catch((e) => { if (alive) { setError(String((e && e.message) || e)); setStatus("error"); } });
    return () => { alive = false; };
  }, [merchant.id]);
  if (status === "ready") return <MerchantProfileView onBack={onBack} backLabel={backLabel} onOpenMerchant={null} />;
  return <MPLoadShell onBack={onBack} backLabel={backLabel} title={merchant.name} status={status} error={error} />;
}

function useDebounced(v, ms) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function PortfolioScreen({ am, amData, analysis, onBack }) {
  const [fid, setFid] = useState(""); const [fname, setFname] = useState("");
  const did = useDebounced(fid.trim(), 250), dname = useDebounced(fname.trim(), 250); // applied automatically while typing
  const [loadedKey, setLoadedKey] = useState(null);
  const [errKey, setErrKey] = useState(null);
  const [error, setError] = useState(null);
  const total = analysis.merchants.length;
  const active = did.length >= 2 || dname.length >= 2;
  const matches = active ? analysis.merchants.filter((m) => (did.length < 2 || String(m.id).toLowerCase().includes(did.toLowerCase())) && (dname.length < 2 || String(m.name).toLowerCase().includes(dname.toLowerCase()))) : [];
  const mode = !active ? "all" : matches.length === 0 ? "none" : matches.length === 1 ? "one" : matches.length === total ? "all" : "subset";
  const key = mode === "one" ? "M:" + matches[0].id : mode === "subset" ? "S:" + matches.map((m) => m.id).join(",") : mode === "none" ? "N" : "P";
  useEffect(() => {
    if (mode === "none") return undefined;
    let alive = true;
    const p = mode === "one" ? mpLoadProfile({ ...matches[0], am }) : mode === "subset" ? mpLoadPortfolio(am, amData, analysis, matches) : mpLoadPortfolio(am, amData, analysis);
    p.then(() => { if (alive) { setLoadedKey(key); setErrKey(null); } }).catch((e) => { if (alive) { setError(String((e && e.message) || e)); setErrKey(key); } });
    return () => { alive = false; };
  }, [am, key]);
  const clear = () => { setFid(""); setFname(""); };
  const pick = (m) => { setFid(String(m.id)); setFname(""); };
  const inp = { ...UI.input, minWidth: 170 };
  const slot = (
    <div style={{ margin: "0 0 14px", padding: "12px 14px", ...UI.card }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: COLORS.textMuted, display: "inline-flex", alignItems: "center" }}>Filter merchants<InfoTip text="Filters apply as you type (2+ characters). One match shows that merchant; several matches show their combined numbers; clear to return to the whole portfolio." /></span>
        <input value={fid} onChange={(e) => setFid(e.target.value)} placeholder="Business ID" aria-label="Business ID" style={inp} />
        <input value={fname} onChange={(e) => setFname(e.target.value)} placeholder="Business name" aria-label="Business name" style={inp} />
        {active && <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: THEME.color.navyTint, color: COLORS.navy, borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: 12, fontWeight: 600 }}>{mode === "one" ? "Showing: " + matches[0].name : mode === "none" ? "No match" : "Filtered: " + matches.length + " merchants"}<button onClick={clear} style={{ border: "none", background: "transparent", color: COLORS.navy, padding: 2, display: "inline-flex", borderRadius: 999 }} aria-label="Clear filters"><X size={14} strokeWidth={2} aria-hidden="true" /></button></span>}
      </div>
      {mode === "subset" && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: COLORS.textFaint }}>Open one:</span>
          {matches.slice(0, 8).map((m) => <button key={m.id} onClick={() => pick(m)} style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 999, border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.panel, cursor: "pointer", color: COLORS.text }}>{m.name}</button>)}
          {matches.length > 8 && <span style={{ fontSize: 11, color: COLORS.textFaint }}>+{matches.length - 8} more</span>}
        </div>
      )}
    </div>
  );
  const backFn = active ? clear : onBack;
  const backLabel = active ? "Back to portfolio overview" : "Back to Target Tracker";
  if (mode === "none") return <MPLoadShell onBack={backFn} backLabel={backLabel} title={am} status="error" error="No merchant in this portfolio matches these filters." topSlot={slot} />;
  if (errKey === key) return <MPLoadShell onBack={backFn} backLabel={backLabel} title={am} status="error" error={error} topSlot={slot} />;
  if (loadedKey === key) return <MerchantProfileView onBack={backFn} backLabel={backLabel} onOpenMerchant={pick} topSlot={slot} />;
  return <MPLoadShell onBack={backFn} backLabel={backLabel} title={mode === "one" ? matches[0].name : am} status="loading" topSlot={slot} />;
}
