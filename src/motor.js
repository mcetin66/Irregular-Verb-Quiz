/**
 * Motor tasarım çekirdeği — saf hesap, DOM bağımlılığı yok.
 *
 * Veri modeli bilinçli olarak Pyleecan (Eomys/pyleecan, Apache-2.0) sınıf
 * şemasına göre adlandırılmıştır; böylece `toPyleecan()` çıktısı doğrudan
 * `pyleecan.Functions.load.load()` ile okunabilir.
 *
 *   stator  -> LamSlotWind + SlotW11 + Winding + CondType12
 *   rotor   -> LamSlotMag  + SlotM11 + Magnet
 *   makine  -> MachineSIPMSM
 *
 * Pyleecan SI birimleri kullanır (metre). Bu modülün ARAYÜZÜ milimetre alır,
 * dönüşüm yalnızca export sınırında yapılır.
 */

import { LAMINATIONS } from "./laminations.js";

export { LAMINATIONS };

export const PHASES = ["A", "B", "C"];

/** Malzeme kütüphanesi. Değerler tipik katalog verileridir. */
export const MATERIALS = {
  steel: {
    name: "M400-50A",
    rho: 7650,          // kg/m^3
    Wlam: 0.0005,       // sac kalınlığı [m]
    Bknee: 1.55,        // dizin noktası (doyma dirseği) [T]
    Bsat: 2.0,          // pratik doyma sınırı [T]
    p15: 4.0,           // özgül kayıp @1.5 T, 50 Hz [W/kg]
    mur_lin: 2500,
    rho_elec: 5.9e-7,   // ohm.m
  },
  magnet: {
    name: "NdFeB N38SH",
    Brm20: 1.22,        // remanans [T]
    mur_lin: 1.05,
    alpha_Br: -0.0011,  // 1/K
    rho: 7500,
    rho_elec: 1.4e-6,
  },
  copper: {
    name: "Copper",
    rho20: 1.724e-8,    // ohm.m
    alpha: 0.00393,     // 1/K
    rho: 8933,
  },
  aluminium: {
    name: "Aluminium",
    rho: 2700,
    rho_elec: 2.83e-8,
    alpha: 0.0039,
  },

  shaft: { name: "Steel-C45", rho: 7850, rho_elec: 1.7e-7 },
  insulation: { name: "Insulation1", rho: 1400 },

};

/**
 * Rotor kafes malzemeleri. rho20 [Ω·m] 20 °C'de.
 * Döküm alüminyum, gözeneklilik ve alaşım nedeniyle saf alüminyumdan
 * belirgin biçimde dirençlidir; bu tasarımın en çok gözden kaçan kalemidir.
 */
export const CAGE_MATERIALS = {
  "Alüminyum döküm": {
    rho20: 4.00e-8, alpha: 0.0039, dens: 2700, cast: true, joint: 1.0,
    note: "Basınçlı döküm. Ucuz, seri üretime uygun, halkalar tek parça. Gözeneklilik direnci ~%25 artırır.",
  },
  "Alüminyum çubuk": {
    rho20: 2.90e-8, alpha: 0.0039, dens: 2700, cast: false, joint: 1.05,
    note: "Haddelenmiş çubuk + kaynaklı halka. Dökümden iletken, ama bağlantı direnci ve işçilik ekler.",
  },
  "Bakır döküm": {
    rho20: 2.00e-8, alpha: 0.00393, dens: 8900, cast: true, joint: 1.0,
    note: "1085 °C döküm — kalıp ömrü kısa, ekipman özel. En düşük kayıp, en yüksek üretim maliyeti.",
  },
  "Bakır çubuk": {
    rho20: 1.75e-8, alpha: 0.00393, dens: 8900, cast: false, joint: 1.05,
    note: "Çubuk çakma + sert lehim/kaynak halka. En iyi iletkenlik; bağlantı kalitesi kritik, gevşek bağlantı noktasal ısınma yapar.",
  },
};

/* ------------------------------------------------------------------ *
 * Varsayılan tasarım — 400 Hz havacılık tipi sincap kafesli asenkron motor
 *
 * Değerler kullanıcının elindeki motor dokümanından alınmıştır. Bağlantı
 * biçimi dokümanda yazmıyordu; eşdeğer devre parametreleri ile etiket
 * başarımı yalnızca ÜÇGEN bağlantıda (faz gerilimi 200 V) örtüşüyor —
 * bkz. test/motor.test.mjs içindeki etiket doğrulaması.
 * ------------------------------------------------------------------ */
/** Optimize tasarımın geometrisi (kısıtlı arama sonucu). */
const OPT_GEOM = {
  Rint: 32.1, W3: 1.7, H2: 9.0, W0: 1.22, H0: 0.5, H1: 0.7, R1: 0.8,
  Ntcoil: 14, Zr: 28, Hbar: 11.4, Wbar: 3.02, Lscr: 6.04,
  W0r: 0.8, H0r: 0.5, gap: 0.26, Drsh: 24, Dshaft: 12, speed: 5901,
};

export function defaultDesign() {
  return {
    type: "scim",
    name: "SCIM-48s38r-400Hz",

    // --- Stator laminasyonu ---
    // Ölçülen: stator sac paketi dış çapı 92,23 mm (dokümanda 91).
    Rext: 46.115,
    Rint: 33.0,    // 66 mm delik çapı — ölçülen rotorla 0,29 mm aralık verir
    L1: 58,        // dokümandaki aktif paket (ölçülen rotor paketi 64,08 mm)
    Kf1: 0.95,

    // --- Stator oluğu ---
    Zs: 48,
    // Oluk profili ÇIKARIMDIR, ölçüm değil. İki kısıtla çözüldü:
    //   (1) dokümandaki net oluk alanı 17,155 mm²
    //   (2) etiketteki güç faktörü 0,720
    // Çözüm açık oluk veriyor: ağız genişliği ≈ oluk üst genişliği.
    // Doğrulanması gereken tek geometri budur — bkz. README.
    W0: 2.93, H0: 0.6, H1: 0.8, H2: 5.32,
    W3: 1.57,      // diş genişliği
    R1: 0.8,

    // --- Sargı ---
    p: 4,          // 8 kutup (400 Hz -> 6000 d/dk senkron)
    qs: 3,
    Ntcoil: 15,    // bobin başına sarım (çift katman -> oluk başına 30 iletken)
    Npcp: 1,
    Nlayer: 2,
    coil_pitch: 6, // tam adım (48/8 = 6)
    Wwire: 0.55,
    Nwppc: 1,

    // --- Rotor: sincap kafesi ---
    // Ölçülen rotor dış çapı 65,42 mm -> hava aralığı (66 − 65,42)/2 = 0,29 mm.
    //
    // Dokümandaki "rotor iç çapı 44 mm" iki türlü okunabiliyordu. Fotoğrafta
    // mil, paket yüzünde bile rotor çapının dörtte biri kadar; dolayısıyla
    // 44 mm mil çapı olamaz. 44 mm ÇUBUK DİBİ ÇEMBERİ olarak alındı:
    //   çubuk derinliği = (65,42 − 44)/2 = 10,71 mm  (ağız payı düşülünce 10,21)
    // Çubuk genişliği, dokümandaki Rr = 3,65 Ω'a oturacak şekilde çözüldü.
    Zr: 38,        // rotor çubuk sayısı
    Hbar: 10.21,   // çubuk yüksekliği
    Wbar: 1.74,    // çubuk genişliği
    W0r: 0.6,      // rotor oluk ağzı (fotoğrafta yüzey neredeyse kesintisiz)
    H0r: 0.5,
    gap: 0.29,     // ölçülen
    Drsh: 15,      // rotor sac paketi iç (mil oturma) çapı — fotoğraftan

    // --- Elektriksel besleme ---
    Vline: 200,          // hat gerilimi [V]
    connection: "delta", // "delta" | "wye"
    freq: 400,           // [Hz]

    // --- Eşdeğer devre (doküman değerleri, faz başına) ---
    Rs: 3.99, Xls: 5.42,
    Rr: 3.65, Xlr: 5.26,
    Xm: 0,     // 0 ise geometriden hesaplanır
    Pfw: 60,   // sürtünme + rüzgâr kaybı [W]

    // --- Üretim seçimleri ---
    Ksfill: 0.417,               // oluk bakır doluluk oranı
    windType: "yuvarlak",        // "yuvarlak" | "dikdörtgen"
    RsMode: "manual",            // "manual" (doküman) | "geometri"
    XMode: "manual",             // kaçak reaktanslar: doküman | geometri
    Dshaft: 12,                  // mil uzantı çapı (paket dışında) [mm]
    lamGrade: "M400-50A",        // silisli sac kalitesi/kalınlığı
    cageMat: "Alüminyum döküm",  // kafes malzemesi ve üretim biçimi
    Lscr: 3.5,                   // kısa devre halkası eksenel genişliği [mm]
    rotorClosed: false,          // kapalı rotor oluğu (döküm için tipik)
    bridge: 0.4,                 // kapalı olukta köprü kalınlığı [mm]
    skew: 1.0,                   // rotor eğimi [rotor oluk adımı]
    RrMode: "manual",            // "manual" (doküman) | "geometri"
    skinEffect: true,            // derin çubuk / deri etkisi
    Trot: 120,                   // rotor sıcaklığı [°C]

    speed: 5600,   // çalışma devri [d/dk]
    Twind: 100,
    Tmag: 80,

    // SPM alanları (tip değiştirilirse kullanılır)
    Hmag: 4.0, alpha_m: 0.82, Irms: 18,

    // --- Etiket değerleri (karşılaştırma paneli için) ---
    plate: {
      Pout: 1500, speed: 5600, T: 2.6, Tstart: 4.0,
      I: 4.4, Ilr: 15.8, eta: 0.78, pf: 0.72, nsync: 6000, Aslot: 17.155,
      // Ölçülen dış çap; dokümandaki 91 mm yerine
      Dext: 92.23, Drot: 65.42,
    },
  };
}

