import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultDesign, defaultSPM, winding, analyse, geometry, toPyleecan, checks,
  analyseSCIM, checksSCIM, cageGeometry, nameplate, toPyleecanSCIM,
  MATERIALS, CAGE_MATERIALS, cageResistance, skinFactors, stack,
  slotRules, goodRotorSlots, ironLoss,
} from "../src/motor.js";

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
    const d = { ...defaultSPM(), Zs: c.Zs, p: c.p, Nlayer: c.Nlayer, coil_pitch: c.coil_pitch };
    const w = winding(d);
    near(w.kw1, c.kw, 0.002, "kw1");
    near(w.q, c.q, 1e-9, "q");
    assert.ok(w.balanced, "sargı dengeli olmalı");
  });
}

test("kısa adım sargı faktörünü düşürür", () => {
  const base = { ...defaultSPM(), Zs: 36, p: 3, Nlayer: 2 };
  const full = winding({ ...base, coil_pitch: 6 }).kw1;
  const short = winding({ ...base, coil_pitch: 5 }).kw1;
  assert.ok(short < full, `kısa adım (${short}) tam adımdan (${full}) küçük olmalı`);
  near(short, 0.9330, 0.002, "5/6 adım kw1");
});

test("faz iletken sayıları dengeli dağılır", () => {
  const w = winding(defaultSPM());
  const totals = w.conductors.map((a) => a.reduce((s, v) => s + Math.abs(v), 0));
  assert.deepEqual(totals, [totals[0], totals[0], totals[0]], "her faz eşit iletken almalı");
  for (const a of w.conductors)
    assert.equal(a.reduce((s, v) => s + v, 0), 0, "her fazın net işaretli toplamı sıfır olmalı");
});

test("dengesiz kombinasyon yakalanır", () => {
  // 12 oluk / 12 kutup: t = gcd(12,6) = 6, 12/(6*3) = 0.667 -> tam sayı değil
  const w = winding({ ...defaultSPM(), Zs: 12, p: 6 });
  assert.equal(w.balanced, false);
});

test("vuruntu periyodu ve simetri göstergeleri", () => {
  const a = winding({ ...defaultSPM(), Zs: 12, p: 5 }); // 12/10
  assert.equal(a.cogPeriod, 60, "OKEK(12,10) = 60");
  assert.equal(a.symmetric, true, "OBEB(12,10) = 2, çift");

  const b = winding({ ...defaultSPM(), Zs: 9, p: 4 });  // 9/8
  assert.equal(b.cogPeriod, 72, "OKEK(9,8) = 72");
  assert.equal(b.symmetric, false, "OBEB(9,8) = 1, tek -> dengesiz çekme");
});

test("geometri tutarlı", () => {
  const d = defaultSPM();
  const g = geometry(d);
  near(g.r3, d.Rint + d.H0 + d.H1 + d.H2, 1e-9, "oluk dibi");
  near(g.hy, d.Rext - g.r3, 1e-9, "boyunduruk");
  assert.ok(g.W2 > g.W1, "sabit dişte oluk dışa doğru genişler");
  assert.ok(g.A_slot > 0, "oluk alanı pozitif");
  near(g.Rr, d.Rint - d.gap, 1e-9, "rotor dış yarıçapı");
});

test("varsayılan tasarım makul mühendislik değerleri üretir", () => {
  const r = analyse(defaultSPM());
  assert.ok(r.kc > 1.0 && r.kc < 1.4, `Carter kc = ${r.kc}`);
  assert.ok(r.Bg > 0.5 && r.Bg < 1.1, `Bg = ${r.Bg} T`);
  assert.ok(r.Bt > 0.8 && r.Bt < 1.8, `Bt = ${r.Bt} T`);
  assert.ok(r.J < 7, `akım yoğunluğu = ${r.J} A/mm²`);
  assert.equal(checks(defaultSPM(), r).every((c) => c.level === "ok"), true,
    "varsayılan tasarım tüm kontrolleri geçmeli");
  assert.ok(r.By > 0.4 && r.By < 2.0, `By = ${r.By} T`);
  assert.ok(r.fill > 0.1 && r.fill < 0.6, `doluluk = ${r.fill}`);
  assert.ok(r.T > 0, `moment = ${r.T} Nm`);
  assert.ok(r.eta > 0.7 && r.eta < 1.0, `verim = ${r.eta}`);
  assert.equal(r.f, (5 * 3000) / 60, "temel frekans");
});

