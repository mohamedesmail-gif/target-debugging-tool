// MERCHANT PROFILE SCREEN (Phase 2, now live) — real data pulled from
// mart.mart_merchant_metrics for business_id ImbeR25m9 (Trend Hub).
// Prefixed MP_ to avoid any collision with Target Tracker's own DATA/consts.
// ============================================================================
// ---- per-merchant profile data: every merchant's own history, loaded on click from ./merchant_profile_data.js ----
// (gzip + base64 packs built from mart.v_merchant_monthly_wide / mart.v_merchant_daily_wide / mart.v_parcel_lifecycle)
let MP_MERCHANT = { id: "", name: "", segment: "", accountManager: "", joinDate: "", lastActivity: null };
let MP_MONTHLY = [];        // Jan..Oct 2026, one object per month (October is month-to-date)
let MP_DAILY_PREV = [];     // previous month (September), daily
let MP_DAILY_CUR = [];      // current month (October), daily, month-to-date
let MP_COMBINED_DAILY = []; // Sep 1 -> Oct 4
let MP_X = { source: null, sourcePct: null, locations: [] };
const MP_PREV_LABEL = "Sep", MP_CUR_LABEL = "Oct", MP_CUR_NAME = "October";
const MP_MONTH_KEYS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const MP_DAILY_START = "2026-09-01", MP_CUR_MONTH_START = "2026-10-01";
const MP_M_FIELDS = ["ecomm_pickups", "fulfillment_pickups", "box_pickups", "parcels_picked", "parcels_delivered", "delivery_revenue_total", "delivery_revenue_shipping", "delivery_revenue_vas_total", "vas_extracod", "vas_next_day", "vas_insurance", "vas_flexship", "vas_allow_to_open", "vas_materials", "vas_handling", "dsr", "asr", "fake_attempts", "rto_without_attempt", "parcels_lost", "parcels_damaged", "compensation_amount", "parcels_rto", "parcels_returned", "zone_cairo_giza", "zone_alex_behira", "zone_delta_canal", "zone_near_upper", "zone_far_upper_matrouh", "zone_north_coast", "zone_sinai_new_valley", "zone_other"];
const MP_D_FIELDS = ["ecomm_pickups", "fulfillment_pickups", "box_pickups", "parcels_picked", "parcels_delivered", "delivery_revenue_total", "delivery_revenue_vas_total", "dsr", "asr", "fake_attempts", "rto_without_attempt", "parcels_lost", "parcels_damaged", "compensation_amount"];