/**
 * Optimize edilmiş tasarım — aynı gövde (Ø91 × 58 mm), aynı besleme
 * (200 V üçgen, 400 Hz, 8 kutup) ve aynı görev (1,5 kW / 2,6 N·m) altında
 * kısıtlı arama ile bulunmuştur.
 *
 * Kısıtlar: Bdiş ≤ 1,70 · Bboyunduruk ≤ 1,50 · Brotor dişi ≤ 1,60 T,
 * kalkış momenti ≥ 4,0 N·m, devrilme payı ≥ 2,2×, J ≤ 12 A/mm²,
 * güç faktörü ≥ 0,70, hava aralığı ≥ 0,25 mm, diş ≥ 1,5 mm,
 * oluk ağzı ≥ 1,2 mm, oluk kombinasyonu kurallarından geçmeli.
 *
 * Arama yöntemi ve kısıtlar: test/motor.test.mjs içinde doğrulanır.
 */
export function optimisedDesign() {
  return {
    ...defaultDesign(),
    name: "SCIM-optimize-400Hz",

    // Gövde ve besleme değişmedi
    Rext: 46.115, L1: 58, Vline: 200, connection: "delta", freq: 400, p: 4,
    Zs: 48, Nlayer: 2, Npcp: 1, coil_pitch: 6,

    // Geometri — arama sonucu
    ...OPT_GEOM,

    // Üretim seçimleri
    Kf1: 0.92,
    lamGrade: "HF-10X",
    cageMat: "Bakır çubuk",
    windType: "dikdörtgen",
    Ksfill: 0.62,
    RsMode: "geometri",
    RrMode: "geometri",
    XMode: "geometri",
    skinEffect: true,
    rotorClosed: false,
    skew: 1.0,
    Dshaft: 24,

    // Etiket karşılaştırması aynı hedeflerle yapılır
    plate: defaultDesign().plate,
  };
}

/** Kalıcı mıknatıslı örnek tasarım (12 oluk / 10 kutup). */
export function defaultSPM() {
  return {
    type: "spm",
    name: "SPM-12s10p",

    // --- Stator laminasyonu (LamSlotWind) --- [mm]
    Rext: 75,      // dış yarıçap
    Rint: 45,      // delik (bore) yarıçapı
    L1: 60,        // paket boyu
    Kf1: 0.95,     // istifleme faktörü

    // --- Oluk (SlotW11), sabit diş genişliği modu ---
    Zs: 12,        // oluk sayısı
    W0: 2.6,       // oluk ağzı genişliği
    H0: 1.0,       // oluk ağzı yüksekliği
    H1: 1.2,       // geçiş (kama) yüksekliği
    H2: 16,        // oluk gövde derinliği
    W3: 13.2,      // diş genişliği (sabit)
    R1: 1.5,       // oluk dibi yarıçapı

    // --- Sargı (Winding) ---
    p: 5,          // kutup çifti
    qs: 3,         // faz sayısı
    Ntcoil: 16,    // bobin başına sarım
    Npcp: 1,       // faz başına paralel kol
    Nlayer: 2,     // oluktaki katman sayısı
    coil_pitch: 1, // bobin adımı [oluk]
    Wwire: 0.95,   // tel çapı (yalıtımsız) [mm]
    Nwppc: 4,      // paralel tel sayısı

    // --- Rotor (LamSlotMag + SlotM11, gömme yüzey mıknatıs) ---
    gap: 1.0,      // hava aralığı [mm]
    Hmag: 4.0,     // mıknatıs kalınlığı [mm]
    alpha_m: 0.82, // mıknatıs kutup kaplama oranı [0..1]
    Drsh: 24,      // mil çapı [mm]

    // --- Çalışma noktası ---
    speed: 3000,   // devir [rpm]
    Irms: 18,      // faz akımı [A rms]
    Twind: 100,    // sargı sıcaklığı [°C]
    Tmag: 80,      // mıknatıs sıcaklığı [°C]
  };
}

/* ------------------------------------------------------------------ *
 * Yardımcılar
 * ------------------------------------------------------------------ */
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ *
 * Geometri — türetilmiş boyutlar
 * ------------------------------------------------------------------ */
export function geometry(d) {
  const r0 = d.Rint;                 // delik
  const r1 = r0 + d.H0;              // ağız üstü
  const r2 = r1 + d.H1;              // gövde başlangıcı
  const r3 = r2 + d.H2;              // oluk dibi
  const hy = d.Rext - r3;            // boyunduruk kalınlığı

  // Sabit diş genişliğinde, r yarıçapında oluğun teğetsel yarı genişliği
  const halfWidth = (r) => Math.max(0, (TAU * r) / d.Zs - d.W3) / 2;

  const W1 = 2 * halfWidth(r2);      // oluk üst genişliği
  const W2 = 2 * halfWidth(r3);      // oluk dip genişliği
  const tau_s = (TAU * r0) / d.Zs;   // delikte oluk adımı
  const tau_p = (Math.PI * r0) / d.p; // kutup adımı (delikte)

  // Oluk alanı (yamuk gövde, dip yuvarlaması düşülmüş)
  const A_slot = ((W1 + W2) / 2) * d.H2 - (2 - Math.PI / 2) * d.R1 * d.R1;

  const Rr = r0 - d.gap;             // rotor laminasyon dış yarıçapı
  const Rm_in = Rr - d.Hmag;         // mıknatıs iç yarıçapı (gömme)
  const Rsh = d.Drsh / 2;
  const Wmag_rad = (d.alpha_m * Math.PI) / d.p; // mıknatıs açısal genişliği [rad]

  return { r0, r1, r2, r3, hy, W1, W2, W3: d.W3, tau_s, tau_p,
           A_slot, halfWidth, Rr, Rm_in, Rsh, Wmag_rad };
}

/* ------------------------------------------------------------------ *
 * Sargı — yıldız diyagramı (star of slots) ile faz dağılımı
 * ------------------------------------------------------------------ */
const SECTORS = [
  { ph: 0, s: +1 }, { ph: 2, s: -1 }, { ph: 1, s: +1 },
  { ph: 0, s: -1 }, { ph: 2, s: +1 }, { ph: 1, s: -1 },
];

