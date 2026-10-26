/* Elementos del plano (modelo tipo BIM sencillo): catálogo, geometría, refuerzo automático y cantidades.
   Unidades internas: metros. Las reglas de refuerzo son mínimos de referencia (NSR-10) y no reemplazan el diseño estructural. */
const Elementos = (() => {
  const { BARRAS, CONCRETOS, MORTEROS, BULTO } = Calc;
  const { num, esc } = UI;

  /* ---------- Catálogo ---------- */
  // Área nominal de las barras (m²)
  const AREA = { '#2': 32e-6, '#3': 71e-6, '#4': 129e-6, '#5': 199e-6, '#6': 284e-6, '#7': 387e-6, '#8': 510e-6 };
  const db = b => BARRAS[b].d / 1000;

  // Unidades de mampostería: soga (l), altura (h) y espesor del muro (e) en metros. Junta de 1 cm.
  const MAMPOSTERIA = {
    h10: { t: 'Ladrillo H10 (10 × 20 × 30 cm)', l: 0.30, h: 0.20, e: 0.10, patron: 'diagonal', color3d: '#c8734b' },
    h15: { t: 'Ladrillo H15 (15 × 20 × 30 cm)', l: 0.30, h: 0.20, e: 0.15, patron: 'diagonal', color3d: '#c8734b' },
    macizo: { t: 'Ladrillo macizo (tolete 24,5 × 12 × 5,5) en soga — muro de 12 cm', l: 0.245, h: 0.055, e: 0.12, patron: 'cruzado', color3d: '#b0503a' },
    macizoTizon: { t: 'Ladrillo macizo (tolete) en tizón — muro de 24,5 cm', l: 0.12, h: 0.055, e: 0.245, patron: 'cruzado', color3d: '#b0503a' },
    b4: { t: 'Bloque #4 de arcilla (10 × 20 × 40 cm)', l: 0.40, h: 0.20, e: 0.10, patron: 'diagonal', color3d: '#cf8a5f' },
    bc15: { t: 'Bloque de concreto (15 × 20 × 40 cm)', l: 0.40, h: 0.20, e: 0.15, patron: 'puntos', color3d: '#9c9b96' },
  };
  const JUNTA = 0.01;
  const unidadesM2 = u => 1 / ((u.l + JUNTA) * (u.h + JUNTA));
  const morteroM2 = u => Math.max(0, 1 - unidadesM2(u) * u.l * u.h) * u.e;
  const PANETE = 0.015; // espesor de pañete por cara

  // Tejas: ancho total, ancho útil, traslapo longitudinal, separación de correas y largos comerciales (m).
  // Valores de catálogo de referencia: confirme con la ficha técnica del fabricante.
  const TEJAS = {
    zinc: { t: 'Zinc ondulada (ancho 0,80 m)', ancho: 0.80, util: 0.70, traslapo: 0.20, sep: 0.90, color3d: '#aab4bd',
      largos: [[2.134, '2,13 m (7′)'], [2.438, '2,44 m (8′)'], [3.048, '3,05 m (10′)'], [3.658, '3,66 m (12′)']] },
    p7: { t: 'Fibrocemento perfil 7 (ancho 0,92 m)', ancho: 0.92, util: 0.873, traslapo: 0.14, sep: 1.15, color3d: '#c9c6bb',
      largos: [[1.22, 'No. 4 (1,22 m)'], [1.52, 'No. 5 (1,52 m)'], [1.83, 'No. 6 (1,83 m)'], [2.13, 'No. 7 (2,13 m)'], [2.44, 'No. 8 (2,44 m)'], [3.05, 'No. 10 (3,05 m)']] },
    termo: { t: 'Termoacústica (ancho 0,82 m)', ancho: 0.82, util: 0.76, traslapo: 0.20, sep: 1.20, color3d: '#b24a3b',
      largos: [[2.44, '2,44 m'], [3.05, '3,05 m'], [3.66, '3,66 m'], [6.00, '6,00 m']] },
  };

  // Capas (categorías). El orden es el de dibujo en planta.
  const CAPAS = [
    { id: 'zapata', t: 'Zapatas', pre: 'Z', color: '#8a6d3b' },
    { id: 'vigaCim', t: 'Vigas de cimentación', pre: 'VC', color: '#9a6a2f' },
    { id: 'muro', t: 'Muros', pre: 'M', color: '#b0532f' },
    { id: 'columna', t: 'Columnas', pre: 'C', color: '#3d4450' },
    { id: 'viga', t: 'Vigas aéreas', pre: 'VA', color: '#1f5fa8' },
    { id: 'puerta', t: 'Puertas', pre: 'P', color: '#2f6b3a' },
    { id: 'ventana', t: 'Ventanas', pre: 'V', color: '#1f8fb8' },
    { id: 'cubierta', t: 'Cubierta', pre: 'CUB', color: '#8e44ad' },
    { id: 'bloque', t: 'Bloques', pre: 'B', color: '#2e7d32' },
    { id: 'cota', t: 'Cotas', pre: '', color: '#333' },
  ];
  const capa = id => CAPAS.find(c => c.id === id);
  const NOMBRE_TIPO = {
    muro: 'Muro', columna: 'Columna', viga: 'Viga aérea', vigaCim: 'Viga de cimentación', zapata: 'Zapata',
    puerta: 'Puerta', ventana: 'Ventana', cubierta: 'Cubierta', bloque: 'Bloque', cota: 'Cota',
  };

  // Propiedades por defecto de cada elemento nuevo.
  const PLANTILLAS = {
    muro: { unidad: 'h10', alto: 2.40, panete: 2 },
    columna: { b: 0.25, h: 0.25, alto: 2.60, ang: 0 },
    viga: { base: 0.15, altura: 0.20 },
    vigaCim: { base: 0.25, altura: 0.30 },
    zapata: { B: 1.0, L: 1.0, h: 0.30, prof: 1.20 },
    puerta: { ancho: 0.90, alto: 2.10, estilo: 'batiente', giro: 'izq', lado: 1 },
    ventana: { ancho: 1.20, alto: 1.00, antepecho: 1.00 },
    cubierta: { alero: 0.60, forma: 'dos', dir: 'y', pendiente: 20, teja: 'zinc', apoyo: 'muros', sepCerchas: 3.0 },
    bloque: { simbolo: 'arbol', escala: 1, ang: 0 },
    cota: { off: 0.5 },
  };

  // Ajustes de cálculo del plano
  const CFG = {
    sistema: 'E', pisos: 1, concreto: '1:2:3', concretoCim: '1:2:3', mortero: '1:4', morteroPanete: '1:4',
    despConcreto: 5, despMamp: 5, despMortero: 30, despAcero: 5, varilla: 6, traslapo: 50,
    rec: 0.04, recCim: 0.075, solado: 0.05, sepColumnas: 4.0,
  };
  const SISTEMAS = {
    E: 'Mampostería confinada — NSR-10 Título E (casas de 1 y 2 pisos)',
    DMO: 'Pórticos de concreto — NSR-10 Título C, capacidad moderada (DMO)',
  };

  /* ---------- Geometría ---------- */
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const largo = el => dist(el.a, el.b);
  const angulo = el => Math.atan2(el.b.y - el.a.y, el.b.x - el.a.x);

  function proyectar(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    return { t, q, d: dist(p, q), s: t * Math.sqrt(L2) };
  }

  const areaFirmada = pts => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2;
  const caja = pts => {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const c = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    return { ...c, w: c.x1 - c.x0, h: c.y1 - c.y0 };
  };

  // Desplaza un polígono hacia afuera una distancia d (alero de la cubierta).
  function desfasar(pts, d) {
    if (!d || pts.length < 3) return pts.map(p => ({ ...p }));
    const sg = areaFirmada(pts) > 0 ? 1 : -1;
    const n = pts.length;
    const lineas = pts.map((p, i) => {
      const q = pts[(i + 1) % n], L = dist(p, q) || 1;
      const u = { x: (q.x - p.x) / L, y: (q.y - p.y) / L };
      const nn = sg > 0 ? { x: u.y, y: -u.x } : { x: -u.y, y: u.x };
      return { p: { x: p.x + nn.x * d, y: p.y + nn.y * d }, u };
    });
    return lineas.map((l2, i) => {
      const l1 = lineas[(i - 1 + n) % n];
      const den = l1.u.x * l2.u.y - l1.u.y * l2.u.x;
      if (Math.abs(den) < 1e-9) return { ...l2.p };
      const t = ((l2.p.x - l1.p.x) * l2.u.y - (l2.p.y - l1.p.y) * l2.u.x) / den;
      return { x: l1.p.x + l1.u.x * t, y: l1.p.y + l1.u.y * t };
    });
  }

  // Recorta un polígono con un semiplano (eje 'x' o 'y' respecto a un valor).
  function recortar(pts, eje, valor, menor) {
    const dentro = p => (menor ? p[eje] <= valor + 1e-9 : p[eje] >= valor - 1e-9);
    const sal = [];
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      if (dentro(p)) sal.push(p);
      if (dentro(p) !== dentro(q)) {
        const t = (valor - p[eje]) / (q[eje] - p[eje]);
        sal.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    });
    return sal;
  }

  // Esquinas de un rectángulo centrado y girado
  function rectangulo(cx, cy, w, h, ang = 0) {
    const c = Math.cos(ang), s = Math.sin(ang);
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c }));
  }
  // Rectángulo de un elemento lineal (muro o viga) con espesor t
  function franja(a, b, t, extA = 0, extB = 0) {
    const L = dist(a, b) || 1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, nx = -uy * t / 2, ny = ux * t / 2;
    const A = { x: a.x - ux * extA, y: a.y - uy * extA }, B = { x: b.x + ux * extB, y: b.y + uy * extB };
    return [{ x: A.x + nx, y: A.y + ny }, { x: B.x + nx, y: B.y + ny }, { x: B.x - nx, y: B.y - ny }, { x: A.x - nx, y: A.y - ny }];
  }

  const espesorMuro = m => (MAMPOSTERIA[m.unidad] || MAMPOSTERIA.h10).e;

  /* ---------- Contexto de cálculo ---------- */
  function contexto(plano) {
    const cfg = { ...CFG, ...(plano.cfg || {}) };
    const els = plano.elementos || [];
    const de = t => els.filter(e => e.tipo === t);
    const cols = de('columna'), zaps = de('zapata'), vcs = de('vigaCim');
    const ctx = {
      cfg, els, de,
      vanosDe: id => els.filter(e => (e.tipo === 'puerta' || e.tipo === 'ventana') && e.muro === id),
      zapataBajo: c => zaps.find(z => Math.abs(c.x - z.x) <= z.B / 2 + 1e-6 && Math.abs(c.y - z.y) <= z.L / 2 + 1e-6),
      vigaCimBajo: c => vcs.find(v => proyectar(c, v.a, v.b).d <= v.base / 2 + 0.02),
      // Columnas que tocan un elemento lineal, con su posición (m) a lo largo y el traslapo de su ancho.
      columnasEn(lin) {
        const L = largo(lin), ang = angulo(lin);
        return cols.map(c => {
          const pr = proyectar(c, lin.a, lin.b);
          const dAng = ang - (c.ang || 0);
          const along = Math.abs(Math.cos(dAng)) * c.b + Math.abs(Math.sin(dAng)) * c.h;
          const across = Math.abs(Math.sin(dAng)) * c.b + Math.abs(Math.cos(dAng)) * c.h;
          if (pr.d > across / 2 + 0.01) return null;
          const ini = Math.max(0, pr.s - along / 2), fin = Math.min(L, pr.s + along / 2);
          return fin > ini ? { c, s: pr.s, traslapo: fin - ini } : null;
        }).filter(Boolean).sort((p, q) => p.s - q.s);
      },
      alturaApoyo() {
        const z = [...de('muro').map(m => m.alto), ...cols.map(c => c.alto)];
        const vigas = de('viga');
        const hv = vigas.length ? Math.max(...vigas.map(v => v.altura)) : 0;
        return Math.max(0, ...z, ...de('muro').map(m => m.alto + hv)) || 2.6;
      },
    };
    return ctx;
  }

  function etiquetas(plano) {
    const cont = {}, mapa = new Map();
    for (const e of plano.elementos || []) {
      const c = capa(e.tipo);
      if (!c || !c.pre) continue;
      cont[e.tipo] = (cont[e.tipo] || 0) + 1;
      mapa.set(e.id, `${c.pre}-${cont[e.tipo]}`);
    }
    return mapa;
  }

  /* ---------- Refuerzo ---------- */
  const arriba = (v, paso) => Math.ceil(v / paso - 1e-9) * paso;
  const abajo = (v, paso) => Math.max(paso, Math.floor(v / paso + 1e-9) * paso);
  const par = x => (x % 2 ? x + 1 : x);
  const gancho = b => Math.max(12 * db(b), 0.15);
  const traslapo = (b, cfg) => arriba(cfg.traslapo * db(b), 0.05);
  function conTraslapos(L, b, cfg) {
    const lc = +cfg.varilla || 6, tr = traslapo(b, cfg);
    if (L <= lc) return { L, n: 0 };
    const n = Math.ceil((L - lc) / (lc - tr) - 1e-9);
    return { L: L + n * tr, n };
  }
  const largoEstribo = (b, h, r, e) => 2 * (b - 2 * r) + 2 * (h - 2 * r) + 2 * Math.max(6 * db(e), 0.075);
  // Estribos en un tramo: zona de confinamiento lz en cada extremo con separación so y el centro con s.
  function contarEstribos(Ls, lz, so, s) {
    if (Ls <= 0) return 0;
    if (Ls <= 2 * lz) return Math.floor(Ls / so + 1e-9) + 1;
    const nz = Math.floor(lz / so + 1e-9) + 1;
    return 2 * nz + Math.max(0, Math.ceil((Ls - 2 * lz) / s - 1e-9) - 1);
  }
  const cm = v => num(v * 100, 0);

  function refColumna(el, ctx) {
    const { cfg } = ctx, r = el.ref || {}, avisos = [];
    const sistE = cfg.sistema === 'E';
    const bmin = Math.min(el.b, el.h);
    let barra = r.long, n = +r.n || 0, e, so, s, lz;
    if (sistE) {
      barra = barra || (cfg.pisos > 1 ? '#4' : '#3');
      n = n || 4;
      if (el.b * el.h < 0.02 - 1e-9) avisos.push('Sección menor a 200 cm² (mínimo para columnas de confinamiento, NSR-10 Título E).');
      if (!(n >= 4 && db(barra) >= db('#3')) && !(n >= 3 && db(barra) >= db('#4'))) avisos.push('Refuerzo menor a 4 #3 o 3 #4 (mínimo Título E).');
      e = r.estribo || '#2';
      so = +r.so || 0.10; s = +r.s || 0.20; lz = 5 * so; // primeros 6 estribos a 10 cm
    } else {
      const As = 0.01 * el.b * el.h;
      if (bmin < 0.25 - 1e-9) avisos.push('Dimensión menor a 25 cm (mínimo de columnas DMO).');
      barra = barra || ['#4', '#5', '#6', '#7', '#8'].find(x => par(Math.ceil(As / AREA[x] - 1e-9)) <= 12) || '#8';
      n = n || Math.max(4, par(Math.ceil(As / AREA[barra] - 1e-9)));
      const rho = n * AREA[barra] / (el.b * el.h);
      if (rho < 0.01 - 1e-6) avisos.push(`Cuantía de ${num(rho * 100, 2)} %: menor al 1 % mínimo.`);
      if (rho > 0.04) avisos.push(`Cuantía de ${num(rho * 100, 2)} %: mayor al 4 % máximo.`);
      e = r.estribo || '#3';
      lz = arriba(Math.max(Math.max(el.b, el.h), el.alto / 6, 0.50), 0.05);
      so = +r.so || abajo(Math.min(8 * db(barra), 16 * db(e), bmin / 3, 0.15), 0.025);
      s = +r.s || abajo(Math.min(16 * db(barra), 48 * db(e), bmin, 2 * so), 0.05);
      if (Math.max(el.b, el.h) > 0.40) avisos.push('Lado mayor a 40 cm: revise ganchos suplementarios.');
    }
    if (bmin - 2 * cfg.rec < 0.06) avisos.push(`Lado de ${cm(bmin)} cm: no caben estribos y barras con ${cm(cfg.rec)} cm de recubrimiento (use 15 cm o más).`);
    const zap = ctx.zapataBajo(el), vc = !zap && ctx.vigaCimBajo(el);
    const anclaje = zap ? zap.prof - cfg.recCim + gancho(barra) : vc ? vc.altura - cfg.recCim + gancho(barra) : 0.30;
    const pedestal = zap ? Math.max(0, zap.prof - zap.h) : 0;
    const L = el.alto - cfg.rec + gancho(barra) + anclaje;
    const tl = conTraslapos(L, barra, cfg);
    const nEst = contarEstribos(el.alto + pedestal, lz, so, s);
    const lE = largoEstribo(el.b, el.h, cfg.rec, e);
    return {
      barras: [
        { desc: `Longitudinal${tl.n ? ` (incluye ${tl.n} traslapo)` : ''}`, barra, n, l: tl.L },
        { desc: `Estribos ${cm(el.b)}×${cm(el.h)}`, barra: e, n: nEst, l: lE },
      ],
      amarres: nEst * n,
      texto: `${n} ${barra} · E ${e} c/${num(so, 3)} en ${num(lz, 2)} m y c/${num(s, 2)}`,
      avisos, detalle: { tipo: 'columna', b: el.b, h: el.h, n, barra, e, rec: cfg.rec },
      anclaje: zap ? 'Ancla en la zapata' : vc ? 'Ancla en la viga de cimentación' : 'Sin cimentación dibujada debajo',
    };
  }

  function refViga(el, ctx) {
    const { cfg } = ctx, r = el.ref || {}, avisos = [];
    const cim = el.tipo === 'vigaCim', sistE = cfg.sistema === 'E';
    const rec = cim ? cfg.recCim : cfg.rec;
    const L = largo(el), d = el.altura - rec - 0.01;
    let barra = r.long, n = +r.n || 0, e, so, s, lz;
    if (sistE) {
      barra = barra || (cim && cfg.pisos > 1 ? '#4' : '#3');
      n = n || 4;
      if (el.base * el.altura < 0.02 - 1e-9) avisos.push('Sección menor a 200 cm² (mínimo Título E).');
      e = r.estribo || '#2';
      so = +r.so || 0.10; s = +r.s || 0.20; lz = 5 * so;
    } else {
      const As = Math.max(1.4 / 420, 0.25 * Math.sqrt(21) / 420) * el.base * d; // por cara
      barra = barra || '#4';
      n = n || 2 * Math.max(2, Math.ceil(As / AREA[barra] - 1e-9));
      if (el.base < 0.20 - 1e-9) avisos.push('Base menor a 20 cm.');
      e = r.estribo || '#3';
      lz = 2 * el.altura;
      so = +r.so || abajo(Math.min(d / 4, 8 * db(barra), 24 * db(e), 0.30), 0.025);
      s = +r.s || abajo(d / 2, 0.05);
    }
    if (el.base - 2 * rec < 0.06) avisos.push(`Base de ${cm(el.base)} cm: no caben estribos y barras con ${cm(rec)} cm de recubrimiento.`);
    const nSup = Math.floor(n / 2), nInf = n - nSup;
    // Tramos entre columnas de apoyo
    const apoyos = [0, ...ctx.columnasEn(el).map(p => p.s), L].sort((p, q) => p - q)
      .filter((v, i, a) => i === 0 || v - a[i - 1] > 0.05);
    let nEst = 0;
    for (let i = 1; i < apoyos.length; i++) nEst += contarEstribos(apoyos[i] - apoyos[i - 1], lz, so, s);
    const Lb = L - 2 * rec + 2 * gancho(barra);
    const tl = conTraslapos(Lb, barra, cfg);
    return {
      barras: [
        { desc: `Superior${tl.n ? ` (incluye ${tl.n} traslapo)` : ''}`, barra, n: nSup, l: tl.L },
        { desc: `Inferior${tl.n ? ` (incluye ${tl.n} traslapo)` : ''}`, barra, n: nInf, l: tl.L },
        { desc: `Estribos ${cm(el.base)}×${cm(el.altura)}`, barra: e, n: nEst, l: largoEstribo(el.base, el.altura, rec, e) },
      ],
      amarres: nEst * n,
      texto: `${nSup}+${nInf} ${barra} · E ${e} c/${num(so, 3)} en ${num(lz, 2)} m y c/${num(s, 2)}`,
      avisos, detalle: { tipo: 'viga', b: el.base, h: el.altura, nSup, nInf, barra, e, rec },
    };
  }

  function refZapata(el, ctx) {
    const { cfg } = ctx, r = el.ref || {}, avisos = [];
    const rec = cfg.recCim, barra = r.long || '#4';
    const smax = Math.min(3 * el.h, 0.30);
    if (el.h < 0.25 - 1e-9) avisos.push('Altura menor a 25 cm (la altura útil sobre el refuerzo debe ser ≥ 15 cm).');
    const dir = (ancho, Lbarra) => {
      const As = 0.0018 * ancho * el.h;
      const libre = ancho - 2 * rec;
      const n = +r.s ? Math.ceil(libre / +r.s - 1e-9) + 1 : Math.max(Math.ceil(As / AREA[barra] - 1e-9), Math.ceil(libre / smax - 1e-9) + 1);
      return { n, s: libre / Math.max(1, n - 1), l: Lbarra - 2 * rec + 2 * gancho(barra) };
    };
    const x = dir(el.L, el.B), y = dir(el.B, el.L); // barras paralelas a B se reparten en L
    return {
      barras: [
        { desc: `Parrilla, barras de ${num(el.B, 2)} m`, barra, n: x.n, l: x.l },
        { desc: `Parrilla, barras de ${num(el.L, 2)} m`, barra, n: y.n, l: y.l },
      ],
      amarres: x.n * y.n,
      texto: `Parrilla ${barra} c/${num(Math.min(x.s, y.s), 2)} en ambos sentidos`,
      avisos, detalle: { tipo: 'zapata', B: el.B, L: el.L, h: el.h, nx: x.n, ny: y.n, barra, rec },
    };
  }

  function refuerzo(el, ctx) {
    if (el.tipo === 'columna') return refColumna(el, ctx);
    if (el.tipo === 'viga' || el.tipo === 'vigaCim') return refViga(el, ctx);
    if (el.tipo === 'zapata') return refZapata(el, ctx);
    return null;
  }

  /* ---------- Muros ---------- */
  function muroInfo(el, ctx) {
    const u = MAMPOSTERIA[el.unidad] || MAMPOSTERIA.h10;
    const L = largo(el), bruta = L * el.alto;
    const vanos = ctx.vanosDe(el.id).reduce((s, v) => s + v.ancho *
      (v.tipo === 'puerta' ? Math.min(v.alto, el.alto) : Math.max(0, Math.min(v.alto, el.alto - v.antepecho))), 0);
    const columnas = ctx.columnasEn(el).reduce((s, p) => s + p.traslapo, 0) * el.alto;
    const neta = Math.max(0, bruta - vanos - columnas);
    const { cfg } = ctx;
    return {
      u, L, bruta, vanos, columnas, neta,
      unidades: Math.ceil(neta * unidadesM2(u) * (1 + cfg.despMamp / 100) - 1e-9),
      mortero: neta * morteroM2(u) * (1 + cfg.despMortero / 100),
      panete: neta * (+el.panete || 0),
    };
  }

  /* ---------- Cubierta ---------- */
  // Mejor combinación de largos comerciales para cubrir una longitud inclinada Ls.
  function mejorLargo(Ls, largos, tras) {
    let mejor = null;
    for (const [Lt] of largos) {
      const filas = Lt >= Ls ? 1 : Math.ceil((Ls - tras) / (Lt - tras) - 1e-9);
      const resto = Ls - (filas - 1) * (Lt - tras);
      const ultimo = largos.find(([x]) => x >= resto - 1e-9) || largos[largos.length - 1];
      const total = (filas - 1) * Lt + ultimo[0];
      if (!mejor || total < mejor.total - 1e-9 || (Math.abs(total - mejor.total) < 1e-9 && filas < mejor.filas)) mejor = { Lt, filas, ultimo, total };
    }
    const piezas = {};
    const nombre = L => largos.find(([x]) => x === L)[1];
    if (mejor.filas > 1) piezas[mejor.Lt] = mejor.filas - 1;
    piezas[mejor.ultimo[0]] = (piezas[mejor.ultimo[0]] || 0) + 1;
    return { filas: mejor.filas, piezas: Object.entries(piezas).map(([L, c]) => ({ L: +L, nombre: nombre(+L), c })) };
  }

  function cercha(S, f, dos, alero, k) {
    const paneles = Math.max(2, 2 * Math.ceil(S / 2 / 1.0 - 1e-9)), a = S / paneles;
    const alt = x => (dos ? f * (1 - Math.abs(x - S / 2) / (S / 2)) : f * (1 - x / S));
    let mont = dos ? 0 : f, diag = 0;
    for (let i = 1; i < paneles; i++) mont += alt(i * a);
    for (let i = 0; i < paneles; i++) diag += Math.hypot(a, Math.max(alt(i * a), alt((i + 1) * a)));
    const sup = (dos ? 2 * Math.hypot(S / 2, f) : Math.hypot(S, f)) + 2 * alero * k;
    return { paneles, sup, inf: S, mont, diag, total: sup + S + mont + diag };
  }

  function cubiertaInfo(el) {
    const teja = TEJAS[el.teja] || TEJAS.zinc;
    const util = +el.util || teja.util, tras = +el.traslapo || teja.traslapo, sep = +el.sep || teja.sep;
    const ap = el.puntos, cont = desfasar(ap, +el.alero || 0);
    const p = (+el.pendiente || 0) / 100, k = Math.sqrt(1 + p * p);
    const bb = caja(cont), ba = caja(ap);
    const ejeX = el.dir === 'x';
    const extS = ejeX ? bb.w : bb.h, extW = ejeX ? bb.h : bb.w;
    const S = ejeX ? ba.w : ba.h, Wap = ejeX ? ba.h : ba.w;
    const dos = el.forma === 'dos', aguas = dos ? 2 : 1;
    const Ls = extS / aguas * k;
    const areaPlan = Math.abs(areaFirmada(cont)), areaReal = areaPlan * k;
    const columnas = Math.max(1, Math.ceil((extW - (teja.ancho - util)) / util - 1e-9));
    const comb = mejorLargo(Ls, teja.largos, tras);
    const tejas = comb.piezas.map(x => ({ ...x, total: x.c * columnas * aguas }));
    const nCorreas = Math.ceil(Ls / sep - 1e-9) + 1;
    const correasMl = nCorreas * aguas * extW;
    const f = dos ? p * S / 2 : p * S;
    const res = {
      teja, util, tras, sep, cont, p, k, areaPlan, areaReal, aguas, Ls, extW, columnas, comb, tejas,
      totalTejas: tejas.reduce((s, x) => s + x.total, 0),
      nCorreas: nCorreas * aguas, correasMl, correas6: Math.ceil(correasMl * 1.05 / 6 - 1e-9),
      caballetes: dos ? columnas : 0,
      fijaciones: columnas * aguas * nCorreas * 2,
      S, f, flecha: f,
    };
    if (el.apoyo === 'cerchas') {
      const c = cercha(S, f, dos, +el.alero || 0, k);
      const n = Math.ceil(Wap / (+el.sepCerchas || 3) - 1e-9) + 1;
      res.cerchas = { ...c, n, ml: c.total * n };
    } else {
      res.culatas = S * f; // dos triángulos de base S y altura f, en cualquiera de las dos formas
    }
    return res;
  }

  // Planos inclinados de la cubierta para la vista 3D: polígonos con la cota z de cada vértice.
  function planosCubierta(el, z0) {
    const ap = el.puntos, cont = desfasar(ap, +el.alero || 0);
    const p = (+el.pendiente || 0) / 100, ba = caja(ap);
    const eje = el.dir === 'x' ? 'x' : 'y';
    const s0 = eje === 'x' ? ba.x0 : ba.y0, s1 = eje === 'x' ? ba.x1 : ba.y1, mid = (s0 + s1) / 2, half = (s1 - s0) / 2;
    const z = el.forma === 'dos' ? s => z0 + p * (half - Math.abs(s - mid)) : s => z0 + p * (s1 - s);
    const polis = el.forma === 'dos' ? [recortar(cont, eje, mid, true), recortar(cont, eje, mid, false)] : [cont];
    return polis.filter(q => q.length >= 3).map(q => q.map(pt => ({ x: pt.x, y: pt.y, z: z(pt[eje]) })));
  }

  /* ---------- Cantidades del plano ---------- */
  function cantidades(plano) {
    const ctx = contexto(plano), { cfg } = ctx;
    const etq = etiquetas(plano);
    const kC = 1 + cfg.despConcreto / 100, kA = 1 + cfg.despAcero / 100;
    const secciones = [];
    const mat = { cemento: 0, arena: 0, grava: 0, agua: 0, unidades: {}, acero: {}, alambre: 0 };
    const concretoPor = {};
    const sumarConcreto = (vol, dos) => { concretoPor[dos] = (concretoPor[dos] || 0) + vol; };

    // Mampostería
    const muros = ctx.de('muro');
    if (muros.length) {
      const filas = [], porUnidad = {};
      let morteroPega = 0, panete = 0;
      for (const m of muros) {
        const i = muroInfo(m, ctx);
        filas.push([etq.get(m.id), i.u.t.replace(/\s*\(.*$/, ''), i.L, m.alto, i.vanos, i.neta, i.unidades, i.mortero, i.panete]);
        const pu = porUnidad[m.unidad] || (porUnidad[m.unidad] = { t: i.u.t, area: 0, un: 0 });
        pu.area += i.neta; pu.un += i.unidades;
        morteroPega += i.mortero; panete += i.panete;
      }
      const tot = filas.reduce((s, f) => [s[0] + f[2], s[1] + f[4], s[2] + f[5], s[3] + f[6], s[4] + f[7], s[5] + f[8]], [0, 0, 0, 0, 0, 0]);
      secciones.push({
        id: 'mamposteria', titulo: 'Mampostería',
        cols: [['Muro'], ['Unidad'], ['Long. (m)', 2], ['Alto (m)', 2], ['Vanos (m²)', 2], ['Área neta (m²)', 2], ['Unidades', 0], ['Mortero pega (m³)', 3], ['Pañete (m²)', 2]],
        filas, total: ['Total', '', tot[0], '', tot[1], tot[2], tot[3], tot[4], tot[5]],
        notas: [`Unidades con ${cfg.despMamp} % de desperdicio y junta de 1 cm. Mortero de pega ${cfg.mortero} con ${cfg.despMortero} % de desperdicio. Se descuentan vanos y columnas embebidas.`],
      });
      const mp = MORTEROS[cfg.mortero], mpa = MORTEROS[cfg.morteroPanete];
      const volPanete = panete * PANETE * 1.15;
      mat.cemento += morteroPega * mp.cem + volPanete * mpa.cem;
      mat.arena += morteroPega * mp.arena + volPanete * mpa.arena;
      mat.agua += morteroPega * mp.agua + volPanete * mpa.agua;
      for (const [k, v] of Object.entries(porUnidad)) mat.unidades[k] = { t: v.t, n: v.un, area: v.area };
      mat.morteroPega = morteroPega; mat.panete = panete; mat.volPanete = volPanete;
    }

    // Concreto y acero
    const filasC = [], filasA = [], avisos = [];
    let amarres = 0;
    const estructurales = [...ctx.de('zapata'), ...ctx.de('vigaCim'), ...ctx.de('columna'), ...ctx.de('viga')];
    let solado = 0, excav = 0, enterrado = 0;
    for (const el of estructurales) {
      const nombre = etq.get(el.id);
      let vol = 0, seccion = '', medida = 0, dos = cfg.concreto;
      if (el.tipo === 'columna') {
        const zap = ctx.zapataBajo(el), ped = zap ? Math.max(0, zap.prof - zap.h) : 0;
        medida = el.alto + ped; vol = el.b * el.h * medida; seccion = `${cm(el.b)}×${cm(el.h)}`;
        enterrado += el.b * el.h * ped;
      } else if (el.tipo === 'zapata') {
        medida = el.h; vol = el.B * el.L * el.h; seccion = `${num(el.B, 2)}×${num(el.L, 2)}`; dos = cfg.concretoCim;
        solado += el.B * el.L * cfg.solado;
        excav += (el.B + 0.2) * (el.L + 0.2) * (el.prof + cfg.solado);
        enterrado += vol + el.B * el.L * cfg.solado;
      } else {
        // Solo la viga aérea comparte el nudo con la columna; la de cimentación queda bajo el arranque.
        const L = largo(el), sol = el.tipo === 'viga' ? ctx.columnasEn(el).reduce((s, p) => s + p.traslapo, 0) : 0;
        medida = Math.max(0, L - sol); vol = el.base * el.altura * medida; seccion = `${cm(el.base)}×${cm(el.altura)}`;
        if (el.tipo === 'vigaCim') {
          dos = cfg.concretoCim;
          solado += el.base * medida * cfg.solado;
          excav += (el.base + 0.2) * (el.altura + cfg.solado) * medida;
          enterrado += vol + el.base * medida * cfg.solado;
        }
      }
      filasC.push([nombre, NOMBRE_TIPO[el.tipo], seccion, medida, vol, dos]);
      sumarConcreto(vol, dos);
      const ref = refuerzo(el, ctx);
      if (!ref) continue;
      amarres += ref.amarres;
      ref.avisos.forEach(a => avisos.push(`${nombre}: ${a}`));
      for (const b of ref.barras) {
        const total = b.n * b.l, kg = total * BARRAS[b.barra].kg;
        filasA.push([nombre, b.desc, b.barra, b.n, b.l, total, kg]);
        mat.acero[b.barra] = (mat.acero[b.barra] || 0) + total;
      }
    }
    if (filasC.length) {
      const totalVol = filasC.reduce((s, f) => s + f[4], 0);
      secciones.push({
        id: 'concreto', titulo: 'Concreto',
        cols: [['Elemento'], ['Tipo'], ['Sección (cm / m)'], ['Long. o alto (m)', 2], ['Volumen (m³)', 3], ['Mezcla']],
        filas: filasC, total: ['Total', '', '', '', totalVol, ''],
        notas: [`Volúmenes geométricos; los materiales se calculan con ${cfg.despConcreto} % de desperdicio. Las vigas aéreas descuentan el nudo con las columnas.`],
      });
      for (const [dos, vol] of Object.entries(concretoPor)) {
        const c = CONCRETOS[dos];
        mat.cemento += vol * kC * c.cem; mat.arena += vol * kC * c.arena; mat.grava += vol * kC * c.grava; mat.agua += vol * kC * c.agua;
      }
      if (solado) {
        const c = CONCRETOS['1:3:6'];
        mat.cemento += solado * kC * c.cem; mat.arena += solado * kC * c.arena; mat.grava += solado * kC * c.grava; mat.agua += solado * kC * c.agua;
      }
      mat.concreto = concretoPor; mat.solado = solado;
    }
    if (filasA.length) {
      const pesoTotal = filasA.reduce((s, f) => s + f[6], 0);
      secciones.push({
        id: 'acero', titulo: 'Acero de refuerzo (despiece)',
        cols: [['Elemento'], ['Descripción'], ['Barra'], ['Cant.', 0], ['Long. c/u (m)', 2], ['Long. total (m)', 2], ['Peso (kg)', 1]],
        filas: filasA, total: ['Total', '', '', '', '', '', pesoTotal],
        notas: [`Sistema: ${SISTEMAS[cfg.sistema]}. Traslapo ${cfg.traslapo} db, ganchos de 12 db, recubrimiento ${cm(cfg.rec)} cm (cimentación ${num(cfg.recCim * 100, 1)} cm).`,
          'Es refuerzo mínimo de referencia: el refuerzo definitivo lo fija el diseño estructural firmado.'],
      });
      const filasR = [];
      let kgTotal = 0;
      for (const b of Object.keys(BARRAS)) {
        const m = mat.acero[b];
        if (!m) continue;
        const kg = m * BARRAS[b].kg * kA;
        kgTotal += kg;
        filasR.push([BARRAS[b].t, m, kg, Math.ceil(m * kA / (+cfg.varilla || 6) - 1e-9)]);
      }
      const porAmarre = amarres * 0.30 / 105; // alambre #18: ~105 m/kg y ~30 cm por amarre
      const porPeso = kgTotal * 0.02; // 2 % del peso del acero
      mat.alambre = Math.ceil(Math.max(porAmarre, porPeso) * 2) / 2;
      mat.kgAcero = kgTotal;
      secciones.push({
        id: 'resumenAcero', titulo: 'Resumen de acero',
        cols: [['Barra'], ['Longitud (m)', 1], [`Peso con ${cfg.despAcero} % (kg)`, 1], [`Varillas de ${cfg.varilla} m`, 0]],
        filas: filasR, total: ['Total', '', kgTotal, ''],
        notas: [`Alambre negro #18 sugerido: ${num(mat.alambre, 1)} kg — el mayor entre ${num(amarres, 0)} amarres × 30 cm (${num(porAmarre, 1)} kg) y el 2 % del peso del acero (${num(porPeso, 1)} kg).`],
      });
    }

    // Excavación y rellenos
    if (excav) {
      secciones.push({
        id: 'excavacion', titulo: 'Excavación y rellenos',
        cols: [['Concepto'], ['Cantidad', 2], ['Unidad']],
        filas: [['Excavación manual (con sobreancho de 10 cm por lado)', excav, 'm³'], ['Solado de limpieza 1:3:6 (e = ' + cm(cfg.solado) + ' cm)', solado, 'm³'],
          ['Relleno compactado con material de excavación', Math.max(0, excav - enterrado), 'm³'], ['Retiro de sobrantes (volumen suelto ×1,3)', enterrado * 1.3, 'm³']],
        notas: ['Se asume la viga de cimentación con su cara superior a nivel del terreno.'],
      });
      mat.excavacion = excav;
    }

    // Cubierta
    for (const cub of ctx.de('cubierta')) {
      const c = cubiertaInfo(cub);
      const filas = [
        ['Área en planta (con alero de ' + num(cub.alero, 2) + ' m)', c.areaPlan, 'm²'],
        ['Pendiente', cub.pendiente, '%'],
        ['Área inclinada', c.areaReal, 'm²'],
        ['Longitud inclinada por agua', c.Ls, 'm'],
        ...c.tejas.map(t => [`Teja ${c.teja.t} — ${t.nombre}`, t.total, 'un']),
        ['Correas (líneas de ' + num(c.extW, 2) + ' m, separación ≤ ' + num(c.sep, 2) + ' m)', c.nCorreas, 'un'],
        ['Correas — longitud total', c.correasMl, 'm'],
        ['Correas — perfiles de 6 m (5 % desperdicio)', c.correas6, 'un'],
        ...(c.caballetes ? [['Caballetes', c.caballetes, 'un']] : []),
        ['Ganchos o tornillos de fijación (aprox.)', c.fijaciones, 'un'],
        ['Altura de cumbrera sobre el apoyo', c.f, 'm'],
      ];
      if (c.cerchas) {
        filas.push(['Cerchas metálicas (separación ' + num(cub.sepCerchas, 2) + ' m)', c.cerchas.n, 'un']);
        filas.push(['Perfil por cercha (cordones, montantes y diagonales)', c.cerchas.total, 'm']);
        filas.push(['Perfil total de cerchas', c.cerchas.ml, 'm']);
      } else filas.push(['Culatas en mampostería (triángulos de apoyo)', c.culatas, 'm²']);
      secciones.push({
        id: 'cubierta', titulo: `Cubierta ${etq.get(cub.id)} — ${cub.forma === 'dos' ? 'dos aguas' : 'una agua'}`,
        cols: [['Concepto'], ['Cantidad', 'a'], ['Unidad']], filas,
        notas: [`Por agua: ${c.columnas} columnas de teja (ancho útil ${num(c.util, 3)} m) × ${c.comb.filas} fila(s): ${c.comb.piezas.map(x => `${x.c} × ${x.nombre}`).join(' + ')} por columna, traslapo de ${num(c.tras, 2)} m.`,
          'Confirme ancho útil, traslapos y separación de correas con la ficha técnica del fabricante.'],
      });
      mat.tejas = (mat.tejas || []).concat(c.tejas.map(t => ({ t: `Teja ${c.teja.t} — ${t.nombre}`, n: t.total })));
      mat.correas = (mat.correas || 0) + c.correas6;
    }

    // Carpintería
    const vanos = [...ctx.de('puerta'), ...ctx.de('ventana')];
    if (vanos.length) {
      secciones.push({
        id: 'carpinteria', titulo: 'Puertas y ventanas',
        cols: [['Elemento'], ['Tipo'], ['Ancho (m)', 2], ['Alto (m)', 2], ['Antepecho (m)', 2], ['Muro']],
        filas: vanos.map(v => [etq.get(v.id), v.tipo === 'puerta' ? `Puerta ${v.estilo || 'batiente'}` : 'Ventana', v.ancho, v.alto, v.tipo === 'ventana' ? v.antepecho : '', etq.get(v.muro) || '—']),
      });
    }

    // Materiales consolidados
    const filasM = [];
    if (mat.cemento) filasM.push(['Cemento gris (bultos de 50 kg)', Math.ceil(mat.cemento / BULTO - 1e-9), 'bto']);
    if (mat.arena) filasM.push(['Arena', mat.arena, 'm³']);
    if (mat.grava) filasM.push(['Grava', mat.grava, 'm³']);
    for (const u of Object.values(mat.unidades)) filasM.push([u.t, u.n, 'un']);
    for (const b of Object.keys(BARRAS)) if (mat.acero[b]) filasM.push([`Acero ${BARRAS[b].t} — varillas de ${cfg.varilla} m`, Math.ceil(mat.acero[b] * kA / (+cfg.varilla || 6) - 1e-9), 'un']);
    if (mat.kgAcero) filasM.push(['Acero total', mat.kgAcero, 'kg']);
    if (mat.alambre) filasM.push(['Alambre negro #18', mat.alambre, 'kg']);
    for (const t of mat.tejas || []) filasM.push([t.t, t.n, 'un']);
    if (mat.correas) filasM.push(['Correas metálicas (perfiles de 6 m)', mat.correas, 'un']);
    if (mat.agua) filasM.push(['Agua', mat.agua, 'L']);
    if (filasM.length) secciones.unshift({
      id: 'materiales', titulo: 'Materiales a comprar', cols: [['Material'], ['Cantidad', 'a'], ['Unidad']], filas: filasM,
      notas: ['Incluye desperdicios. Cantidades preliminares a partir de lo dibujado.'],
    });

    const resumen = [];
    const volTotal = Object.values(concretoPor).reduce((s, v) => s + v, 0);
    if (volTotal) resumen.push(['Concreto', `${num(volTotal, 2)} m³`]);
    if (mat.kgAcero) resumen.push(['Acero', `${num(mat.kgAcero, 0)} kg`]);
    for (const u of Object.values(mat.unidades)) resumen.push([u.t.replace(/\s*\(.*$/, '').replace(/ —.*$/, ''), `${num(u.n, 0)} un`]);
    if (mat.cemento) resumen.push(['Cemento', `${num(Math.ceil(mat.cemento / BULTO - 1e-9), 0)} bto`]);
    for (const t of mat.tejas || []) resumen.push(['Tejas', `${num(t.n, 0)} un`]);
    return { secciones, avisos, resumen, mat };
  }

  /* ---------- Detalle de refuerzo (SVG) ---------- */
  function detalleSVG(d) {
    if (!d) return '';
    const W = 220, H = 170, m = 26;
    const barraR = Math.max(3, BARRAS[d.barra].d / 1000);
    if (d.tipo === 'zapata') {
      const k = Math.min((W - 2 * m) / d.B, (H - 2 * m) / d.L), w = d.B * k, h = d.L * k, x0 = (W - w) / 2, y0 = (H - h) / 2 - 6;
      const lineas = (n, horizontal) => {
        const c = Math.min(n, 14), out = [];
        for (let i = 0; i < c; i++) {
          const f = c === 1 ? 0.5 : i / (c - 1);
          out.push(horizontal ? `<line x1="${x0 + 6}" x2="${x0 + w - 6}" y1="${y0 + 6 + f * (h - 12)}" y2="${y0 + 6 + f * (h - 12)}"/>`
            : `<line y1="${y0 + 6}" y2="${y0 + h - 6}" x1="${x0 + 6 + f * (w - 12)}" x2="${x0 + 6 + f * (w - 12)}"/>`);
        }
        return out.join('');
      };
      return `<svg viewBox="0 0 ${W} ${H}" class="detalle"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#e7e3da" stroke="#555"/>
        <g stroke="#c0392b" stroke-width="1.6">${lineas(d.nx, true)}${lineas(d.ny, false)}</g>
        <text x="${W / 2}" y="${H - 6}" text-anchor="middle">Planta ${num(d.B, 2)} × ${num(d.L, 2)} m · ${d.nx}+${d.ny} ${d.barra}</text></svg>`;
    }
    const k = Math.min((W - 2 * m) / d.b, (H - 2 * m - 10) / d.h), w = d.b * k, h = d.h * k, x0 = (W - w) / 2, y0 = (H - h) / 2 - 8;
    const r = d.rec * k, ri = r + 4;
    const pos = [];
    if (d.tipo === 'viga') {
      const fila = (n, y) => { for (let i = 0; i < n; i++) pos.push([x0 + ri + (n === 1 ? (w - 2 * ri) / 2 : i * (w - 2 * ri) / (n - 1)), y]); };
      fila(d.nSup, y0 + ri); fila(d.nInf, y0 + h - ri);
    } else {
      const xs = [x0 + ri, x0 + w - ri], ys = [y0 + ri, y0 + h - ri];
      xs.forEach(x => ys.forEach(y => pos.push([x, y])));
      const extra = Math.max(0, d.n - 4);
      const eb = Math.round(extra * d.b / (d.b + d.h) / 2), eh = Math.floor((extra - 2 * eb) / 2), sobra = extra - 2 * eb - 2 * eh;
      for (const y of ys) for (let i = 1; i <= eb; i++) pos.push([x0 + ri + i * (w - 2 * ri) / (eb + 1), y]);
      for (const x of xs) for (let i = 1; i <= eh; i++) pos.push([x, y0 + ri + i * (h - 2 * ri) / (eh + 1)]);
      if (sobra) pos.push([x0 + w / 2, ys[0]]);
    }
    const rb = Math.max(3.2, barraR * k);
    return `<svg viewBox="0 0 ${W} ${H}" class="detalle"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#e3e3e0" stroke="#555"/>
      <rect x="${x0 + r}" y="${y0 + r}" width="${w - 2 * r}" height="${h - 2 * r}" rx="4" fill="none" stroke="#c0392b" stroke-width="1.8"/>
      ${pos.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${rb}" fill="#222"/>`).join('')}
      <text x="${W / 2}" y="${H - 6}" text-anchor="middle">${cm(d.b)} × ${cm(d.h)} cm · ${d.tipo === 'viga' ? d.nSup + d.nInf : d.n} ${d.barra} · E ${d.e}</text></svg>`;
  }

  /* ---------- Modelo ---------- */
  function nuevoPlano(proyectoId = null, nombre = 'Plano 1') {
    const ahora = new Date().toISOString();
    return {
      id: UI.uid(), proyectoId, nombre, creado: ahora, modificado: ahora,
      cfg: { ...CFG }, plantillas: JSON.parse(JSON.stringify(PLANTILLAS)), capasOcultas: [], elementos: [],
    };
  }

  return {
    AREA, MAMPOSTERIA, TEJAS, CAPAS, PLANTILLAS, CFG, SISTEMAS, JUNTA, NOMBRE_TIPO, capa,
    unidadesM2, morteroM2, espesorMuro,
    dist, largo, angulo, proyectar, areaFirmada, caja, desfasar, recortar, rectangulo, franja,
    contexto, etiquetas, refuerzo, muroInfo, cubiertaInfo, planosCubierta, cantidades, detalleSVG, nuevoPlano,
  };
})();
