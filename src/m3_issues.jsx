
// ============================================================================
// Issues + Opportunities (current-month detail is real data, see m6)
// ============================================================================
function mpMonthLabel(i) { return MP_MON3[Number(MP_MONTHLY[i].month.slice(5)) - 1]; }
function MPNoCm() { return <MPBanner text="The current-month detail (parcel issues, tickets, failed attempts) is not loaded for this month, so these tables are unavailable. The monthly trends above still come from the warehouse." />; }

function MPParcelTables() {
  if (!MP_CM) return <MPNoCm />;
  const port = MP_MODE === "portfolio";
  const mcol = port ? [{ key: "merchant", label: "Merchant" }] : [];
  const base = [{ key: "tracking", label: "Tracking #", mono: true }, { key: "date", label: "Date" }, ...mcol, { key: "hub", label: "Hub" }, { key: "curHub", label: "Current hub" }, { key: "star", label: "Star / courier" }, { key: "status", label: "Status" }];
  const money = [{ key: "liability", label: "Liability" }, { key: "amount", label: "Amount (EGP)", align: "right", mono: true }];
  const fk = port ? ["tracking", "merchant", "hub", "star"] : ["tracking", "hub", "star"];
  const defs = [
    ["F", "Fake attempts", base.concat([{ key: "attempts", label: "Attempts", align: "right", mono: true }]), "Parcels flagged as a fake delivery attempt (grey_reason_fake_attempt), by flag date. A close proxy: the card count comes from the merchant metrics view and can differ."],
    ["R", "RTO without attempt", base, "Parcels whose return started with zero delivery attempts (rto_initiated_at). A proxy: the card count uses a different upstream rule and is higher."],
    ["L", "Lost parcels", base.concat(money), "Parcels lost (lost_at) with compensation liability. Matches the card count."],
    ["D", "Damaged parcels", base.concat(money), "Parcels damaged (damaged_at) with compensation liability. Within a couple of parcels of the card."],
    ["C", "Compensation", [{ key: "tracking", label: "Tracking #", mono: true }, { key: "date", label: "Date" }, ...mcol, { key: "amount", label: "Amount (EGP)", align: "right", mono: true }, { key: "reason", label: "Reason" }, { key: "liability", label: "Liability" }, { key: "status", label: "Status" }], "Parcels with a compensation paid (last_compensation_at); amount = full_compensation_amount. Matches the card amount."],
  ];
  return (
    <>
      <MPSection title="Tracking-number detail" />
      <MPCmStamp />
      {defs.map(([t, title, cols, info]) => (
        <MPDetailTable key={t} title={title} info={info} rows={mpCmIssueRows(t)} columns={cols} filterKeys={t === "C" ? (port ? ["tracking", "merchant", "reason"] : ["tracking", "reason"]) : fk} csvName={`${title.toLowerCase().replace(/[^a-z]+/g, "_")}_oct.csv`} />
      ))}
    </>
  );
}

