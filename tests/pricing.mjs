// Checks the ported pricing engine (src/pricing_engine.js) against the data pack.
//
//   node tests/pricing.mjs [data/pricing_store.b64]
//
// Three checks:
//  1. actual() revenue equals the recorded before-VAT revenue in the data (the engine must not invent revenue).
//  2. simulate() on the merchant's CURRENT plan lands within 1% of actual, for the large majority of
//     single-plan merchants. This is the simulator's own acceptance test (it reported 9,498 of 9,640).
//  3. a plan change moves revenue, and GM2 = revenue - cost holds on every result.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// the full pack (with cost) is for testing the engine only and is never served; the served pack is data/pricing_store.b64 (revenue and ASP only)
const _full = path.join(ROOT, 'data', 'pricing_store_FULL_private.b64');
const storePath = process.argv[2] || (fs.existsSync(_full) ? _full : path.join(ROOT, 'data', 'pricing_store.b64'));
if (!fs.existsSync(storePath)) {
  console.log('pricing: SKIP (no ' + path.relative(ROOT, storePath) + '; build it with scripts/build_pricing.py)');
  process.exit(0);
}

// the engine is plain JS with no module system, so it is evaluated as-is
const src = fs.readFileSync(path.join(ROOT, 'src', 'pricing_engine.js'), 'utf8');
const ENG = new Function(src + '; return PRC_ENG;')();
const store = JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(storePath, 'utf8').trim(), 'base64')).toString('utf8'));

const C = ENG.costSettings(store);
const month = store.months[0];
const iBeforeVat = store.fields.indexOf('before_vat');
let fail = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  FAIL ' + msg); fail++; } };

console.log('pricing: store %s · %d merchants · month %s', store.asof, Object.keys(store.m).length, month);

// ---- 1. actual() reproduces recorded revenue, line for line ----------------
// before_vat is the recorded billed total. The engine's revenue differs from it in two
// deliberate ways (both carried over from the simulator): POS and fulfillment fees are
// excluded, and packaging, pickup and bundle sales are included. So the identity is
//   engine revenue == before_vat - pos_rev - ful_rev + mat + matdel + pickup + bundle_rev
// This is exact, not a tolerance band: any drift in a revenue or discount line breaks it.
const fv = (a, name) => +a[store.fields.indexOf(name)] || 0;
let checked = 0, matched = 0, worst = { d: 0, id: null };
for (const id of Object.keys(store.m)) {
  const rec = store.m[id][month];
  if (!rec) continue;
  const a = rec.a;
  const recorded = fv(a, 'before_vat');
  if (recorded <= 0) continue;
  const expected = recorded - fv(a, 'pos_rev') - fv(a, 'ful_rev')
    + fv(a, 'mat_rev') + fv(a, 'matdel_rev') + fv(a, 'pickup_rev') + fv(a, 'bundle_rev');
  const base = ENG.baseFor(store, id, month, 'id');
  const r = ENG.actual(base, C);
  const d = Math.abs(r.revenue - expected) / Math.max(1, Math.abs(expected));
  checked++;
  if (d <= 1e-3) matched++;
  else if (d > worst.d) worst = { d, id };
}
const rate = matched / checked;
console.log('  actual revenue == recorded components: %d of %d within 0.1%% (%s%%)', matched, checked, (rate * 100).toFixed(2));
if (worst.id) console.log('    worst gap: %s at %s%%', worst.id, (worst.d * 100).toFixed(4));
ok(rate > 0.999, 'actual() must rebuild recorded revenue within 0.1%, got ' + (rate * 100).toFixed(2) + '%');

// ---- 2. simulate() on the current plan lands on actual ---------------------
// Only single-plan merchants: a merchant billed on two plans in one month cannot be re-priced on one.
let sChecked = 0, sMatched = 0;
for (const id of Object.keys(store.m)) {
  const rec = store.m[id][month];
  if (!rec) continue;
  const plans = ENG.parseMap(rec.P || '');
  if (Object.keys(plans).length !== 1) continue;
  const plan = Object.keys(plans)[0];
  if (!store.pricing.plans[plan]) continue;
  const base = ENG.baseFor(store, id, month, 'id');
  const a = ENG.actual(base, C);
  if (!(a.revenue > 0)) continue;
  const s = ENG.simulate(base, store.pricing, { plan, curPlan: plan, k: 1, keepRto: true, keepPromo: true }, C);
  sChecked++;
  if (Math.abs(s.revenue - a.revenue) / a.revenue <= 0.01) sMatched++;
}
const sRate = sMatched / sChecked;
console.log('  current plan re-simulated vs actual: %d of %d within 1%% (%s%%)', sMatched, sChecked, (sRate * 100).toFixed(1));
ok(sRate > 0.95, 'simulating the current plan should land on actual for >95% of single-plan merchants, got ' + (sRate * 100).toFixed(1) + '%');

