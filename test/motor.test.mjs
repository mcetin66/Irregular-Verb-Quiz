import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultDesign, winding, analyse, geometry, toPyleecan, checks } from "../src/motor.js";

const near = (a, b, tol, what) =>
  assert.ok(Math.abs(a - b) < tol, `${what}: ${a} beklenen ${b} (±${tol})`);

/* Sargı faktörleri — literatürden bilinen değerlerle karşılaştırma.
   Kaynak: Bianchi & Dai Pré, "Use of the star of slots in designing
   fractional-slot single-layer synchronous motors". */
const kwCases = [
  { Zs: 36, p: 3, Nlayer: 2, coil_pitch: 6, kw: 0.9659, q: 2, name: "36o/6k tam adım" },
  { Zs: 24, p: 2, Nlayer: 2, coil_pitch: 6, kw: 0.9659, q: 2, name: "24o/4k tam adım" },
  { Zs: 12, p: 5, Nlayer: 2, coil_pitch: 1, kw: 0.9330, q: 0.4, name: "12o/10k konsantre" },
  { Zs: 12, p: 4, Nlayer: 2, coil_pitch: 1, kw: 0.8660, q: 0.5, name: "12o/8k konsantre" },
  { Zs: 9, p: 4, Nlayer: 2, coil_pitch: 1, kw: 0.9452, q: 0.375, name: "9o/8k konsantre" },
  { Zs: 18, p: 8, Nlayer: 2, coil_pitch: 1, kw: 0.9452, q: 0.375, name: "18o/16k konsantre" },
];

for (const c of kwCases) {
  test(`sargı faktörü — ${c.name}`, () => {
    const d = { ...defaultDesign(), Zs: c.Zs, p: c.p, Nlayer: c.Nlayer, coil_pitch: c.coil_pitch };
    const w = winding(d);
    near(w.kw1, c.kw, 0.002, "kw1");
    near(w.q, c.q, 1e-9, "q");
    assert.ok(w.balanced, "sargı dengeli olmalı");
  });
}

test("kısa adım sargı faktörünü düşürür", () => {
  const base = { ...defaultDesign(), Zs: 36, p: 3, Nlayer: 2 };
  const full = winding({ ...base, coil_pitch: 6 }).kw1;
  const short = winding({ ...base, coil_pitch: 5 }).kw1;
  assert.ok(short < full, `kısa adım (${short}) tam adımdan (${full}) küçük olmalı`);
  near(short, 0.9330, 0.002, "5/6 adım kw1");
});

test("faz iletken sayıları dengeli dağılır", () => {
  const w = winding(defaultDesign());
  const totals = w.conductors.map((a) => a.reduce((s, v) => s + Math.abs(v), 0));
  assert.deepEqual(totals, [totals[0], totals[0], totals[0]], "her faz eşit iletken almalı");
  for (const a of w.conductors)
    assert.equal(a.reduce((s, v) => s + v, 0), 0, "her fazın net işaretli toplamı sıfır olmalı");
});

test("dengesiz kombinasyon yakalanır", () => {
  // 12 oluk / 12 kutup: t = gcd(12,6) = 6, 12/(6*3) = 0.667 -> tam sayı değil
  const w = winding({ ...defaultDesign(), Zs: 12, p: 6 });
  assert.equal(w.balanced, false);
});

test("vuruntu periyodu ve simetri göstergeleri", () => {
  const a = winding({ ...defaultDesign(), Zs: 12, p: 5 }); // 12/10
  assert.equal(a.cogPeriod, 60, "OKEK(12,10) = 60");
  assert.equal(a.symmetric, true, "OBEB(12,10) = 2, çift");

  const b = winding({ ...defaultDesign(), Zs: 9, p: 4 });  // 9/8
  assert.equal(b.cogPeriod, 72, "OKEK(9,8) = 72");
  assert.equal(b.symmetric, false, "OBEB(9,8) = 1, tek -> dengesiz çekme");
});

