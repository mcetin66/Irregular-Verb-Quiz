/**
 * Bağımsız WebGL görüntüleyici — harici kütüphane yok.
 *
 * Motorun tüm parçaları 2B kesit profillerinin eksen boyunca ötelenmesiyle
 * (extrusion) üretilir. Kesit alma, parçaları ayırma (patlatılmış görünüm),
 * döndürme ve yakınlaştırma desteklenir.
 *
 * Eksen düzeni: motor ekseni +Z, kesit düzlemi XY — 2B çizimle aynı.
 */

/* ------------------------------------------------------------------ *
 * Küçük matris kütüphanesi (sütun öncelikli, WebGL düzeni)
 * ------------------------------------------------------------------ */
const M4 = {
  identity: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),

  perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  },

  multiply(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    return o;
  },

  /**
   * Tornatabla kamerası:  V = T(0,0,-d) · Rx(elev) · Ry(azim)
   * azim = 0 motorun yüzünü (kesit düzlemini), azim = π/2 yan görünüşü verir.
   */
  orbit(azim, elev, dist) {
    const ca = Math.cos(azim), sa = Math.sin(azim);
    const ce = Math.cos(elev), se = Math.sin(elev);
    return new Float32Array([
      ca, se * sa, -ce * sa, 0,
      0, ce, se, 0,
      sa, -se * ca, ce * ca, 0,
      0, 0, -dist, 1,
    ]);
  },
};

/* ------------------------------------------------------------------ *
 * Ağ (mesh) üretimi
 * ------------------------------------------------------------------ */
class MeshBuilder {
  constructor() { this.v = []; }

  /** Üçgen ekler; normal köşelerden hesaplanır (düz gölgeleme). */
  tri(a, b, c) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    for (const p of [a, b, c]) this.v.push(p[0], p[1], p[2], nx, ny, nz);
  }

  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }

  /**
   * Halka/boru: rIn..rOut yarıçapları arasında, z0..z1 boyunca,
   * a0..a1 açı aralığında. rIn = 0 ise dolu silindir.
   */
  tube(rIn, rOut, z0, z1, a0 = 0, a1 = Math.PI * 2, seg = 72) {
    const n = Math.max(3, Math.ceil((seg * (a1 - a0)) / (Math.PI * 2)));
    const P = (r, a, z) => [r * Math.cos(a), r * Math.sin(a), z];
    for (let i = 0; i < n; i++) {
      const A = a0 + ((a1 - a0) * i) / n, B = a0 + ((a1 - a0) * (i + 1)) / n;
      // dış yüzey
      this.quad(P(rOut, A, z0), P(rOut, B, z0), P(rOut, B, z1), P(rOut, A, z1));
      // iç yüzey (ters yön)
      if (rIn > 0)
        this.quad(P(rIn, A, z1), P(rIn, B, z1), P(rIn, B, z0), P(rIn, A, z0));
      // uç halkalar
      this.quad(P(rIn, A, z1), P(rOut, A, z1), P(rOut, B, z1), P(rIn, B, z1));
      this.quad(P(rOut, A, z0), P(rIn, A, z0), P(rIn, B, z0), P(rOut, B, z0));
    }
  }

  /**
   * Şerit prizma: her seviye {r, half} (yarıçap ve yarı açı) verir.
   * Merkez açısı ac olan, z0..z1 boyunca ötelenmiş katı üretir.
   */
  ribbon(levels, ac, z0, z1, twist = 0) {
    const P = (r, a, z) => [r * Math.cos(a), r * Math.sin(a), z];
    const a0 = ac - twist / 2, a1 = ac + twist / 2;
    const L = levels.map((s) => P(s.r, a0 + s.half, z0));
    const R = levels.map((s) => P(s.r, a0 - s.half, z0));
    const L1 = levels.map((s) => P(s.r, a1 + s.half, z1));
    const R1 = levels.map((s) => P(s.r, a1 - s.half, z1));

    for (let i = 0; i < levels.length - 1; i++) {
      // ön ve arka yüzler
      this.quad(R[i], L[i], L[i + 1], R[i + 1]);
      this.quad(L1[i], R1[i], R1[i + 1], L1[i + 1]);
      // yan duvarlar
      this.quad(L[i], L1[i], L1[i + 1], L[i + 1]);
      this.quad(R1[i], R[i], R[i + 1], R1[i + 1]);
    }
    // uç kapaklar (iç ve dış yarıçapta)
    const n = levels.length - 1;
    this.quad(L[0], R[0], R1[0], L1[0]);
    this.quad(R[n], L[n], L1[n], R1[n]);
  }

  data() { return new Float32Array(this.v); }
  get count() { return this.v.length / 6; }
}

