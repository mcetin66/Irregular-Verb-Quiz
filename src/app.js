import {
  defaultDesign, defaultSPM, geometry, cageGeometry, winding,
  analyseAny, checksAny, toPyleecanAny, nameplate, PHASES,
  MATERIALS, CAGE_MATERIALS, goodRotorSlots, optimisedDesign, design115V,
  LAMINATIONS, Hof, specificLoss, lamOf,
} from "./motor.js";
import { buildParts, createViewer } from "./view3d.js";

/* ------------------------------------------------------------------ *
 * Durum
 * ------------------------------------------------------------------ */
const STORE = "ivq.motor.design.v2";
let D = load();
let view = "winding"; // winding | flux | plain | 3d
let viewer = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const saved = JSON.parse(raw);
      const base = saved.type === "spm" ? defaultSPM() : defaultDesign();
      return { ...base, ...saved };
    }
  } catch { /* depolama yoksa varsayılana düş */ }
  return defaultDesign();
}
const save = () => {
  try { localStorage.setItem(STORE, JSON.stringify(D)); } catch { /* yok say */ }
};

/* ------------------------------------------------------------------ *
 * Parametre tanımları
 * ------------------------------------------------------------------ */
const G_STATOR = {
  name: "Stator laminasyonu",
  items: [
    ["Rext", "Dış yarıçap", 20, 160, 0.5, "mm"],
    ["Rint", "Delik yarıçapı", 10, 130, 0.5, "mm"],
    ["L1", "Paket boyu", 10, 250, 1, "mm"],
    ["Kf1", "İstifleme faktörü", 0.85, 1.0, 0.01, ""],
  ],
};
const G_SLOT = {
  name: "Stator oluğu (SlotW11)",
  items: [
    ["Zs", "Oluk sayısı", 3, 72, 3, ""],
    ["W3", "Diş genişliği", 0.5, 40, 0.02, "mm"],
    ["H2", "Oluk derinliği", 1, 50, 0.1, "mm"],
    ["W0", "Oluk ağzı", 0.3, 15, 0.1, "mm"],
    ["H0", "Ağız yüksekliği", 0.2, 6, 0.1, "mm"],
    ["H1", "Kama yüksekliği", 0, 8, 0.1, "mm"],
    ["R1", "Dip yarıçapı", 0, 6, 0.1, "mm"],
  ],
};
const G_WIND = {
  name: "Sargı",
  items: [
    ["p", "Kutup çifti", 1, 24, 1, ""],
    ["Nlayer", "Katman sayısı", 1, 2, 1, ""],
    ["coil_pitch", "Bobin adımı", 1, 24, 1, "oluk"],
    ["Ntcoil", "Bobin başına sarım", 1, 300, 1, ""],
    ["Npcp", "Paralel kol", 1, 8, 1, ""],
    ["Wwire", "Tel çapı", 0.1, 3, 0.01, "mm"],
    ["Nwppc", "Paralel tel", 1, 20, 1, ""],
  ],
};
const GROUPS_SPM = [
  G_STATOR, G_SLOT, G_WIND,
  {
    name: "Rotor ve mıknatıs",
    items: [
      ["gap", "Hava aralığı", 0.2, 5, 0.05, "mm"],
      ["Hmag", "Mıknatıs kalınlığı", 1, 15, 0.1, "mm"],
      ["alpha_m", "Kutup kaplama oranı", 0.4, 1.0, 0.01, ""],
      ["Drsh", "Mil çapı", 5, 120, 1, "mm"],
    ],
  },
  {
    name: "Çalışma noktası",
    items: [
      ["speed", "Devir", 100, 20000, 50, "d/dk"],
      ["Irms", "Faz akımı", 0.5, 400, 0.5, "A rms"],
      ["Twind", "Sargı sıcaklığı", 20, 180, 5, "°C"],
      ["Tmag", "Mıknatıs sıcaklığı", 20, 150, 5, "°C"],
    ],
  },
];
const GROUPS_SCIM = [
  G_STATOR, G_SLOT, G_WIND,
  {
    name: "Rotor kafesi",
    items: [
      ["Zr", "Rotor çubuk sayısı", 8, 96, 1, ""],
      ["gap", "Hava aralığı", 0.15, 5, 0.05, "mm"],
      ["Hbar", "Çubuk yüksekliği", 1, 25, 0.1, "mm"],
      ["Wbar", "Çubuk genişliği", 0.5, 12, 0.1, "mm"],
      ["W0r", "Rotor oluk ağzı", 0.2, 6, 0.1, "mm"],
      ["H0r", "Rotor ağız yüksekliği", 0.1, 4, 0.1, "mm"],
      ["Lscr", "Kısa devre halkası eni", 1, 20, 0.1, "mm"],
      ["skew", "Rotor eğimi", 0, 2, 0.05, "oluk"],
      ["Trot", "Rotor sıcaklığı", 20, 200, 5, "°C"],
      ["Drsh", "Rotor iç (mil oturma) çapı", 5, 120, 1, "mm"],
      ["Dshaft", "Mil uzantı çapı", 5, 120, 1, "mm"],
    ],
  },
  {
    name: "Besleme",
    items: [
      ["Vline", "Hat gerilimi", 12, 690, 1, "V"],
      ["freq", "Frekans", 10, 1000, 5, "Hz"],
      ["speed", "Çalışma devri", 0, 20000, 25, "d/dk"],
    ],
  },
  {
    name: "Eşdeğer devre (faz başına)",
    items: [
      ["Rs", "Stator direnci Rs", 0.05, 40, 0.01, "Ω"],
      ["Xls", "Stator kaçak Xls", 0.05, 60, 0.01, "Ω"],
      ["Rr", "Rotor direnci Rr", 0.05, 40, 0.01, "Ω"],
      ["Xlr", "Rotor kaçak Xlr", 0.05, 60, 0.01, "Ω"],
      ["Xm", "Mıknatıslanma Xm", 0, 400, 0.5, "Ω"],
      ["Pfw", "Sürtünme + rüzgâr", 0, 400, 5, "W"],
      ["Twind", "Sargı sıcaklığı", 20, 180, 5, "°C"],
    ],
  },
];
const groupsFor = (d) => (d.type === "scim" ? GROUPS_SCIM : GROUPS_SPM);

/* Üretim seçimleri: liste hâlinde seçilenler ve açık/kapalı anahtarlar */
const CHOICES = [
  { key: "lamGrade", label: "Silisli sac", opts: () => Object.keys(LAMINATIONS) },
  { key: "cageMat", label: "Rotor kafesi", opts: () => Object.keys(CAGE_MATERIALS) },
  { key: "RrMode", label: "Rotor direnci kaynağı",
    opts: () => ["manual", "geometri"],
    text: { manual: "Doküman değeri", geometri: "Geometriden hesapla" } },
];
const TOGGLES = [
  ["rotorClosed", "Kapalı rotor oluğu"],
  ["skinEffect", "Derin çubuk (deri) etkisi"],
];