export function winding(d) {
  const { Zs, p, Nlayer, coil_pitch: y, Ntcoil } = d;

  // Üst katman: her oluğun elektriksel açısına göre 60°'lik sektör ataması
  const top = [];
  for (let k = 0; k < Zs; k++) {
    let th = ((k * TAU * p) / Zs) % TAU;
    if (th < 0) th += TAU;
    // sektör sınırındaki oluğu bir sonraki sektöre iterek yuvarlama
    // hatasını engelle
    const idx = Math.floor((th + 1e-9) / (Math.PI / 3)) % 6;
    top.push(SECTORS[idx]);
  }

  // Alt katman: k oluğundaki dönüş iletkeni, (k - y) oluğunun bobininden gelir
  const bot = [];
  for (let k = 0; k < Zs; k++) {
    if (Nlayer < 2) { bot.push(null); continue; }
    const src = top[(((k - y) % Zs) + Zs) % Zs];
    bot.push({ ph: src.ph, s: -src.s });
  }

  // Faz başına oluk başına işaretli iletken sayısı
  const conductors = PHASES.map((_, ph) => {
    const a = new Array(Zs).fill(0);
    for (let k = 0; k < Zs; k++) {
      const layers = Nlayer >= 2 ? [top[k], bot[k]] : [top[k]];
      for (const L of layers) if (L && L.ph === ph) a[k] += L.s;
    }
    return a;
  });

  // Sargı faktörü: kw_n = |Σ a_k e^{-j n p θ_k}| / Σ|a_k|
  const kwOf = (n) => {
    const a = conductors[0];
    let re = 0, im = 0, abs = 0;
    for (let k = 0; k < Zs; k++) {
      const ang = (n * p * TAU * k) / Zs;
      re += a[k] * Math.cos(ang);
      im -= a[k] * Math.sin(ang);
      abs += Math.abs(a[k]);
    }
    return abs === 0 ? 0 : Math.hypot(re, im) / abs;
  };

  const harmonics = [1, 3, 5, 7, 9, 11, 13].map((n) => ({ n, kw: kwOf(n) }));
  const kw1 = kwOf(1);

  // Faz başına seri sarım sayısı
  const Nph = (Zs * Ntcoil * Nlayer) / (2 * d.qs * d.Npcp);

  // --- Oluk/kutup kombinasyonu kalite göstergeleri ---
  const poles = 2 * p;
  const q = Zs / (d.qs * poles);                 // oluk/kutup/faz
  const t = gcd(Zs, p);                          // makine periyodikliği
  const cogPeriod = lcm(Zs, poles);              // vuruntu periyodu (yüksek = iyi)
  const balanced = Number.isInteger(Zs / (gcd(Zs, p) * d.qs));
  const symmetric = gcd(Zs, poles) % 2 === 0;    // tek ise dengesiz manyetik çekme

  return { top, bot, conductors, kw1, harmonics, Nph,
           q, t, cogPeriod, balanced, symmetric, poles };
}

/* ------------------------------------------------------------------ *
 * Manyetik devre + performans
 * ------------------------------------------------------------------ */
export function analyse(d) {
  const g = geometry(d);
  const w = winding(d);
  const M = MATERIALS;

  // metreye çevir
  const mm = 1e-3;
  const L1 = d.L1 * mm, gap = d.gap * mm, hm = d.Hmag * mm;
  const tau_s = g.tau_s * mm, tau_p = g.tau_p * mm, W0 = d.W0 * mm;

  // --- Carter katsayısı (oluk ağzının etkin hava aralığını artırması) ---
  const gp = gap + hm / M.magnet.mur_lin;           // manyetik hava aralığı
  const u = W0 / (2 * gp);
  const gamma = (4 / Math.PI) * (u * Math.atan(u) - Math.log(Math.sqrt(1 + u * u)));
  const kc = tau_s / Math.max(1e-9, tau_s - gamma * gp);

  // --- Sıcaklığa göre remanans ---
  const Brm = M.magnet.Brm20 * (1 + M.magnet.alpha_Br * (d.Tmag - 20));

  // --- Hava aralığı akı yoğunluğu (yüzey mıknatıs, kaçak düzeltmeli) ---
  const k_leak = 0.95;
  const Bg = (k_leak * Brm * hm) / (hm + M.magnet.mur_lin * kc * gap);
  const Bg1 = (4 / Math.PI) * Bg * Math.sin((d.alpha_m * Math.PI) / 2); // temel bileşen

  // --- Akı ---
  const Phi1 = (2 / Math.PI) * Bg1 * tau_p * L1;      // temel, kutup başına (tepe)
  const Phi_pole = Bg * d.alpha_m * tau_p * L1;       // gerçek kutup akısı

  // --- Doyma kontrolü ---
  const Bt = (Bg * tau_s) / (d.W3 * mm * d.Kf1);                 // diş
  const By = Phi_pole / (2 * g.hy * mm * L1 * d.Kf1);            // boyunduruk
  const Bry = Phi_pole / (2 * (g.Rm_in - g.Rsh) * mm * L1 * d.Kf1); // rotor boyunduruğu

  // --- Elektriksel ---
  const f = (d.p * d.speed) / 60;
  const omega = TAU * f;
  const omega_m = (TAU * d.speed) / 60;
  const lambda_m = w.kw1 * w.Nph * Phi1;              // faz akı bağı (tepe)
  const Erms = (omega * lambda_m) / Math.SQRT2;
  const Ke = lambda_m * d.p;                          // Nm/A ve Vs/rad

  const Ipk = Math.SQRT2 * d.Irms;
  const T = 1.5 * d.p * lambda_m * Ipk;               // Id=0 kontrolü
  const Pmech = T * omega_m;

  // --- İletken / doluluk ---
  const A_wire = (Math.PI * (d.Wwire * mm) ** 2) / 4 * d.Nwppc;   // m^2
  const A_cu_slot = A_wire * d.Ntcoil * d.Nlayer;
  const fill = A_cu_slot / (g.A_slot * mm * mm);
  const J = d.Irms / (A_wire * 1e6);                  // A/mm^2

  // --- Direnç ve kayıplar ---
  const rho_cu = M.copper.rho20 * (1 + M.copper.alpha * (d.Twind - 20));
  const Lend = 1.2 * d.coil_pitch * tau_s + 0.02;     // bobin başı uzunluğu [m]
  const Lturn = 2 * (L1 + Lend);
  const Rph = (rho_cu * w.Nph * Lturn) / A_wire;
  const Pcu = 3 * d.Irms * d.Irms * Rph;

  // --- Demir kaybı (Steinmetz benzeri ölçekleme) ---
  const vol = (rOut, rIn) => Math.PI * (rOut ** 2 - rIn ** 2) * L1;
  const V_yoke = vol(d.Rext * mm, g.r3 * mm) * d.Kf1;
  const V_teeth = (d.Zs * d.W3 * mm * (d.H1 + d.H2) * mm * L1) * d.Kf1;
  const m_yoke = V_yoke * M.steel.rho;
  const m_teeth = V_teeth * M.steel.rho;
  const specLoss = (B) => M.steel.p15 * (B / 1.5) ** 2 * (f / 50) ** 1.5;
  const Pfe = specLoss(By) * m_yoke + specLoss(Bt) * m_teeth;

  const Ploss = Pcu + Pfe;
  const eta = Pmech > 0 ? Pmech / (Pmech + Ploss) : 0;

  // --- Kütleler ---
  const V_cu = 3 * w.Nph * d.Npcp * Lturn * A_wire;
  const V_mag = d.alpha_m * Math.PI * ((g.Rr * mm) ** 2 - (g.Rm_in * mm) ** 2) * L1;
  const V_rotor = vol(g.Rm_in * mm, g.Rsh * mm) * d.Kf1;
  const mass = {
    steel: (m_yoke + m_teeth) + V_rotor * M.steel.rho,
    copper: V_cu * M.copper.rho,
    magnet: V_mag * M.magnet.rho,
  };
  mass.total = mass.steel + mass.copper + mass.magnet;

  return {
    geom: g, wind: w,
    kc, gamma, Brm, Bg, Bg1, Phi1, Phi_pole,
    Bt, By, Bry,
    f, Erms, Ke, T, Pmech, omega_m,
    fill, J, Rph, Pcu, Pfe, Ploss, eta,
    mass, Lturn, A_wire,
    torqueDensity: mass.total > 0 ? T / mass.total : 0,
  };
}

/* ================================================================== *
 * SİNCAP KAFESLİ ASENKRON MAKİNE (SCIM)
 * ================================================================== */

/** Rotor kafes geometrisi. */
export function cageGeometry(d) {
  const Rr = d.Rint - d.gap;         // rotor dış yarıçapı
  const rb1 = Rr - d.H0r;            // çubuk üstü
  const rb0 = rb1 - d.Hbar;          // çubuk dibi
  const Rsh = d.Drsh / 2;
  const hyr = rb0 - Rsh;             // rotor boyunduruğu
  const tau_r = (TAU * Rr) / d.Zr;   // rotor oluk adımı
  const A_bar = d.Hbar * d.Wbar;     // çubuk kesiti [mm^2]
  // rotor dişi (çubuklar arası) ortalama genişliği
  const W3r = (TAU * ((rb0 + rb1) / 2)) / d.Zr - d.Wbar;
  return { Rr, rb0, rb1, Rsh, hyr, tau_r, A_bar, W3r };
}