/* ------------------------------------------------------------------ *
 * Motor geometrisi -> parçalar
 * ------------------------------------------------------------------ */

/** Oluk profilinin r yarıçapındaki yarı genişliği (mm). */
function slotHalf(d, g, r) {
  if (r <= g.r1) return d.W0 / 2;
  if (r <= g.r2) {
    const t = (r - g.r1) / Math.max(1e-6, g.r2 - g.r1);
    return d.W0 / 2 + t * (g.halfWidth(g.r2) - d.W0 / 2);
  }
  return g.halfWidth(r);
}

/** Bir yarıçapta diş yarı açısı (oluklar arasında kalan malzeme). */
const toothHalf = (d, g, r, Z) =>
  Math.max(0.002, Math.PI / Z - Math.asin(Math.min(0.999, slotHalf(d, g, r) / r)));

function levelsBetween(rA, rB, fn, n = 6) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const r = rA + ((rB - rA) * i) / n;
    out.push({ r, half: fn(r) });
  }
  return out;
}

/**
 * Tasarımdan parça listesi üretir.
 * Her parça: { key, label, color, mesh, axial } — axial patlatma yönüdür.
 */
export function buildParts(d, r, colors) {
  const g = r.geom;
  const hz = d.L1 / 2;
  const isSCIM = d.type === "scim";
  const parts = [];

  const push = (key, label, color, axial, fn) => {
    const m = new MeshBuilder();
    fn(m);
    if (m.count) parts.push({ key, label, color, axial, data: m.data(), count: m.count });
  };

  // --- Stator boyunduruğu ---
  push("yoke", "Stator boyunduruğu", colors.lam, 0, (m) =>
    m.tube(g.r3, d.Rext, -hz, hz));

  // --- Stator dişleri ---
  push("teeth", "Stator dişleri", colors.tooth, 0, (m) => {
    const lv = levelsBetween(g.r0, g.r3, (rr) => toothHalf(d, g, rr, d.Zs), 8);
    for (let k = 0; k < d.Zs; k++)
      m.ribbon(lv, ((k + 0.5) * Math.PI * 2) / d.Zs, -hz, hz);
  });

  // --- Sargılar: oluk içi iletken demetleri, faz rengiyle ---
  const nLay = Math.max(1, d.Nlayer);
  const span = g.r3 - g.r2 - 0.6;
  for (let ph = 0; ph < 3; ph++) {
    push(`w${ph}`, `Faz ${"ABC"[ph]} sargısı`, colors.phase[ph], 0, (m) => {
      for (let k = 0; k < d.Zs; k++) {
        const layers = nLay >= 2 ? [r.wind.top[k], r.wind.bot[k]] : [r.wind.top[k]];
        layers.forEach((L, i) => {
          if (!L || L.ph !== ph) return;
          const rA = g.r2 + 0.3 + (span / nLay) * i;
          const rB = rA + (span / nLay) * 0.86;
          const lv = levelsBetween(rA, rB, (rr) =>
            Math.asin(Math.min(0.999, Math.max(0.01, slotHalf(d, g, rr) - 0.45) / rr)), 3);
          m.ribbon(lv, (k * Math.PI * 2) / d.Zs, -hz, hz);
        });
      }
    });
  }

  // --- Sargı başları: her iki uçta bakır halka ---
  const endLen = Math.max(3, 0.55 * d.coil_pitch * g.tau_s);
  push("endw", "Sargı başları", colors.phase[0], 0, (m) => {
    m.tube(g.r2 + 0.3, g.r3 - 0.3, hz, hz + endLen);
    m.tube(g.r2 + 0.3, g.r3 - 0.3, -hz - endLen, -hz);
  });

  // --- Rotor ---
  // Eğim (skew) rotor oluklarını eksen boyunca burar; fotoğraftaki helisel
  // görünümün kaynağı budur ve asalak momentleri bastırır.
  const twist = ((d.skew ?? 0) * Math.PI * 2) / Math.max(1, d.Zr ?? 1);
  if (isSCIM) {
    const c = r.cage;
    // rotor dişleri (çubuklar arası sac)
    push("rteeth", "Rotor sacı", colors.rotor, -1, (m) => {
      const half = (rr) => {
        let slotHalfW;
        if (rr > c.rb1) {
          // kapalı olukta ağız yok: köprü kesintisiz demir
          slotHalfW = d.rotorClosed ? 0 : d.W0r / 2;
        } else {
          const t = (rr - c.rb0) / Math.max(0.1, c.rb1 - c.rb0);
          slotHalfW = (d.Wbar / 2) * (0.55 + 0.45 * Math.sqrt(Math.max(0, t)));
        }
        return Math.max(0.002, Math.PI / d.Zr -
          Math.asin(Math.min(0.999, slotHalfW / rr)));
      };
      const lv = levelsBetween(c.rb0, c.Rr, half, 8);
      for (let k = 0; k < d.Zr; k++)
        m.ribbon(lv, ((k + 0.5) * Math.PI * 2) / d.Zr, -hz, hz, twist);
      m.tube(c.Rsh, c.rb0, -hz, hz);
    });
    // kafes çubukları — dibe doğru daralan, yuvarlatılmış profil
    push("bars", "Kafes çubukları", colors.cage, -1, (m) => {
      const lv = levelsBetween(c.rb0 + 0.1, c.rb1, (rr) => {
        const t = (rr - c.rb0) / Math.max(0.1, c.rb1 - c.rb0);
        const wHalf = (d.Wbar / 2) * (0.55 + 0.45 * Math.sqrt(Math.max(0, t)));
        return Math.asin(Math.min(0.999, wHalf / rr));
      }, 6);
      for (let k = 0; k < d.Zr; k++)
        m.ribbon(lv, (k * Math.PI * 2) / d.Zr, -hz, hz, twist);
    });
    // kısa devre halkaları
    push("rings", "Kısa devre halkaları", colors.cage, -1, (m) => {
      const w = 2 * d.Wbar;
      m.tube(c.rb0, c.rb1, hz, hz + w);
      m.tube(c.rb0, c.rb1, -hz - w, -hz);
    });
  } else {
    push("rlam", "Rotor sacı", colors.rotor, -1, (m) =>
      m.tube(g.Rsh, g.Rm_in, -hz, hz));
    push("mag", "Mıknatıslar", colors.magnet, -1, (m) => {
      const half = g.Wmag_rad / 2;
      for (let k = 0; k < 2 * d.p; k++) {
        const a = (k * Math.PI * 2) / (2 * d.p);
        m.tube(g.Rm_in, g.Rr, -hz, hz, a - half, a + half, 96);
      }
    });
  }

  // --- Mil: paket içinde oturma çapı, dışarıda kademeli olarak incelir ---
  const seatR = (isSCIM ? r.cage.Rsh : g.Rsh);
  const extR = Math.min(seatR, (d.Dshaft ?? 26) / 2);
  const stub = Math.max(12, 0.35 * d.L1);
  const shoulder = 4;                       // omuz payı, paket dışında
  push("shaft", "Mil", colors.shaft, -1, (m) => {
    m.tube(0, seatR, -hz - shoulder, hz + shoulder);           // oturma çapı
    m.tube(0, extR, hz + shoulder, hz + stub);                 // tahrik ucu
    m.tube(0, extR, -hz - stub, -hz - shoulder);               // karşı uç
  });

  return parts;
}