/* ------------------------------------------------------------------ *
 * Biçimlendirme yardımcıları
 * ------------------------------------------------------------------ */
const fx = (v, n = 2) => (Number.isFinite(v) ? v.toFixed(n) : "—");
const el = (t, cls, txt) => {
  const e = document.createElement(t);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
const SVGNS = "http://www.w3.org/2000/svg";
const svgEl = (t, attrs) => {
  const e = document.createElementNS(SVGNS, t);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

function ramp(t, stops) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  return stops[i].map((a, k) => Math.round(a + (stops[i + 1][k] - a) * f));
}
const heat = (v, lo, hi) =>
  `rgb(${ramp((v - lo) / (hi - lo), [[63,110,140],[78,140,107],[201,162,39],[178,62,42]])})`;
const quality = (v, lo, hi) =>
  `rgb(${ramp((v - lo) / (hi - lo), [[164,62,45],[186,133,40],[96,141,92],[55,122,96]])})`;
const sevB = (b, warn, crit) => (b > crit ? "crit" : b > warn ? "warn" : "ok");

/** CSS değişkenini WebGL için 0–1 aralığında RGB'ye çevirir. */
function cssRGB(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return new Float32Array([(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]);
  }
  const r = v.match(/rgba?\(([^)]+)\)/);
  if (r) {
    const p = r[1].split(",").map(Number);
    return new Float32Array([p[0] / 255, p[1] / 255, p[2] / 255]);
  }
  return new Float32Array(fallback);
}

/* ------------------------------------------------------------------ *
 * 2B kesit çizimi
 * ------------------------------------------------------------------ */