test("geometri tutarlı", () => {
  const d = defaultDesign();
  const g = geometry(d);
  near(g.r3, d.Rint + d.H0 + d.H1 + d.H2, 1e-9, "oluk dibi");
  near(g.hy, d.Rext - g.r3, 1e-9, "boyunduruk");
  assert.ok(g.W2 > g.W1, "sabit dişte oluk dışa doğru genişler");
  assert.ok(g.A_slot > 0, "oluk alanı pozitif");
  near(g.Rr, d.Rint - d.gap, 1e-9, "rotor dış yarıçapı");
});

test("varsayılan tasarım makul mühendislik değerleri üretir", () => {
  const r = analyse(defaultDesign());
  assert.ok(r.kc > 1.0 && r.kc < 1.4, `Carter kc = ${r.kc}`);
  assert.ok(r.Bg > 0.5 && r.Bg < 1.1, `Bg = ${r.Bg} T`);
  assert.ok(r.Bt > 0.8 && r.Bt < 1.8, `Bt = ${r.Bt} T`);
  assert.ok(r.J < 7, `akım yoğunluğu = ${r.J} A/mm²`);
  assert.equal(checks(defaultDesign(), r).every((c) => c.level === "ok"), true,
    "varsayılan tasarım tüm kontrolleri geçmeli");
  assert.ok(r.By > 0.4 && r.By < 2.0, `By = ${r.By} T`);
  assert.ok(r.fill > 0.1 && r.fill < 0.6, `doluluk = ${r.fill}`);
  assert.ok(r.T > 0, `moment = ${r.T} Nm`);
  assert.ok(r.eta > 0.7 && r.eta < 1.0, `verim = ${r.eta}`);
  assert.equal(r.f, (5 * 3000) / 60, "temel frekans");
});

test("moment akımla doğrusal, akı bağıyla orantılı", () => {
  const d = defaultDesign();
  const a = analyse(d);
  const b = analyse({ ...d, Irms: d.Irms * 2 });
  near(b.T / a.T, 2, 1e-9, "moment akımla doğrusal");
});

test("hava aralığını büyütmek akıyı düşürür", () => {
  const d = defaultDesign();
  assert.ok(analyse({ ...d, gap: 2.0 }).Bg < analyse({ ...d, gap: 0.5 }).Bg);
});

test("pyleecan export şeması", () => {
  const d = defaultDesign();
  const j = toPyleecan(d);
  assert.equal(j.__class__, "MachineSIPMSM");
  assert.equal(j.stator.__class__, "LamSlotWind");
  assert.equal(j.stator.slot.__class__, "SlotW11");
  assert.equal(j.stator.winding.__class__, "Winding");
  assert.equal(j.stator.winding.conductor.__class__, "CondType12");
  assert.equal(j.rotor.__class__, "LamSlotMag");
  assert.equal(j.rotor.slot.__class__, "SlotM11");
  assert.equal(j.rotor.magnet.__class__, "Magnet");
  assert.equal(j.shaft.__class__, "Shaft");

  // SI birimleri: metre
  near(j.stator.Rext, d.Rext * 1e-3, 1e-12, "Rext metre");
  near(j.stator.slot.W3, d.W3 * 1e-3, 1e-12, "W3 metre");
  near(j.rotor.slot.H1, d.Hmag * 1e-3, 1e-12, "mıknatıs kalınlığı metre");

  // hava aralığı tutarlılığı
  near(j.stator.Rint - j.rotor.Rext, d.gap * 1e-3, 1e-12, "hava aralığı");

  // her iç nesnede __class__ olmalı (pyleecan load şartı)
  const walk = (o, path = "$") => {
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (o && typeof o === "object") {
      assert.ok("__class__" in o, `${path} __class__ taşımalı`);
      for (const [k, v] of Object.entries(o))
        if (v && typeof v === "object") walk(v, `${path}.${k}`);
    }
  };
  walk(j);
});