/* ------------------------------------------------------------------ *
 * Gölgelendiriciler
 * ------------------------------------------------------------------ */
const VS = `
attribute vec3 aPos;
attribute vec3 aNor;
uniform mat4 uProj, uView;
uniform float uAxial;      // patlatma ötelemesi
varying vec3 vNor, vModel;
void main() {
  vec3 p = aPos + vec3(0.0, 0.0, uAxial);
  vNor = aNor;
  vModel = aPos;
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;

const FS = `
precision mediump float;
varying vec3 vNor, vModel;
uniform vec3 uColor;
uniform vec3 uEye;         // kamera yönü (model uzayında)
uniform vec3 uKey, uFill;  // ışık yönleri, kamera çerçevesinden türetilir
uniform vec2 uCut;         // x: dilimin merkez açısı, y: yarı genişliği
uniform float uCutOn;
void main() {
  if (uCutOn > 0.5) {
    // dilim daima kameraya baksın: merkeze göre sarmalı fark
    float delta = atan(vModel.y, vModel.x) - uCut.x;
    delta = mod(delta + 3.14159265, 6.28318531) - 3.14159265;
    if (abs(delta) < uCut.y) discard;
  }
  // Çift taraflı aydınlatma. gl_FrontFacing üçgen sarım yönüne bağlıdır ve
  // kesit alınmış katılarda güvenilmez; normali doğrudan kameraya çeviriyoruz.
  vec3 n = normalize(vNor);
  if (dot(n, normalize(uEye)) < 0.0) n = -n;

  // Işıklar kamera çerçevesine bağlıdır: model döndükçe onlar da döner,
  // böylece hiçbir bakış açısında yüzeyler karanlıkta kalmaz.
  float d = max(dot(n, uKey), 0.0) * 0.50
          + max(dot(n, uFill), 0.0) * 0.18
          + max(dot(n, normalize(uEye)), 0.0) * 0.34
          + 0.22;
  // kenar aydınlatması, biçimi ayırmak için
  float rim = pow(1.0 - abs(n.z), 3.0) * 0.10;
  gl_FragColor = vec4(uColor * d + rim, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) || "gölgelendirici derlenemedi");
  return s;
}