test("moment akımla doğrusal, akı bağıyla orantılı", () => {
  const d = defaultSPM();
  const a = analyse(d);
  const b = analyse({ ...d, Irms: d.Irms * 2 });
  near(b.T / a.T, 2, 1e-9, "moment akımla doğrusal");
});

test("hava aralığını büyütmek akıyı düşürür", () => {
  const d = defaultSPM();
  assert.ok(analyse({ ...d, gap: 2.0 }).Bg < analyse({ ...d, gap: 0.5 }).Bg);
});

/* ================================================================== *
 * Asenkron motor — doküman değerleriyle doğrulama
 * ================================================================== */

test("SCIM: etiket değerleri modelle örtüşür", () => {
  const d = defaultDesign();
  assert.equal(d.type, "scim");
  const r = analyseSCIM(d);
  for (const c of nameplate(d, r))
    assert.ok(Math.abs(c.dev) < 0.08,
      `${c.n}: hesap ${c.calc.toFixed(3)} / etiket ${c.plate} → %${(c.dev * 100).toFixed(1)} sapma`);
});

test("SCIM: bağlantı üçgen olmalı — yıldız etiketle bağdaşmıyor", () => {
  const d = defaultDesign();
  const delta = analyseSCIM(d);
  const wye = analyseSCIM({ ...d, connection: "wye" });

  // Üçgende kalkış momenti etikete yakın, yıldızda üçte birine düşer
  assert.ok(Math.abs(delta.Tstart - d.plate.Tstart) / d.plate.Tstart < 0.08);
  assert.ok(wye.Tstart < 0.4 * d.plate.Tstart, `yıldız kalkış momenti ${wye.Tstart}`);

  // Yıldızda devrilme momenti nominalin altına düşer -> fiziksel olarak imkânsız
  assert.ok(wye.peakT < d.plate.T, `yıldız devrilme momenti ${wye.peakT} < nominal ${d.plate.T}`);
  assert.ok(delta.peakT > d.plate.T * 1.5, "üçgende sağlıklı devrilme payı");
});

test("SCIM: mıknatıslanma reaktansı geometriden makul çıkar", () => {
  const r = analyseSCIM(defaultDesign());
  assert.ok(r.Xm > 50 && r.Xm < 100, `Xm = ${r.Xm} Ω`);
  assert.ok(r.kc > 1.2 && r.kc < 1.6, `Carter kc = ${r.kc}`);
});

test("SCIM: moment-kayma eğrisi tutarlı", () => {
  const d = defaultDesign();
  const r = analyseSCIM(d);
  assert.ok(r.peakT > r.T, "devrilme momenti nominal momentin üstünde");
  assert.ok(r.peakS > r.s, "devrilme kayması nominal kaymanın üstünde");
  assert.ok(r.Ilr > r.I1 * 3, "kilitli rotor akımı nominalin katı");
  const atSync = r.curve.find((c) => c.s === 0);
  assert.ok(!atSync || atSync.T < 0.01, "senkron hızda moment sıfıra gider");
});

test("SCIM: 48/38 oluk uyumu ve sargı", () => {
  const d = defaultDesign();
  const w = winding(d);
  near(w.kw1, 0.9659, 0.002, "48 oluk 8 kutup tam adım kw1");
  assert.equal(w.Nph, 240, "faz başına sarım");
  assert.ok(w.balanced);
  assert.equal(checksSCIM(d, analyseSCIM(d)).some((c) => c.label === "Oluk uyumu"), false,
    "48/38 kombinasyonu oluk uyumu uyarısı vermemeli");
});