function MPOperationalIssues({ monthIdx, onOpenMerchant }) {
  const cur = MP_MONTHLY[monthIdx];
  const tdp = mpTdPair(monthIdx);
  const labels = MP_MONTHLY.map((m) => MP_MON3[Number(m.month.slice(5)) - 1]);
  const kpis = [
    ["Fake attempts", "fake_attempts", "Delivery attempts flagged as fake (mart: fake_attempts)."],
    ["RTO without attempt", "rto_without_attempt", "Parcels returned to the merchant without a delivery attempt (mart: rto_without_attempt)."],
    ["Lost", "parcels_lost", "Parcels flagged lost (mart: parcels_lost)."],
    ["Damaged", "parcels_damaged", "Parcels flagged damaged (mart: parcels_damaged)."],
    ["Compensation (EGP)", "compensation_amount", "Compensation paid to the merchant (mart: compensation_amount)."],
  ];
  const [gran, setGran] = useState("Monthly");
  const td = mpSeriesForRange(gran, { from: MP_RANGE_MIN, to: MP_RANGE_MAX });
  const tm = td.rows.map(mpRowMetrics), tl = td.labels;
  return (
    <div>
      <MPGrid2 min={170}>
        {kpis.map(([l, k, info]) => (
          <MPKpi key={k} label={l} info={info} value={fmt(cur[k])} accent={COLORS.text}
            delta={tdp.prev ? mpDeltaOf(tdp.cur[k], tdp.prev[k], { good: "down", label: tdp.label }) : null} sub={mpMonthLabel(monthIdx) + (tdp.td ? " (MTD)" : "")} prev={tdp.prev ? tdp.label + ": " + fmt(tdp.prev[k]) : null} />
        ))}
      </MPGrid2>
      <MPSection title="Trend" />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <MPPillRow tabs={["Daily", "Weekly", "Monthly"]} active={gran} onChange={setGran} />
        <span style={{ fontSize: 11, color: COLORS.textFaint }}>{gran === "Monthly" ? "October is month-to-date." : gran === "Daily" ? "Daily view starts on Sep 1 and skips Fridays." : "Weekly view starts on Sep 1; the last week may be partial."} Each trend can also be read per 1,000 pickups.</span>
      </div>
      <MPGrid2>
        <MPIncidentCard title="Fake attempts" field="fake" countLabel="Attempts" color={COLORS.chart} m={tm} labels={tl} kind={td.kind} partialLast={td.partialLast} info="Delivery attempts flagged as fake (mart: fake_attempts). Lower is better." />
        <MPIncidentCard title="RTO without attempt" field="rto" countLabel="Parcels" color={COLORS.chart} m={tm} labels={tl} kind={td.kind} partialLast={td.partialLast} info="Parcels returned to the merchant with no delivery attempt (mart: rto_without_attempt). Lower is better." />
        <MPIncidentCard title="Lost parcels" field="lost" color={COLORS.chart} m={tm} labels={tl} kind={td.kind} partialLast={td.partialLast} info="Parcels flagged lost (mart: parcels_lost). Lower is better." />
        <MPIncidentCard title="Damaged parcels" field="dam" color={COLORS.chart} m={tm} labels={tl} kind={td.kind} partialLast={td.partialLast} info="Parcels flagged damaged (mart: parcels_damaged). Lower is better." />
        <MPIncidentCard title="Compensation (EGP)" field="comp" countLabel="EGP" color={COLORS.chart} m={tm} labels={tl} kind={td.kind} partialLast={td.partialLast} info="Compensation paid to merchants in EGP (mart: compensation_amount). Lower is better." />
      </MPGrid2>
      {MP_MODE === "portfolio" && (
        <>
          <MPSection title={"Which merchants — " + mpMonthLabel(monthIdx)} />
          <MPGrid2>
            {[["Fake attempts", "fake_attempts"], ["RTO without attempt", "rto_without_attempt"], ["Lost", "parcels_lost"], ["Damaged", "parcels_damaged"], ["Compensation (EGP)", "compensation_amount"]].map(([t, k]) => (
              <MPChartCard key={k} title={t} info={"Merchants with the most " + t.toLowerCase() + " in the selected month. Click a name to open its profile."}>
                <MPRankBars data={mpPfRank(monthIdx, k, 6).map((r) => ({ label: r.label, value: r.value, item: r.item }))} onItemClick={onOpenMerchant} color={COLORS.chart} fmtFn={(v) => fmt(v)} emptyText="None this month" />
              </MPChartCard>
            ))}
          </MPGrid2>
        </>
      )}
      <MPParcelTables />
    </div>
  );
}