function mpAddDays(s, n) { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

function mpParsePacks(mpack, dpack) {
  const monthly = mpack.split(";").map((seg, i) => {
    const v = seg.split(",").map(Number);
    const o = { month: MP_MONTH_KEYS[i] };
    MP_M_FIELDS.forEach((f, j) => { o[f] = v[j]; });
    // ratios are stored x10000, -1 = no data. Monthly rows expose *_avg; daily/weekly rows expose dsr / asr.
    o.dsr_avg = o.dsr < 0 ? null : o.dsr / 10000;
    o.asr_avg = o.asr < 0 ? null : o.asr / 10000;
    delete o.dsr; delete o.asr;
    return o;
  });
  const daily = dpack.split(";").map((seg, i) => {
    const v = seg.split(",").map(Number);
    const o = { date: mpAddDays(MP_DAILY_START, i) };
    MP_D_FIELDS.forEach((f, j) => { o[f] = v[j]; });
    o.dsr = o.dsr < 0 ? null : o.dsr / 10000;
    o.asr = o.asr < 0 ? null : o.asr / 10000;
    return o;
  });
  return { monthly, daily };
}

// All merchants' profile data is embedded at the bottom of this file (MP_DATA_B64: gzip + base64), so there is
// nothing else to deploy. It is decompressed once, the first time any profile is opened.
async function mpInflate(b64) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser can't decompress the profile data (DecompressionStream is missing) \u2014 please use a current Chrome, Edge, Safari or Firefox.");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}
let MP_STORE = null;
async function mpLoadStore() {
  if (MP_STORE) return MP_STORE;
  MP_STORE = JSON.parse(await mpInflate(MP_DATA_B64));
  return MP_STORE;
}

async function mpLoadProfile(merchant) {
  const store = await mpLoadStore();
  const entry = store.p[merchant.id];
  if (!entry) throw new Error("No profile data found for merchant " + merchant.id + " in merchant_profile_data.js");
  const { monthly, daily } = mpParsePacks(entry[0], entry[1]);
  const x = (store.x && store.x[merchant.id]) || {};
  MP_MERCHANT = { id: merchant.id, name: merchant.name, segment: merchant.seg, accountManager: merchant.am, joinDate: merchant.jd, lastActivity: merchant.lastActivity };
  MP_MONTHLY = monthly;
  MP_DAILY_PREV = daily.filter((d) => d.date < MP_CUR_MONTH_START);
  MP_DAILY_CUR = daily.filter((d) => d.date >= MP_CUR_MONTH_START);
  MP_COMBINED_DAILY = MP_DAILY_PREV.concat(MP_DAILY_CUR);
  MP_X = { source: x.s || null, sourcePct: x.sp == null ? null : x.sp, locations: x.l || [] };
  mpBuildSamples(merchant.id);
}

function mpPct100(r, k) { const v = r[k] != null ? r[k] : r[k + "_avg"]; return v == null ? null : v * 100; }

const MP_ZONE_LABELS = {
  zone_cairo_giza: "Cairo & Giza", zone_alex_behira: "Alexandria & Beheira", zone_delta_canal: "Delta & Canal",
  zone_near_upper: "Near Upper Egypt", zone_far_upper_matrouh: "Far Upper Egypt & Matrouh",
  zone_north_coast: "North Coast", zone_sinai_new_valley: "Sinai & New Valley", zone_other: "Other",
};
const MP_VAS_TYPES = [
  { key: "vas_insurance", label: "Insurance" }, { key: "vas_next_day", label: "Next-day" },
  { key: "vas_allow_to_open", label: "Allow to open" }, { key: "vas_extracod", label: "Extra COD" },
  { key: "vas_flexship", label: "Flexship" }, { key: "vas_materials", label: "Materials" },
];
// A VAS type counts as "in use" if it earned revenue in the selected month or either of the two months before it
function mpVasWindow(monthIdx) { return MP_MONTHLY.slice(Math.max(0, monthIdx - 2), monthIdx + 1); }
function mpVasUsed(monthIdx, key) { return mpVasWindow(monthIdx).some((m) => m[key] > 0); }

// Seasonality is a derived heuristic (there is no official seasonality tag in the mart)
function mpSeasonality() {
  const vols = MP_MONTHLY.slice(0, MP_MONTHLY.length - 1).map((m) => m.ecomm_pickups + m.fulfillment_pickups + m.box_pickups); // complete months only
  const active = vols.filter((v) => v > 0);
  if (active.length < 4) return { value: "Not enough history" };
  const mean = active.reduce((a, b) => a + b, 0) / active.length;
  const sd = Math.sqrt(active.reduce((s, v) => s + (v - mean) * (v - mean), 0) / active.length);
  const max = Math.max(...vols);
  const peakKey = HIST_MONTH_KEYS[vols.indexOf(max)];
  if (sd / mean < 0.2) return { value: "Stable" };
  if (max / mean >= 1.4) return { value: "Peaks in " + MONTH_LABELS[peakKey] };
  return { value: "Moderate swings" };
}

function pct(n, d) {
  if (d === undefined) d = 1;
  if (n === null || n === undefined || Number.isNaN(n)) return "\u2014";
  return fmt(n * 100, d) + "%";
}
function ordinalSuffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  switch (n % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
}
function dayOfWeekName(dateStr) {
  const dt = new Date(dateStr + "T00:00:00Z");
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dt.getUTCDay()];
}
function dayOfMonth(dateStr) { return Number(dateStr.slice(8, 10)); }

