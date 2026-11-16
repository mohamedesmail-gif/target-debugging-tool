// ============================================================================
// PRICING ENGINE — ported from the Merchant Pricing Simulator (v66, data 2026-11-02).
// Pure functions, no React and no DOM, so tests/pricing.mjs can run it directly.
// The formulas are the simulator's, unchanged: it reconciled with billed revenue
// within 1% for 9,498 of 9,640 single-plan merchants, so any change here would
// break a result that has already been validated. Keep ports faithful; put new
// behaviour in src/m11_pricing.jsx instead.
//
// Everything is EGP before VAT. Fulfillment revenue and cost are out of scope.
// "Orders" = orders that reached delivered or returned status in the month.
// ============================================================================
const PRC_ENG = (function () {
  var TYPES = 'SFRECKGP';
  var SIZES = 'NLXWBH';
  var TYPE_NAME = { S: 'Send', F: 'Send – fulfillment', R: 'Return to origin (RTO)', E: 'Exchange', C: 'Customer return pickup', K: 'Cash collection', G: 'Sign & return', P: 'Pick & choose', O: 'Other' };
  var SIZE_NAME = { N: 'Normal', L: 'Large', X: 'X-Large', W: 'White bag', B: 'Light bulky', H: 'Heavy bulky' };
  var ZONE_NAME = ['', 'Cairo & Giza', 'Alexandria & Behira', 'Delta & Canal', 'Near Upper', 'Far Upper & Matrouh', 'North Coast', 'Sinai & New Valley'];
  var COLOUR_NAME = { R: 'Red', Y: 'Yellow', G: 'Green', N: 'No history' };

  function priceIdx(t, p, s, z) {
    return ((TYPES.indexOf(t) * 7 + (p - 1)) * 7 + (s - 1)) * 6 + SIZES.indexOf(z);
  }
  function price(pricing, plan, t, p, s, z) {
    var arr = pricing.plans[plan];
    if (!arr || TYPES.indexOf(t) < 0 || p < 1 || p > 7 || s < 1 || s > 7) return null;
    // Customer return pickups and cash collections are billed on the reversed lane (merchant zone -> customer zone)
    if (t === 'C' || t === 'K') { var q = p; p = s; s = q; }
    return arr[priceIdx(t, p, s, z)];
  }

  // token "S11N0-36" -> row
  function parseGrain(str) {
    var out = [];
    if (!str) return out;
    var toks = str.split(' ');
    for (var i = 0; i < toks.length; i++) {
      var k = toks[i];
      out.push({ t: k[0], p: +k[1], s: +k[2], z: k[3], b: +k[4], c: k[5], n: +k.slice(6) });
    }
    return out;
  }
  function parseMap(str) {
    var o = {};
    if (!str) return o;
    str.split('|').forEach(function (kv) {
      var i = kv.lastIndexOf(':');
      if (i < 0) return;
      var k = kv.slice(0, i), v = +kv.slice(i + 1);
      o[k] = (o[k] || 0) + v;
    });
    return o;
  }

  // order-level RTO discount groups "R15L:3:0.9:24.3" -> {t,p,s,z,n,rq (sum of discount / actual shipping fee), rd (sum of discount)}
  function parseRtoD(str) {
    var out = [];
    if (!str) return out;
    str.split('|').forEach(function (g) {
      var a = g.split(':'), k = a[0];
      out.push({ t: k[0], p: +k[1], s: +k[2], z: k[3], n: +a[1], rq: +a[2], rd: +a[3] });
    });
    return out;
  }

  // Combine several merchants' month records into one base
  // recs: [{id, rec:{a,g,L,P,Y,D,T,Z,X}, cost:[fm,lmf,mat]|null}]
  function combine(recs, fields, defaults) {
    var A = {};
    fields.forEach(function (f) { A[f] = 0; });
    var rows = [], legs = {}, plans = {}, X = [], Y = {}, Z = {}, D = [], hasD = true, T = 0, hasT = true;
    var fmT = 0, lmfT = 0, matT = 0, missingCost = 0;
    recs.forEach(function (r) {
      var a = r.rec.a;
      for (var i = 0; i < fields.length; i++) A[fields[i]] += +a[i] || 0;
      rows = rows.concat(parseGrain(r.rec.g));
      var L = parseMap(r.rec.L);
      for (var k in L) legs[k] = (legs[k] || 0) + L[k];
      var P = parseMap(r.rec.P);
      for (var p in P) plans[p] = (plans[p] || 0) + P[p];
      if (r.rec.X) r.rec.X.split('|').forEach(function (v, i) { X[i] = (X[i] || 0) + (+v || 0); });
      if (r.rec.D == null) hasD = false; else D = D.concat(parseRtoD(r.rec.D));
      if (r.rec.T == null) hasT = false; else T += +r.rec.T || 0;
      var Yp = parseMap(r.rec.Y);
      for (var yt in Yp) Y[yt] = (Y[yt] || 0) + Yp[yt];
      var Zp = parseMap(r.rec.Z);   // drop-off zone fees by order type (already inside ship_rev and Y)
      for (var zt in Zp) Z[zt] = (Z[zt] || 0) + Zp[zt];
      var o = +a[fields.indexOf('orders')] || 0;
      if (r.cost) { fmT += r.cost[0] * o; lmfT += r.cost[1] * o; matT += r.cost[2] * o; }
      else { fmT += defaults.fmPerOrder * o; lmfT += defaults.lmFixed * o; matT += (defaults.matPerOrder || 0) * o; missingCost += o; }
    });
    return { A: A, rows: rows, legs: legs, plans: plans, X: X, Y: Y, Z: Z, D: hasD ? D : null, atoAtt: hasT ? T : null, fmT: fmT, lmfT: lmfT, matT: matT, missingCostOrders: missingCost };
  }

  // Several months combined -> monthly average: every additive quantity x f (f = 1 / number of months)
  function scaleBase(b, f) {
    if (f === 1) return b;
    var A = {}; for (var k in b.A) A[k] = b.A[k] * f;
    var sc = function (o) { var r = {}; for (var q in (o || {})) r[q] = o[q] * f; return r; };
    return { A: A, rows: b.rows.map(function (r) { var c = {}; for (var q in r) c[q] = r[q]; c.n = r.n * f; return c; }),
      legs: sc(b.legs), plans: sc(b.plans), X: (b.X || []).map(function (v) { return v * f; }), Y: sc(b.Y), Z: sc(b.Z),
      D: b.D ? b.D.map(function (d) { return { t: d.t, p: d.p, s: d.s, z: d.z, n: d.n * f, rq: d.rq * f, rd: d.rd * f }; }) : null,
      atoAtt: b.atoAtt == null ? null : b.atoAtt * f, fmT: b.fmT * f, lmfT: b.lmfT * f, matT: b.matT * f, missingCostOrders: (b.missingCostOrders || 0) * f };
  }

  // Sum over orders of max(COD amount - limit, 0), stored at these limits (EGP); other limits are interpolated
  var XB = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000, 50000];
  function codExcess(X, L) {
    if (!X || !X.length) return 0;
    if (L <= XB[0]) return X[0] || 0;
    for (var i = 0; i < XB.length; i++) {
      if (L === XB[i]) return X[i] || 0;
      if (i < XB.length - 1 && L > XB[i] && L < XB[i + 1]) return (X[i] || 0) + ((X[i + 1] || 0) - (X[i] || 0)) * (L - XB[i]) / (XB[i + 1] - XB[i]);
    }
    return 0;
  }

  function sumKeys(o) { var s = 0; for (var k in o) s += o[k]; return s; }
  // actual shipping by order type without the drop-off zone fees, which get their own P&L line
  function shipLessZone(Y, Z) { var o = {}; for (var t in (Y || {})) o[t] = Y[t] - ((Z && Z[t]) || 0); return o; }

  // Actual month, as recorded
  function actual(base, C) {
    var A = base.A;
    var res = {
      orders: A.orders, rto: A.rto_orders,
      ship: A.ship_rev,
      shipT: shipLessZone(base.Y, base.Z), zone: sumKeys(base.Z || {}),
      ato: A.ato_rev, flex: A.flex_rev, nd: A.exp_rev, xcod: A.xcod_rev,
      ins: A.ins_rev, ful: 0, codfee: A.codfee_rev,
      otherVas: A.ins_rev + A.codfee_rev,   // POS fee and fulfillment fee excluded everywhere
      mat: A.mat_rev, matdel: A.matdel_rev, pickup: A.pickup_rev,
      packPickup: A.mat_rev + A.matdel_rev + A.pickup_rev,
      bundleRev: A.bundle_rev,
      dBundle: A.disc_bundle, dPromo: A.disc_promo, dRto: A.disc_rto, dZcod: A.disc_zcod, dColour: 0, dTier: 0
    };
    return finish(res, base, C, 1);
  }

  // Simulated month on a plan.
  // o: {plan, curPlan, k (volume scale), keepRto, keepPromo, colour:{R,Y,G,N} (0-1), tier:{orders, pct}}
  function simulate(base, pricing, o, C) {
    var A = base.A, k = o.k || 1, card = pricing.card[o.plan] || { ato: 0, ato_on: false, flex: 0 };
    var ship = 0, bundle = 0, missing = 0, rtoCol = { R: 0, Y: 0, G: 0, N: 0 }, shipT = {};
    for (var i = 0; i < base.rows.length; i++) {
      var r = base.rows[i];
      var pr = price(pricing, o.plan, r.t, r.p, r.s, r.z);
      if (pr == null) { missing += r.n; continue; }
      var v = pr * r.n * k;
      ship += v;
      shipT[r.t] = (shipT[r.t] || 0) + v;
      if (r.b) bundle += v;
      if (r.t === 'R' && rtoCol[r.c] != null) rtoCol[r.c] += v;
    }
    // Allow to open: a flagged order is only charged if it had > 0 delivery attempts.
    // Data without attempts (older months): charged, else flagged x the ATO charge rate.
    var fallbackAto = A.ato_chg > 0 ? A.ato_chg : A.ato_flag * C.atoChargeRate;
    var atoCharged = base.atoAtt == null ? fallbackAto : base.atoAtt;
    var ato = card.ato_on ? atoCharged * card.ato * k : 0;
    var flex = A.flex_coll * card.flex * k;
    var otherVas = (A.ins_rev + A.codfee_rev) * k;   // fulfillment fee excluded
    // drop-off zone fees: kept as actual on every plan
    var zone = sumKeys(base.Z || {}) * k;
    ship += zone;
    // Next day: actual next-day revenue on the current plan; on another plan scaled by new % / current %
    var curCard = pricing.card[o.curPlan || o.plan];
    var ndRatio = 1;
    if (o.curPlan && o.plan !== o.curPlan && curCard) ndRatio = curCard.nd > 0 ? (card.nd || 0) / curCard.nd : 1;
    var nd = A.exp_rev * k * ndRatio;
    // Extra COD: plan % x sum of (COD amount - plan limit) over orders above the limit
    var xcod;
    if (!o.curPlan || o.plan === o.curPlan) xcod = A.xcod_rev * k;   // current plan: paste actual
    else if (base.X && base.X.length) xcod = card.xcod_on ? (card.xcod || 0) * codExcess(base.X, card.xcod_lim || 0) * k : 0;
    else {
      // no COD-above-limit data for this month: keep actual on the current plan, scale by % on another plan
      var xr = 1;
      if (o.curPlan && o.plan !== o.curPlan && curCard) xr = !card.xcod_on ? 0 : (curCard.xcod_on && curCard.xcod > 0 ? card.xcod / curCard.xcod : 1);
      xcod = A.xcod_rev * k * xr;
    }
    // discount rates from actual month, as % of (shipping + add-on services)
    var actBase = A.ship_rev + A.ato_rev + A.flex_rev + A.exp_rev + A.xcod_rev + A.ins_rev + A.codfee_rev;
    var simBase = ship + ato + flex + nd + xcod + otherVas;
    var rtoRate = actBase > 0 ? A.disc_rto / actBase : 0;
    // merchant's own RTO discount, order level: each discounted order keeps its discount / its actual
    // shipping fee (size fee included), applied to its price on the simulated plan. Older data without order detail: % of base.
    var dRtoSim = null;
    if (base.D) {
      var cov = 0; dRtoSim = 0;
      base.D.forEach(function (g) { var pr = price(pricing, o.plan, g.t, g.p, g.s, g.z); dRtoSim += pr == null ? g.rd : pr * g.rq; cov += g.rd; });
      dRtoSim = (dRtoSim + Math.max(0, A.disc_rto - cov)) * k;
    }
    var promoRate = actBase > 0 ? A.disc_promo / actBase : 0;
    var dColour = 0;
    if (o.colour) for (var c in rtoCol) dColour += rtoCol[c] * (o.colour[c] || 0);
    var dTier = 0;
    var orders = A.orders * k;
    if (o.tier && o.tier.orders > 0 && orders > 0) {
      dTier = Math.min(o.tier.orders, orders) * ((ship - zone) / orders) * o.tier.pct;
    }
    var res = {
      orders: orders, rto: A.rto_orders * k,
      ship: ship, shipT: shipT, ato: ato, flex: flex, nd: nd, xcod: xcod,
      zone: zone, ins: A.ins_rev * k, ful: 0, codfee: A.codfee_rev * k, otherVas: otherVas,
      mat: A.mat_rev * k, matdel: A.matdel_rev * k, pickup: A.pickup_rev * k,
      packPickup: (A.mat_rev + A.matdel_rev + A.pickup_rev) * k, ndScaled: ndRatio !== 1,
      bundleRev: A.bundle_rev * k,
      dBundle: bundle,
      dPromo: o.keepPromo ? promoRate * simBase : 0,
      dRto: o.keepRto ? (dRtoSim != null ? dRtoSim : rtoRate * simBase) : 0,
      dZcod: A.disc_zcod * k,
      dColour: dColour, dTier: dTier,
      rtoShipByColour: rtoCol, missingPriceOrders: missing * k, atoChargedOrders: card.ato_on ? atoCharged * k : 0
    };
    return finish(res, base, C, k);
  }

  function finish(res, base, C, k) {
    var A = base.A;
    res.vas = res.ato + res.flex + (res.nd || 0) + (res.xcod || 0) + res.otherVas;
    res.discounts = res.dBundle + res.dPromo + res.dRto + res.dZcod + res.dColour + res.dTier;
    res.revenue = res.ship + res.vas + res.packPickup + res.bundleRev - res.discounts;
    var O = res.orders, R = res.rto, S = O - R;
    res.asp = O > 0 ? res.revenue / O : null;
    // A margin-free pack (scripts/build_pricing.py --no-cost) carries no cost rates on purpose.
    // Report cost and GM2 as absent rather than letting them come out as NaN.
    if (C.noMargin) { res.cost = null; res.gm2 = null; res.gm2pct = null; return res; }
    var mm = 0;
    for (var key in base.legs) {
      var city = key.slice(1);
      mm += base.legs[key] * (C.mm[city] != null ? C.mm[city] : C.mmFallback);
    }
    var compPO;
    if (C.compMode === '3m') compPO = A.parcels_3m > 0 ? A.comp_3m / A.parcels_3m : C.compDefault;
    else compPO = A.wide_parcels > 0 ? A.comp / A.wide_parcels : C.compDefault;
    var cost = {
      fm: base.fmT * k,
      mm: mm * k,
      lmFixed: base.lmfT * k,
      lmVar: C.lmVar * S,
      hub: C.hub * O,
      comm: C.comm * O,
      reverse: C.reverse * R,
      cod: C.codPct * A.cod_amt * k,
      materials: base.matT * k,
      comp: compPO * O
    };
    cost.total = 0;
    for (var c in cost) if (c !== 'total') cost.total += cost[c];
    res.cost = cost;
    res.gm2 = res.revenue - cost.total;
    res.gm2pct = res.revenue !== 0 ? res.gm2 / res.revenue : null;
    return res;
  }

  // average middle-mile leg cost per zone (1..7), weighted by network legs of that zone
  function zoneLegCost(bySector, C) {
    var out = [0];
    for (var z = 1; z <= 7; z++) {
      var m = bySector[String(z)] || {}, n = 0, c = 0;
      for (var city in m) { n += m[city]; c += m[city] * (C.mm[city] != null ? C.mm[city] : C.mmFallback); }
      out.push(n > 0 ? c / n : C.mmFallback);
    }
    return out;
  }

  // New merchant (acquisition): every input comes from the user.
  // q: {orders, deliveredPct, pick:[7], drop:[7], size:[6], atoPct, flexPct, codPct, avgCod, insPct, insRate, ndPct, packaging, stops, plan}
  function acquisition(q, pricing, C, net) {
    var card = pricing.card[q.plan] || { ato: 0, ato_on: false, flex: 0 };
    var O = q.orders, R = O * (1 - q.deliveredPct), S = O - R;
    var norm = function (a) { var t = a.reduce(function (x, y) { return x + y; }, 0); return a.map(function (v) { return t > 0 ? v / t : 0; }); };
    var pk = norm(q.pick), dr = norm(q.drop), sz = norm(q.size);
    var sendP = 0, rtoP = 0;
    for (var p = 1; p <= 7; p++) for (var s = 1; s <= 7; s++) for (var z = 0; z < 6; z++) {
      var w = pk[p - 1] * dr[s - 1] * sz[z];
      if (!w) continue;
      sendP += w * price(pricing, q.plan, 'S', p, s, SIZES[z]);
      rtoP += w * price(pricing, q.plan, 'R', p, s, SIZES[z]);
    }
    var ship = S * sendP + R * rtoP;
    var ato = card.ato_on ? O * q.atoPct * (C.atoChargeRate || 0) * card.ato : 0;
    var flex = R * q.flexPct * card.flex;
    var nd = O * (q.ndPct || 0) * (card.nd || 0) * q.avgCod * q.codPct;
    var ins = O * (q.insPct || 0) * (q.insRate || 0) * q.avgCod;
    var pack = q.packaging ? O * (C.packRev || 0) : 0;
    var res = { orders: O, rto: R, ship: ship, shipT: { S: S * sendP, R: R * rtoP }, zone: 0, ato: ato, flex: flex, nd: nd, xcod: 0, ins: ins, ful: 0, codfee: 0, otherVas: 0,
      mat: pack, matdel: 0, pickup: 0, packPickup: pack, bundleRev: 0,
      dBundle: 0, dPromo: 0, dRto: 0, dZcod: 0, dColour: 0, dTier: 0, sendPrice: sendP, rtoPrice: rtoP };
    res.vas = ato + flex + nd + ins;
    res.discounts = 0;
    res.revenue = ship + res.vas + pack;
    res.asp = O > 0 ? res.revenue / O : null;
    if (C.noMargin) { res.cost = null; res.gm2 = null; res.gm2pct = null; return res; }
    var legPick = zoneLegCost(net.pick, C), legDrop = zoneLegCost(net.drop, C);
    var mmPO = 0;
    for (var i = 0; i < 7; i++) mmPO += pk[i] * legPick[i + 1] + dr[i] * legDrop[i + 1];
    var cost = {
      fm: q.stops * C.fmPerStop, mm: mmPO * O, lmFixed: C.lmFixed * O, lmVar: C.lmVar * S, hub: C.hub * O, comm: C.comm * O,
      reverse: C.reverse * R, cod: C.codPct * O * q.codPct * q.avgCod, materials: q.packaging ? C.matCost * O : 0, comp: C.compDefault * O
    };
    cost.total = 0;
    for (var c in cost) if (c !== 'total') cost.total += cost[c];
    res.cost = cost;
    res.gm2 = res.revenue - cost.total;
    res.gm2pct = res.revenue !== 0 ? res.gm2 / res.revenue : null;
    return res;
  }

  // ---- GM2 benchmark: September 2026 actual P&L, GM2 % by monthly orders range. Fixed, not editable. ----
  var GM2_RANGE = [[0, 99, 0.293], [100, 300, 0.369], [301, 600, 0.405], [601, 1000, 0.392], [1001, 3000, 0.347],
    [3001, 5000, 0.306], [5001, 7000, 0.278], [7001, 10000, 0.269], [10001, 16000, 0.274], [16001, 21000, 0.291],
    [21001, 31000, 0.267], [31001, 41000, 0.245], [41001, 60000, 0.19], [60001, Infinity, 0.137]];
  function gm2Range(O) { for (var i = 0; i < GM2_RANGE.length; i++) if (O <= GM2_RANGE[i][1]) return GM2_RANGE[i]; return GM2_RANGE[GM2_RANGE.length - 1]; }
  function gm2RangeLabel(g, long) {
    var f = function (n) { return Math.round(n).toLocaleString('en-US'); };
    return g[1] === Infinity ? f(g[0]) + (long ? ' and above' : '+') : f(g[0]) + (long ? ' – ' : '–') + f(g[1]);
  }
  // tolerance on (simulated GM2 % - expected GM2 %): green at or above tolG, yellow at or above tolY, red below
  function tolOf(v, C) { return v == null ? null : v >= C.tolG - 1e-9 ? 'g' : v >= C.tolY - 1e-9 ? 'y' : 'r'; }
  var TOL_NAME = { g: 'Green', y: 'Yellow', r: 'Red' };

  // Cost settings from the store's defaults, with the owner's saved overrides applied on top.
  function costSettings(store, compMode) {
    var d = store.idx.cost_defaults, net = store.net || {};
    var C = {
      fmPerStop: d.fm_per_stop, fmPerOrder: d.fm_per_order_default, lmFixed: d.lm_fixed, lmVar: d.lm_var_per_success,
      hub: d.hub, comm: d.comm, reverse: d.reverse_per_rto, codPct: d.cod_pct, matCost: d.mat_cost_wa,
      matPerOrder: d.mat_per_order_default || 0, packRev: store.idx.pack_rev_per_order, compDefault: store.idx.comp_per_order,
      atoChargeRate: store.idx.ato_charge_rate, mm: JSON.parse(JSON.stringify(net.mm || {})), mmFallback: 1.389,
      tolG: -0.01, tolY: -0.04
    };
    var o = store.cost_overrides || {};
    for (var k in o) if (k !== 'mm' && C[k] != null && isFinite(+o[k])) C[k] = +o[k];
    if (o.mm) for (var g in o.mm) if (C.mm[g] != null && isFinite(+o.mm[g])) C.mm[g] = +o.mm[g];
    C.compMode = compMode || 'month';
    C.noMargin = store.margin === false;   // a pack built with --no-cost: revenue and ASP only
    return C;
  }

  // Build the base for one merchant (or a main account with its subs) in one month.
  // scope "id" = this account only; "main" = every account under the same main account.
  function baseFor(store, id, month, scope) {
    var ids = [id];
    if (scope === 'main') {
      var mainId = store.main[id] || id;
      ids = Object.keys(store.main).filter(function (x) { return (store.main[x] || x) === mainId; });
      if (ids.indexOf(id) < 0) ids.push(id);
    }
    var recs = [];
    ids.forEach(function (x) {
      var rec = store.m[x] && store.m[x][month];
      if (rec) recs.push({ id: x, rec: rec, cost: store.cost[x] || null });
    });
    if (!recs.length) return null;
    var C = costSettings(store);
    return combine(recs, store.fields, { fmPerOrder: C.fmPerOrder, lmFixed: C.lmFixed, matPerOrder: C.matPerOrder });
  }

  return {
    TYPES: TYPES, SIZES: SIZES, TYPE_NAME: TYPE_NAME, SIZE_NAME: SIZE_NAME, ZONE_NAME: ZONE_NAME, COLOUR_NAME: COLOUR_NAME,
    price: price, parseGrain: parseGrain, parseMap: parseMap, parseRtoD: parseRtoD, combine: combine, scaleBase: scaleBase,
    actual: actual, simulate: simulate, zoneLegCost: zoneLegCost, sumKeys: sumKeys, codExcess: codExcess, XB: XB,
    GM2_RANGE: GM2_RANGE, gm2Range: gm2Range, gm2RangeLabel: gm2RangeLabel, tolOf: tolOf, TOL_NAME: TOL_NAME,
    costSettings: costSettings, baseFor: baseFor, acquisition: acquisition
  };
})();