/* ------------------------------------------------------------------ *
 * Üretim seçimleri: sac, kafes, oluk kombinasyonu
 * ------------------------------------------------------------------ */

export const lamOf = (d) => LAMINATIONS[d.lamGrade] ?? LAMINATIONS["M400-50A"];

const MU0 = 4e-7 * Math.PI;

/**
 * B–H eğrisinden manyetik alan şiddeti. Eğrinin üstünde kalan B için
 * doyma sonrası eğim μ0 alınarak dışdeğerleme yapılır.
 */
export function Hof(lam, B) {
  const bh = lam.bh;
  const b = Math.abs(B);
  if (b <= bh[0][1]) return (b / Math.max(1e-9, bh[0][1])) * bh[0][0];
  for (let i = 1; i < bh.length; i++) {
    if (b <= bh[i][1]) {
      const [h0, b0] = bh[i - 1], [h1, b1] = bh[i];
      return h0 + ((b - b0) / Math.max(1e-9, b1 - b0)) * (h1 - h0);
    }
  }
  const [hL, bL] = bh[bh.length - 1];
  return hL + (b - bL) / MU0;                 // doyma sonrası: hava gibi
}

/**
 * Özgül demir kaybı [W/kg] — ÖLÇÜLEN yüzeyden.
 * B içinde doğrusal, frekans içinde log-log ara değerleme yapılır
 * (kayıp frekansla üstel artar). Veri yoksa Steinmetz'e düşer.
 */
export function specificLoss(lam, B, f) {
  if (!lam.loss) {
    // yedek: p15 varsayımı ile Steinmetz
    const p15 = lam.p15 ?? 4.0;
    return p15 * (B / 1.5) ** 2 * (f / 50) ** 1.5;
  }
  const atF = (fq) => {
    const pts = lam.loss[fq];
    const b = Math.abs(B);
    if (b <= pts[0][0]) return (pts[0][1] * b * b) / Math.max(1e-9, pts[0][0] ** 2);
    for (let i = 1; i < pts.length; i++)
      if (b <= pts[i][0]) {
        const [b0, p0] = pts[i - 1], [b1, p1] = pts[i];
        return p0 + ((b - b0) / (b1 - b0)) * (p1 - p0);
      }
    // B aralığın üstünde: son iki noktadan üstel dışdeğerleme
    const [b0, p0] = pts[pts.length - 2], [b1, p1] = pts[pts.length - 1];
    const n = Math.log(p1 / p0) / Math.log(b1 / b0);
    return p1 * (Math.abs(B) / b1) ** n;
  };

  const fs = Object.keys(lam.loss).map(Number).sort((a, b) => a - b);
  if (f <= fs[0]) return atF(fs[0]) * (f / fs[0]) ** 1.6;
  for (let i = 1; i < fs.length; i++)
    if (f <= fs[i]) {
      const f0 = fs[i - 1], f1 = fs[i];
      const p0 = atF(f0), p1 = atF(f1);
      const t = Math.log(f / f0) / Math.log(f1 / f0);
      return p0 * (p1 / p0) ** t;             // log-log ara değerleme
    }
  const fA = fs[fs.length - 2], fB = fs[fs.length - 1];
  const n = Math.log(atF(fB) / atF(fA)) / Math.log(fB / fA);
  return atF(fB) * (f / fB) ** n;
}
export const cageOf = (d) =>
  CAGE_MATERIALS[d.cageMat] ?? CAGE_MATERIALS["Alüminyum döküm"];

/**
 * Sac paketi: kaç lamina gerekiyor.
 * Aktif paket boyu L1, istifleme faktörü Kf1 ile net demir demektir;
 * lamina sayısı bu net demirin sac kalınlığına bölümüdür.
 */
export function stack(d) {
  const lam = lamOf(d);
  const n = Math.round((d.L1 * d.Kf1) / lam.t);
  return {
    grade: d.lamGrade, thickness: lam.t, count: n,
    Kf_typ: lam.Kf,                       // o kalınlık için tipik istifleme
    grossLength: n * lam.t / d.Kf1,       // yalıtımla birlikte fiziksel boy
  };
}

/**
 * Demir kaybı — histerezis ve girdap bileşenleri ayrı.
 *   P = kh·f·B²  +  ke·(f·B)²
 * Girdap terimi sac kalınlığının karesiyle orantılıdır; katalog p15
 * değeri zaten o kalınlığa ait olduğu için ayrıca ölçeklenmez.
 */
export function ironLoss(d, B_tooth, B_yoke, m_tooth, m_yoke) {
  const lam = lamOf(d);
  const f = d.freq ?? 50;
  const pT = specificLoss(lam, B_tooth, f);
  const pY = specificLoss(lam, B_yoke, f);
  const teeth = pT * m_tooth, yoke = pY * m_yoke;

  // Bileşen ayrımı yalnızca gösterim içindir: ölçülen toplam, aynı noktadaki
  // düşük frekans davranışından çıkarılan histerezis payına göre bölünür.
  const pT50 = specificLoss(lam, B_tooth, 50), pY50 = specificLoss(lam, B_yoke, 50);
  const hystShare = (p50, p, fq) => Math.min(1, Math.max(0, (p50 * (fq / 50)) / Math.max(1e-9, p)));
  const hT = hystShare(pT50, pT, f), hY = hystShare(pY50, pY, f);
  const Ph = teeth * hT + yoke * hY;

  return {
    Ph, Pe: teeth + yoke - Ph, total: teeth + yoke,
    teeth, yoke, pT, pY, lam,
    measured: !!lam.loss,
  };
}

/**
 * Doyma faktörü — B–H eğrisinden manyeto-motor kuvvet dengesiyle.
 *
 * Bir kutup çifti boyunca akı yolu: 2 hava aralığı, 2 stator dişi,
 * 2 rotor dişi, 1 stator boyunduruğu, 1 rotor boyunduruğu.
 *
 *   ksat = ΣF / (2·F_hava)
 *
 * Boyunduruklarda B yol boyunca değiştiği için H·L değeri cY katsayısıyla
 * düzeltilir (yayınlarda 0,3–0,5; burada 0,4).
 *
 * Bu, daha önce sabit 1,3 olarak VARSAYILAN değerin yerini alır.
 */
export function saturationFactor(d, flux, kc) {
  const mm = 1e-3, lam = lamOf(d), cY = 0.4;
  const g = geometry(d), c = cageGeometry(d);
  const H = (B) => Hof(lam, B);

  const F_gap = (flux.Bg * kc * d.gap * mm) / MU0;
  const F_ts = H(flux.Bt) * (d.H0 + d.H1 + d.H2) * mm;
  const F_tr = H(flux.Btr) * (d.Hbar + d.H0r) * mm;

  // boyunduruk yol uzunlukları: ortalama yarıçapta kutup başına yay
  const L_ys = (Math.PI * ((d.Rext + g.r3) / 2) * mm) / (2 * d.p);
  const L_yr = (Math.PI * ((c.rb0 + c.Rsh) / 2) * mm) / (2 * d.p);
  const F_ys = cY * H(flux.By) * L_ys;
  const F_yr = cY * H(flux.Byr) * L_yr;

  const F_iron = 2 * F_ts + 2 * F_tr + F_ys + F_yr;
  const ksat = F_gap > 1e-9 ? (2 * F_gap + F_iron) / (2 * F_gap) : 1;
  return { ksat: Math.max(1, Math.min(4, ksat)),
           F_gap, F_ts, F_tr, F_ys, F_yr, F_iron };
}

/**
 * Kafes direncinin geometriden hesabı, statora indirgenmiş.
 *   Rbe = Rçubuk + 2·Rhalka / (4 sin²(πp/Zr))
 *   Rr' = 4·m·(kw·Nph)² / Zr · Rbe
 */