function weeklyFromDailyMP(daily) {
  const weeks = {};
  daily.forEach((d) => {
    const dt = new Date(d.date + "T00:00:00Z");
    const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((dt - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
    const key = "W" + weekNum;
    if (!weeks[key]) weeks[key] = { week: key, days: [] };
    weeks[key].days.push(d);
  });
  const sumKeys = ["ecomm_pickups", "fulfillment_pickups", "box_pickups", "delivery_revenue_total", "delivery_revenue_vas_total", "fake_attempts", "rto_without_attempt", "parcels_lost", "parcels_damaged", "compensation_amount", "parcels_delivered"];
  return Object.keys(weeks).sort().map((key) => {
    const w = weeks[key];
    const out = { week: w.week, dayCount: w.days.length };
    sumKeys.forEach((k) => { out[k] = w.days.reduce((s, d) => s + (d[k] || 0), 0); });
    const dsrVals = w.days.map((d) => d.dsr).filter((v) => v != null);
    const asrVals = w.days.map((d) => d.asr).filter((v) => v != null);
    out.dsr = dsrVals.length ? dsrVals.reduce((a, b) => a + b, 0) / dsrVals.length : null;
    out.asr = asrVals.length ? asrVals.reduce((a, b) => a + b, 0) / asrVals.length : null;
    return out;
  });
}
function weekOfMonthFromDailyMP(daily) {
  const buckets = {};
  daily.forEach((d) => {
    const wk = Math.ceil(dayOfMonth(d.date) / 7);
    const key = "Week " + wk;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(d);
  });
  const sumKeys = ["ecomm_pickups", "fulfillment_pickups", "box_pickups", "delivery_revenue_total", "delivery_revenue_vas_total", "fake_attempts", "rto_without_attempt", "parcels_lost", "parcels_damaged", "compensation_amount", "parcels_delivered"];
  return Object.keys(buckets).sort().map((label) => {
    const days = buckets[label];
    const out = { label, dayCount: days.length };
    sumKeys.forEach((k) => { out[k] = days.reduce((s, d) => s + (d[k] || 0), 0); });
    const dsrVals = days.map((d) => d.dsr).filter((v) => v != null);
    const asrVals = days.map((d) => d.asr).filter((v) => v != null);
    out.dsr = dsrVals.length ? dsrVals.reduce((a, b) => a + b, 0) / dsrVals.length : null;
    out.asr = asrVals.length ? asrVals.reduce((a, b) => a + b, 0) / asrVals.length : null;
    return out;
  });
}
function computeFlagsMP(monthIdx) {
  const cur = MP_MONTHLY[monthIdx];
  const prev = monthIdx > 0 ? MP_MONTHLY[monthIdx - 1] : null;
  const anyBefore = MP_MONTHLY.slice(0, monthIdx).some((m) => (m.ecomm_pickups + m.fulfillment_pickups + m.box_pickups) > 0);
  const curActive = (cur.ecomm_pickups + cur.fulfillment_pickups + cur.box_pickups) > 0;
  const prevActive = prev ? (prev.ecomm_pickups + prev.fulfillment_pickups + prev.box_pickups) > 0 : false;
  const joinMonth = MP_MERCHANT.joinDate.slice(0, 7);
  const isNew = joinMonth === cur.month;
  let lifecycle = "Existing";
  if (isNew) lifecycle = "New";
  else if (curActive && prevActive) lifecycle = "Retained";
  else if (curActive && !prevActive && anyBefore) lifecycle = "Reactivated";
  else if (curActive) lifecycle = "Retained";
  const totalVol = cur.ecomm_pickups + cur.fulfillment_pickups + cur.box_pickups;
  const shares = { ecomm: totalVol ? cur.ecomm_pickups / totalVol : 0, fulfillment: totalVol ? cur.fulfillment_pickups / totalVol : 0, box: totalVol ? cur.box_pickups / totalVol : 0 };
  const isLowDSR = cur.dsr_avg != null && (cur.dsr_avg != null && cur.dsr_avg <= 0.65);
  const vasActiveCount = MP_VAS_TYPES.filter((v) => mpVasUsed(monthIdx, v.key)).length;
  let vasFlag = "None";
  if (vasActiveCount === MP_VAS_TYPES.length) vasFlag = "Full"; else if (vasActiveCount >= 2) vasFlag = "Multiple"; else if (vasActiveCount === 1) vasFlag = "Single";
  const vasMissing = MP_VAS_TYPES.filter((v) => !mpVasUsed(monthIdx, v.key)).map((v) => v.label);
  return { isNew, lifecycle, shares, isLowDSR, vasFlag, vasActiveCount, vasMissing, totalVol };
}
function downloadCsvMP(filename, columns, rows) {
  const header = columns.map((c) => c.label).join(",");
  const lines = rows.map((r) => columns.map((c) => `"${String(r[c.key] == null ? "" : r[c.key]).replace(/"/g, '""')}"`).join(","));
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function groupCountMP(rows, keyFn) {
  const out = {};
  rows.forEach((r) => { const k = keyFn(r); out[k] = (out[k] || 0) + 1; });
  return out;
}
function sortedEntriesMP(obj) { return Object.entries(obj).sort((a, b) => b[1] - a[1]); }

const MP_METRICS = [
  { key: "volume", label: "Volume", isPct: false, getVal: (r) => (r.ecomm_pickups || 0) + (r.box_pickups || 0) + (r.fulfillment_pickups || 0) },
  { key: "revenue_ship", label: "Revenue (Shipping)", getVal: (r) => (r.delivery_revenue_total || 0) - (r.delivery_revenue_vas_total || 0) },
  { key: "revenue_vas", label: "Revenue (VAS)", getVal: (r) => r.delivery_revenue_vas_total || 0 },
  { key: "asp_ship", label: "ASP (Shipping)", getVal: (r) => { const v = (r.ecomm_pickups || 0) + (r.box_pickups || 0) + (r.fulfillment_pickups || 0); const rev = (r.delivery_revenue_total || 0) - (r.delivery_revenue_vas_total || 0); return v ? rev / v : 0; }, decimals: 1 },
  { key: "asp_vas", label: "ASP (VAS)", getVal: (r) => { const v = (r.ecomm_pickups || 0) + (r.box_pickups || 0) + (r.fulfillment_pickups || 0); return v ? (r.delivery_revenue_vas_total || 0) / v : 0; }, decimals: 1 },
  { key: "dsr", label: "DSR", isPct: true, getVal: (r) => mpPct100(r, "dsr") },
  { key: "asr", label: "ASR", isPct: true, getVal: (r) => mpPct100(r, "asr") },
  { key: "fake_attempts", label: "Fake attempts", getVal: (r) => r.fake_attempts || 0 },
  { key: "rto", label: "RTO no attempt", getVal: (r) => r.rto_without_attempt || 0 },
  { key: "lost", label: "Lost", getVal: (r) => r.parcels_lost || 0 },
  { key: "damaged", label: "Damaged", getVal: (r) => r.parcels_damaged || 0 },
  { key: "compensation", label: "Compensation", getVal: (r) => r.compensation_amount || 0 },
];
