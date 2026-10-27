/* Vista 3D del plano: arma el modelo (cimentación, muros, estructura, cubierta, bloques y elementos propios) y lo dibuja.
   Con WebGL (three.js, incluido en la app) usa luces, sombras y texturas; sin WebGL ordena las caras por profundidad en un canvas 2D. */
const Iso = (() => {
  const E = Elementos;

  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const resta = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const cruz = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const punto = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const unit = v => { const L = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / L, y: v.y / L, z: v.z / L }; };
  const centro = pts => pts.reduce((c, p) => ({ x: c.x + p.x / pts.length, y: c.y + p.y / pts.length, z: c.z + p.z / pts.length }), { x: 0, y: 0, z: 0 });

  const CONCRETO = '#c4c3bd', CIMIENTO = '#a69e90', ACERO = '#8f9aa5', MADERA = '#9b6b43', BLANCO = '#f4f4f1', VIDRIO = '#9fd0ea';
  const PANETE = '#eee8dc';
  const LISO = { sinBorde: true };

  /* ---------- Primitivas ---------- */
  function cara(pts, color, ref, op = {}) {
    let n = unit(cruz(resta(pts[1], pts[0]), resta(pts[2], pts[0])));
    if (ref && punto(n, resta(centro(pts), ref)) < 0) { pts = pts.slice().reverse(); n = { x: -n.x, y: -n.y, z: -n.z }; }
    return { pts, n, color, ...op };
  }

  // Prisma vertical a partir de un polígono en planta
  function prisma(base, z0, z1, color, op) {
    if (z1 - z0 < 1e-4) return [];
    const ref = { ...centro(base.map(p => ({ ...p, z: 0 }))), z: (z0 + z1) / 2 };
    const abajo = base.map(p => ({ x: p.x, y: p.y, z: z0 })), arriba = base.map(p => ({ x: p.x, y: p.y, z: z1 }));
    const caras = [cara(arriba, color, ref, op), cara(abajo, color, ref, op)];
    base.forEach((p, i) => {
      const j = (i + 1) % base.length;
      caras.push(cara([abajo[i], abajo[j], arriba[j], arriba[i]], color, ref, op));
    });
    return caras;
  }

  // Barra de sección w × h entre dos puntos 3D (correas, cerchas, ramas)
  function barra(p, q, w, h, color, op) {
    const d = unit(resta(q, p));
    let s = cruz(d, { x: 0, y: 0, z: 1 });
    if (Math.hypot(s.x, s.y, s.z) < 1e-6) s = { x: 1, y: 0, z: 0 };
    s = unit(s);
    const u = cruz(s, d);
    const esq = o => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: o.x + (s.x * a * w + u.x * b * h) / 2, y: o.y + (s.y * a * w + u.y * b * h) / 2, z: o.z + (s.z * a * w + u.z * b * h) / 2 }));
    const A = esq(p), B = esq(q), ref = centro([p, q]);
    const caras = [cara(A, color, ref, op), cara(B, color, ref, op)];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; caras.push(cara([A[i], A[j], B[j], B[i]], color, ref, op)); }
    return caras;
  }

  const circulo = (cx, cy, r, n = 16) => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos(i * 2 * Math.PI / n), y: cy + r * Math.sin(i * 2 * Math.PI / n) }));
  const cilindro = (cx, cy, r, z0, z1, color, op = LISO) => prisma(circulo(cx, cy, r), z0, z1, color, { ...LISO, ...op });

  function esfera(c, rx, ry, rz, color, op = LISO, nLat = 6, nLon = 12) {
    const P = (i, j) => {
      const t = Math.PI * i / nLat, f = 2 * Math.PI * j / nLon;
      return { x: c.x + rx * Math.sin(t) * Math.cos(f), y: c.y + ry * Math.sin(t) * Math.sin(f), z: c.z + rz * Math.cos(t) };
    };
    const caras = [];
    for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) {
      const pts = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)].filter((p, k, a) => k === 0 || Math.hypot(p.x - a[k - 1].x, p.y - a[k - 1].y, p.z - a[k - 1].z) > 1e-6);
      if (pts.length >= 3) caras.push(cara(pts, color, c, { ...LISO, ...op }));
    }
    return caras;
  }

  // Triángulo o polígono vertical con espesor t (culatas)
  function placa(pts, normal, t, color, op) {
    const o = { x: normal.x * t / 2, y: normal.y * t / 2, z: normal.z * t / 2 };
    const A = pts.map(p => ({ x: p.x + o.x, y: p.y + o.y, z: p.z + o.z })), B = pts.map(p => ({ x: p.x - o.x, y: p.y - o.y, z: p.z - o.z }));
    const ref = centro(pts);
    const caras = [cara(A, color, ref, op), cara(B, color, ref, op)];
    pts.forEach((_, i) => { const j = (i + 1) % pts.length; caras.push(cara([A[i], A[j], B[j], B[i]], color, ref, op)); });
    return caras;
  }

  /* ---------- Bloques en 3D (coordenadas locales en metros, escaladas y giradas con el bloque) ---------- */
  function modelo(b, caras) {
    const k = b.escala || 1, ca = Math.cos(b.ang || 0), sa = Math.sin(b.ang || 0);
    const W = (x, y) => ({ x: b.x + (x * ca - y * sa) * k, y: b.y + (x * sa + y * ca) * k });
    const P = (x, y, z) => ({ ...W(x, y), z: z * k });
    return {
      caja: (x, y, w, l, z0, z1, color, op) => caras.push(...prisma([W(x - w / 2, y - l / 2), W(x + w / 2, y - l / 2), W(x + w / 2, y + l / 2), W(x - w / 2, y + l / 2)], z0 * k, z1 * k, color, op)),
      cil: (x, y, r, z0, z1, color) => { const c = W(x, y); caras.push(...cilindro(c.x, c.y, r * k, z0 * k, z1 * k, color)); },
      esf: (x, y, z, r, rz, color) => caras.push(...esfera(P(x, y, z), r * k, r * k, rz * k, color)),
      barra: (a, c, w, h, color) => caras.push(...barra(P(...a), P(...c), w * k, h * k, color, LISO)),
      poli: (pts, z0, z1, color) => caras.push(...prisma(pts.map(([x, y]) => W(x, y)), z0 * k, z1 * k, color)),
      cara: (pts, color) => caras.push({ ...cara(pts.map(p => P(...p)), color), doble: true }),
    };
  }
  function silla(m, x, y, dx, dy, color = MADERA) {
    m.caja(x, y, 0.42, 0.42, 0.42, 0.46, color);
    for (const [a, c] of [[-0.18, -0.18], [0.18, -0.18], [0.18, 0.18], [-0.18, 0.18]]) m.caja(x + a, y + c, 0.04, 0.04, 0, 0.42, color);
    const bx = x - dx * 0.19, by = y - dy * 0.19;
    if (Math.abs(dx) > Math.abs(dy)) m.caja(bx, by, 0.04, 0.42, 0.46, 0.9, color); else m.caja(bx, by, 0.42, 0.04, 0.46, 0.9, color);
  }
  const patas = (m, w, l, z, color) => { for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.caja(a * (w / 2 - 0.05), c * (l / 2 - 0.05), 0.05, 0.05, 0, z, color); };
  function cama(m, w) {
    m.caja(0, 0, w, 1.9, 0, 0.3, MADERA);
    m.caja(0, 0.03, w - 0.04, 1.84, 0.3, 0.52, '#f2f4f7');
    m.caja(0, -0.93, w + 0.04, 0.08, 0, 0.95, MADERA);
    const n = w > 1.2 ? [-w / 4, w / 4] : [0];
    for (const x of n) m.caja(x, -0.74, Math.min(0.56, w / 2 - 0.06), 0.28, 0.52, 0.63, '#ffffff');
    m.caja(0, 0.3, w, 1.3, 0.52, 0.57, '#7fa7d1');
  }
  const MODELOS = {
    arbol: m => { m.cil(0, 0, 0.14, 0, 1.9, '#6b4a2f'); m.esf(0, 0, 2.7, 1.5, 1.2, '#5d9441'); m.esf(0.45, -0.35, 3.3, 0.95, 0.8, '#6eaa4e'); },
    arbusto: m => m.esf(0, 0, 0.45, 0.6, 0.5, '#5f9a45'),
    palma: m => {
      m.cil(0, 0, 0.13, 0, 4.4, '#8a6a4a');
      for (let i = 0; i < 9; i++) {
        const a = i * 2 * Math.PI / 9, c = Math.cos(a), s = Math.sin(a);
        m.barra([0, 0, 4.4], [0.85 * c, 0.85 * s, 4.8], 0.34, 0.03, '#4f8f3a');
        m.barra([0.85 * c, 0.85 * s, 4.8], [1.6 * c, 1.6 * s, 4.15], 0.28, 0.03, '#5b9c42');
      }
    },
    carro: m => {
      for (const [x, y] of [[-0.78, -1.35], [0.78, -1.35], [-0.78, 1.35], [0.78, 1.35]]) m.caja(x, y, 0.24, 0.62, 0, 0.62, '#26292e');
      m.caja(0, 0, 1.76, 4.25, 0.2, 0.78, '#c0392b');
      m.caja(0, 0.2, 1.52, 2.15, 0.78, 1.32, VIDRIO, { alfa: 0.85 });
      m.caja(0, 0.2, 1.44, 2.0, 1.32, 1.38, '#b23427');
    },
    moto: m => { m.caja(0, -0.75, 0.1, 0.55, 0, 0.6, '#26292e'); m.caja(0, 0.75, 0.1, 0.55, 0, 0.6, '#26292e'); m.caja(0, 0, 0.3, 1.5, 0.35, 0.85, '#34495e'); },
    persona: m => { m.cil(0, 0, 0.19, 0, 1.4, '#3d5a80'); m.esf(0, 0, 1.58, 0.12, 0.14, '#d9a77a'); },
    inodoro: m => { m.caja(0, -0.28, 0.42, 0.17, 0, 0.78, BLANCO); m.cil(0, 0.06, 0.2, 0, 0.42, BLANCO); },
    lavamanos: m => { m.cil(0, 0, 0.08, 0, 0.78, BLANCO); m.caja(0, 0, 0.56, 0.46, 0.78, 0.9, BLANCO); },
    ducha: m => { m.caja(0, 0, 0.9, 0.9, 0, 0.06, '#e6edf2'); m.barra([0.38, -0.38, 0], [0.38, -0.38, 2.05], 0.03, 0.03, '#9aa3ad'); m.caja(0.3, -0.38, 0.18, 0.06, 1.98, 2.02, '#9aa3ad'); },
    estufa: m => { m.caja(0, 0, 0.6, 0.6, 0, 0.88, '#e9ecef'); m.caja(0, 0, 0.58, 0.58, 0.88, 0.92, '#2d2f33'); },
    lavaplatos: m => { m.caja(0, 0, 1.2, 0.54, 0, 0.86, '#d8c7ab'); m.caja(0, 0, 1.22, 0.56, 0.86, 0.9, '#c9cdd2'); },
    nevera: m => { m.caja(0, 0, 0.7, 0.7, 0, 1.75, '#eef1f4'); },
    lavadero: m => { m.caja(0, 0, 0.6, 1.0, 0, 0.82, '#cfd4d9'); m.caja(0, 0, 0.62, 1.02, 0.82, 0.88, '#bfc5cb'); },
    cama: m => cama(m, 1.4),
    camaSencilla: m => cama(m, 1.0),
    closet: m => { m.caja(0, 0, 1.2, 0.6, 0, 2.1, '#b5875c'); },
    sofa: m => {
      m.caja(0, 0.08, 1.6, 0.68, 0, 0.42, '#8fa3b8');
      m.caja(0, -0.32, 2.0, 0.2, 0, 0.85, '#7d91a6');
      for (const x of [-0.9, 0.9]) m.caja(x, 0.0, 0.2, 0.84, 0, 0.62, '#7d91a6');
    },
    mesa: m => {
      m.cil(0, 0, 0.5, 0.72, 0.76, MADERA); m.cil(0, 0, 0.06, 0, 0.72, MADERA);
      for (const [x, y] of [[0, -0.75], [0, 0.75], [-0.75, 0], [0.75, 0]]) silla(m, x, y, -x / 0.75, -y / 0.75);
    },
    mesaRect: m => {
      m.caja(0, 0, 0.9, 1.8, 0.72, 0.76, MADERA); patas(m, 0.9, 1.8, 0.72, MADERA);
      for (const y of [-0.55, 0, 0.55]) { silla(m, -0.68, y, 1, 0); silla(m, 0.68, y, -1, 0); }
    },
    escritorio: m => { m.caja(0, 0, 1.2, 0.6, 0.72, 0.76, MADERA); patas(m, 1.2, 0.6, 0.72, MADERA); silla(m, 0, 0.55, 0, -1, '#34495e'); },
    silla: m => silla(m, 0, 0, 0, -1),
    tanque: m => { m.cil(0, 0, 0.55, 0, 1.1, '#2f3b47'); m.cil(0, 0, 0.25, 1.1, 1.18, '#2f3b47'); },
    carpa: m => {
      const c = '#3a7bd5', a = 1.5, h = 2.2;
      m.cara([[-a, -a, 0], [0, -a, h], [0, a, h], [-a, a, 0]], c); m.cara([[a, -a, 0], [0, -a, h], [0, a, h], [a, a, 0]], '#336fc0');
      m.cara([[-a, -a, 0], [a, -a, 0], [0, -a, h]], '#5b93dd'); m.cara([[-a, a, 0], [a, a, 0], [0, a, h]], '#5b93dd');
    },
    puntoEncuentro: m => { m.barra([0, 0, 0], [0, 0, 1.6], 0.06, 0.06, '#9aa3ad'); m.caja(0, 0, 0.8, 0.04, 1.5, 2.3, '#1e8e3e'); },
    flecha: m => m.poli([[-0.3, 0.9], [0.3, 0.9], [0.3, -0.2], [0.6, -0.2], [0, -1], [-0.6, -0.2], [-0.3, -0.2]], 0, 0.02, '#1e8e3e'),
    extintor: m => { m.cil(0, 0, 0.1, 0.9, 1.45, '#d93025'); m.caja(0, 0, 0.3, 0.04, 0.85, 1.55, '#c9ccd1'); },
    poste: m => { m.cil(0, 0, 0.1, 0, 7, '#9aa3ad'); m.barra([0, 0, 6.9], [0.9, 0, 7.15], 0.08, 0.08, '#9aa3ad'); m.caja(0.95, 0, 0.32, 0.16, 7.0, 7.16, '#f4d35e'); },
  };

  /* ---------- Modelo del plano ---------- */
  // Muro con vanos, cortado donde hay columnas y prolongado en las esquinas sin columna.
  function muro(m, ctx, muros, caras, op) {
    const L = E.largo(m), t = E.espesorMuro(m), H = m.alto;
    const u = E.MAMPOSTERIA[m.unidad] || E.MAMPOSTERIA.h10;
    const panete = op.acabado === 'panete' && +m.panete > 0;
    const estilo = panete ? { color: PANETE, op: { sinBorde: false } } : { color: u.color3d, op: { tex: 'mamp:' + (E.MAMPOSTERIA[m.unidad] ? m.unidad : 'h10') } };
    const ux = (m.b.x - m.a.x) / (L || 1), uy = (m.b.y - m.a.y) / (L || 1);
    const P = s => ({ x: m.a.x + ux * s, y: m.a.y + uy * s });
    const vanos = ctx.vanosDe(m.id).map(v => ({
      v, s0: Math.max(0, v.s - v.ancho / 2), s1: Math.min(L, v.s + v.ancho / 2),
      z0: v.tipo === 'puerta' ? 0 : v.antepecho, z1: Math.min(H, (v.tipo === 'puerta' ? 0 : v.antepecho) + v.alto),
    }));
    const [extA, extB] = E.extremosMuro(m, muros);
    for (const [a, b] of E.tramosLibres(L, ctx.columnasEn(m).map(p => ({ s: p.s, traslapo: p.along })), extA, extB)) {
      const cortes = [...new Set([a, b, ...vanos.flatMap(o => [o.s0, o.s1]).filter(s => s > a && s < b)])].sort((x, y) => x - y);
      for (let i = 1; i < cortes.length; i++) {
        const s0 = cortes[i - 1], s1 = cortes[i];
        if (s1 - s0 < 1e-4) continue;
        const o = vanos.find(q => q.s0 <= s0 + 1e-6 && q.s1 >= s1 - 1e-6);
        const tramos = o ? [[0, o.z0], [o.z1, H]] : [[0, H]];
        const n = op.trozos ? Math.max(1, Math.ceil((s1 - s0) / 1.0)) : 1;
        for (let k = 0; k < n; k++) {
          const p0 = s0 + (s1 - s0) * k / n, p1 = s0 + (s1 - s0) * (k + 1) / n;
          for (const [z0, z1] of tramos) caras.push(...prisma(E.franja(P(p0), P(p1), t), z0, z1, estilo.color, estilo.op));
        }
      }
    }
    // Carpintería: marco, vidrio u hoja de puerta
    for (const o of vanos) {
      const w = Math.min(0.05, (o.s1 - o.s0) / 4), ventana = o.v.tipo === 'ventana';
      const marco = ventana ? '#e4e8ec' : '#6d4628', prof = ventana ? Math.min(t, 0.08) : t;
      const pieza = (s0, s1, z0, z1, color, ancho, opc) => caras.push(...prisma(E.franja(P(s0), P(s1), ancho), z0, z1, color, opc));
      pieza(o.s0, o.s0 + w, o.z0, o.z1, marco, prof); pieza(o.s1 - w, o.s1, o.z0, o.z1, marco, prof);
      pieza(o.s0, o.s1, o.z1 - w, o.z1, marco, prof);
      if (ventana) {
        pieza(o.s0, o.s1, o.z0, o.z0 + w, marco, prof);
        pieza(o.s0 + w, o.s1 - w, o.z0 + w, o.z1 - w, VIDRIO, 0.012, { alfa: 0.45, sinSombra: true });
        const mid = (o.s0 + o.s1) / 2;
        if (o.s1 - o.s0 > 0.9) pieza(mid - 0.02, mid + 0.02, o.z0 + w, o.z1 - w, marco, prof * 0.8);
      } else pieza(o.s0 + w, o.s1 - w, o.z0, o.z1 - w, '#8a5a32', 0.04);
    }
  }

  // Elemento lineal (viga) cortado en las columnas
  function lineal(v, ctx, z0, z1, color, caras) {
    const L = E.largo(v) || 1, u = { x: (v.b.x - v.a.x) / L, y: (v.b.y - v.a.y) / L };
    const P = s => ({ x: v.a.x + u.x * s, y: v.a.y + u.y * s });
    for (const [a, b] of E.tramosLibres(L, ctx.columnasEn(v).map(p => ({ s: p.s, traslapo: p.along }))))
      caras.push(...prisma(E.franja(P(a), P(b), v.base), z0, z1, color));
  }

  function cubierta(c, ctx, caras, op, muros) {
    const d = E.datosCubierta(c), z0 = ctx.alturaApoyo();
    const pc = E.perfilInfo(d.correaPerfil, d.correaMedida, d.correaCal);
    const cerchas = d.apoyo === 'cerchas';
    const pco = E.perfilInfo(d.cordonPerfil, d.cordonMedida, d.cordonCal), pce = E.perfilInfo(d.celosiaPerfil, d.celosiaMedida, d.celosiaCal);
    const zr = z0 + pc.h + (cerchas ? pco.h : 0);
    const G = E.geomCubierta(c, zr);
    const teja = E.TEJAS[d.teja] ? d.teja : 'zinc';
    if (op.cubierta === 'ver' || op.cubierta === 'transparente') {
      const alfa = op.cubierta === 'transparente' ? 0.35 : 1;
      for (const pol of E.planosCubierta(c, zr)) caras.push({ ...cara(pol, E.TEJAS[teja].color3d), doble: true, alfa, techo: true, tex: 'teja:' + teja, uv: G.ejeX ? 'y' : 'x' });
      if (G.dos) caras.push(...barra(G.P(G.mid, G.v0, G.z(G.mid) + 0.03), G.P(G.mid, G.v1, G.z(G.mid) + 0.03), 0.32, 0.05, '#7f8a93', { alfa, techo: true }));
    }
    // Estructura: correas, cerchas o culatas
    const colorC = pc.madera ? MADERA : ACERO;
    for (const x of E.estructuraCubierta(c, zr).correas) {
      const baja = p => ({ ...p, z: p.z - pc.h / 2 - 0.005 });
      caras.push(...barra(baja(x.a), baja(x.b), pc.b, pc.h, colorC));
    }
    if (cerchas) {
      for (const ch of E.estructuraCubierta(c, z0 + pco.h / 2).cerchas)
        for (const b of ch.barras) {
          const pf = b.tipo === 'cordon' ? pco : pce;
          caras.push(...barra(b.a, b.b, pf.b, pf.h, pf.madera ? MADERA : '#7d8893'));
        }
    } else {
      const base = muros[0], u = E.MAMPOSTERIA[base?.unidad] || E.MAMPOSTERIA.h10;
      const t = base ? E.espesorMuro(base) : 0.12;
      const estilo = op.acabado === 'panete' ? [PANETE, {}] : [u.color3d, { tex: 'mamp:' + (E.MAMPOSTERIA[base?.unidad] ? base.unidad : 'h10') }];
      for (const w of [G.w0, G.w1]) {
        const tri = [G.P(G.s0, w, z0), G.P(G.s1, w, z0), G.P(G.dos ? G.mid : G.s0, w, z0 + G.f)];
        caras.push(...placa(tri, G.ejeX ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }, t, estilo[0], estilo[1]));
      }
    }
  }

  function construir(plano, op = {}) {
    const ctx = E.contexto(plano), caras = [];
    const visible = t => !(plano.capasOcultas || []).includes(t);
    const muros = visible('muro') ? ctx.de('muro') : [];
    if (op.piso !== false && muros.length) {
      const cub = ctx.de('cubierta')[0];
      let base = cub?.puntos;
      if (!base) {
        const t = Math.max(...muros.map(E.espesorMuro)) / 2, b = E.caja(muros.flatMap(m => [m.a, m.b]));
        base = [{ x: b.x0 - t, y: b.y0 - t }, { x: b.x1 + t, y: b.y0 - t }, { x: b.x1 + t, y: b.y1 + t }, { x: b.x0 - t, y: b.y1 + t }];
      }
      caras.push(...prisma(base, -0.1, 0.05, '#d6d2ca'));
    }
    if (visible('zapata')) for (const z of ctx.de('zapata'))
      caras.push(...prisma(E.rectangulo(z.x, z.y, z.B, z.L), -z.prof, -z.prof + z.h, CIMIENTO));
    if (visible('vigaCim')) for (const v of ctx.de('vigaCim')) lineal(v, ctx, -v.altura, 0, CIMIENTO, caras);
    for (const m of muros) muro(m, ctx, muros, caras, op);
    if (visible('columna')) for (const c of ctx.de('columna')) {
      const zap = ctx.zapataBajo(c);
      caras.push(...prisma(E.rectangulo(c.x, c.y, c.b, c.h, c.ang || 0), zap ? -(zap.prof - zap.h) : -0.05, c.alto, CONCRETO));
    }
    if (visible('viga')) for (const v of ctx.de('viga')) {
      const cols = ctx.columnasEn(v).map(p => p.c.alto);
      const mu = ctx.de('muro').find(m => E.proyectar(v.a, m.a, m.b).d < 0.05 && E.proyectar(v.b, m.a, m.b).d < 0.05);
      const zTop = cols.length ? Math.max(...cols) : (mu ? mu.alto : 2.4) + v.altura;
      lineal(v, ctx, zTop - v.altura, zTop, CONCRETO, caras);
    }
    if (visible('generico')) for (const g of ctx.de('generico'))
      caras.push(...prisma(E.rectangulo(g.x, g.y, +g.L || 1, +g.A || 1, g.ang || 0), +g.z || 0, (+g.z || 0) + (+g.H || 1), g.color || '#0e7c86'));
    if (visible('bloque')) for (const b of ctx.de('bloque')) (MODELOS[b.simbolo] || MODELOS.arbol)(modelo(b, caras));
    if (visible('cubierta') && op.cubierta !== 'oculta') for (const c of ctx.de('cubierta')) cubierta(c, ctx, caras, op, muros);
    return caras;
  }

  function limites(plano) {
    const pts = [];
    for (const e of plano.elementos || []) {
      if (e.a) pts.push(e.a, e.b);
      if (e.puntos) pts.push(...E.desfasar(e.puntos, +e.alero || 0));
      if (e.x != null) pts.push({ x: e.x - 1, y: e.y - 1 }, { x: e.x + 1, y: e.y + 1 });
    }
    if (!pts.length) return { x0: -5, y0: -5, x1: 5, y1: 5, z0: -1, z1: 3 };
    const b = E.caja(pts);
    return { ...b, z0: -1.5, z1: 4 };
  }

  /* ---------- Texturas ---------- */
  const TEX = {};
  function azar(semilla) { let s = semilla; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
  function textura(nombre) {
    if (TEX[nombre]) return TEX[nombre];
    const T = THREE, c = document.createElement('canvas'), g = c.getContext('2d');
    const [tipo, clave] = nombre.split(':');
    let w = 1, h = 1;
    if (tipo === 'mamp') {
      const u = E.MAMPOSTERIA[clave] || E.MAMPOSTERIA.h10, J = E.JUNTA, rnd = azar(7 + clave.length * 31);
      w = 2 * (u.l + J); h = 4 * (u.h + J);
      c.width = 256; c.height = Math.max(32, Math.round(256 * h / w));
      const k = c.width / w, [r, gg, b] = hex(u.color3d);
      g.fillStyle = '#d8d1c4'; g.fillRect(0, 0, c.width, c.height);
      for (let fila = 0; fila < 4; fila++) {
        const off = fila % 2 ? (u.l + J) / 2 : 0;
        for (let i = -1; i < 3; i++) {
          const v = 0.88 + rnd() * 0.2;
          g.fillStyle = `rgb(${Math.min(255, r * v) | 0},${Math.min(255, gg * v) | 0},${Math.min(255, b * v) | 0})`;
          g.fillRect((off + i * (u.l + J)) * k, (fila * (u.h + J) + J / 2) * k, u.l * k, u.h * k);
        }
      }
    } else if (tipo === 'teja') {
      const t = E.TEJAS[clave] || E.TEJAS.zinc;
      w = { zinc: 0.076, p7: 0.177, termo: 0.25 }[clave] || 0.1;
      c.width = 64; c.height = 8;
      const [r, gg, b] = hex(t.color3d);
      for (let x = 0; x < 64; x++) {
        const f = clave === 'termo' ? (x % 64 < 14 ? 1.1 : 0.94) : 0.86 + 0.16 * Math.sin(x / 64 * 2 * Math.PI);
        g.fillStyle = `rgb(${Math.min(255, r * f) | 0},${Math.min(255, gg * f) | 0},${Math.min(255, b * f) | 0})`;
        g.fillRect(x, 0, 1, 8);
      }
    } else if (tipo === 'terreno') {
      c.width = c.height = 128;
      const rnd = azar(11);
      g.fillStyle = '#d9e2cc'; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(110,130,90,${0.04 + rnd() * 0.06})`; g.fillRect(rnd() * 128, rnd() * 128, 2, 2); }
      g.strokeStyle = 'rgba(120,135,105,.35)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 127, 127);
    } else if (tipo === 'cielo') {
      c.width = 2; c.height = 256;
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#c9def2'); gr.addColorStop(0.6, '#e9f1f8'); gr.addColorStop(1, '#f7f9fb');
      g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    }
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.anisotropy = 4;
    return (TEX[nombre] = { tex, w, h });
  }

  /* ---------- Motor WebGL ---------- */
  let motorGL = null; // null: sin iniciar · false: no disponible
  function motor() {
    if (motorGL !== null) return motorGL;
    try {
      if (!window.THREE) throw new Error('three.js no está cargado');
      const T = THREE;
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      const scene = new T.Scene();
      scene.background = textura('cielo').tex;
      const camara = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
      const sol = new T.DirectionalLight(0xffffff, 0.7);
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      sol.shadow.bias = -0.0005;
      sol.shadow.normalBias = 0.02;
      const terreno = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshLambertMaterial({ map: textura('terreno').tex, transparent: true, depthWrite: false }));
      terreno.rotation.x = -Math.PI / 2;
      terreno.receiveShadow = true;
      scene.add(new T.HemisphereLight(0xf2f7ff, 0x8f8676, 0.68), sol, sol.target, terreno);
      motorGL = { T, renderer, scene, camara, sol, terreno, grupo: null, clave: '' };
    } catch (err) {
      console.warn('Vista 3D sin WebGL:', err.message);
      motorGL = false;
    }
    return motorGL;
  }

  function triangulos(f) {
    const n = f.pts.length;
    if (n <= 4) return n === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]];
    const a = Math.abs(f.n.x), b = Math.abs(f.n.y), c = Math.abs(f.n.z);
    const [i, j] = c >= a && c >= b ? ['x', 'y'] : a >= b ? ['y', 'z'] : ['x', 'z'];
    return THREE.ShapeUtils.triangulateShape(f.pts.map(p => new THREE.Vector2(p[i], p[j])), []);
  }
  function coordUV(p, f) {
    if (f.uv === 'x') return [p.x, p.y];
    if (f.uv === 'y') return [p.y, p.x];
    if (Math.abs(f.n.z) > 0.9) return [p.x, p.y];
    const L = Math.hypot(f.n.x, f.n.y) || 1;
    return [(p.x * -f.n.y + p.y * f.n.x) / L, p.z];
  }

  function armar(M, caras) {
    const { T } = M, grupo = new T.Group(), lotes = new Map(), bordes = [];
    for (const f of caras) {
      const k = [f.tex ? '' : f.color, f.alfa ?? 1, f.tex || '', f.uv || '', f.sinSombra ? 1 : 0].join('|');
      if (!lotes.has(k)) lotes.set(k, []);
      lotes.get(k).push(f);
    }
    for (const lista of lotes.values()) {
      const f0 = lista[0], tx = f0.tex ? textura(f0.tex) : null, alfa = f0.alfa ?? 1;
      const pos = [], nor = [], uv = [];
      for (const f of lista) {
        const n3 = [f.n.x, f.n.z, f.n.y];
        for (let [a, b, c] of triangulos(f)) {
          const A = f.pts[a], B = f.pts[b], C = f.pts[c];
          // Orden antihorario visto desde la normal (en coordenadas de three: x, z, y)
          const u = [B.x - A.x, B.z - A.z, B.y - A.y], v = [C.x - A.x, C.z - A.z, C.y - A.y];
          if ((u[1] * v[2] - u[2] * v[1]) * n3[0] + (u[2] * v[0] - u[0] * v[2]) * n3[1] + (u[0] * v[1] - u[1] * v[0]) * n3[2] < 0) [b, c] = [c, b];
          for (const i of [a, b, c]) {
            const p = f.pts[i];
            pos.push(p.x, p.z, p.y); nor.push(...n3);
            if (tx) { const [s, t] = coordUV(p, f); uv.push(s / tx.w, t / tx.h); }
          }
        }
        if (!f.sinBorde) f.pts.forEach((p, i) => { const q = f.pts[(i + 1) % f.pts.length]; bordes.push(p.x, p.z, p.y, q.x, q.z, q.y); });
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      if (tx) geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      const mat = new T.MeshLambertMaterial({
        color: tx ? 0xffffff : f0.color, map: tx ? tx.tex : null, side: T.DoubleSide, transparent: alfa < 1, opacity: alfa, depthWrite: alfa > 0.6,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
      const malla = new T.Mesh(geo, mat);
      malla.castShadow = alfa > 0.6 && !f0.sinSombra;
      malla.receiveShadow = true;
      grupo.add(malla);
    }
    if (bordes.length) {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(bordes, 3));
      grupo.add(new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0x1f2328, transparent: true, opacity: 0.25 })));
    }
    return grupo;
  }

  function liberar(grupo) {
    grupo.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  }

  function renderGL(M, plano, cam, W, H, op, base) {
    const { T, renderer, scene, camara, sol, terreno } = M;
    const clave = JSON.stringify([plano.elementos, plano.capasOcultas, plano.cfg, op.cubierta, op.acabado, op.piso]);
    if (clave !== M.clave) {
      if (M.grupo) { scene.remove(M.grupo); liberar(M.grupo); }
      M.grupo = armar(M, construir(plano, op));
      scene.add(M.grupo);
      M.clave = clave;
    }
    const { c3, R, esc, V } = base;
    const D = R * 6;
    camara.position.set(c3.x + V.x * D, c3.z + V.z * D, c3.y + V.y * D);
    camara.up.set(0, 1, 0);
    camara.lookAt(c3.x, c3.z, c3.y);
    const px = cam.px || 0, py = cam.py || 0;
    Object.assign(camara, { left: (-W / 2 - px) / esc, right: (W / 2 - px) / esc, top: (H / 2 + py) / esc, bottom: (-H / 2 + py) / esc, near: 0.1, far: D * 2 + R * 4 });
    camara.updateProjectionMatrix();
    const lado = R * 8;
    terreno.position.set(c3.x, -0.01, c3.y);
    terreno.scale.set(lado, lado, 1);
    terreno.material.map.repeat.set(lado, lado);
    terreno.material.opacity = op.terreno === 'opaco' ? 1 : 0.6;
    terreno.visible = op.terreno !== 'oculto';
    const luz = unit({ x: -0.55, y: 0.45, z: 0.95 });
    sol.position.set(c3.x + luz.x * R * 3, c3.z + luz.z * R * 3, c3.y + luz.y * R * 3);
    sol.target.position.set(c3.x, c3.z, c3.y);
    Object.assign(sol.shadow.camera, { left: -R * 1.6, right: R * 1.6, top: R * 1.6, bottom: -R * 1.6, near: 0.1, far: R * 8 });
    sol.shadow.camera.updateProjectionMatrix();
    const pw = Math.max(1, Math.round(W * base.k)), ph = Math.max(1, Math.round(H * base.k));
    const tam = renderer.getSize(new T.Vector2());
    if (tam.x !== pw || tam.y !== ph) renderer.setSize(pw, ph, false);
    renderer.render(scene, camara);
  }

  /* ---------- Respaldo sin WebGL: caras ordenadas por profundidad ---------- */
  function pintor(g, plano, op, W, H, proy, V) {
    const fondo = g.createLinearGradient(0, 0, 0, H);
    fondo.addColorStop(0, '#d3e4f3'); fondo.addColorStop(1, '#f7f9fb');
    g.fillStyle = fondo; g.fillRect(0, 0, W, H);
    const lim = limites(plano);
    g.strokeStyle = 'rgba(80,110,90,.18)'; g.lineWidth = 1;
    const gx0 = Math.floor(lim.x0) - 2, gx1 = Math.ceil(lim.x1) + 2, gy0 = Math.floor(lim.y0) - 2, gy1 = Math.ceil(lim.y1) + 2;
    g.beginPath();
    for (let x = gx0; x <= gx1; x++) { const a = proy({ x, y: gy0, z: 0 }), b = proy({ x, y: gy1, z: 0 }); g.moveTo(a.X, a.Y); g.lineTo(b.X, b.Y); }
    for (let y = gy0; y <= gy1; y++) { const a = proy({ x: gx0, y, z: 0 }), b = proy({ x: gx1, y, z: 0 }); g.moveTo(a.X, a.Y); g.lineTo(b.X, b.Y); }
    g.stroke();
    const luz = unit({ x: -0.4, y: 0.6, z: 1 });
    const caras = construir(plano, { ...op, trozos: true }).map(f => {
      const pp = f.pts.map(proy);
      return { ...f, pp, D: pp.reduce((s, p) => s + p.D, 0) / pp.length };
    }).filter(f => f.doble || punto(f.n, V) > 1e-6)
      .sort((a, b) => (a.techo ? 1 : 0) - (b.techo ? 1 : 0) || a.D - b.D);
    for (const f of caras) {
      const [r, gg, b] = hex(f.color);
      const l = 0.55 + 0.45 * Math.abs(punto(f.n, luz));
      g.fillStyle = `rgba(${Math.round(r * l)},${Math.round(gg * l)},${Math.round(b * l)},${f.alfa ?? 1})`;
      g.beginPath();
      f.pp.forEach((p, i) => (i ? g.lineTo(p.X, p.Y) : g.moveTo(p.X, p.Y)));
      g.closePath();
      g.fill();
      if (!f.sinBorde) { g.strokeStyle = 'rgba(30,30,30,.35)'; g.lineWidth = 0.6; g.stroke(); }
    }
  }

  /* cam: { theta, phi, zoom, px, py } en radianes y píxeles.
     op: { cubierta: 'ver'|'transparente'|'estructura'|'oculta', acabado: 'ladrillo'|'panete', terreno: 'translucido'|'opaco'|'oculto', margenInferior } */
  function dibujar(g, plano, cam, W, H, op = {}) {
    op = { cubierta: 'ver', acabado: 'ladrillo', terreno: 'translucido', ...op };
    const ct = Math.cos(cam.theta), st = Math.sin(cam.theta), cp = Math.cos(cam.phi), sp = Math.sin(cam.phi);
    const V = { x: st * cp, y: ct * cp, z: sp };
    const lim = limites(plano);
    const c3 = { x: (lim.x0 + lim.x1) / 2, y: (lim.y0 + lim.y1) / 2, z: (lim.z0 + lim.z1) / 2 };
    const R = Math.hypot(lim.x1 - lim.x0, lim.y1 - lim.y0, lim.z1 - lim.z0) / 2 || 5;
    const esc = Math.min(W, H) / (2.1 * R) * (cam.zoom || 1);
    const proy = p => {
      const x = p.x - c3.x, y = p.y - c3.y, z = p.z - c3.z;
      const u = x * ct - y * st, v = x * st + y * ct;
      return { X: W / 2 + (cam.px || 0) + u * esc, Y: H / 2 + (cam.py || 0) + (v * sp - z * cp) * esc, D: v * cp + z * sp };
    };
    const k = (g.getTransform && g.getTransform().a) || 1;

    g.save();
    const M = motor();
    let hecho = false;
    if (M) {
      try {
        renderGL(M, plano, cam, W, H, op, { c3, R, esc, V, k });
        g.drawImage(M.renderer.domElement, 0, 0, W, H);
        hecho = true;
      } catch (err) { console.warn('Error en la vista 3D WebGL:', err); }
    }
    if (!hecho) pintor(g, plano, op, W, H, proy, V);

    // Ejes de referencia
    const o = { X: 46, Y: H - (op.margenInferior ?? 40) };
    const eje = (v, color, t) => {
      const u = v.x * ct - v.y * st, w = v.x * st + v.y * ct;
      const X = o.X + u * 26, Y = o.Y + (w * sp - v.z * cp) * 26;
      g.strokeStyle = g.fillStyle = color; g.lineWidth = 2;
      g.beginPath(); g.moveTo(o.X, o.Y); g.lineTo(X, Y); g.stroke();
      g.font = '600 11px system-ui'; g.fillText(t, X + 3, Y + 3);
    };
    eje({ x: 1, y: 0, z: 0 }, '#c0392b', 'X');
    eje({ x: 0, y: -1, z: 0 }, '#1d7a46', 'N');
    eje({ x: 0, y: 0, z: 1 }, '#1f5fa8', 'Z');
    g.restore();
  }

  return { dibujar, construir, MODELOS };
})();
