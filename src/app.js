import { defaultDesign, geometry, winding, analyse, checks, toPyleecan, PHASES } from "./motor.js";

/* ------------------------------------------------------------------ *
 * Durum
 * ------------------------------------------------------------------ */
const STORE = "ivq.motor.design";
let D = load();
let view = "winding"; // winding | flux | plain

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return { ...defaultDesign(), ...JSON.parse(raw) };
  } catch { /* depolama yoksa varsayılana düş */ }
  return defaultDesign();
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(D)); } catch { /* yok say */ }
}

/* ------------------------------------------------------------------ *
 * Parametre tanımları
 * ------------------------------------------------------------------ */
const GROUPS = [
  {
    name: "Stator laminasyonu",
    items: [
      ["Rext", "Dış yarıçap", 40, 160, 0.5, "mm"],
      ["Rint", "Delik yarıçapı", 15, 130, 0.5, "mm"],
      ["L1", "Paket boyu", 10, 250, 1, "mm"],
      ["Kf1", "İstifleme faktörü", 0.85, 1.0, 0.01, ""],
    ],
  },
  {
    name: "Oluk profili (SlotW11)",
    items: [
      ["Zs", "Oluk sayısı", 3, 72, 3, ""],
      ["W3", "Diş genişliği", 1, 40, 0.1, "mm"],
      ["H2", "Oluk derinliği", 2, 50, 0.5, "mm"],
      ["W0", "Oluk ağzı", 0.5, 15, 0.1, "mm"],
      ["H0", "Ağız yüksekliği", 0.2, 6, 0.1, "mm"],
      ["H1", "Kama yüksekliği", 0, 8, 0.1, "mm"],
      ["R1", "Dip yarıçapı", 0, 6, 0.1, "mm"],
    ],
  },
  {
    name: "Sargı",
    items: [
      ["p", "Kutup çifti", 1, 24, 1, ""],
      ["Nlayer", "Katman sayısı", 1, 2, 1, ""],
      ["coil_pitch", "Bobin adımı", 1, 24, 1, "oluk"],
      ["Ntcoil", "Bobin başına sarım", 1, 300, 1, ""],
      ["Npcp", "Paralel kol", 1, 8, 1, ""],
      ["Wwire", "Tel çapı", 0.2, 3, 0.05, "mm"],
      ["Nwppc", "Paralel tel", 1, 20, 1, ""],
    ],
  },
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

/* ------------------------------------------------------------------ *
 * Biçimlendirme
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

/* Doyma / yük seviyesine göre ısı rengi */
function heat(val, lo, hi) {
  const t = Math.max(0, Math.min(1, (val - lo) / (hi - lo)));
  return ramp(t, [[63, 110, 140], [78, 140, 107], [201, 162, 39], [178, 62, 42]]);
}

/* Kalite rengi: düşük = kötü (kırmızı), yüksek = iyi (yeşil) */
function quality(val, lo, hi) {
  const t = Math.max(0, Math.min(1, (val - lo) / (hi - lo)));
  return ramp(t, [[164, 62, 45], [186, 133, 40], [96, 141, 92], [55, 122, 96]]);
}

function ramp(t, stops) {
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const c = stops[i].map((a, k) => Math.round(a + (stops[i + 1][k] - a) * f));
  return `rgb(${c.join(",")})`;
}
const sevB = (b, warn, crit) => (b > crit ? "crit" : b > warn ? "warn" : "ok");

/* ------------------------------------------------------------------ *
 * Kesit çizimi
 * ------------------------------------------------------------------ */
const pt = (r, a) => [r * Math.cos(a), -r * Math.sin(a)];
const fmtPt = ([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`;

/** İç ve dış yarıçap arasında, a1..a2 açısını kapsayan halka dilimi. */
function sectorPath(rIn, rOut, a1, a2, hIn, hOut) {
  // hIn/hOut verilirse yarıçapa göre değişen yarı-açı kullanılır
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

/** Tek bir oluğun profili (merkez açısı 0'da; dışarıda döndürülür). */
function slotPath(d, g) {
  const ang = (r, w) => Math.asin(Math.min(0.999, w / r));
  const { r0, r1, r2, r3 } = g;
  const w0 = d.W0 / 2;
  const a0 = ang(r0, w0), a1 = ang(r1, w0);
  const a2 = ang(r2, g.halfWidth(r2));
  const a3 = ang(r3, g.halfWidth(r3));
  const R1 = Math.min(d.R1, d.H2 / 2, g.halfWidth(r3) * 0.9);
  const dA = R1 / r3;
  const rc = r3 - R1;

  return [
    `M ${fmtPt(pt(r0, a0))}`,
    `L ${fmtPt(pt(r1, a1))}`,
    `L ${fmtPt(pt(r2, a2))}`,
    `L ${fmtPt(pt(rc, a3))}`,
    `Q ${fmtPt(pt(r3, a3))} ${fmtPt(pt(r3, Math.max(0, a3 - dA)))}`,
    `A ${r3} ${r3} 0 0 0 ${fmtPt(pt(r3, -Math.max(0, a3 - dA)))}`,
    `Q ${fmtPt(pt(r3, -a3))} ${fmtPt(pt(rc, -a3))}`,
    `L ${fmtPt(pt(r2, -a2))}`,
    `L ${fmtPt(pt(r1, -a1))}`,
    `L ${fmtPt(pt(r0, -a0))}`,
    `A ${r0} ${r0} 0 0 1 ${fmtPt(pt(r0, a0))}`,
    "Z",
  ].join(" ");
}

function drawSection(r) {
  const g = r.geom, w = r.wind;
  const R = D.Rext * 1.06;
  const svg = svgEl("svg", { viewBox: `${-R} ${-R} ${2 * R} ${2 * R}`, role: "img",
    "aria-label": `${D.Zs} oluk ${w.poles} kutup motor kesiti` });

  const add = (t, a) => { const e = svgEl(t, a); svg.appendChild(e); return e; };

  const fluxView = view === "flux";
  // Not: sunum özniteliği (fill=) CSS sınıfına yenilir; ısı rengi satır içi
  // stil olarak verilmeli.
  const tint = (c) => (c ? { style: `fill:${c}` } : {});

  // Stator: boyunduruk -> diş bölgesi -> delik
  add("circle", { r: D.Rext, class: "lam-yoke", ...tint(fluxView && heat(r.By, 0.6, 2.0)) });
  add("circle", { r: g.r3, class: "lam-teeth", ...tint(fluxView && heat(r.Bt, 0.6, 2.0)) });
  add("circle", { r: D.Rint, class: "air" });

  // Oluklar + sargı
  const path = slotPath(D, g);
  const nLay = Math.max(1, D.Nlayer);
  for (let k = 0; k < D.Zs; k++) {
    const rot = (360 * k) / D.Zs;
    const grp = add("g", { transform: `rotate(${-rot})` });
    grp.appendChild(svgEl("path", { d: path, class: "slot-air" }));

    if (view === "winding") {
      const layers = nLay >= 2 ? [w.top[k], w.bot[k]] : [w.top[k]];
      const span = g.r3 - g.r2 - 0.6;
      layers.forEach((L, i) => {
        if (!L) return;
        const rA = g.r2 + 0.3 + (span / nLay) * i;
        const rB = rA + (span / nLay) * 0.86;
        const inset = 0.55;
        const hIn = Math.asin(Math.min(0.999, Math.max(0, g.halfWidth(rA) - inset) / rA));
        const hOut = Math.asin(Math.min(0.999, Math.max(0, g.halfWidth(rB) - inset) / rB));
        grp.appendChild(svgEl("path", {
          d: sectorPath(rA, rB, 0, 0, hIn, hOut),
          class: `wnd${L.ph}${L.s < 0 ? " wnd-neg" : ""}`,
        }));
      });
    }
  }

  // Rotor
  add("circle", { r: g.Rr, class: "rotor-st", ...tint(fluxView && heat(r.Bry, 0.6, 2.0)) });
  const half = g.Wmag_rad / 2;
  for (let k = 0; k < w.poles; k++) {
    const c = (k * 2 * Math.PI) / w.poles;
    add("path", {
      d: sectorPath(g.Rm_in, g.Rr, c - half, c + half),
      class: k % 2 ? "mag-s" : "mag-n",
    });
  }
  add("circle", { r: g.Rsh, class: "shaft-f" });

  // Kenar çizgileri
  for (const rr of [D.Rext, g.r3, D.Rint, g.Rr, g.Rm_in, g.Rsh])
    if (rr > 0) add("circle", { r: rr, class: "edge" });

  return svg;
}

/* ------------------------------------------------------------------ *
 * Kurulum — statik iskelet
 * ------------------------------------------------------------------ */
const app = document.getElementById("app");

app.innerHTML = `
<div class="masthead">
  <h1>Motor Tasarım Atölyesi</h1>
  <span class="sub">SPM · analitik çekirdek · pyleecan uyumlu</span>
</div>

<div class="instrument">
  <div class="stage">
    <div class="views" role="group" aria-label="Görünüm">
      <button class="chip" data-view="winding" aria-pressed="true">Sargı</button>
      <button class="chip" data-view="flux" aria-pressed="false">Akı</button>
      <button class="chip" data-view="plain" aria-pressed="false">Sade</button>
    </div>
    <div id="stage"></div>
  </div>
  <div class="vitals" id="vitals"></div>
</div>

<div class="stream">
<section><h2>Kontroller</h2><div class="card" id="ctrls"></div></section>

<section><h2>Tasarım kontrolü</h2><div class="card" id="checks"></div></section>

<section><h2>Sonuçlar</h2><div class="card"><div class="results" id="results"></div></div></section>

<section><h2>Sargı yerleşimi</h2><div class="card">
  <div class="scroller"><div class="layout" id="layout"></div></div>
  <p class="note" id="layout-note"></p>
</div></section>

<section><h2>Sargı faktörü harmonikleri</h2><div class="card">
  <div class="harm" id="harm"></div>
</div></section>

<section><h2>Oluk / kutup matrisi</h2><div class="card">
  <div class="scroller"><table class="matrix" id="matrix"></table></div>
  <p class="note">Hücre değeri temel sargı faktörü kw₁. Bir hücreye dokunarak o kombinasyona geçebilirsiniz. Soluk hücreler dengeli üç fazlı sargı vermez.</p>
</div></section>

<section><h2>Dışa aktar</h2><div class="card">
  <div class="actions">
    <button class="act" id="exp-pyl">Pyleecan JSON</button>
    <button class="act ghost" id="exp-design">Tasarım JSON</button>
    <button class="act ghost" id="reset">Varsayılana dön</button>
  </div>
  <p class="note">Pyleecan JSON doğrudan <code>pyleecan.Functions.load.load()</code> ile açılır; sınıf adları ve SI birimleri (metre) şemaya uygundur. Sonraki adımda bu dosya FEMM üzerinden doğrusal olmayan manyetostatik analize gönderilecek.</p>
</div></section>

<p class="note">Bu araç analitik manyetik devre modeli kullanır — hızlı ön tasarım içindir, FEA yerine geçmez.
Doyma, Carter katsayısı, sıcaklığa bağlı remanans ve yıldız diyagramı sargı faktörü hesaba katılmıştır.</p>
</div>
`;

/* --- Kontrolleri oluştur --- */
const ctrlEls = {};
{
  const host = document.getElementById("ctrls");
  for (const grp of GROUPS) {
    const gEl = el("div", "group");
    gEl.appendChild(el("span", "lbl", grp.name));
    const box = el("div", "ctrls");
    for (const [key, label, min, max, step, unit] of grp.items) {
      const c = el("div", "ctrl");
      const lab = el("label", null);
      lab.htmlFor = `c-${key}`;
      lab.textContent = label;
      const num = el("div", "num");
      const input = svgInput(key, min, max, step);
      c.append(lab, num, input);
      box.appendChild(c);
      ctrlEls[key] = { num, input, unit, step };
    }
    gEl.appendChild(box);
    host.appendChild(gEl);
  }
}
function svgInput(key, min, max, step) {
  const i = document.createElement("input");
  i.type = "range"; i.id = `c-${key}`;
  i.min = min; i.max = max; i.step = step; i.value = D[key];
  i.addEventListener("input", () => {
    D[key] = parseFloat(i.value);
    if (key === "Zs" || key === "p") D.coil_pitch = Math.min(D.coil_pitch, D.Zs);
    save();
    render();
  });
  return i;
}

/* --- Görünüm düğmeleri --- */
for (const b of document.querySelectorAll(".chip[data-view]")) {
  b.addEventListener("click", () => {
    view = b.dataset.view;
    for (const o of document.querySelectorAll(".chip[data-view]"))
      o.setAttribute("aria-pressed", String(o.dataset.view === view));
    render();
  });
}

/* --- Dışa aktarma --- */
const download = (name, obj) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
document.getElementById("exp-pyl").onclick = () => download(`${D.name}.json`, toPyleecan(D));
document.getElementById("exp-design").onclick = () => download(`${D.name}-design.json`, D);
document.getElementById("reset").onclick = () => { D = defaultDesign(); save(); syncInputs(); render(); };

function syncInputs() {
  for (const [k, c] of Object.entries(ctrlEls)) c.input.value = D[k];
}

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */
function render() {
  const r = analyse(D);
  const w = r.wind;

  // Kesit
  const stage = document.getElementById("stage");
  stage.replaceChildren(drawSection(r));
  if (view === "flux") {
    const key = el("div", "fluxkey");
    const bar = el("div", "ramp");
    bar.style.background = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1]
      .map((t) => heat(0.6 + t * 1.4, 0.6, 2.0)).join(",")})`;
    key.append(el("span", null, "0.6"), bar, el("span", null, "2.0 T"));
    stage.appendChild(key);
  }

  // Kontrol değerleri
  for (const [k, c] of Object.entries(ctrlEls)) {
    const dec = c.step >= 1 ? 0 : c.step >= 0.1 ? 1 : 2;
    c.num.innerHTML = `${fx(D[k], dec)}${c.unit ? ` <span>${c.unit}</span>` : ""}`;
  }

  // Hayati değerler
  const vitals = [
    ["Bδ", fx(r.Bg, 3), "T", "ok"],
    ["B diş", fx(r.Bt, 2), "T", sevB(r.Bt, 1.8, 2.0)],
    ["B boy.", fx(r.By, 2), "T", sevB(r.By, 1.6, 1.8)],
    ["kw₁", fx(w.kw1, 3), "", w.kw1 < 0.8 ? "warn" : "ok"],
    ["Moment", fx(r.T, 1), "N·m", "ok"],
    ["Güç", fx(r.Pmech / 1000, 2), "kW", "ok"],
    ["Doluluk", fx(r.fill * 100, 0), "%", r.fill > 0.5 ? "crit" : r.fill > 0.42 ? "warn" : "ok"],
    ["Verim", fx(r.eta * 100, 1), "%", "ok"],
  ];
  const vHost = document.getElementById("vitals");
  vHost.replaceChildren(...vitals.map(([k, v, u, sev]) => {
    const t = el("div", "vital");
    t.dataset.sev = sev;
    t.appendChild(el("div", "k", k));
    const val = el("div", "v");
    val.innerHTML = `${v}${u ? ` <span>${u}</span>` : ""}`;
    t.appendChild(val);
    return t;
  }));

  // Kontroller
  const cHost = document.getElementById("checks");
  cHost.replaceChildren(...checks(D, r).map((c) => {
    const e = el("div", "check");
    e.dataset.l = c.level;
    e.appendChild(el("div", "dot"));
    e.appendChild(el("div", "t", c.label));
    e.appendChild(el("div", "m", c.msg));
    return e;
  }));

  // Sonuçlar
  const rows = [
    ["Oluk / kutup", `${D.Zs} / ${w.poles}`, ""],
    ["q (oluk/kutup/faz)", w.q.toFixed(3), ""],
    ["Vuruntu periyodu OKEK", String(w.cogPeriod), ""],
    ["Makine periyodikliği t", String(w.t), ""],
    ["Faz başına sarım", w.Nph.toFixed(0), ""],
    ["Carter katsayısı", fx(r.kc, 3), ""],
    ["Remanans (sıcak)", fx(r.Brm, 3), "T"],
    ["Temel akı, kutup", fx(r.Phi1 * 1e3, 3), "mWb"],
    ["Rotor boyunduruğu B", fx(r.Bry, 2), "T"],
    ["Temel frekans", fx(r.f, 1), "Hz"],
    ["Ters EMK (faz)", fx(r.Erms, 1), "V rms"],
    ["Moment sabiti", fx(1.5 * D.p * w.kw1 * w.Nph * r.Phi1, 4), "N·m/A"],
    ["Akım yoğunluğu", fx(r.J, 2), "A/mm²"],
    ["Faz direnci", fx(r.Rph, 4), "Ω"],
    ["Bakır kaybı", fx(r.Pcu, 1), "W"],
    ["Demir kaybı", fx(r.Pfe, 1), "W"],
    ["Moment yoğunluğu", fx(r.torqueDensity, 2), "N·m/kg"],
    ["Kütle — sac", fx(r.mass.steel, 2), "kg"],
    ["Kütle — bakır", fx(r.mass.copper, 2), "kg"],
    ["Kütle — mıknatıs", fx(r.mass.magnet, 3), "kg"],
    ["Toplam kütle", fx(r.mass.total, 2), "kg"],
    ["Oluk alanı", fx(r.geom.A_slot, 1), "mm²"],
    ["Boyunduruk kalınlığı", fx(r.geom.hy, 2), "mm"],
    ["Oluk üst / dip genişliği", `${fx(r.geom.W1, 1)} / ${fx(r.geom.W2, 1)}`, "mm"],
  ];
  document.getElementById("results").replaceChildren(...rows.map(([n, v, u]) => {
    const e = el("div", "row");
    e.appendChild(el("div", "n", n));
    const val = el("div", "v");
    val.innerHTML = `${v}${u ? ` <span>${u}</span>` : ""}`;
    e.appendChild(val);
    return e;
  }));

  // Sargı yerleşimi
  const lHost = document.getElementById("layout");
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
  lHost.replaceChildren(...cols);
  document.getElementById("layout-note").textContent =
    `${D.Nlayer === 2 ? "Çift" : "Tek"} katman, bobin adımı ${D.coil_pitch} oluk. ` +
    `Üst satır oluk ağzına yakın katman. İşaret iletken yönünü gösterir.`;

  // Harmonikler
  document.getElementById("harm").replaceChildren(...w.harmonics.map(({ n, kw }) => {
    const b = el("div", "bar");
    b.appendChild(el("div", "k", kw.toFixed(2)));
    const stalk = el("div", "stalk");
    const fill = el("div", "fill");
    fill.style.height = `${Math.max(1, kw * 100)}%`;
    stalk.appendChild(fill);
    b.appendChild(stalk);
    b.appendChild(el("div", "n", `ν${n}`));
    return b;
  }));

  renderMatrix();
}

/* --- Oluk/kutup matrisi --- */
const M_SLOTS = [3, 6, 9, 12, 15, 18, 24, 27, 36, 48];
const M_POLES = [2, 4, 6, 8, 10, 12, 14, 16, 20, 22];

function renderMatrix() {
  const t = document.getElementById("matrix");
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
  t.replaceChildren(...rows);
}

render();