export function cageResistance(d, w) {
  const mm = 1e-3, mat = cageOf(d), c = cageGeometry(d);
  const rho = mat.rho20 * (1 + mat.alpha * (d.Trot - 20));

  const Abar = c.A_bar * mm * mm;
  const Rbar = (rho * d.L1 * mm) / Math.max(1e-12, Abar);

  const Der = (c.rb0 + c.rb1) * mm;              // ortalama halka çapı
  const Aer = d.Hbar * d.Lscr * mm * mm;         // halka kesiti
  const Rer = (rho * Math.PI * Der) / Math.max(1e-12, d.Zr * Aer);

  const s2 = Math.sin((Math.PI * d.p) / d.Zr) ** 2;
  const Rring = (2 * Rer) / Math.max(1e-9, 4 * s2);
  const Rbe = Rbar + Rring;
  const K = ((4 * d.qs * (w.kw1 * w.Nph) ** 2) / d.Zr) * mat.joint;

  // Deri etkisi yalnızca oluk içindeki çubuğa uygulanır; kısa devre
  // halkası oluk dışındadır ve akımı kesitine düzgün yayılır.
  return {
    Rr: K * Rbe, Rbar, Rer, Rbe, rho, mat,
    RrBar: K * Rbar, RrRing: K * Rring,
    barShare: Rbe > 0 ? Rbar / Rbe : 1,
  };
}

/**
 * Stator faz direnci — oluk alanı, doluluk oranı ve bobin başı boyundan.
 * Bobin başı uzunluğu 1,15 × bobin adımı × oluk adımı olarak alınır; bu
 * katsayı dokümandaki Rs = 3,99 Ω değerine %1 içinde oturur.
 */
export function statorResistance(d, w, g) {
  const mm = 1e-3;
  const Acu = (d.Ksfill * g.A_slot) / (d.Ntcoil * d.Nlayer);   // tel başına [mm²]
  const Lend = 1.15 * d.coil_pitch * g.tau_s;                  // bobin başı [mm]
  const Lturn = 2 * (d.L1 + Lend) * mm;
  const rho = MATERIALS.copper.rho20 * (1 + MATERIALS.copper.alpha * (d.Twind - 20));
  const Rs = (rho * w.Nph * Lturn) / Math.max(1e-12, Acu * mm * mm);
  return { Rs, Acu, Lend, Lturn };
}

/**
 * Kaçak reaktanslar — oluk geçirgenliği (permeans) ve sarım sayısıyla ölçekleme.
 * Doküman değerleri referans alınır; geometri değiştikçe
 *   X ∝ Nph² · λ · L1
 * bağıntısıyla ölçeklenir. λ dikdörtgen oluk yaklaşımıdır:
 *   λ = H2/(3·W) + H1/W + H0/W0
 */
const REF = { Nph: 240, lam_s: 1.299, lam_r: 1.458, L1: 58 };

export function leakage(d, w, g, c) {
  const Wavg = Math.max(0.2, (g.W1 + g.W2) / 2);
  const lam_s = d.H2 / (3 * Wavg) + d.H1 / Wavg + d.H0 / Math.max(0.2, d.W0);
  const lam_r = d.Hbar / (3 * Math.max(0.2, d.Wbar)) + d.H0r / Math.max(0.2, d.W0r);
  if (d.XMode !== "geometri") return { Xls: d.Xls, Xlr: d.Xlr, lam_s, lam_r };
  const k = (w.Nph / REF.Nph) ** 2 * (d.L1 / REF.L1);
  return {
    Xls: d.Xls * k * (lam_s / REF.lam_s),
    Xlr: d.Xlr * k * (lam_r / REF.lam_r),
    lam_s, lam_r,
  };
}

/** Sargı tipine göre ulaşılabilir doluluk tavanı. */
export const fillCeiling = (d) => (d.windType === "dikdörtgen" ? 0.65 : 0.45);

/**
 * Derin çubuk (deri) etkisi — Field katsayıları.
 * Rotor frekansı s·f olduğundan kalkışta güçlü, nominal kaymada yok denecek
 * kadar azdır. 400 Hz'de bu ayrım büyüktür: kalkış momenti artar ama
 * nominal verim etkilenmez.
 */
export function skinFactors(d, s) {
  if (!d.skinEffect) return { kR: 1, kX: 1, xi: 0, delta: Infinity };
  const mat = cageOf(d);
  const rho = mat.rho20 * (1 + mat.alpha * (d.Trot - 20));
  const fr = Math.abs(s) * d.freq;
  if (fr < 1e-6) return { kR: 1, kX: 1, xi: 0, delta: Infinity };

  const delta = Math.sqrt(rho / (Math.PI * fr * 4e-7 * Math.PI));  // deri kalınlığı [m]
  const xi = (d.Hbar * 1e-3) / delta;
  if (xi < 0.1) return { kR: 1, kX: 1, xi, delta };

  const a = 2 * xi;
  const den = Math.cosh(a) - Math.cos(a);
  const kR = (xi * (Math.sinh(a) + Math.sin(a))) / den;
  const kX = ((3 / a) * (Math.sinh(a) - Math.sin(a))) / den;
  return { kR, kX: Math.min(1, kX), xi, delta };
}

/**
 * Stator/rotor oluk sayısı kombinasyonu kuralları.
 * Kaynak: Alger, "Induction Machines" — asalak moment ve gürültü kuralları.
 * Eğim (skew) bu etkilerin çoğunu bastırır; bu yüzden ihlaller eğim
 * uygulanmışsa uyarıya düşürülür.
 */
export function slotRules(Zs, Zr, p, skew = 0) {
  const P = 2 * p, dz = Zs - Zr, ad = Math.abs(dz);
  const soft = skew >= 0.8;
  const out = [];
  const add = (ok, level, rule, why) => out.push({ ok, level, rule, why });

  add(Zr !== Zs, "crit", "Zr ≠ Zs",
    "Eşit oluk sayısı vuruntu ve kalkışta kilitlenme yapar.");
  add(!(ad === P), "crit", `|Zs − Zr| ≠ 2p (${P})`,
    "Sıfır hızda senkron asalak moment — motor kalkamayabilir.");
  add(!(ad === p), "warn", `|Zs − Zr| ≠ p (${p})`,
    "Senkron asalak moment; hız eğrisinde çukur oluşturur.");
  add(!(ad === 1 || ad === 2), soft ? "warn" : "crit", "|Zs − Zr| ∉ {1, 2}",
    "Tek kutup çiftli radyal kuvvet — gövde titreşimi ve gürültü.");
  add(!(ad === P + 1 || ad === P - 1), "warn", `|Zs − Zr| ∉ {2p±1} (${P - 1}, ${P + 1})`,
    "Manyetik gürültü kaynağı.");
  add(!(ad === P + 2 || ad === P - 2), "warn", `|Zs − Zr| ∉ {2p±2} (${P - 2}, ${P + 2})`,
    "Düşük mertebeli radyal kuvvet dalgası — akustik gürültü.");
  add(Zr % P !== 0, "warn", `Zr, 2p'nin katı olmamalı (${P})`,
    "Kafes akımlarında dengesizlik ve asalak moment.");
  add(Zr <= 1.25 * Zs, "warn", "Zr ≤ 1,25·Zs",
    "Aşırı çubuk sayısı kaçak reaktansı büyütür, güç faktörünü düşürür.");

  const fails = out.filter((r) => !r.ok);
  return { rules: out, fails, clean: fails.length === 0 };
}

/** Verilen Zs ve p için kurallara uyan rotor oluk sayıları. */
export function goodRotorSlots(Zs, p, skew = 0, lo = 12, hi = 90) {
  const out = [];
  for (let Zr = lo; Zr <= hi; Zr++) {
    const r = slotRules(Zs, Zr, p, skew);
    if (r.clean) out.push(Zr);
  }
  return out;
}

/** Oluk ağzının etkin hava aralığını büyütmesi (Carter). */
function carter(tau, W0, g) {
  const u = W0 / (2 * g);
  const gamma = (4 / Math.PI) * (u * Math.atan(u) - Math.log(Math.sqrt(1 + u * u)));
  return tau / Math.max(1e-9, tau - gamma * g);
}

/**
 * Mıknatıslanma reaktansı — hava aralığı geometrisinden.
 * Lm = 6 μ0 L r (kw Nph)^2 / (π p^2 g_eff)
 */
export function magnetizingX(d, w, kc, ksat = 1.3) {
  const mm = 1e-3;
  const g_eff = d.gap * mm * kc * ksat;
  const Lm = (6 * 4e-7 * Math.PI * d.L1 * mm * d.Rint * mm * (w.kw1 * w.Nph) ** 2)
    / (Math.PI * d.p * d.p * Math.max(1e-9, g_eff));
  // Bozuk geometride (kw1 = 0 gibi) sıfıra düşmesini engelle: eşdeğer devre
  // sıfır mıknatıslanma reaktansıyla çözülemez.
  const X = TAU * d.freq * Lm;
  return Number.isFinite(X) && X > 1e-3 ? X : 1e-3;
}

