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

/* ------------------------------------------------------------------ *
 * Varsayılan tasarım — 400 Hz havacılık tipi sincap kafesli asenkron motor
 *
 * Değerler kullanıcının elindeki motor dokümanından alınmıştır. Bağlantı
 * biçimi dokümanda yazmıyordu; eşdeğer devre parametreleri ile etiket
 * başarımı yalnızca ÜÇGEN bağlantıda (faz gerilimi 200 V) örtüşüyor —
 * bkz. test/motor.test.mjs içindeki etiket doğrulaması.
 * ------------------------------------------------------------------ */
export function defaultDesign() {
  return {
    type: "scim",
    name: "SCIM-48s38r-400Hz",

    // --- Stator laminasyonu ---
    Rext: 45.5,    // 91 mm dış çap
    Rint: 33.0,    // 66 mm delik çapı
    L1: 58,        // aktif paket
    Kf1: 0.95,

    // --- Stator oluğu ---
    Zs: 48,
    // Oluk profili dokümandaki net oluk alanına (17,155 mm²) oturtulmuştur.
    W0: 1.8, H0: 0.6, H1: 0.8, H2: 6.0,
    W3: 2.0,       // diş genişliği
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
    Zr: 38,        // rotor çubuk sayısı
    Hbar: 7.0,     // çubuk yüksekliği
    Wbar: 2.8,     // çubuk genişliği
    W0r: 0.8,      // rotor oluk ağzı
    H0r: 0.5,
    gap: 0.30,     // hava aralığı
    Drsh: 44,      // mil / rotor iç çapı

    // --- Elektriksel besleme ---
    Vline: 200,          // hat gerilimi [V]
    connection: "delta", // "delta" | "wye"
    freq: 400,           // [Hz]

    // --- Eşdeğer devre (doküman değerleri, faz başına) ---
    Rs: 3.99, Xls: 5.42,
    Rr: 3.65, Xlr: 5.26,
    Xm: 0,     // 0 ise geometriden hesaplanır
    Pfw: 60,   // sürtünme + rüzgâr kaybı [W]

    speed: 5600,   // çalışma devri [d/dk]
    Twind: 100,
    Tmag: 80,

    // SPM alanları (tip değiştirilirse kullanılır)
    Hmag: 4.0, alpha_m: 0.82, Irms: 18,

    // --- Etiket değerleri (karşılaştırma paneli için) ---
    plate: {
      Pout: 1500, speed: 5600, T: 2.6, Tstart: 4.0,
      I: 4.4, Ilr: 15.8, eta: 0.78, pf: 0.72, nsync: 6000, Aslot: 17.155,
    },
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
function solveSlip(d, Xm, s) {
  const V = phaseVoltage(d);
  const ws = (TAU * d.freq) / d.p;               // senkron açısal hız [rad/s]
  const sc = Math.abs(s) < 1e-6 ? 1e-6 : s;

  const Zs_ = C(d.Rs, d.Xls);
  const Zr_ = C(d.Rr / sc, d.Xlr);
  const Zm_ = C(0, Xm);
  const Zpar = cDiv(cMul(Zm_, Zr_), cAdd(Zm_, Zr_));
  const Ztot = cAdd(Zs_, Zpar);

  const I1 = V / cAbs(Ztot);
  const pf = Ztot.re / cAbs(Ztot);
  const I2 = I1 * cAbs(Zm_) / cAbs(cAdd(Zm_, Zr_));

  const Pgap = 3 * I2 * I2 * (d.Rr / sc);
  const T = Pgap / ws;                           // hava aralığı momenti
  const Pmech = Pgap * (1 - s);
  const Pcus = 3 * I1 * I1 * d.Rs;
  const Pcur = Pgap * s;
  const Pin = 3 * V * I1 * pf;

  const num = (x) => (Number.isFinite(x) ? x : 0);
  return {
    V, ws, Ztot,
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

  // Etkin hava aralığı: stator + rotor oluk ağızları
  const kc_s = carter(g.tau_s, d.W0, d.gap);
  const kc_r = carter(c.tau_r, d.W0r, d.gap);
  const kc = kc_s * kc_r;

  const Xm = d.Xm > 0 ? d.Xm : magnetizingX(d, w, kc);

  const ns = (60 * d.freq) / d.p;                // senkron devir [d/dk]
  const s = (ns - d.speed) / ns;
  const op = solveSlip(d, Xm, s);

  const Pout = op.Pmech - d.Pfw;
  const eta = op.Pin > 0 ? Math.max(0, Pout) / op.Pin : 0;

  // --- Moment / kayma eğrisi ---
  const curve = [];
  for (let i = 0; i <= 120; i++) {
    const sv = 1 - i / 120;
    const r = solveSlip(d, Xm, sv);
    curve.push({ s: sv, n: ns * (1 - sv), T: r.T, I: r.I1 });
  }
  const peak = curve.reduce((a, b) => (b.T > a.T ? b : a));
  const start = solveSlip(d, Xm, 1);

  // --- Manyetik akı: stator empedansı düşüldükten sonraki hava aralığı EMK'si ---
  const E = Math.max(1, op.V - op.I1 * (d.Rs * op.pf + d.Xls * Math.sqrt(1 - op.pf ** 2)));
  const Phi = E / (4.44 * d.freq * w.Nph * w.kw1);   // kutup başına akı [Wb]
  const tau_p = g.tau_p * mm;
  const Bg = (Math.PI / 2) * Phi / (tau_p * d.L1 * mm);  // tepe hava aralığı akısı
  const Bt = (Bg * g.tau_s * mm) / (d.W3 * mm * d.Kf1);
  const By = Phi / (2 * g.hy * mm * d.L1 * mm * d.Kf1);
  const Btr = (Bg * c.tau_r * mm) / (c.W3r * mm * d.Kf1);
  const Byr = Phi / (2 * c.hyr * mm * d.L1 * mm * d.Kf1);

  // --- İletken / doluluk ---
  const A_wire = ((Math.PI * (d.Wwire * mm) ** 2) / 4) * d.Nwppc;
  const fill = (A_wire * d.Ntcoil * d.Nlayer) / (g.A_slot * mm * mm);
  const J = op.I1 / (A_wire * 1e6);
  const Jbar = op.I2 * (2 * w.Nph * w.kw1 * 3) / (d.Zr) / c.A_bar; // çubuk akım yoğunluğu

  // --- Kütleler ---
  const vol = (ro, ri) => Math.PI * (ro ** 2 - ri ** 2) * d.L1 * mm ** 3;
  const V_yoke = vol(d.Rext, g.r3) * d.Kf1;
  const V_teeth = d.Zs * d.W3 * (d.H1 + d.H2) * d.L1 * mm ** 3 * d.Kf1;
  const V_rot = (vol(c.Rr, c.Rsh) - d.Zr * c.A_bar * d.L1 * mm ** 3) * d.Kf1;
  const Lend = 1.2 * d.coil_pitch * g.tau_s * mm + 0.02;
  const V_cu = 3 * w.Nph * d.Npcp * 2 * (d.L1 * mm + Lend) * A_wire;
  const mass = {
    steel: (V_yoke + V_teeth + V_rot) * M.steel.rho,
    copper: V_cu * M.copper.rho,
    cage: d.Zr * c.A_bar * mm * mm * (d.L1 * mm) * 2700, // alüminyum kafes
  };
  mass.total = mass.steel + mass.copper + mass.cage;

  // --- Demir kaybı ---
  const specLoss = (B) => M.steel.p15 * (B / 1.5) ** 2 * (d.freq / 50) ** 1.5;
  const Pfe = specLoss(By) * V_yoke * M.steel.rho + specLoss(Bt) * V_teeth * M.steel.rho;

  return {
    type: "scim", geom: g, cage: c, wind: w,
    kc, kc_s, kc_r, Xm, ns, s, ...op,
    Pout, eta, Pfe, Pfw: d.Pfw,
    Phi, Bg, Bt, By, Btr, Byr,
    fill, J, Jbar, A_wire, mass, curve,
    peakT: peak.T, peakS: peak.s, peakN: peak.n,
    Tstart: start.T, Ilr: start.I1,
    f: d.freq,
  };
}

/** Etiket değerleriyle karşılaştırma. */
export function nameplate(d, r) {
  const p = d.plate;
  if (!p) return [];
  const cmp = (n, calc, plate, u, dec = 2) => ({
    n, calc, plate, u,
    dev: plate ? (calc - plate) / plate : 0,
    txt: `${calc.toFixed(dec)} / ${plate.toFixed(dec)}`,
  });
  return [
    cmp("Senkron devir", r.ns, p.nsync, "d/dk", 0),
    cmp("Nominal moment", r.T, p.T, "N·m"),
    cmp("Çıkış gücü", r.Pout, p.Pout, "W", 0),
    cmp("Faz akımı", r.I1, p.I, "A"),
    cmp("Güç faktörü", r.pf, p.pf, "", 3),
    cmp("Verim", r.eta * 100, p.eta * 100, "%", 1),
    cmp("Kalkış momenti", r.Tstart, p.Tstart, "N·m"),
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

  if (r.fill > 0.50) add("crit", "Oluk doluluğu", `%${(r.fill * 100).toFixed(0)} — sığmaz.`);
  else if (r.fill > 0.42) add("warn", "Oluk doluluğu", `%${(r.fill * 100).toFixed(0)} — zorlayıcı.`);
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