function MPCxIssues({ onOpenMerchant }) {
  if (!MP_CM) return <MPNoCm />;
  const port = MP_MODE === "portfolio";
  const all = mpCmTicketRows();
  const isPending = (t) => t.status === "Pending" || t.status === "Pending Customer Response";
  const isComp = (t) => t.comp && !/not ask for a compensation/i.test(t.comp);
  const count = (arr, key) => { const m = {}; arr.forEach((t) => { m[t[key]] = (m[t[key]] || 0) + 1; }); return Object.entries(m).map(([label, value]) => ({ label, value })); };
  const perDay = Array.from({ length: MP_CM.days }, (_, i) => ({ x: mpShortDate(MP_CUR_MONTH_START.slice(0, 8) + String(i + 1).padStart(2, "0")), Tickets: all.filter((t) => t.dom === i + 1).length }));
  const open = all.filter((t) => t.status === "Open"), pending = all.filter(isPending), comps = all.filter(isComp);
  const base = [{ key: "id", label: "Ticket ID", mono: true }, { key: "date", label: "Date" }, ...(port ? [{ key: "merchant", label: "Merchant" }] : []), { key: "tracking", label: "Tracking #", mono: true }, { key: "agent", label: "Agent" }, { key: "type", label: "Type" }, { key: "category", label: "Category" }, { key: "status", label: "Status" }];
  const fk = port ? ["id", "tracking", "merchant", "agent"] : ["id", "tracking", "agent"];
  const byMerchant = port ? count(all, "merchant").map((d) => ({ ...d, item: MP_PF.parsed.find((p) => p.item.name === d.label)?.item })) : [];
  return (
    <div>
      <MPBanner text="Tickets come from public.freshdesk_tickets_enriched and are attached to a merchant by business id, chat id or tracking number. Only about half of all tickets can be linked to a merchant, so counts here are a floor, not the full volume." />
      <MPCmStamp />
      <MPGrid2 min={170}>
        <MPKpi label="Tickets" value={fmt(all.length)} sub="Oct 1–4" info="Tickets created this month that are linked to a merchant of this view." />
        <MPKpi label="Open" value={fmt(open.length)} sub="status Open" info="Tickets whose status is Open." />
        <MPKpi label="Pending" value={fmt(pending.length)} sub="incl. waiting for customer" info="Status Pending or Pending Customer Response." />
        <MPKpi label="With compensation" value={fmt(comps.length)} sub="ticket outcome" info="Tickets with a compensation type other than 'not ask for a compensation' (free order, credit, rejected…)." />
      </MPGrid2>
      <MPSection title="When, who and what" />
      <MPGrid2>
        <MPChartCard title="Tickets per day" info="Tickets created each day this month." insight={all.length ? { text: `${fmt(all.length)} tickets in ${MP_CM.days} days`, tone: "flat" } : null}>
          <MPBarChart data={perDay} xKey="x" series={[{ key: "Tickets", label: "Tickets", color: COLORS.chart }]} />
        </MPChartCard>
        <MPChartCard title="By status" info="Tickets by current status."><MPRankBars data={count(all, "status")} color={COLORS.chart} fmtFn={(v) => fmt(v)} /></MPChartCard>
        <MPChartCard title="By category" info="Tickets by category."><MPRankBars data={count(all, "category")} color={COLORS.chart} fmtFn={(v) => fmt(v)} /></MPChartCard>
        <MPChartCard title="By agent" info="Tickets per assigned agent."><MPRankBars data={count(all, "agent")} color={COLORS.chart} fmtFn={(v) => fmt(v)} /></MPChartCard>
        {port && <MPChartCard title="By merchant" info="Merchants with the most tickets. Click a name to open its profile."><MPRankBars data={byMerchant} onItemClick={onOpenMerchant} color={COLORS.chart} fmtFn={(v) => fmt(v)} /></MPChartCard>}
      </MPGrid2>
      <MPSection title="Ticket detail" />
      <MPDetailTable title="Opened tickets" rows={open} columns={base} filterKeys={fk} csvName="opened_tickets_oct.csv" info="Tickets with status Open." />
      <MPDetailTable title="Pending tickets" rows={pending} columns={base} filterKeys={fk} csvName="pending_tickets_oct.csv" info="Status Pending or Pending Customer Response." />
      <MPDetailTable title="Tickets with compensation" rows={comps} columns={base.concat([{ key: "comp", label: "Compensation" }])} filterKeys={fk} csvName="compensation_tickets_oct.csv" info="Tickets with a compensation type other than 'not ask for a compensation'." />
    </div>
  );
}