/* Karmaşık sayı yardımcıları (küçük ve yerel) */
const C = (re, im = 0) => ({ re, im });
const cAdd = (a, b) => C(a.re + b.re, a.im + b.im);
const cMul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cDiv = (a, b) => {
  const q = b.re * b.re + b.im * b.im;
  return C((a.re * b.re + a.im * b.im) / q, (a.im * b.re - a.re * b.im) / q);
};
const cAbs = (a) => Math.hypot(a.re, a.im);

/** Faz gerilimi — üçgende hat gerilimine eşit, yıldızda √3 küçüktür. */
export const phaseVoltage = (d) =>
  d.connection === "delta" ? d.Vline : d.Vline / Math.sqrt(3);

/** Verilen kaymada eşdeğer devre çözümü. */
function solveSlip(d, Xm, s, Rr0 = d.Rr, Xlr0 = d.Xlr) {
  const V = phaseVoltage(d);
  const ws = (TAU * d.freq) / d.p;               // senkron açısal hız [rad/s]
  const sc = Math.abs(s) < 1e-6 ? 1e-6 : s;

  // Derin çubuk etkisi kaymaya bağlıdır: kalkışta direnç artar, kaçak düşer.
  // kR yalnızca oluktaki çubuk payına uygulanır (barShare); kısa devre
  // halkası oluk dışında olduğu için deri etkisine girmez.
  const { kR, kX } = skinFactors(d, s);
  const share = d._barShare ?? 1;
  const Rr = Rr0 * (share * kR + (1 - share));
  const Xlr = Xlr0 * kX;

  const Zs_ = C(d.Rs, d.Xls);
  const Zr_ = C(Rr / sc, Xlr);
  const Zm_ = C(0, Xm);
  const Zpar = cDiv(cMul(Zm_, Zr_), cAdd(Zm_, Zr_));
  const Ztot = cAdd(Zs_, Zpar);

  const I1 = V / cAbs(Ztot);
  const pf = Ztot.re / cAbs(Ztot);
  const I2 = I1 * cAbs(Zm_) / cAbs(cAdd(Zm_, Zr_));

  const Pgap = 3 * I2 * I2 * (Rr / sc);
  const T = Pgap / ws;                           // hava aralığı momenti
  const Pmech = Pgap * (1 - s);
  const Pcus = 3 * I1 * I1 * d.Rs;
  const Pcur = Pgap * s;
  const Pin = 3 * V * I1 * pf;

  const num = (x) => (Number.isFinite(x) ? x : 0);
  return {
    V, ws, Ztot, kR, kX, Rr_eff: Rr, Xlr_eff: Xlr,
    I1: num(I1), I2: num(I2), pf: num(pf), Pgap: num(Pgap), T: num(T),
    Pmech: num(Pmech), Pcus: num(Pcus), Pcur: num(Pcur), Pin: num(Pin),
  };
}

export function analyseSCIM(d) {
  const g = geometry(d);
  const c = cageGeometry(d);
  const w = winding(d);
  const M = MATERIALS;
  const mm = 1e-3;

  // Etkin hava aralığı: stator + rotor oluk ağızları.
  // Kapalı rotor oluğunda ağız yoktur, rotor Carter katsayısı 1'e iner.
  const kc_s = carter(g.tau_s, d.W0, d.gap);
  const kc_r = d.rotorClosed ? 1 : carter(c.tau_r, d.W0r, d.gap);
  const kc = kc_s * kc_r;

  // Kafes direnci: doküman değeri ya da çubuk + halka geometrisinden
  const cageR = cageResistance(d, w);
  const Rr0 = d.RrMode === "geometri" ? cageR.Rr : d.Rr;

  // Stator direnci: doküman değeri ya da oluk + doluluk geometrisinden
  const statR = statorResistance(d, w, g);
  const lk = leakage(d, w, g, c);
  const dEff = {
    ...d, Xls: lk.Xls, _barShare: cageR.barShare,
    ...(d.RsMode === "geometri" ? { Rs: statR.Rs } : {}),
  };

  // Kapalı oluk köprüsü kaçak reaktansı büyütür. Katsayı mühendislik
  // payıdır (yayınlarda +%20…40); FEA ile doğrulanmalıdır.
  const closedK = d.rotorClosed ? 1.3 : 1;
  const Xlr0 = lk.Xlr * closedK;

  const ns = (60 * d.freq) / d.p;                // senkron devir [d/dk]
  const s = (ns - d.speed) / ns;

  /** Verilen çalışma noktasından akı yoğunlukları. */
  const fluxOf = (o) => {
    const E = Math.max(1, o.V - o.I1 * (dEff.Rs * o.pf + dEff.Xls * Math.sqrt(1 - o.pf ** 2)));
    const Phi = E / (4.44 * d.freq * w.Nph * w.kw1);
    const Bg = ((Math.PI / 2) * Phi) / (g.tau_p * mm * d.L1 * mm);
    return {
      Phi, Bg,
      Bt: (Bg * g.tau_s * mm) / (d.W3 * mm * d.Kf1),
      By: Phi / (2 * g.hy * mm * d.L1 * mm * d.Kf1),
      Btr: (Bg * c.tau_r * mm) / (c.W3r * mm * d.Kf1),
      Byr: Phi / (2 * c.hyr * mm * d.L1 * mm * d.Kf1),
    };
  };

  // Doyma faktörü ile mıknatıslanma reaktansı birbirine bağlıdır:
  // Xm doymaya, doyma da akıya, akı da Xm'e. Sönümlü yineleme ile çözülür.
  let ksat = 1.0, Xm = 0, op = null, flux = null, mmf = null;
  for (let it = 0; it < 20; it++) {
    Xm = d.Xm > 0 ? d.Xm : magnetizingX(d, w, kc, ksat);
    op = solveSlip(dEff, Xm, s, Rr0, Xlr0);
    flux = fluxOf(op);
    mmf = saturationFactor(d, flux, kc);
    const diff = mmf.ksat - ksat;
    ksat += 0.7 * diff;
    if (Math.abs(diff) < 2e-4) break;
  }

  // eta aşağıda, demir kaybı hesaplandıktan sonra tamamlanır

  // --- Moment / kayma eğrisi ---
  const curve = [];
  for (let i = 0; i <= 120; i++) {
    const sv = 1 - i / 120;
    const r = solveSlip(dEff, Xm, sv, Rr0, Xlr0);
    curve.push({ s: sv, n: ns * (1 - sv), T: r.T, I: r.I1 });
  }
  const peak = curve.reduce((a, b) => (b.T > a.T ? b : a));
  const start = solveSlip(dEff, Xm, 1, Rr0, Xlr0);

  const { Phi, Bg, Bt, By, Btr, Byr } = flux;

  // --- İletken / doluluk ---
  // Tel kesiti doluluk oranından türetilir: gerçek sarımda belirleyici olan
  // oluğa ne kadar bakır sığdığıdır, tel çapı bunun sonucudur.
  const A_wire = statR.Acu * mm * mm;                 // tel başına kesit [m²]
  const fill = d.Ksfill;
  const J = op.I1 / (A_wire * 1e6);
  const Wwire_eq = 2 * Math.sqrt(statR.Acu / Math.PI); // eşdeğer yuvarlak tel çapı
  // Çubuk akımı: statordan rotora dönüşüm oranı 2·m·kw·Nph / Zr
  const Ibar = op.I2 * (2 * d.qs * w.kw1 * w.Nph) / d.Zr;
  const Jbar = Ibar / c.A_bar;                    // A/mm²

  // --- Kütleler ---
  const vol = (ro, ri) => Math.PI * (ro ** 2 - ri ** 2) * d.L1 * mm ** 3;
  const V_yoke = vol(d.Rext, g.r3) * d.Kf1;
  const V_teeth = d.Zs * d.W3 * (d.H1 + d.H2) * d.L1 * mm ** 3 * d.Kf1;
  const V_rot = (vol(c.Rr, c.Rsh) - d.Zr * c.A_bar * d.L1 * mm ** 3) * d.Kf1;
  const V_cu = 3 * w.Nph * d.Npcp * statR.Lturn * A_wire;
  const mass = {
    steel: (V_yoke + V_teeth + V_rot) * M.steel.rho,
    copper: V_cu * M.copper.rho,
    cage: d.Zr * c.A_bar * mm * mm * (d.L1 * mm) * cageOf(d).dens,
  };
  mass.total = mass.steel + mass.copper + mass.cage;

  // --- Demir kaybı: sac kalitesinin ÖLÇÜLEN kayıp yüzeyinden ---
  const lam = lamOf(d);
  const iron = ironLoss(d, Bt, By, V_teeth * lam.rho, V_yoke * lam.rho);
  const Pfe = iron.total;
  const pack = stack(d);

  // Demir kaybı eşdeğer devrede ayrı bir kol olarak modellenmediğinden
  // giriş gücüne eklenir; çıkış gücünden sürtünme + rüzgâr düşülür.
  const Pout = op.Pmech - d.Pfw;
  const Pin = op.Pin + Pfe;
  const Ploss = op.Pcus + op.Pcur + Pfe + d.Pfw;
  const eta = Pin > 0 ? Math.max(0, Pout) / Pin : 0;

  return {
    type: "scim", geom: g, cage: c, wind: w,
    kc, kc_s, kc_r, Xm, ns, s, ...op,
    Pout, Pin, Ploss, eta, Pfe, Pfw: d.Pfw,
    Phi, Bg, Bt, By, Btr, Byr,
    fill, J, Jbar, Ibar, A_wire, mass, curve,
    peakT: peak.T, peakS: peak.s, peakN: peak.n,
    Tstart: start.T, Ilr: start.I1,
    iron, pack, cageR, Rr0, Xlr0, statR, Rs0: dEff.Rs, Wwire_eq,
    ksat, mmf, lam,
    fillMax: fillCeiling(d), leak: lk,
    skinStart: skinFactors(d, 1), skinRated: skinFactors(d, s),
    slots: slotRules(d.Zs, d.Zr, d.p, d.skew),
    f: d.freq,
  };
}