const pt = (r, a) => [r * Math.cos(a), -r * Math.sin(a)];
const fmtPt = ([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`;

function sectorPath(rIn, rOut, a1, a2, hIn, hOut) {
  const A1o = hOut != null ? -hOut : a1, A2o = hOut != null ? hOut : a2;
  const A1i = hIn != null ? -hIn : a1, A2i = hIn != null ? hIn : a2;
  const large = Math.abs(A2o - A1o) > Math.PI ? 1 : 0;
  return [
    `M ${fmtPt(pt(rOut, A1o))}`,
    `A ${rOut} ${rOut} 0 ${large} 0 ${fmtPt(pt(rOut, A2o))}`,
    `L ${fmtPt(pt(rIn, A2i))}`,
    `A ${rIn} ${rIn} 0 ${large} 1 ${fmtPt(pt(rIn, A1i))}`,
    "Z",
  ].join(" ");
}

const ang = (r, w) => Math.asin(Math.min(0.999, Math.max(0, w) / r));

function slotPath(d, g) {
  const { r0, r1, r2, r3 } = g;
  const w0 = d.W0 / 2;
  const a0 = ang(r0, w0), a1 = ang(r1, w0);
  const a2 = ang(r2, g.halfWidth(r2));
  const a3 = ang(r3, g.halfWidth(r3));
  const R1 = Math.min(d.R1, d.H2 / 2, g.halfWidth(r3) * 0.9);
  const dA = R1 / r3, rc = r3 - R1;
  return [
    `M ${fmtPt(pt(r0, a0))}`, `L ${fmtPt(pt(r1, a1))}`, `L ${fmtPt(pt(r2, a2))}`,
    `L ${fmtPt(pt(rc, a3))}`,
    `Q ${fmtPt(pt(r3, a3))} ${fmtPt(pt(r3, Math.max(0, a3 - dA)))}`,
    `A ${r3} ${r3} 0 0 0 ${fmtPt(pt(r3, -Math.max(0, a3 - dA)))}`,
    `Q ${fmtPt(pt(r3, -a3))} ${fmtPt(pt(rc, -a3))}`,
    `L ${fmtPt(pt(r2, -a2))}`, `L ${fmtPt(pt(r1, -a1))}`, `L ${fmtPt(pt(r0, -a0))}`,
    `A ${r0} ${r0} 0 0 1 ${fmtPt(pt(r0, a0))}`, "Z",
  ].join(" ");
}

/**
 * Rotor kafes oluğu profili — döküm rotorlarda tipik olduğu gibi tabana
 * doğru daralan ve köşeleri yuvarlatılmış. Kapalı olukta hava aralığına
 * açılan ağız yoktur; oluk köprünün altında biter.
 */
function barPath(d, c) {
  // çubuk yarı genişliği: tabanda dar, ağza doğru genişler
  const wHalf = (rr) => {
    const t = (rr - c.rb0) / Math.max(0.1, c.rb1 - c.rb0);
    return (d.Wbar / 2) * (0.55 + 0.45 * Math.sqrt(Math.max(0, t)));
  };
  const rTop = d.rotorClosed ? c.Rr - Math.max(0.2, d.bridge) : c.Rr;
  const aTop = d.rotorClosed ? ang(rTop, wHalf(c.rb1)) : ang(c.Rr, d.W0r / 2);
  const aO1 = d.rotorClosed ? ang(c.rb1, wHalf(c.rb1)) : ang(c.rb1, d.W0r / 2);
  const aB = ang(c.rb1, wHalf(c.rb1));

  // gövdeyi birkaç seviyede örnekle (yuvarlak yan duvar)
  const N = 5, mid = [];
  for (let i = 1; i <= N; i++) {
    const rr = c.rb1 - ((c.rb1 - c.rb0) * i) / (N + 1);
    mid.push({ r: rr, a: ang(rr, wHalf(rr)) });
  }
  const rBot = c.rb0 + wHalf(c.rb0) * 0.8;
  const aBot = ang(rBot, wHalf(c.rb0) * 0.6);

  const right = mid.map((m) => `L ${fmtPt(pt(m.r, m.a))}`).join(" ");
  const left = [...mid].reverse().map((m) => `L ${fmtPt(pt(m.r, -m.a))}`).join(" ");

  return [
    `M ${fmtPt(pt(rTop, aTop))}`,
    `L ${fmtPt(pt(c.rb1, aO1))}`,
    `L ${fmtPt(pt(c.rb1, aB))}`,
    right,
    `L ${fmtPt(pt(rBot, aBot))}`,
    `A ${rBot} ${rBot} 0 0 0 ${fmtPt(pt(rBot, -aBot))}`,
    left,
    `L ${fmtPt(pt(c.rb1, -aB))}`,
    `L ${fmtPt(pt(c.rb1, -aO1))}`,
    `L ${fmtPt(pt(rTop, -aTop))}`,
    `A ${rTop} ${rTop} 0 0 1 ${fmtPt(pt(rTop, aTop))}`,
    "Z",
  ].join(" ");
}

function drawSection(r) {
  const g = r.geom, w = r.wind;
  const R = D.Rext * 1.06;
  const svg = svgEl("svg", {
    viewBox: `${-R} ${-R} ${2 * R} ${2 * R}`, role: "img",
    "aria-label": `${D.Zs} oluk ${w.poles} kutup motor kesiti`,
  });
  const add = (t, a) => { const e = svgEl(t, a); svg.appendChild(e); return e; };
  const flux = view === "flux";
  const tint = (c) => (c ? { style: `fill:${c}` } : {});

  add("circle", { r: D.Rext, class: "lam-yoke", ...tint(flux && heat(r.By, 0.6, 2.0)) });
  add("circle", { r: g.r3, class: "lam-teeth", ...tint(flux && heat(r.Bt, 0.6, 2.0)) });
  add("circle", { r: D.Rint, class: "air" });

  const path = slotPath(D, g);
  const nLay = Math.max(1, D.Nlayer);
  for (let k = 0; k < D.Zs; k++) {
    const grp = add("g", { transform: `rotate(${-(360 * k) / D.Zs})` });
    grp.appendChild(svgEl("path", { d: path, class: "slot-air" }));
    if (view === "winding") {
      const layers = nLay >= 2 ? [w.top[k], w.bot[k]] : [w.top[k]];
      const span = g.r3 - g.r2 - 0.6;
      layers.forEach((L, i) => {
        if (!L) return;
        const rA = g.r2 + 0.3 + (span / nLay) * i;
        const rB = rA + (span / nLay) * 0.86;
        grp.appendChild(svgEl("path", {
          d: sectorPath(rA, rB, 0, 0,
            ang(rA, g.halfWidth(rA) - 0.55), ang(rB, g.halfWidth(rB) - 0.55)),
          class: `wnd${L.ph}${L.s < 0 ? " wnd-neg" : ""}`,
        }));
      });
    }
  }

  if (D.type === "scim") {
    const c = r.cage;
    add("circle", { r: c.Rr, class: "rotor-st", ...tint(flux && heat(r.Btr, 0.6, 2.0)) });
    add("circle", { r: c.rb0, class: "rotor-st", ...tint(flux && heat(r.Byr, 0.6, 2.0)) });
    const bp = barPath(D, c);
    for (let k = 0; k < D.Zr; k++)
      add("path", { d: bp, class: "cage-bar", transform: `rotate(${-(360 * k) / D.Zr})` });
    // mil: paket içindeki oturma çapı, üstünde tahrik ucu çapı
    add("circle", { r: c.Rsh, class: "shaft-f" });
    const extR = Math.min(c.Rsh, (D.Dshaft ?? 26) / 2);
    if (extR < c.Rsh - 0.3) add("circle", { r: extR, class: "shaft-ext" });
    for (const rr of [D.Rext, g.r3, D.Rint, c.Rr, c.rb0, c.Rsh, extR])
      if (rr > 0) add("circle", { r: rr, class: "edge" });
  } else {
    add("circle", { r: g.Rr, class: "rotor-st", ...tint(flux && heat(r.Bry, 0.6, 2.0)) });
    const half = g.Wmag_rad / 2;
    for (let k = 0; k < w.poles; k++) {
      const a = (k * Math.PI * 2) / w.poles;
      add("path", { d: sectorPath(g.Rm_in, g.Rr, a - half, a + half), class: k % 2 ? "mag-s" : "mag-n" });
    }
    add("circle", { r: g.Rsh, class: "shaft-f" });
    for (const rr of [D.Rext, g.r3, D.Rint, g.Rr, g.Rm_in, g.Rsh])
      if (rr > 0) add("circle", { r: rr, class: "edge" });
  }
  return svg;
}

/* ------------------------------------------------------------------ *
 * Malzeme eğrileri: B(H) ve özgül kayıp
 * ------------------------------------------------------------------ */
function drawXY(pts, marks, logX = false) {
  // Bozuk geometride akı yoğunlukları sonsuza gidebilir; eksenleri koru.
  const fin = (v, alt = 0) => (Number.isFinite(v) ? v : alt);
  pts = pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  marks = marks.filter((m) => Number.isFinite(m.x) && Number.isFinite(m.y));
  if (!pts.length) pts = [[0, 0], [1, 1]];

  const W = 320, H = 168, pad = { l: 38, r: 10, t: 8, b: 26 };
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img",
    "aria-label": "eğri" });
  const add = (t, a) => { const e = svgEl(t, a); svg.appendChild(e); return e; };

  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = logX ? Math.max(1, Math.min(...xs)) : 0;
  const x1 = Math.max(x0 * 1.01, Math.max(...xs));
  const y1 = Math.max(1e-6, fin(Math.max(...ys, ...marks.map((m) => m.y)), 1)) * 1.08;
  const tx = (v) => logX
    ? Math.log(Math.max(x0, v) / x0) / Math.log(x1 / x0)
    : v / x1;
  const X = (v) => pad.l + (W - pad.l - pad.r) * Math.min(1, Math.max(0, tx(v)));
  const Y = (v) => H - pad.b - (H - pad.t - pad.b) * Math.min(1, Math.max(0, v / y1));

  for (let i = 0; i <= 4; i++) {
    const v = (y1 * i) / 4;
    add("line", { x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v), class: "grid" });
    add("text", { x: pad.l - 4, y: Y(v) + 3, class: "tick", "text-anchor": "end" })
      .textContent = v >= 100 ? v.toFixed(0) : v.toFixed(v < 10 ? 1 : 0);
  }
  const xticks = logX
    ? [x0, Math.sqrt(x0 * x1), x1]
    : [0, x1 / 2, x1];
  for (const v of xticks)
    add("text", { x: X(v), y: H - 8, class: "tick", "text-anchor": "middle" })
      .textContent = v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(v < 10 ? 1 : 0);
  add("path", { d: pts.map((p, i) => `${i ? "L" : "M"} ${X(p[0]).toFixed(2)} ${Y(p[1]).toFixed(2)}`).join(" "),
    class: "curve" });

  for (const m of marks) {
    add("line", { x1: X(m.x), x2: X(m.x), y1: Y(0), y2: Y(m.y), class: "markline" });
    add("circle", { cx: X(m.x), cy: Y(m.y), r: 3.2, class: `pt-${m.cls}` });
    add("text", { x: X(m.x) + 5, y: Y(m.y) - 5, class: "pointlbl" }).textContent = m.label;
  }
  return svg;
}

/* ------------------------------------------------------------------ *
 * Moment / devir eğrisi
 * ------------------------------------------------------------------ */
function drawCurve(r) {
  const W = 320, H = 150, pad = { l: 34, r: 8, t: 10, b: 22 };
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img",
    "aria-label": "Moment devir eğrisi" });
  const add = (t, a) => { const e = svgEl(t, a); svg.appendChild(e); return e; };

  // Bozuk geometride hesap sonsuza gidebilir; eksenleri her hâlükârda geçerli tut.
  const fin = (x, alt = 0) => (Number.isFinite(x) ? x : alt);
  const maxT = Math.max(0.01, fin(Math.max(r.peakT, r.T)) * 1.15);
  const ns = Math.max(1, fin(r.ns, 1));
  const X = (n) => pad.l + ((W - pad.l - pad.r) * Math.max(0, Math.min(ns, fin(n)))) / ns;
  const Y = (t) => H - pad.b - ((H - pad.t - pad.b) * Math.max(0, Math.min(maxT, fin(t)))) / maxT;

  // ızgara
  for (let i = 0; i <= 4; i++) {
    const t = (maxT * i) / 4;
    add("line", { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: "grid" });
    add("text", { x: pad.l - 4, y: Y(t) + 3, class: "tick", "text-anchor": "end" })
      .textContent = t.toFixed(1);
  }
  for (const n of [0, ns / 2, ns])
    add("text", { x: X(n), y: H - 6, class: "tick", "text-anchor": "middle" })
      .textContent = String(Math.round(n));

  add("path", {
    d: r.curve.map((c, i) => `${i ? "L" : "M"} ${X(c.n).toFixed(2)} ${Y(c.T).toFixed(2)}`).join(" "),
    class: "curve",
  });

  // işaretler
  const mark = (n, t, cls, label) => {
    add("circle", { cx: X(n), cy: Y(t), r: 3.2, class: cls });
    add("text", { x: X(n) + (n > r.ns * 0.6 ? -6 : 6), y: Y(t) - 6, class: "pointlbl",
      "text-anchor": n > r.ns * 0.6 ? "end" : "start" }).textContent = label;
  };
  mark(0, r.Tstart, "pt-start", "kalkış");
  mark(r.peakN, r.peakT, "pt-peak", "devrilme");
  mark(D.speed, r.T, "pt-op", "çalışma");
  return svg;
}

/* ------------------------------------------------------------------ *
 * İskelet
 * ------------------------------------------------------------------ */
document.getElementById("app").innerHTML = `
<div class="masthead">
  <h1>Motor Tasarım Atölyesi</h1>
  <span class="sub" id="sub"></span>
  <div class="types" role="group" aria-label="Makine tipi">
    <button class="chip" data-type="scim">Asenkron</button>
    <button class="chip" data-type="spm">Mıknatıslı</button>
  </div>
</div>

<div class="presets" role="group" aria-label="Hazır tasarımlar">
  <button class="preset" data-preset="doc">
    <b>Doküman</b><span>Elimizdeki motorun ölçüleri ve etiket değerleri</span>
  </button>
  <button class="preset" data-preset="wye">
    <b>115 V yıldız</b><span>Aynı motor, 115 V faz için yeniden sarılmış</span>
  </button>
  <button class="preset" data-preset="opt">
    <b>Claude Op.</b><span>Aynı gövde ve görevde kısıtlı arama ile optimize edilmiş</span>
  </button>
</div>

<div class="instrument">
  <div class="stage">
    <div class="views" role="group" aria-label="Görünüm">
      <button class="chip" data-view="winding" aria-pressed="true">Sargı</button>
      <button class="chip" data-view="flux" aria-pressed="false">Akı</button>
      <button class="chip" data-view="plain" aria-pressed="false">Sade</button>
      <button class="chip" data-view="3d" aria-pressed="false">3B</button>
    </div>
    <div id="stage"></div>
    <canvas id="gl" hidden></canvas>
  </div>
  <div class="d3panel" id="d3panel" hidden>
    <div class="d3row">
      <label>Kesit<input type="range" id="cut" min="0" max="0.5" step="0.01" value="0"></label>
      <label>Ayır<input type="range" id="exp" min="0" max="1" step="0.01" value="0"></label>
    </div>
    <div class="d3row chips" id="d3groups"></div>
    <div class="d3row chips" id="d3views"></div>
    <div class="d3row chips" id="d3parts"></div>
  </div>
  <div class="vitals" id="vitals"></div>
</div>

<div class="stream">
<section id="sec-plate" hidden><h2>Etiket karşılaştırması</h2><div class="card">
  <div class="rows" id="plate"></div>
  <p class="note">Sol sütun modelin hesabı, sağ sütun dokümandaki değer.</p>
</div></section>

<section id="sec-mat" hidden><h2>Silisli sac</h2><div class="card">
  <div class="rows" id="matinfo"></div>
  <div class="matcharts">
    <figure><figcaption>Mıknatıslanma eğrisi · B (T) / H (A·m⁻¹)</figcaption><div id="bhchart"></div></figure>
    <figure><figcaption id="losscap">Özgül kayıp</figcaption><div id="losschart"></div></figure>
  </div>
  <p class="note" id="matnote"></p>
</div></section>

<section id="sec-slots" hidden><h2>Oluk kombinasyonu</h2><div class="card">
  <div id="slotrules"></div>
  <p class="note" id="slotsugg"></p>
</div></section>

<section id="sec-curve" hidden><h2>Moment / devir</h2><div class="card">
  <div id="curve"></div>
  <p class="note">Yatay eksen devir (d/dk), dikey eksen moment (N·m).</p>
</div></section>

<section><h2>Kontroller</h2><div class="card" id="ctrls"></div></section>
<section><h2>Tasarım kontrolü</h2><div class="card" id="checks"></div></section>
<section><h2>Sonuçlar</h2><div class="card"><div class="results" id="results"></div></div></section>

<section><h2>Sargı yerleşimi</h2><div class="card">
  <div class="scroller"><div class="layout" id="layout"></div></div>
  <p class="note" id="layout-note"></p>
</div></section>

<section><h2>Sargı faktörü harmonikleri</h2><div class="card"><div class="harm" id="harm"></div></div></section>

<section><h2>Oluk / kutup matrisi</h2><div class="card">
  <div class="scroller"><table class="matrix" id="matrix"></table></div>
  <p class="note">Hücre değeri temel sargı faktörü kw₁. Dokununca o kombinasyona geçilir. Soluk hücreler dengeli üç fazlı sargı vermez.</p>
</div></section>

<section><h2>Dışa aktar</h2><div class="card">
  <div class="actions">
    <button class="act" id="exp-pyl">Pyleecan JSON</button>
    <button class="act ghost" id="exp-design">Tasarım JSON</button>
    <button class="act ghost" id="reset">Varsayılana dön</button>
  </div>
  <p class="note">Pyleecan JSON doğrudan <code>pyleecan.Functions.load.load()</code> ile açılır.</p>
</div></section>

<p class="note">Analitik model — hızlı ön tasarım içindir, sonlu elemanlar analizinin yerine geçmez.</p>
</div>
`;

/* --- Hazır tasarımlar --- */
let presetKey = "doc";
for (const b of document.querySelectorAll(".preset[data-preset]"))
  b.addEventListener("click", () => {
    presetKey = b.dataset.preset;
    D = presetKey === "opt" ? optimisedDesign()
      : presetKey === "wye" ? design115V()
      : defaultDesign();
    save(); buildControls(); render();
  });

/* --- Makine tipi --- */
for (const b of document.querySelectorAll(".chip[data-type]"))
  b.addEventListener("click", () => {
    if (D.type === b.dataset.type) return;
    D = b.dataset.type === "spm" ? defaultSPM() : defaultDesign();
    presetKey = "doc";
    save(); buildControls(); render();
  });

/* --- Görünüm --- */
for (const b of document.querySelectorAll(".chip[data-view]"))
  b.addEventListener("click", () => {
    view = b.dataset.view;
    for (const o of document.querySelectorAll(".chip[data-view]"))
      o.setAttribute("aria-pressed", String(o.dataset.view === view));
    render();
  });

/* --- Parametre denetimleri --- */
let ctrlEls = {};
function buildControls() {
  const host = document.getElementById("ctrls");
  host.replaceChildren();
  ctrlEls = {};
  for (const grp of groupsFor(D)) {
    const gEl = el("div", "group");
    gEl.appendChild(el("span", "lbl", grp.name));
    const box = el("div", "ctrls");
    for (const [key, label, min, max, step, unit] of grp.items) {
      const c = el("div", "ctrl");
      const lab = el("label", null, label);
      lab.htmlFor = `c-${key}`;
      const num = el("div", "num");
      const input = document.createElement("input");
      Object.assign(input, { type: "range", id: `c-${key}`, min, max, step, value: D[key] });
      input.addEventListener("input", () => {
        D[key] = parseFloat(input.value);
        if (key === "Zs") D.coil_pitch = Math.min(D.coil_pitch, D.Zs);
        save(); render();
      });
      c.append(lab, num, input);
      box.appendChild(c);
      ctrlEls[key] = { num, input, unit, step };
    }
    gEl.appendChild(box);
    host.appendChild(gEl);
  }
  if (D.type !== "scim") return;

  // --- Bağlantı biçimi ---
  const conn = el("div", "group");
  conn.appendChild(el("span", "lbl", "Bağlantı"));
  const cbox = el("div", "chips");
  for (const [k, t] of [["delta", "Üçgen"], ["wye", "Yıldız"]]) {
    const b = el("button", "chip", t);
    b.setAttribute("aria-pressed", String(D.connection === k));
    b.onclick = () => { D.connection = k; save(); buildControls(); render(); };
    cbox.appendChild(b);
  }
  conn.appendChild(cbox);
  host.appendChild(conn);

  // --- Üretim seçimleri ---
  for (const ch of CHOICES) {
    const gEl = el("div", "group");
    gEl.appendChild(el("span", "lbl", ch.label));
    const box = el("div", "chips");
    for (const o of ch.opts()) {
      const b = el("button", "chip", ch.text ? ch.text[o] : o);
      b.setAttribute("aria-pressed", String(D[ch.key] === o));
      b.onclick = () => { D[ch.key] = o; save(); buildControls(); render(); };
      box.appendChild(b);
    }
    gEl.appendChild(box);
    host.appendChild(gEl);
  }

  const tEl = el("div", "group");
  tEl.appendChild(el("span", "lbl", "Üretim seçenekleri"));
  const tbox = el("div", "chips");
  for (const [k, t] of TOGGLES) {
    const b = el("button", "chip", t);
    b.setAttribute("aria-pressed", String(!!D[k]));
    b.onclick = () => { D[k] = !D[k]; save(); buildControls(); render(); };
    tbox.appendChild(b);
  }
  tEl.appendChild(tbox);
  host.appendChild(tEl);

  const note = el("p", "note", CAGE_MATERIALS[D.cageMat]?.note ?? "");
  host.appendChild(note);
}
const syncInputs = () => {
  for (const [k, c] of Object.entries(ctrlEls)) c.input.value = D[k];
};

/* --- Dışa aktarma --- */
const download = (name, obj) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  URL.revokeObjectURL(a.href);
};
document.getElementById("exp-pyl").onclick = () => download(`${D.name}.json`, toPyleecanAny(D));
document.getElementById("exp-design").onclick = () => download(`${D.name}-design.json`, D);
document.getElementById("reset").onclick = () => {
  D = D.type === "spm" ? defaultSPM() : defaultDesign();
  save(); buildControls(); render();
};

/* ------------------------------------------------------------------ *
 * 3B görünüm
 * ------------------------------------------------------------------ */
const canvas = document.getElementById("gl");
const d3panel = document.getElementById("d3panel");
let partList = [];

function colors3d() {
  return {
    lam: cssRGB("--lam", [0.78, 0.82, 0.85]),
    tooth: cssRGB("--lam-tooth", [0.84, 0.88, 0.90]),
    rotor: cssRGB("--rotor", [0.66, 0.72, 0.76]),
    shaft: cssRGB("--shaft", [0.58, 0.65, 0.68]),
    magnet: cssRGB("--magnet", [0.42, 0.38, 0.57]),
    cage: cssRGB("--cage", [0.72, 0.74, 0.76]),
    phase: [cssRGB("--copper", [0.71, 0.44, 0.24]),
            cssRGB("--steel", [0.29, 0.45, 0.57]),
            cssRGB("--verdigris", [0.25, 0.48, 0.40])],
  };
}

function setup3d() {
  if (viewer) return true;
  try { viewer = createViewer(canvas); } catch { viewer = null; }
  if (!viewer) return false;

  document.getElementById("cut").addEventListener("input", (e) => {
    viewer.state.cut = parseFloat(e.target.value); viewer.schedule();
  });
  document.getElementById("exp").addEventListener("input", (e) => {
    viewer.state.explode = parseFloat(e.target.value); viewer.schedule();
  });

  // --- Montaj grupları: fotoğrafla karşılaştırmak için çıplak rotor ---
  const groups = document.getElementById("d3groups");
  const STATOR_KEYS = ["yoke", "teeth", "w0", "w1", "w2"];
  const ROTOR_KEYS = ["rteeth", "bars", "rings", "rlam", "mag", "shaft"];
  const GROUP_SETS = [
    ["Tümü", []],
    ["Rotor", STATOR_KEYS],
    ["Stator", ROTOR_KEYS],
  ];
  let groupName = "Tümü";
  for (const [t, hide] of GROUP_SETS) {
    const b = el("button", "chip", t);
    b.onclick = () => {
      groupName = t;
      viewer.state.hidden = new Set(hide);
      for (const o of groups.children) o.setAttribute("aria-pressed", String(o.textContent === t));
      syncPartChips();
      viewer.schedule();
    };
    groups.appendChild(b);
  }
  groups.firstChild.setAttribute("aria-pressed", "true");

  const views = document.getElementById("d3views");
  const HALF = Math.PI / 2;
  const presets = [
    ["Açı", HALF + 0.6, 0.38],   // üç çeyrek
    ["Ön", 0, 0],                // kesit düzlemi karşıdan
    ["Yan", HALF, 0],            // eksen yatay
    ["Arka", Math.PI, 0],        // arkadan
    ["Üst", HALF, 1.4],          // tepeden
  ];
  for (const [t, y, p] of presets) {
    const b = el("button", "chip", t);
    b.onclick = () => viewer.setView(y, p);
    views.appendChild(b);
  }
  const spin = el("button", "chip", "Döndür");
  spin.onclick = () => {
    viewer.state.spin = !viewer.state.spin;
    spin.setAttribute("aria-pressed", String(viewer.state.spin));
    viewer.schedule();
  };
  views.appendChild(spin);
  return true;
}

let syncPartChips = () => {};

function update3d(r) {
  if (!setup3d()) {
    canvas.hidden = true;
    document.getElementById("stage").replaceChildren(
      el("p", "note", "Bu tarayıcıda WebGL kullanılamıyor; 3B görünüm devre dışı."));
    return;
  }
  partList = buildParts(D, r, colors3d());
  const extent = Math.max(D.Rext, D.L1 / 2 + Math.max(10, 0.3 * D.L1));
  // sac katman aralığı dokusu için (görsel; aliasing'e karşı alt sınırlı)
  viewer.setParts(partList, extent, r.pack ? r.pack.thickness * 3 : 1);
  viewer.setBackground([0, 0, 0, 0]);

  const host = document.getElementById("d3parts");
  host.replaceChildren();
  const chips = [];
  for (const p of partList) {
    const b = el("button", "chip", p.label);
    const on = () => !viewer.state.hidden.has(p.key);
    b.onclick = () => {
      if (on()) viewer.state.hidden.add(p.key); else viewer.state.hidden.delete(p.key);
      b.setAttribute("aria-pressed", String(on()));
      viewer.schedule();
    };
    chips.push([b, p.key]);
    host.appendChild(b);
  }
  syncPartChips = () => {
    for (const [b, key] of chips)
      b.setAttribute("aria-pressed", String(!viewer.state.hidden.has(key)));
  };
  syncPartChips();
  viewer.schedule();
}

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */
function render() {
  const r = analyseAny(D);
  const w = r.wind;
  const isSCIM = D.type === "scim";

  document.getElementById("sub").textContent = isSCIM
    ? `sincap kafesli asenkron · ${D.Zs}/${D.Zr} oluk · ${2 * D.p} kutup · ${D.freq} Hz · ` +
      `${D.connection === "delta" ? "üçgen" : "yıldız"} ${fx(D.connection === "delta" ? D.Vline : D.Vline / Math.sqrt(3), 0)} V`
    : `yüzey mıknatıslı senkron · ${D.Zs} oluk · ${w.poles} kutup`;
  for (const b of document.querySelectorAll(".chip[data-type]"))
    b.setAttribute("aria-pressed", String(b.dataset.type === D.type));
  for (const b of document.querySelectorAll(".preset[data-preset]"))
    b.setAttribute("aria-pressed",
      String(isSCIM && b.dataset.preset === presetKey));

  // --- Sahne ---
  const is3d = view === "3d";
  canvas.hidden = !is3d;
  d3panel.hidden = !is3d;
  const stage = document.getElementById("stage");
  stage.hidden = is3d;
  if (is3d) update3d(r); else stage.replaceChildren(drawSection(r));

  if (view === "flux") {
    const key = el("div", "fluxkey");
    const bar = el("div", "ramp");
    bar.style.background = `linear-gradient(90deg, ${[0, .25, .5, .75, 1]
      .map((t) => heat(0.6 + t * 1.4, 0.6, 2.0)).join(",")})`;
    key.append(el("span", null, "0.6"), bar, el("span", null, "2.0 T"));
    stage.appendChild(key);
  }

  // --- Denetim değerleri ---
  for (const [k, c] of Object.entries(ctrlEls)) {
    const dec = c.step >= 1 ? 0 : c.step >= 0.1 ? 1 : 2;
    c.num.innerHTML = `${fx(D[k], dec)}${c.unit ? ` <span>${c.unit}</span>` : ""}`;
  }

  // --- Hayati değerler ---
  const vitals = isSCIM ? [
    ["Bδ", fx(r.Bg, 3), "T", "ok"],
    ["B diş", fx(r.Bt, 2), "T", sevB(r.Bt, 1.8, 2.0)],
    ["B boy.", fx(r.By, 2), "T", sevB(r.By, 1.6, 1.8)],
    ["Kayma", fx(r.s * 100, 1), "%", r.s <= 0 ? "warn" : "ok"],
    ["Moment", fx(r.T, 2), "N·m", r.T > r.peakT ? "crit" : "ok"],
    ["Çıkış", fx(r.Pout, 0), "W", "ok"],
    ["Akım", fx(r.I1, 2), "A", "ok"],
    ["Verim", fx(r.eta * 100, 1), "%", "ok"],
  ] : [
    ["Bδ", fx(r.Bg, 3), "T", "ok"],
    ["B diş", fx(r.Bt, 2), "T", sevB(r.Bt, 1.8, 2.0)],
    ["B boy.", fx(r.By, 2), "T", sevB(r.By, 1.6, 1.8)],
    ["kw₁", fx(w.kw1, 3), "", w.kw1 < 0.8 ? "warn" : "ok"],
    ["Moment", fx(r.T, 1), "N·m", "ok"],
    ["Güç", fx(r.Pmech / 1000, 2), "kW", "ok"],
    ["Doluluk", fx(r.fill * 100, 0), "%", r.fill > 0.5 ? "crit" : r.fill > 0.42 ? "warn" : "ok"],
    ["Verim", fx(r.eta * 100, 1), "%", "ok"],
  ];
  document.getElementById("vitals").replaceChildren(...vitals.map(([k, v, u, sev]) => {
    const t = el("div", "vital");
    t.dataset.sev = sev;
    t.appendChild(el("div", "k", k));
    const val = el("div", "v");
    val.innerHTML = `${v}${u ? ` <span>${u}</span>` : ""}`;
    t.appendChild(val);
    return t;
  }));

  // --- Etiket karşılaştırması ---
  const plateSec = document.getElementById("sec-plate");
  const cmp = isSCIM ? nameplate(D, r) : [];
  plateSec.hidden = cmp.length === 0;
  if (cmp.length) {
    document.getElementById("plate").replaceChildren(...cmp.map((c) => {
      const e = el("div", "row");
      e.appendChild(el("div", "n", c.n));
      const v = el("div", "v");
      const lvl = c.ok ? "ok" : Math.abs(c.dev) > 0.15 ? "crit" : "warn";
      v.innerHTML = `${c.txt} <span>${c.u}</span> <b data-l="${lvl}">${
        (c.dev * 100 >= 0 ? "+" : "")}${(c.dev * 100).toFixed(1)}%</b>`;
      e.appendChild(v);
      return e;
    }));
  }

  // --- Silisli sac: özellikler ve eğriler ---
  const matSec = document.getElementById("sec-mat");
  matSec.hidden = !isSCIM;
  if (isSCIM) {
    const lam = lamOf(D);
    const rows = [
      ["Kalite", D.lamGrade, ""],
      ["Açıklama", lam.desc, ""],
      ["Sac kalınlığı", fx(lam.t, 2), "mm"],
      ["Lamina sayısı", fx(r.pack.count, 0), "adet"],
      ["Yoğunluk", fx(lam.rho, 0), "kg/m³"],
      ["B–H eğrisi", `${lam.bh.length} nokta, ${lam.bh[lam.bh.length - 1][1].toFixed(2)} T'ye kadar`, ""],
      ["Kayıp verisi", lam.loss
        ? `ölçülen, ${Object.keys(lam.loss).length} frekans (${Object.keys(lam.loss)[0]}–${
            Object.keys(lam.loss).slice(-1)[0]} Hz)`
        : "yok — Steinmetz çıkarımı", ""],
      ["Diş kaybı", fx(r.iron.pT, 1), "W/kg"],
      ["Boyunduruk kaybı", fx(r.iron.pY, 1), "W/kg"],
      ["Doyma faktörü ksat", fx(r.ksat, 3), ""],
      ["MMK — hava aralığı", fx(2 * r.mmf.F_gap, 1), "A"],
      ["MMK — demir", fx(r.mmf.F_iron, 2), "A"],
    ];
    document.getElementById("matinfo").replaceChildren(...rows.map(([n, v, u]) => {
      const e = el("div", "row");
      e.appendChild(el("div", "n", n));
      const val = el("div", "v");
      val.innerHTML = `${v}${u ? ` <span>${u}</span>` : ""}`;
      e.appendChild(val);
      return e;
    }));

    document.getElementById("bhchart").replaceChildren(drawXY(
      lam.bh, [
        { x: Hof(lam, r.Bt), y: r.Bt, cls: "op", label: "diş" },
        { x: Hof(lam, r.By), y: r.By, cls: "peak", label: "boyunduruk" },
      ], true));

    const fOp = D.freq;
    const lossPts = [];
    for (let B = 0.1; B <= 1.8001; B += 0.05) lossPts.push([B, specificLoss(lam, B, fOp)]);
    document.getElementById("losschart").replaceChildren(drawXY(
      lossPts, [
        { x: r.Bt, y: r.iron.pT, cls: "op", label: "diş" },
        { x: r.By, y: r.iron.pY, cls: "peak", label: "boyunduruk" },
      ]));
    document.getElementById("losscap").textContent = `Özgül kayıp @ ${fOp} Hz · W·kg⁻¹ / B (T)`;
    document.getElementById("matnote").textContent = lam.loss
      ? "Kayıp eğrisi ölçülen veriden ara değerlendirilir (frekansta log-log). " +
        "Doyma faktörü B–H eğrisinden manyeto-motor kuvvet dengesiyle hesaplanır — varsayım değildir."
      : "Bu grade için ölçülen kayıp verisi yok; Steinmetz çıkarımı kullanılıyor.";
  }

  // --- Oluk kombinasyonu kuralları ---
  const slotSec = document.getElementById("sec-slots");
  slotSec.hidden = !isSCIM;
  if (isSCIM) {
    document.getElementById("slotrules").replaceChildren(...r.slots.rules.map((c) => {
      const e = el("div", "check");
      e.dataset.l = c.ok ? "ok" : c.level;
      e.append(el("div", "dot"), el("div", "t", c.rule),
        el("div", "m", c.ok ? "uygun" : c.why));
      return e;
    }));
    const good = goodRotorSlots(D.Zs, D.p, D.skew, 20, 72);
    document.getElementById("slotsugg").textContent =
      `${D.Zs} oluk / ${2 * D.p} kutup için tüm kurallardan geçen rotor çubuk sayıları: ` +
      (good.join(", ") || "yok") +
      `. Eğim (şu an ${D.skew.toFixed(2)} oluk adımı) gürültü kaynaklı ihlalleri bastırır.`;
  }

  // --- Moment / devir eğrisi ---
  const curveSec = document.getElementById("sec-curve");
  curveSec.hidden = !isSCIM;
  if (isSCIM) document.getElementById("curve").replaceChildren(drawCurve(r));

  // --- Kontroller ---
  document.getElementById("checks").replaceChildren(...checksAny(D, r).map((c) => {
    const e = el("div", "check");
    e.dataset.l = c.level;
    e.append(el("div", "dot"), el("div", "t", c.label), el("div", "m", c.msg));
    return e;
  }));

  // --- Sonuçlar ---
  const rows = isSCIM ? [
    ["Oluk: stator / rotor", `${D.Zs} / ${D.Zr}`, ""],
    ["Kutup sayısı", String(2 * D.p), ""],
    ["Senkron devir", fx(r.ns, 0), "d/dk"],
    ["Kayma", fx(r.s * 100, 2), "%"],
    ["Faz gerilimi", fx(r.V, 1), "V"],
    ["Mıknatıslanma Xm", fx(r.Xm, 2), "Ω"],
    ["Carter katsayısı", fx(r.kc, 3), ""],
    ["Kutup başına akı", fx(r.Phi * 1e3, 3), "mWb"],
    ["Rotor dişi B", fx(r.Btr, 2), "T"],
    ["Rotor boyunduruğu B", fx(r.Byr, 2), "T"],
    ["Faz akımı", fx(r.I1, 3), "A"],
    ["Rotor akımı (indirg.)", fx(r.I2, 3), "A"],
    ["Güç faktörü", fx(r.pf, 3), ""],
    ["Hava aralığı gücü", fx(r.Pgap, 1), "W"],
    ["Giriş gücü", fx(r.Pin, 1), "W"],
    ["Çıkış gücü", fx(r.Pout, 1), "W"],
    ["Stator bakır kaybı", fx(r.Pcus, 1), "W"],
    ["Rotor kaybı", fx(r.Pcur, 1), "W"],
    ["Demir kaybı", fx(r.Pfe, 1), "W"],
    ["Devrilme momenti", fx(r.peakT, 2), "N·m"],
    ["Devrilme kayması", fx(r.peakS * 100, 1), "%"],
    ["Kalkış momenti", fx(r.Tstart, 2), "N·m"],
    ["Kilitli rotor akımı", fx(r.Ilr, 2), "A"],
    ["Oluk doluluğu", fx(r.fill * 100, 1), "%"],
    ["Akım yoğunluğu (sargı)", fx(r.J, 2), "A/mm²"],
    ["Çubuk akımı", fx(r.Ibar, 0), "A"],
    ["Akım yoğunluğu (çubuk)", fx(r.Jbar, 2), "A/mm²"],
    ["Sac kalitesi", `${r.pack.grade} · ${r.pack.thickness} mm`, ""],
    ["Lamina sayısı", fx(r.pack.count, 0), "adet"],
    ["Demir kaybı — histerezis", fx(r.iron.Ph, 1), "W"],
    ["Demir kaybı — girdap", fx(r.iron.Pe, 1), "W"],
    ["Kafes malzemesi", D.cageMat, ""],
    ["Rr — geometriden", fx(r.cageR.Rr, 3), "Ω"],
    ["Rr — kullanılan", fx(r.Rr0, 3), "Ω"],
    ["Çubuk / halka direnci", `${(r.cageR.Rbar * 1e6).toFixed(1)} / ${(r.cageR.Rer * 1e6).toFixed(2)}`, "µΩ"],
    ["Deri kalınlığı (kalkışta)", fx(r.skinStart.delta * 1000, 2), "mm"],
    ["Derin çubuk kR (kalkış)", fx(r.skinStart.kR, 3), ""],
    ["Derin çubuk kR (nominal)", fx(r.skinRated.kR, 3), ""],
    ["Toplam kayıp", fx(r.Ploss, 1), "W"],
    ["Net oluk alanı", fx(r.geom.A_slot, 2), "mm²"],
    ["Boyunduruk kalınlığı", fx(r.geom.hy, 2), "mm"],
    ["Rotor dış çapı", fx(r.cage.Rr * 2, 2), "mm"],
    ["Toplam kütle", fx(r.mass.total, 3), "kg"],
  ] : [
    ["Oluk / kutup", `${D.Zs} / ${w.poles}`, ""],
    ["q (oluk/kutup/faz)", w.q.toFixed(3), ""],
    ["Vuruntu periyodu OKEK", String(w.cogPeriod), ""],
    ["Faz başına sarım", w.Nph.toFixed(0), ""],
    ["Carter katsayısı", fx(r.kc, 3), ""],
    ["Remanans (sıcak)", fx(r.Brm, 3), "T"],
    ["Temel akı, kutup", fx(r.Phi1 * 1e3, 3), "mWb"],
    ["Temel frekans", fx(r.f, 1), "Hz"],
    ["Ters EMK (faz)", fx(r.Erms, 1), "V rms"],
    ["Akım yoğunluğu", fx(r.J, 2), "A/mm²"],
    ["Faz direnci", fx(r.Rph, 4), "Ω"],
    ["Bakır kaybı", fx(r.Pcu, 1), "W"],
    ["Demir kaybı", fx(r.Pfe, 1), "W"],
    ["Moment yoğunluğu", fx(r.torqueDensity, 2), "N·m/kg"],
    ["Toplam kütle", fx(r.mass.total, 2), "kg"],
    ["Oluk alanı", fx(r.geom.A_slot, 1), "mm²"],
    ["Boyunduruk kalınlığı", fx(r.geom.hy, 2), "mm"],
  ];
  document.getElementById("results").replaceChildren(...rows.map(([n, v, u]) => {
    const e = el("div", "row");
    e.appendChild(el("div", "n", n));
    const val = el("div", "v");
    val.innerHTML = `${v}${u ? ` <span>${u}</span>` : ""}`;
    e.appendChild(val);
    return e;
  }));

  // --- Sargı yerleşimi ---
  const cols = [];
  for (let k = 0; k < D.Zs; k++) {
    const col = el("div", "slotcol");
    col.appendChild(el("div", "idx", String(k + 1)));
    const layers = D.Nlayer >= 2 ? [w.top[k], w.bot[k]] : [w.top[k]];
    for (const L of layers) {
      const c = el("div", `cell${L ? ` ph${L.ph}` : " empty"}`);
      c.textContent = L ? `${L.s > 0 ? "+" : "−"}${PHASES[L.ph]}` : "—";
      if (L && L.s < 0) c.style.opacity = "0.62";
      col.appendChild(c);
    }
    cols.push(col);
  }
  document.getElementById("layout").replaceChildren(...cols);
  document.getElementById("layout-note").textContent =
    `${D.Nlayer === 2 ? "Çift" : "Tek"} katman, bobin adımı ${D.coil_pitch} oluk. ` +
    "Üst satır oluk ağzına yakın katman.";

  // --- Harmonikler ---
  document.getElementById("harm").replaceChildren(...w.harmonics.map(({ n, kw }) => {
    const b = el("div", "bar");
    b.appendChild(el("div", "k", kw.toFixed(2)));
    const stalk = el("div", "stalk");
    const fill = el("div", "fill");
    fill.style.height = `${Math.max(1, kw * 100)}%`;
    stalk.appendChild(fill);
    b.append(stalk, el("div", "n", `ν${n}`));
    return b;
  }));

  renderMatrix();
}