// ---- 3. identities hold, and a plan change actually moves revenue ----------
const sample = Object.keys(store.m).filter((id) => {
  const rec = store.m[id][month];
  return rec && (+rec.a[0] || 0) > 500 && store.pricing.plans[store.plan[id]];
}).slice(0, 50);
ok(sample.length > 0, 'expected at least one merchant with >500 orders to sample');

let moved = 0;
for (const id of sample) {
  const base = ENG.baseFor(store, id, month, 'id');
  const cur = store.plan[id];
  const a = ENG.actual(base, C);
  ok(Math.abs(a.gm2 - (a.revenue - a.cost.total)) < 0.01, 'GM2 = revenue - cost for ' + id);
  ok(a.orders >= a.rto, 'orders >= RTO for ' + id);
  const other = Object.keys(store.pricing.plans).find((p) => p !== cur);
  const s = ENG.simulate(base, store.pricing, { plan: other, curPlan: cur, k: 1, keepRto: true, keepPromo: true }, C);
  ok(Number.isFinite(s.revenue) && s.revenue > 0, 'simulated revenue is a positive number for ' + id);
  ok(Math.abs(s.gm2 - (s.revenue - s.cost.total)) < 0.01, 'GM2 identity holds on the simulated plan for ' + id);
  if (Math.abs(s.revenue - a.revenue) / a.revenue > 0.001) moved++;
}
ok(moved > sample.length / 2, 'changing the plan should move revenue for most merchants, moved ' + moved + ' of ' + sample.length);

// ---- 4. the margin-free pack cannot produce a cost or a GM2 ---------------
// scripts/build_pricing.py --no-cost is the real control behind the AM / sales view:
// revenue and ASP must still be exact, cost and GM2 must be absent (not zero, not wrong).
{
  const nc = JSON.parse(JSON.stringify(store));
  nc.cost = {}; nc.cost_overrides = {}; nc.idx = { ...nc.idx, cost_defaults: {}, comp_per_order: null };
  nc.net = { mm: {} }; nc.margin = false;
  const id = sample[0];
  if (id) {
    const Cn = ENG.costSettings(nc);
    const full = ENG.actual(ENG.baseFor(store, id, month, 'id'), C);
    const free = ENG.actual(ENG.baseFor(nc, id, month, 'id'), Cn);
    ok(Math.abs(free.revenue - full.revenue) < 0.01, 'the margin-free pack keeps revenue exact');
    ok(Math.abs(free.asp - full.asp) < 0.0001, 'the margin-free pack keeps ASP exact');
    ok(free.cost === null && free.gm2 === null && free.gm2pct === null, 'the margin-free pack reports no cost and no GM2');
    ok(full.cost !== null && Number.isFinite(full.gm2), 'the full pack still reports cost and GM2');
    const s = ENG.simulate(ENG.baseFor(nc, id, month, 'id'), nc.pricing,
      { plan: Object.keys(nc.pricing.plans)[0], curPlan: nc.plan[id], k: 1, keepRto: true, keepPromo: true }, Cn);
    ok(Number.isFinite(s.revenue) && s.gm2 === null, 'a plan can still be simulated on the margin-free pack');
    console.log('  margin-free pack: revenue and ASP exact, cost and GM2 absent');
  }
}

// ---- 5. the GM2 benchmark bands are well formed ----------------------------
ok(ENG.gm2Range(2000)[2] === 0.347, 'the 1,001-3,000 band expects 34.7%');
ok(ENG.gm2Range(100000)[2] === 0.137, 'the 60,001+ band expects 13.7%');
ok(ENG.tolOf(-0.005, C) === 'g' && ENG.tolOf(-0.02, C) === 'y' && ENG.tolOf(-0.09, C) === 'r', 'tolerance colours');

console.log(fail ? '\npricing: %d FAILED' : '\npricing: all checks passed', fail);
process.exit(fail ? 1 : 0);