/* ------------------------------------------------------------------ *
 * Görüntüleyici
 * ------------------------------------------------------------------ */
export function createViewer(canvas) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
  if (!gl) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) || "program bağlanamadı");
  gl.useProgram(prog);

  const loc = {
    pos: gl.getAttribLocation(prog, "aPos"),
    nor: gl.getAttribLocation(prog, "aNor"),
    proj: gl.getUniformLocation(prog, "uProj"),
    view: gl.getUniformLocation(prog, "uView"),
    color: gl.getUniformLocation(prog, "uColor"),
    axial: gl.getUniformLocation(prog, "uAxial"),
    eye: gl.getUniformLocation(prog, "uEye"),
    key: gl.getUniformLocation(prog, "uKey"),
    fill: gl.getUniformLocation(prog, "uFill"),
    cut: gl.getUniformLocation(prog, "uCut"),
    cutOn: gl.getUniformLocation(prog, "uCutOn"),
  };
  gl.enableVertexAttribArray(loc.pos);
  gl.enableVertexAttribArray(loc.nor);
  gl.enable(gl.DEPTH_TEST);

  const state = {
    azim: Math.PI / 2 + 0.6, elev: 0.38, dist: 5.4,
    cut: 0, explode: 0, spin: false,
    hidden: new Set(),
  };
  let parts = [], buffers = [], radius = 1, bg = [0, 0, 0, 0];
  let raf = 0, dirty = true;

  function setParts(next, extent) {
    for (const b of buffers) gl.deleteBuffer(b);
    parts = next; buffers = [];
    radius = extent;
    for (const p of parts) {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, p.data, gl.STATIC_DRAW);
      buffers.push(b);
    }
    dirty = true;
  }

  function draw() {
    raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // dar görüş açısı: yakındaki sargı başlarının statordan büyük görünmesini engeller
    const proj = M4.perspective(0.5, w / h, radius * 0.05, radius * 60);
    const view = M4.orbit(state.azim, state.elev, radius * state.dist);
    gl.uniformMatrix4fv(loc.proj, false, proj);
    gl.uniformMatrix4fv(loc.view, false, view);

    // Kamera model uzayında nerede duruyorsa dilimi oraya çevir, böylece
    // hangi açıdan bakılırsa bakılsın kesit açık kalır.
    const ce = Math.cos(state.elev), se = Math.sin(state.elev);
    // Kamera çerçevesi model uzayında: görüntü matrisinin satırları.
    const ca = Math.cos(state.azim), sa = Math.sin(state.azim);
    const right = [ca, 0, sa];
    const up = [se * sa, ce, -se * ca];
    const eye = [-ce * sa, se, ce * ca];
    const mix = (a, b, c, wa, wb, wc) => {
      const v = [a[0] * wa + b[0] * wb + c[0] * wc,
                 a[1] * wa + b[1] * wb + c[1] * wc,
                 a[2] * wa + b[2] * wb + c[2] * wc];
      const L = Math.hypot(...v) || 1;
      return new Float32Array([v[0] / L, v[1] / L, v[2] / L]);
    };
    gl.uniform3fv(loc.eye, new Float32Array(eye));
    gl.uniform3fv(loc.key, mix(right, up, eye, 0.45, 0.55, 0.75));
    gl.uniform3fv(loc.fill, mix(right, up, eye, -0.6, -0.35, 0.35));
    const camAngle = Math.atan2(se, -ce * Math.sin(state.azim));
    gl.uniform1f(loc.cutOn, state.cut > 0.001 ? 1 : 0);
    gl.uniform2f(loc.cut, camAngle, state.cut * Math.PI);

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (state.hidden.has(p.key)) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i]);
      gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(loc.nor, 3, gl.FLOAT, false, 24, 12);
      gl.uniform3fv(loc.color, p.color);
      gl.uniform1f(loc.axial, p.axial * state.explode * radius * 1.1);
      gl.drawArrays(gl.TRIANGLES, 0, p.count);
    }

    if (state.spin) { state.azim += 0.006; schedule(); }
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  /* --- Etkileşim: sürükle, tekerlek, iki parmakla yakınlaştırma --- */
  const pointers = new Map();
  let lastPinch = 0;

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    state.spin = false;
  });
  canvas.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      state.azim -= (cur.x - prev.x) * 0.009;
      state.elev = Math.max(-1.45, Math.min(1.45, state.elev + (cur.y - prev.y) * 0.009));
      schedule();
    }
    pointers.set(e.pointerId, cur);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch) {
        state.dist = Math.max(3, Math.min(18, state.dist * (lastPinch / dist)));
        schedule();
      }
      lastPinch = dist;
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    state.dist = Math.max(3, Math.min(18, state.dist * (1 + Math.sign(e.deltaY) * 0.12)));
    schedule();
  }, { passive: false });

  return {
    setParts, schedule, state,
    setBackground(rgba) { bg = rgba; schedule(); },
    setView(azim, elev) { state.azim = azim; state.elev = elev; state.spin = false; schedule(); },
    dispose() {
      cancelAnimationFrame(raf);
      for (const b of buffers) gl.deleteBuffer(b);
    },
  };
}