/** Etiket değerleriyle karşılaştırma. */
export function nameplate(d, r) {
  const p = d.plate;
  if (!p) return [];
  // min: etiket değeri garanti edilen ALT SINIR (kalkış momenti böyledir);
  // hesabın üstünde çıkması sapma sayılmaz.
  const cmp = (n, calc, plate, u, dec = 2, min = false) => ({
    n, calc, plate, u, min,
    dev: plate ? (calc - plate) / plate : 0,
    ok: min ? calc >= plate : Math.abs((calc - plate) / plate) < 0.08,
    txt: `${calc.toFixed(dec)} / ${min ? "≥" : ""}${plate.toFixed(dec)}`,
  });
  return [
    cmp("Senkron devir", r.ns, p.nsync, "d/dk", 0),
    cmp("Nominal moment", r.T, p.T, "N·m"),
    cmp("Çıkış gücü", r.Pout, p.Pout, "W", 0),
    cmp("Faz akımı", r.I1, p.I, "A"),
    cmp("Güç faktörü", r.pf, p.pf, "", 3),
    cmp("Verim", r.eta * 100, p.eta * 100, "%", 1),
    cmp("Kalkış momenti", r.Tstart, p.Tstart, "N·m", 2, true),
    cmp("Kilitli rotor akımı", r.Ilr, p.Ilr, "A"),
    cmp("Net oluk alanı", r.geom.A_slot, p.Aslot, "mm²", 2),
  ];
}

export function checksSCIM(d, r) {
  const out = [];
  const add = (level, label, msg) => out.push({ level, label, msg });

  if (r.Bt > 2.0) add("crit", "Diş doyumu", `Stator dişi ${r.Bt.toFixed(2)} T — doymuş.`);
  else if (r.Bt > 1.8) add("warn", "Diş doyumu", `Stator dişi ${r.Bt.toFixed(2)} T — dizin noktasında.`);
  if (r.Btr > 2.0) add("crit", "Rotor dişi", `${r.Btr.toFixed(2)} T — doymuş.`);
  else if (r.Btr > 1.8) add("warn", "Rotor dişi", `${r.Btr.toFixed(2)} T — sınırda.`);
  if (r.By > 1.7) add("warn", "Stator boyunduruğu", `${r.By.toFixed(2)} T.`);
  if (r.Byr > 1.7) add("warn", "Rotor boyunduruğu", `${r.Byr.toFixed(2)} T.`);

  // Doluluk tavanı sargı tipine bağlıdır: yuvarlak tel ~%45, dikdörtgen ~%65
  const cap = fillCeiling(d);
  if (r.fill > cap)
    add("crit", "Oluk doluluğu",
      `%${(r.fill * 100).toFixed(0)} — ${d.windType} sargıda tavan %${(cap * 100).toFixed(0)}.`);
  else if (r.fill > cap - 0.05)
    add("warn", "Oluk doluluğu", `%${(r.fill * 100).toFixed(0)} — tavana yakın, sarımı zorlar.`);
  if (r.J > 12) add("crit", "Akım yoğunluğu", `${r.J.toFixed(1)} A/mm² — soğutma yetmez.`);
  else if (r.J > 7) add("warn", "Akım yoğunluğu", `${r.J.toFixed(1)} A/mm² — zorlanmış soğutma gerekir.`);

  if (r.s <= 0) add("warn", "Çalışma noktası", "Devir senkron hızın üstünde — makine generatör bölgesinde.");
  if (r.T > r.peakT) add("crit", "Devrilme", "Çalışma momenti devrilme momentini aşıyor — motor durur.");
  else if (r.T > 0.75 * r.peakT)
    add("warn", "Devrilme payı", `Devrilme momentinin %${((r.T / r.peakT) * 100).toFixed(0)}'ünde çalışıyor.`);

  // Oluk sayısı uyumu (gürültü ve asalak moment kuralları)
  const diff = Math.abs(d.Zs - d.Zr);
  if (d.Zs === d.Zr) add("crit", "Oluk uyumu", "Stator ve rotor oluk sayısı eşit — kilitlenme riski.");
  else if (diff === 2 * d.p)
    add("warn", "Oluk uyumu", `|Zs − Zr| = 2p — eşzamanlı asalak moment riski.`);
  if (gcd(d.Zs, d.Zr) > 2 * d.p)
    add("warn", "Oluk uyumu", `OBEB(${d.Zs}, ${d.Zr}) büyük — gürültü ve titreşim riski.`);

  if (!r.wind.balanced) add("crit", "Sargı dengesi", "Dengeli üç fazlı sargı oluşmuyor.");

  if (out.length === 0) add("ok", "Tasarım", "Tüm kontroller sınırlar içinde.");
  return out;
}

/* --- Tip dağıtıcıları --- */
export const analyseAny = (d) => (d.type === "scim" ? analyseSCIM(d) : analyse(d));
export const checksAny = (d, r) => (d.type === "scim" ? checksSCIM(d, r) : checks(d, r));
export const toPyleecanAny = (d) => (d.type === "scim" ? toPyleecanSCIM(d) : toPyleecan(d));

/* ------------------------------------------------------------------ *
 * Tasarım kuralları — uyarı üretimi
 * ------------------------------------------------------------------ */