function MPMerchantCustomerIssues({ onOpenMerchant }) {
  if (!MP_CM) return <MPNoCm />;
  const port = MP_MODE === "portfolio";
  const s = mpCmAttemptSummary();
  const sides = ["Customer", "Merchant", "Address / phone data", "Other"];
  const sideInfo = "Grouped from the failure-reason wording (public.deliveries_attempts.exception_reason): Merchant = business or pickup/return reasons and product issues; Customer = reasons naming the customer or consignee; Address / phone data = 'waiting for data modification'; Other = phone off, weather. This grouping is derived, not a field.";
  const reasons = MP_CM.rs.map((r, i) => ({ label: r, value: s.byReason[i], color: MP_SIDE_COLOR[mpReasonSide(r)] })).filter((d) => d.value > 0);
  const share = (v) => (s.total ? Math.round((v / s.total) * 100) + "%" : "0%");
  const perDay = s.byDay.map((d, i) => ({ x: mpShortDate(MP_CUR_MONTH_START.slice(0, 8) + String(i + 1).padStart(2, "0")), ...d }));
  const cols = [{ key: "tracking", label: "Tracking #", mono: true }, { key: "date", label: "Date" }, ...(port ? [{ key: "merchant", label: "Merchant" }] : []), { key: "reason", label: "Reason" }, { key: "side", label: "Side" }];
  return (
    <div>
      <MPBanner text="Failed delivery attempts with a reason, from public.deliveries_attempts. Counts by day and reason cover every attempt; the table shows only the latest 10 attempts per merchant (the full list is about a million rows by month end)." />
      <MPCmStamp />
      <MPGrid2 min={170}>
        <MPKpi label="Failed attempts" value={fmt(s.total)} sub="Oct 1–4" info="Delivery or pickup attempts that ended with a failure reason." />
        {sides.slice(0, 3).map((k) => <MPKpi key={k} label={k} value={fmt(s.bySide[k])} sub={share(s.bySide[k]) + " of failures"} info={sideInfo} />)}
      </MPGrid2>
      <MPSection title="What fails and when" />
      <MPGrid2>
        <MPChartCard title="Failed attempts per day" info={"Failed attempts each day, split by side. " + sideInfo}>
          <MPBarChart data={perDay} xKey="x" stacked series={sides.map((k) => ({ key: k, label: k, color: MP_SIDE_COLOR[k] }))} />
        </MPChartCard>
        <MPChartCard title="By reason" info={"Most common failure reasons, coloured by side. " + sideInfo}>
          <MPRankBars data={reasons} maxRows={8} fmtFn={(v) => fmt(v)} />
        </MPChartCard>
        {port && <MPChartCard title="By merchant" info="Merchants with the most failed attempts. Click a name to open its profile."><MPRankBars data={s.byMerchant} onItemClick={onOpenMerchant} color={COLORS.chart} fmtFn={(v) => fmt(v)} /></MPChartCard>}
      </MPGrid2>
      <MPSection title="Latest failed attempts" />
      <MPDetailTable title="Latest failed attempts" rows={s.recent} columns={cols} filterKeys={port ? ["tracking", "merchant", "reason"] : ["tracking", "reason"]} csvName="latest_failed_attempts_oct.csv" info="The latest 10 failed attempts of each merchant." />
    </div>
  );
}

function MPOpportunities({ monthIdx }) {
  const cur = MP_MONTHLY[monthIdx];
  const flags = MP_MODE === "merchant" ? computeFlagsMP(monthIdx) : null;
  const win = mpVasWindow(monthIdx);
  const vasData = MP_VAS_TYPES.map((v) => ({ label: v.label, value: win.reduce((s, m) => s + (m[v.key] || 0), 0), color: COLORS.chart }));
  const zoneKeys = Object.keys(MP_ZONE_LABELS);
  const zoneTotal = zoneKeys.reduce((s, k) => s + (cur[k] || 0), 0);
  const zoneRows = zoneKeys.map((k) => ({ label: MP_ZONE_LABELS[k], value: cur[k] || 0, color: COLORS.chart })).sort((a, b) => b.value - a.value);
  const vasMerchantShare = cur.active_merchants ? Math.round((cur.vas_merchants / cur.active_merchants) * 100) : 0;
  const lead = zoneRows[0];
  return (
    <div>
      <MPSection title="VAS opportunities" />
      <MPGrid2>
        <MPChartCard title="VAS revenue by type" info="VAS revenue (EGP) by type over the selected month and the 2 before. Types with no bar are not being used — upsell candidates." insight={MP_MODE === "portfolio" ? { text: `${cur.vas_merchants} of ${cur.active_merchants} active merchants (${vasMerchantShare}%) use VAS in ${mpMonthLabel(monthIdx)}`, tone: "flat" } : (flags.vasMissing.length ? { text: `Not using: ${flags.vasMissing.join(", ")}`, tone: "bad" } : { text: "Using all six core VAS types", tone: "good" })}>
          <MPRankBars data={vasData} fmtFn={(v) => mpCompact(v)} emptyText="No VAS revenue in this window" showShare={false} />
        </MPChartCard>
      </MPGrid2>
      <MPSection title="Delivery zones" />
      <MPGrid2>
        <MPChartCard title="Where parcels go" info={"Delivered parcels by destination zone in " + mpMonthLabel(monthIdx) + " (mart: parcels_delivered_zone_*)."} insight={zoneTotal ? { text: `${lead.label} leads with ${Math.round((lead.value / zoneTotal) * 100)}% of ${mpCompact(zoneTotal)} deliveries`, tone: "flat" } : null}>
          <MPRankBars data={zoneRows} fmtFn={(v) => mpCompact(v)} maxRows={8} />
        </MPChartCard>
      </MPGrid2>
    </div>
  );
}
