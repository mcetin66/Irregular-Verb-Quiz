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
  shaft: { name: "Steel-C45", rho: 7850, rho_elec: 1.7e-7 },
  insulation: { name: "Insulation1", rho: 1400 },
};

/* ------------------------------------------------------------------ *
 * Varsayılan tasarım — 12 oluk / 10 kutup konsantre sargılı SPM
 * ------------------------------------------------------------------ */
export function defaultDesign() {
  return {
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