test("SCIM: geometri dokümanla uyumlu", () => {
  const d = defaultDesign();
  const g = geometry(d), c = cageGeometry(d);
  near(d.Rext * 2, 91, 1e-9, "stator dış çapı");
  near(d.Rint * 2, 66, 1e-9, "stator iç çapı");
  near(c.Rr * 2, 65.4, 1e-9, "rotor dış çapı");
  near(g.A_slot, 17.155, 0.1, "net oluk alanı");
  assert.equal(d.Zs, 48);
  assert.equal(d.Zr, 38);
});

test("SCIM: pyleecan export şeması", () => {
  const j = toPyleecanSCIM(defaultDesign());
  assert.equal(j.__class__, "MachineSCIM");
  assert.equal(j.stator.__class__, "LamSlotWind");
  assert.equal(j.rotor.__class__, "LamSquirrelCage");
  assert.equal(j.rotor.slot.__class__, "SlotW21");
  assert.equal(j.rotor.winding.conductor.__class__, "CondType21");
  assert.equal(j.stator.winding.type_connection, 1, "üçgen bağlantı");
  assert.equal(j.stator.winding.is_wye, false);
  near(j.rotor.Rext, 0.0327, 1e-9, "rotor yarıçapı metre");
  assert.equal(j.rotor.slot.Zs, 38);
});

