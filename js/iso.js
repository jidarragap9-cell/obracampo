/* Vista 3D isométrica del plano: extruye muros, columnas, vigas, zapatas y cubierta, y los dibuja en un canvas 2D. */
const Iso = (() => {
  const E = Elementos;

  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const resta = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const cruz = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const punto = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const unit = v => { const L = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / L, y: v.y / L, z: v.z / L }; };
  const centro = pts => pts.reduce((c, p) => ({ x: c.x + p.x / pts.length, y: c.y + p.y / pts.length, z: c.z + p.z / pts.length }), { x: 0, y: 0, z: 0 });

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

  // Muro con sus vanos: se parte en piezas sólidas (y trozos de ~1 m para ordenar mejor la profundidad).
  function muro(m, ctx, caras) {
    const L = E.largo(m), t = E.espesorMuro(m), H = m.alto;
    const color = (E.MAMPOSTERIA[m.unidad] || E.MAMPOSTERIA.h10).color3d;
    const ux = (m.b.x - m.a.x) / (L || 1), uy = (m.b.y - m.a.y) / (L || 1);
    const P = s => ({ x: m.a.x + ux * s, y: m.a.y + uy * s });
    const vanos = ctx.vanosDe(m.id).map(v => ({
      v, s0: Math.max(0, v.s - v.ancho / 2), s1: Math.min(L, v.s + v.ancho / 2),
      z0: v.tipo === 'puerta' ? 0 : v.antepecho, z1: Math.min(H, (v.tipo === 'puerta' ? 0 : v.antepecho) + v.alto),
    }));
    const cortes = [...new Set([0, L, ...vanos.flatMap(o => [o.s0, o.s1])])].sort((a, b) => a - b);
    for (let i = 1; i < cortes.length; i++) {
      const s0 = cortes[i - 1], s1 = cortes[i];
      if (s1 - s0 < 1e-4) continue;
      const o = vanos.find(q => q.s0 <= s0 + 1e-6 && q.s1 >= s1 - 1e-6);
      const tramos = o ? [[0, o.z0], [o.z1, H]] : [[0, H]];
      const n = Math.max(1, Math.ceil((s1 - s0) / 1.0));
      for (let k = 0; k < n; k++) {
        const a = s0 + (s1 - s0) * k / n, b = s0 + (s1 - s0) * (k + 1) / n;
        for (const [z0, z1] of tramos) caras.push(...prisma(E.franja(P(a), P(b), t), z0, z1, color));
      }
      if (o) {
        const plano = [{ ...P(s0), z: o.z0 }, { ...P(s1), z: o.z0 }, { ...P(s1), z: o.z1 }, { ...P(s0), z: o.z1 }];
        caras.push(o.v.tipo === 'ventana'
          ? { ...cara(plano, '#8fcde8'), alfa: 0.55, doble: true }
          : { ...cara(plano, '#8a5a32'), alfa: 0.95, doble: true });
      }
    }
  }

  function construir(plano, op = {}) {
    const ctx = E.contexto(plano), caras = [];
    const visible = t => !(plano.capasOcultas || []).includes(t);
    const gris = '#a7a9ac', cim = '#9b8f7d';
    if (visible('zapata')) for (const z of ctx.de('zapata'))
      caras.push(...prisma(E.rectangulo(z.x, z.y, z.B, z.L), -z.prof, -z.prof + z.h, cim));
    if (visible('vigaCim')) for (const v of ctx.de('vigaCim'))
      caras.push(...prisma(E.franja(v.a, v.b, v.base), -v.altura, 0, cim));
    if (visible('muro')) for (const m of ctx.de('muro')) muro(m, ctx, caras);
    if (visible('columna')) for (const c of ctx.de('columna')) {
      const zap = ctx.zapataBajo(c);
      caras.push(...prisma(E.rectangulo(c.x, c.y, c.b, c.h, c.ang || 0), zap ? -(zap.prof - zap.h) : 0, c.alto, gris));
    }
    if (visible('viga')) for (const v of ctx.de('viga')) {
      const cols = ctx.columnasEn(v).map(p => p.c.alto);
      const muro = ctx.de('muro').find(m => E.proyectar(v.a, m.a, m.b).d < 0.05 && E.proyectar(v.b, m.a, m.b).d < 0.05);
      const zTop = cols.length ? Math.max(...cols) : (muro ? muro.alto : 2.4) + v.altura;
      caras.push(...prisma(E.franja(v.a, v.b, v.base), zTop - v.altura, zTop, '#b7b9bd'));
    }
    if (visible('bloque')) for (const b of ctx.de('bloque')) {
      const k = b.escala || 1;
      if (['arbol', 'arbusto', 'palma'].includes(b.simbolo)) {
        const r = (b.simbolo === 'arbusto' ? 0.6 : 1.5) * k, h = (b.simbolo === 'arbusto' ? 0.9 : b.simbolo === 'palma' ? 4.5 : 3.5) * k;
        caras.push(...prisma(E.rectangulo(b.x, b.y, 0.2 * k, 0.2 * k), 0, h * 0.45, '#7a5230'));
        const oct = Array.from({ length: 8 }, (_, i) => ({ x: b.x + r * Math.cos(i * Math.PI / 4), y: b.y + r * Math.sin(i * Math.PI / 4) }));
        caras.push(...prisma(oct, h * 0.4, h, '#4f8f3a'));
      } else if (b.simbolo === 'carro') caras.push(...prisma(E.rectangulo(b.x, b.y, 1.8 * k, 4.3 * k, b.ang || 0), 0.2, 1.45, '#3e6fb0'));
    }
    if (visible('cubierta') && op.cubierta !== 'oculta') {
      const z0 = ctx.alturaApoyo();
      for (const c of ctx.de('cubierta')) {
        const color = (E.TEJAS[c.teja] || E.TEJAS.zinc).color3d;
        for (const pol of E.planosCubierta(c, z0)) caras.push({ ...cara(pol, color), doble: true, alfa: op.cubierta === 'transparente' ? 0.4 : 0.96, techo: true });
        if (c.apoyo === 'cerchas') continue;
        // Culatas: triángulos de mampostería en los extremos de la cumbrera
        const ap = E.caja(c.puntos), p = (+c.pendiente || 0) / 100, ejeX = c.dir === 'x';
        const [s0, s1, w0, w1] = ejeX ? [ap.x0, ap.x1, ap.y0, ap.y1] : [ap.y0, ap.y1, ap.x0, ap.x1];
        const P = (s, w, z) => (ejeX ? { x: s, y: w, z } : { x: w, y: s, z });
        const muroBase = ctx.de('muro')[0];
        const ladrillo = (E.MAMPOSTERIA[muroBase?.unidad] || E.MAMPOSTERIA.h10).color3d;
        for (const w of [w0, w1]) {
          const tri = c.forma === 'dos' ? [P(s0, w, z0), P(s1, w, z0), P((s0 + s1) / 2, w, z0 + p * (s1 - s0) / 2)]
            : [P(s0, w, z0), P(s1, w, z0), P(s0, w, z0 + p * (s1 - s0))];
          caras.push({ ...cara(tri, ladrillo), doble: true });
        }
      }
    }
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

  /* cam: { theta, phi, zoom, px, py } en radianes y píxeles */
  function dibujar(g, plano, cam, W, H, op = {}) {
    const ct = Math.cos(cam.theta), st = Math.sin(cam.theta), cp = Math.cos(cam.phi), sp = Math.sin(cam.phi);
    const V = { x: st * cp, y: ct * cp, z: sp };
    const luz = unit({ x: -0.4, y: 0.6, z: 1 });
    const lim = limites(plano);
    const c3 = { x: (lim.x0 + lim.x1) / 2, y: (lim.y0 + lim.y1) / 2, z: (lim.z0 + lim.z1) / 2 };
    const R = Math.hypot(lim.x1 - lim.x0, lim.y1 - lim.y0, lim.z1 - lim.z0) / 2 || 5;
    const esc = Math.min(W, H) / (2.1 * R) * (cam.zoom || 1);
    const proy = p => {
      const x = p.x - c3.x, y = p.y - c3.y, z = p.z - c3.z;
      const u = x * ct - y * st, v = x * st + y * ct;
      return { X: W / 2 + (cam.px || 0) + u * esc, Y: H / 2 + (cam.py || 0) + (v * sp - z * cp) * esc, D: v * cp + z * sp };
    };

    g.save();
    g.fillStyle = op.fondo || '#ffffff';
    g.fillRect(0, 0, W, H);
    // Terreno: cuadrícula de 1 m en z = 0
    g.strokeStyle = 'rgba(80,110,90,.18)';
    g.lineWidth = 1;
    const gx0 = Math.floor(lim.x0) - 2, gx1 = Math.ceil(lim.x1) + 2, gy0 = Math.floor(lim.y0) - 2, gy1 = Math.ceil(lim.y1) + 2;
    g.beginPath();
    for (let x = gx0; x <= gx1; x++) { const a = proy({ x, y: gy0, z: 0 }), b = proy({ x, y: gy1, z: 0 }); g.moveTo(a.X, a.Y); g.lineTo(b.X, b.Y); }
    for (let y = gy0; y <= gy1; y++) { const a = proy({ x: gx0, y, z: 0 }), b = proy({ x: gx1, y, z: 0 }); g.moveTo(a.X, a.Y); g.lineTo(b.X, b.Y); }
    g.stroke();

    const caras = construir(plano, op).map(f => {
      const pp = f.pts.map(proy);
      return { ...f, pp, D: pp.reduce((s, p) => s + p.D, 0) / pp.length };
    }).filter(f => f.doble || punto(f.n, V) > 1e-6)
      // La cubierta se pinta al final: vista desde arriba, siempre tapa lo que está debajo
      .sort((a, b) => (a.techo ? 1 : 0) - (b.techo ? 1 : 0) || a.D - b.D);

    for (const f of caras) {
      const [r, gg, b] = hex(f.color);
      const l = 0.55 + 0.45 * Math.abs(punto(f.n, luz));
      g.fillStyle = `rgba(${Math.round(r * l)},${Math.round(gg * l)},${Math.round(b * l)},${f.alfa ?? 1})`;
      g.beginPath();
      f.pp.forEach((p, i) => (i ? g.lineTo(p.X, p.Y) : g.moveTo(p.X, p.Y)));
      g.closePath();
      g.fill();
      g.strokeStyle = f.techo ? 'rgba(60,40,40,.55)' : 'rgba(30,30,30,.45)';
      g.lineWidth = 0.7;
      g.stroke();
    }

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

  return { dibujar };
})();