export function checks(d, r) {
  const out = [];
  const add = (level, label, msg) => out.push({ level, label, msg });

  if (r.Bt > 2.0) add("crit", "Diş doyumu", `Bt = ${r.Bt.toFixed(2)} T — sac doymuş, dişi kalınlaştırın.`);
  else if (r.Bt > 1.8) add("warn", "Diş doyumu", `Bt = ${r.Bt.toFixed(2)} T — doyma dirseğinde.`);

  if (r.By > 1.8) add("crit", "Boyunduruk doyumu", `By = ${r.By.toFixed(2)} T — boyunduruğu kalınlaştırın.`);
  else if (r.By > 1.6) add("warn", "Boyunduruk doyumu", `By = ${r.By.toFixed(2)} T — sınıra yakın.`);

  if (r.fill > 0.50) add("crit", "Oluk doluluğu", `%${(r.fill * 100).toFixed(0)} — bu tel bu oluğa sığmaz.`);
  else if (r.fill > 0.42) add("warn", "Oluk doluluğu", `%${(r.fill * 100).toFixed(0)} — gelişigüzel sarım için zorlayıcı.`);

  if (r.J > 12) add("crit", "Akım yoğunluğu", `${r.J.toFixed(1)} A/mm² — sıvı soğutma olmadan mümkün değil.`);
  else if (r.J > 7) add("warn", "Akım yoğunluğu", `${r.J.toFixed(1)} A/mm² — zorlanmış soğutma gerekir.`);

  if (!r.wind.balanced)
    add("crit", "Sargı dengesi", `${d.Zs} oluk / ${r.wind.poles} kutup dengeli 3 fazlı sargı vermez.`);
  if (!r.wind.symmetric)
    add("warn", "Manyetik simetri", `OBEB(${d.Zs}, ${r.wind.poles}) tek — dengesiz manyetik çekme ve titreşim riski.`);
  if (r.wind.kw1 < 0.80)
    add("warn", "Sargı faktörü", `kw₁ = ${r.wind.kw1.toFixed(3)} — düşük, moment üretimi zayıf.`);

  if (r.geom.hy <= 0.5) add("crit", "Boyunduruk", "Oluk derinliği statoru yiyor — boyunduruk kalmadı.");
  if (r.geom.W1 <= 0.1) add("crit", "Diş genişliği", "Diş genişliği oluk adımını aşıyor — oluk kapandı.");
  if (r.geom.Rm_in <= r.geom.Rsh) add("crit", "Rotor", "Mıknatıslar mile giriyor.");
  if (d.W0 >= r.geom.W1 && r.geom.W1 > 0.1)
    add("warn", "Oluk ağzı", "Oluk ağzı gövdeden geniş — profil tutarsız.");

  if (out.length === 0) add("ok", "Tasarım", "Tüm kontroller sınırlar içinde.");
  return out;
}

/* ------------------------------------------------------------------ *
 * Pyleecan JSON export
 * ------------------------------------------------------------------ */
const mat = (m, extra = {}) => ({
  __class__: "Material",
  name: m.name,
  is_isotropic: true,
  elec: { __class__: "MatElectrical", rho: m.rho_elec ?? 1e12, alpha: m.alpha ?? 0 },
  mag: { __class__: "MatMagnetics", mur_lin: m.mur_lin ?? 1, Brm20: m.Brm20 ?? 0,
         alpha_Br: m.alpha_Br ?? 0, Wlam: m.Wlam ?? 0, ...extra },
  struct: { __class__: "MatStructural", rho: m.rho },
});

export function toPyleecan(d) {
  const g = geometry(d);
  const m = 1e-3;
  const steel = mat(MATERIALS.steel);
  const magnet = mat(MATERIALS.magnet);

  return {
    __class__: "MachineSIPMSM",
    name: d.name,
    desc: "Irregular-Verb-Quiz motor atölyesi tarafından üretildi",
    type_machine: 7,
    stator: {
      __class__: "LamSlotWind",
      Rint: d.Rint * m, Rext: d.Rext * m, L1: d.L1 * m, Kf1: d.Kf1,
      is_internal: false, is_stator: true,
      Nrvd: 0, Wrvd: 0,
      mat_type: steel,
      slot: {
        __class__: "SlotW11",
        Zs: d.Zs,
        W0: d.W0 * m, H0: d.H0 * m,
        H1: d.H1 * m, H1_is_rad: false,
        W1: g.W1 * m, H2: d.H2 * m, W2: g.W2 * m,
        is_cstt_tooth: true, W3: d.W3 * m,
        R1: d.R1 * m,
      },
      winding: {
        __class__: "Winding",
        qs: d.qs, p: d.p,
        Ntcoil: d.Ntcoil, Npcp: d.Npcp, Nlayer: d.Nlayer,
        coil_pitch: d.coil_pitch,
        type_connection: 0, is_wye: true,
        is_reverse_wind: false, Nslot_shift_wind: 0,
        conductor: {
          __class__: "CondType12",
          Wwire: d.Wwire * m,
          Wins_wire: 0.05 * m,
          Wins_cond: (d.Wwire + 0.1) * m,
          Nwppc: d.Nwppc,
          cond_mat: mat(MATERIALS.copper),
          ins_mat: mat(MATERIALS.insulation),
        },
      },
    },
    rotor: {
      __class__: "LamSlotMag",
      Rint: g.Rsh * m, Rext: g.Rr * m, L1: d.L1 * m, Kf1: d.Kf1,
      is_internal: true, is_stator: false,
      Nrvd: 0, Wrvd: 0,
      mat_type: steel,
      slot: {
        __class__: "SlotM11",
        Zs: 2 * d.p,
        W0: g.Wmag_rad, H0: 0,
        W1: g.Wmag_rad, H1: d.Hmag * m,
      },
      magnet: {
        __class__: "Magnet",
        mat_type: magnet,
        type_magnetization: 0,
        Lmag: d.L1 * m,
        Nseg: 1,
      },
    },
    shaft: {
      __class__: "Shaft",
      Lshaft: (d.L1 + 40) * m,
      Drsh: d.Drsh * m,
      mat_type: mat(MATERIALS.shaft),
    },
    frame: null,
  };
}

/**
 * Sincap kafesli asenkron makine dışa aktarımı.
 * Kafes, pyleecan'in yerleşik gösterimiyle verilir: her çubuk kendi fazı
 * (qs = çubuk sayısı), tek sarım, dikdörtgen iletken (CondType21).
 */
export function toPyleecanSCIM(d) {
  const g = geometry(d);
  const c = cageGeometry(d);
  const m = 1e-3;
  const steel = mat(MATERIALS.steel);

  return {
    __class__: "MachineSCIM",
    name: d.name,
    desc: "Motor Tasarım Atölyesi tarafından üretildi",
    type_machine: 1,
    stator: {
      __class__: "LamSlotWind",
      Rint: d.Rint * m, Rext: d.Rext * m, L1: d.L1 * m, Kf1: d.Kf1,
      is_internal: false, is_stator: true, Nrvd: 0, Wrvd: 0,
      mat_type: steel,
      slot: {
        __class__: "SlotW11",
        Zs: d.Zs, W0: d.W0 * m, H0: d.H0 * m,
        H1: d.H1 * m, H1_is_rad: false,
        W1: g.W1 * m, H2: d.H2 * m, W2: g.W2 * m,
        is_cstt_tooth: true, W3: d.W3 * m, R1: d.R1 * m,
      },
      winding: {
        __class__: "Winding",
        qs: d.qs, p: d.p, Ntcoil: d.Ntcoil, Npcp: d.Npcp,
        Nlayer: d.Nlayer, coil_pitch: d.coil_pitch,
        type_connection: d.connection === "delta" ? 1 : 0,
        is_wye: d.connection !== "delta",
        is_reverse_wind: false, Nslot_shift_wind: 0,
        conductor: {
          __class__: "CondType12",
          Wwire: d.Wwire * m, Wins_wire: 0.03 * m,
          Wins_cond: (d.Wwire + 0.06) * m, Nwppc: d.Nwppc,
          cond_mat: mat(MATERIALS.copper),
          ins_mat: mat(MATERIALS.insulation),
        },
      },
    },
    rotor: {
      __class__: "LamSquirrelCage",
      Rint: c.Rsh * m, Rext: c.Rr * m, L1: d.L1 * m, Kf1: d.Kf1,
      is_internal: true, is_stator: false, Nrvd: 0, Wrvd: 0,
      mat_type: steel,
      Hscr: d.Hbar * m,
      Lscr: (2 * d.Wbar) * m,
      ring_mat: mat(MATERIALS.aluminium),
      slot: {
        __class__: "SlotW21",
        Zs: d.Zr, W0: d.W0r * m, H0: d.H0r * m,
        H1: 0, H1_is_rad: false,
        W1: d.Wbar * m, H2: d.Hbar * m, W2: d.Wbar * 0.7 * m,
      },
      winding: {
        __class__: "Winding",
        qs: d.Zr, p: d.p, Ntcoil: 1, Npcp: 1,
        Nlayer: 1, coil_pitch: 0,
        type_connection: -1, is_wye: false,
        is_reverse_wind: false, Nslot_shift_wind: 0,
        conductor: {
          __class__: "CondType21",
          Hbar: d.Hbar * m, Wbar: d.Wbar * m, Wins: 0,
          cond_mat: mat(MATERIALS.aluminium),
          ins_mat: mat(MATERIALS.insulation),
        },
      },
    },
    shaft: {
      __class__: "Shaft",
      Lshaft: (d.L1 + 40) * m, Drsh: d.Drsh * m,
      mat_type: mat(MATERIALS.shaft),
    },
    frame: null,
  };
}