test("pyleecan export şeması", () => {
  const d = defaultSPM();
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

/* ================================================================== *
 * Üretim seçimleri
 * ================================================================== */

test("kafes direnci geometriden doküman değerine yakın çıkar", () => {
  const d = defaultDesign();
  const { Rr } = cageResistance(d, winding(d));
  // Çubuk ölçüleri dokümanda yoktu; %20 içinde örtüşmesi modeli doğrular.
  const dev = Math.abs(Rr - d.Rr) / d.Rr;
  assert.ok(dev < 0.20, `geometrik Rr = ${Rr.toFixed(3)} Ω, doküman ${d.Rr} Ω (%${(dev*100).toFixed(0)})`);
});

test("kafes malzemesi direnci beklenen sırada", () => {
  const d = defaultDesign(), w = winding(d);
  const R = (m) => cageResistance({ ...d, cageMat: m }, w).Rr;
  assert.ok(R("Bakır çubuk") < R("Bakır döküm"));
  assert.ok(R("Bakır döküm") < R("Alüminyum çubuk"));
  assert.ok(R("Alüminyum çubuk") < R("Alüminyum döküm"));
});

test("derin çubuk: kalkışta etkili, nominalde değil", () => {
  const d = defaultDesign();
  const start = skinFactors(d, 1);
  const rated = skinFactors(d, 0.067);
  assert.ok(start.kR > 1.05, `kalkışta kR = ${start.kR}`);
  assert.ok(start.kX < 1, `kalkışta kX = ${start.kX}`);
  assert.ok(rated.kR < 1.01, `nominalde kR = ${rated.kR}`);
  assert.equal(skinFactors({ ...d, skinEffect: false }, 1).kR, 1);
});

test("bakır kafes verimi artırır ama kalkış momentini düşürür", () => {
  const d = { ...defaultDesign(), RrMode: "geometri" };
  const al = analyseSCIM({ ...d, cageMat: "Alüminyum döküm" });
  const cu = analyseSCIM({ ...d, cageMat: "Bakır çubuk" });
  assert.ok(cu.Rr0 < al.Rr0, "bakır daha düşük dirençli");
  assert.ok(cu.Tstart < al.Tstart, "kalkış momenti düşer — asıl ödünleşme");
  // Aynı kaymada bakır daha çok moment üretir
  assert.ok(cu.T > al.T);
});

test("derin dar çubuk, bakırda kalkış momentini geri kazandırır", () => {
  const d = { ...defaultDesign(), RrMode: "geometri", cageMat: "Bakır çubuk" };
  const sig = analyseSCIM({ ...d, Hbar: 7.0, Wbar: 2.8, Lscr: 5.6 });
  const derin = analyseSCIM({ ...d, Hbar: 9.0, Wbar: 2.2, Lscr: 4.4 });
  assert.ok(derin.skinStart.kR > sig.skinStart.kR, "derin çubukta deri etkisi güçlenir");
  assert.ok(derin.Tstart > sig.Tstart * 1.2, `kalkış ${sig.Tstart.toFixed(2)} -> ${derin.Tstart.toFixed(2)}`);
});

test("ince sac demir kaybını düşürür, lamina sayısını artırır", () => {
  const d = defaultDesign();
  const kalin = analyseSCIM({ ...d, lamGrade: "M400-50A" });
  const ince = analyseSCIM({ ...d, lamGrade: "NO20 · 0,20" });
  assert.ok(ince.Pfe < kalin.Pfe * 0.6, `${kalin.Pfe.toFixed(1)} -> ${ince.Pfe.toFixed(1)} W`);
  assert.ok(ince.pack.count > kalin.pack.count * 2, "daha çok lamina gerekir");
  assert.ok(ince.eta > kalin.eta, "verim demir kaybı üzerinden iyileşir");
});

test("400 Hz'de demir kaybına girdap akımı hâkim", () => {
  const r = analyseSCIM(defaultDesign());
  assert.ok(r.iron.Pe > r.iron.Ph * 2,
    `girdap ${r.iron.Pe.toFixed(1)} W, histerezis ${r.iron.Ph.toFixed(1)} W`);
});

test("lamina sayısı paket boyuyla tutarlı", () => {
  const d = { ...defaultDesign(), L1: 58, Kf1: 0.95, lamGrade: "M270-35A" };
  const st = stack(d);
  assert.equal(st.thickness, 0.35);
  near(st.count, (58 * 0.95) / 0.35, 1, "lamina sayısı");
});

test("verim demir kaybını içerir", () => {
  const d = defaultDesign();
  const r = analyseSCIM(d);
  near(r.Pin, r.Pgap + r.Pcus + r.Pfe, 1e-6, "giriş gücü");
  near(r.Ploss, r.Pcus + r.Pcur + r.Pfe + d.Pfw, 1e-6, "kayıp toplamı");
  near(r.eta, r.Pout / r.Pin, 1e-9, "verim tanımı");
});

test("oluk kombinasyonu kuralları", () => {
  // 48/48: eşit oluk -> kritik
  assert.ok(slotRules(48, 48, 4).fails.some((f) => f.level === "crit"));
  // 48/40: |fark| = 2p = 8 -> kritik senkron asalak moment
  assert.ok(slotRules(48, 40, 4).fails.some((f) => f.level === "crit"));
  // 48/38: |fark| = 10 = 2p+2 -> gürültü uyarısı
  const r38 = slotRules(48, 38, 4, 1.0);
  assert.equal(r38.fails.length, 1);
  assert.equal(r38.fails[0].level, "warn");
  assert.ok(r38.fails[0].rule.includes("2p±2"));
  // önerilen listede kritik ihlal olmamalı
  const good = goodRotorSlots(48, 4, 1.0, 20, 72);
  assert.ok(good.length > 0);
  for (const Zr of good) assert.equal(slotRules(48, Zr, 4, 1.0).clean, true);
  assert.ok(!good.includes(48) && !good.includes(40) && !good.includes(38));
});

test("kapalı rotor oluğu: Carter düşer, kaçak artar", () => {
  const d = { ...defaultDesign(), RrMode: "geometri" };
  const acik = analyseSCIM(d);
  const kapali = analyseSCIM({ ...d, rotorClosed: true });
  assert.ok(kapali.kc_r < acik.kc_r, "rotor Carter katsayısı 1'e iner");
  assert.equal(kapali.kc_r, 1);
  assert.ok(kapali.Xlr0 > acik.Xlr0, "kaçak reaktans artar");
  assert.ok(kapali.Tstart < acik.Tstart, "kalkış momenti düşer");
});