/* --- Oluk/kutup matrisi --- */
const M_SLOTS = [3, 6, 9, 12, 18, 24, 27, 36, 48, 54];
const M_POLES = [2, 4, 6, 8, 10, 12, 14, 16, 20, 22];

function renderMatrix() {
  const head = el("tr");
  head.appendChild(el("th", null, "Zs \\ 2p"));
  for (const P2 of M_POLES) head.appendChild(el("th", null, String(P2)));
  const rows = [head];

  for (const Zs of M_SLOTS) {
    const tr = el("tr");
    tr.appendChild(el("th", null, String(Zs)));
    for (const poles of M_POLES) {
      const p = poles / 2;
      const pitch = Math.max(1, Math.round(Zs / poles));
      const w = winding({ ...D, Zs, p, coil_pitch: pitch });
      const td = el("td", null, w.balanced ? w.kw1.toFixed(3) : "—");
      if (!w.balanced) td.classList.add("bad");
      else {
        td.style.background = quality(w.kw1, 0.55, 0.97);
        td.style.color = "#fff";
        td.onclick = () => {
          D.Zs = Zs; D.p = p; D.coil_pitch = pitch;
          save(); syncInputs(); render();
        };
      }
      if (Zs === D.Zs && poles === 2 * D.p) td.classList.add("cur");
      tr.appendChild(td);
    }
    rows.push(tr);
  }
  document.getElementById("matrix").replaceChildren(...rows);
}

buildControls();
render();
