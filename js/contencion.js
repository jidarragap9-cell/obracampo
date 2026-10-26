/* Prediseño de muro de contención en voladizo (Rankine, relleno horizontal, sin empuje pasivo).
   Da una primera idea de dimensiones, estabilidad y cantidades; no reemplaza el diseño geotécnico y estructural (NSR-10 Título H y C). */
const Contencion = (() => {
  const { esc, $, $$, num, toast } = UI;
  const { CONCRETOS, BARRAS, BULTO } = Calc;
  const AREA = Elementos.AREA;

  const DATOS = [
    ['H', 'Altura total del muro H (m)', 3.0],
    ['L', 'Longitud del muro (m)', 10],
    ['gs', 'Peso unitario del relleno γ (kN/m³)', 18],
    ['phi', 'Ángulo de fricción del relleno φ (°)', 30],
    ['q', 'Sobrecarga sobre el relleno (kPa)', 10],
    ['mu', 'Coeficiente de fricción en la base μ', 0.5],
    ['qa', 'Capacidad admisible del suelo (kPa)', 150],
    ['gc', 'Peso unitario del concreto (kN/m³)', 24],
  ];
  const GEOM = [
    ['tc', 'Espesor de la corona (m)'], ['tb', 'Espesor del vástago en la base (m)'], ['hz', 'Espesor de la zapata (m)'],
    ['B', 'Ancho de la zapata B (m)'], ['p', 'Puntera (m)'],
  ];
  const arriba = (v, k = 0.05) => Math.ceil(v / k - 1e-9) * k;
  const abajo = (v, k = 0.025) => Math.max(k, Math.floor(v / k + 1e-9) * k);

  function predimensionar(d) {
    const H = d.H;
    const tc = arriba(Math.max(0.25, H / 24)), tb = arriba(Math.max(tc, H / 10, 0.30)), hz = arriba(Math.max(0.30, H / 10));
    const B = arriba(0.6 * H), p = arriba(B / 3);
    return { tc, tb, hz, B, p };
  }

  // Separación de barras para un área requerida (m²/m), redondeada hacia abajo a 2,5 cm y máx. 30 cm
  function barraPara(As, opciones = ['#4', '#5', '#6']) {
    for (const b of opciones) {
      const s = abajo(Math.min(0.30, AREA[b] / As));
      if (s >= 0.10) return { b, s };
    }
    const b = opciones[opciones.length - 1];
    return { b, s: abajo(AREA[b] / As) };
  }

  // Si el usuario no fija B, se aumenta desde 0,5H hasta que cumplan volcamiento, deslizamiento y presiones.
  function calcular(d, mezcla) {
    const fijos = Object.fromEntries(GEOM.map(([k]) => [k, d[k]]).filter(([, v]) => v > 0));
    if (fijos.B) return evaluar(d, mezcla, { ...predimensionar(d), ...fijos });
    let r;
    for (let B = arriba(0.5 * d.H); B <= 1.5 * d.H + 1e-9; B = arriba(B + 0.05)) {
      r = evaluar(d, mezcla, { ...predimensionar(d), ...fijos, B, p: fijos.p || arriba(B / 3) });
      if (r.chequeos.every(c => c[3])) return r;
    }
    return r;
  }

  function evaluar(d, mezcla, g) {
    const { H } = d, { tc, tb, hz, B, p } = g;
    const hv = H - hz, talon = B - p - tb;
    const avisos = [];
    if (talon <= 0) avisos.push('La puntera más el espesor del vástago superan el ancho de la zapata.');
    const phi = d.phi * Math.PI / 180, Ka = (1 - Math.sin(phi)) / (1 + Math.sin(phi));
    const Pa = 0.5 * Ka * d.gs * H * H, Pq = Ka * d.q * H, Ph = Pa + Pq;
    const Mo = Pa * H / 3 + Pq * H / 2;
    const pesos = [
      ['Zapata', B * hz * d.gc, B / 2],
      ['Vástago (parte recta)', tc * hv * d.gc, p + tb - tc / 2],
      ['Vástago (parte inclinada)', (tb - tc) * hv / 2 * d.gc, p + 2 * (tb - tc) / 3],
      ['Relleno sobre el talón', Math.max(0, talon) * hv * d.gs, p + tb + Math.max(0, talon) / 2],
    ];
    const W = pesos.reduce((s, x) => s + x[1], 0), Mr = pesos.reduce((s, x) => s + x[1] * x[2], 0);
    const FSv = Mr / Mo, FSd = d.mu * W / Ph;
    const xR = (Mr - Mo) / W, e = B / 2 - xR;
    const qmax = W / B * (1 + 6 * e / B), qmin = W / B * (1 - 6 * e / B);
    const chequeos = [
      ['Volcamiento: FS = Mr / Mo', FSv, '≥ 2,0', FSv >= 2],
      ['Deslizamiento: FS = μ·W / Ea', FSd, '≥ 1,5', FSd >= 1.5],
      ['Excentricidad e (m)', e, `≤ B/6 = ${num(B / 6, 3)}`, Math.abs(e) <= B / 6],
      ['Presión máxima q máx (kPa)', qmax, `≤ ${num(d.qa, 0)}`, qmax <= d.qa],
      ['Presión mínima q mín (kPa)', qmin, '≥ 0', qmin >= 0],
    ];
    if (FSd < 1.5) avisos.push('No cumple deslizamiento: aumente B o agregue una llave de cortante (diente) bajo la zapata.');
    if (FSv < 2) avisos.push('No cumple volcamiento: aumente el talón o el ancho B.');
    if (qmax > d.qa) avisos.push('La presión supera la capacidad admisible: aumente B o mejore el suelo de fundación.');

    // Refuerzo preliminar del vástago (flexión y cortante en la base, fy = 420 MPa)
    const fc = { '1:2:2': 24.5, '1:2:3': 21, '1:2:4': 17.5 }[mezcla] || 21, fy = 420;
    const dv = tb - 0.05 - 0.008;
    const Mu = 1.6 * (0.5 * Ka * d.gs * hv * hv * hv / 3 + Ka * d.q * hv * hv / 2); // kN·m por m
    let As = Mu / (0.9 * fy * 1000 * 0.9 * dv);
    for (let i = 0; i < 3; i++) { const a = As * fy / (0.85 * fc); As = Mu / (0.9 * fy * 1000 * (dv - a / 2)); }
    As = Math.max(As, 0.0015 * tb);
    const Vu = 1.6 * (0.5 * Ka * d.gs * hv * hv + Ka * d.q * hv), phiVc = 0.75 * 0.17 * Math.sqrt(fc) * 1000 * dv;
    if (Vu > phiVc) avisos.push(`El cortante en la base del vástago (${num(Vu, 1)} kN/m) supera φVc (${num(phiVc, 1)} kN/m): aumente el espesor tb.`);
    const vert = barraPara(As), horiz = barraPara(0.0020 * tb / 2, ['#3', '#4']), zap = barraPara(Math.max(0.0018 * hz, As * 0.8), ['#4', '#5', '#6']);
    const zapL = barraPara(0.0018 * hz, ['#4', '#5']);

    // Cantidades
    const area = B * hz + (tc + tb) / 2 * hv, vol = area * d.L;
    const n = s => Math.ceil(d.L / s - 1e-9) + 1;
    const gancho = b => Math.max(12 * BARRAS[b].d / 1000, 0.15);
    const barras = [
      ['Vástago, vertical cara del relleno', vert.b, n(vert.s), hv + hz - 0.075 + gancho(vert.b) + 0.05],
      ['Vástago, vertical cara exterior', horiz.b, n(0.30), hv + hz - 0.075 + gancho(horiz.b)],
      ['Vástago, horizontal (dos caras)', horiz.b, 2 * (Math.ceil(hv / horiz.s - 1e-9) + 1), d.L + 0.3],
      ['Zapata, transversal inferior', zap.b, n(zap.s), B - 0.15 + 2 * gancho(zap.b)],
      ['Zapata, transversal superior (talón)', zapL.b, n(zapL.s), B - 0.15 + 2 * gancho(zapL.b)],
      ['Zapata, longitudinal (dos capas)', zapL.b, 2 * (Math.ceil((B - 0.15) / zapL.s - 1e-9) + 1), d.L + 0.3],
    ].map(([t, b, c, l]) => ({ t, b, c, l, kg: c * l * BARRAS[b].kg }));
    const kgAcero = barras.reduce((s, x) => s + x.kg, 0) * 1.05;
    const c = CONCRETOS[mezcla];
    const mat = {
      vol, kgAcero, cemento: Math.ceil(vol * 1.05 * c.cem / BULTO - 1e-9), arena: vol * 1.05 * c.arena, grava: vol * 1.05 * c.grava,
      excavacion: (B + 0.6) * (hz + 0.05) * d.L, solado: B * 0.05 * d.L, relleno: Math.max(0, talon) * hv * d.L,
      filtro: 0.30 * hv * d.L, geotextil: (hv + 0.6) * d.L, dren: d.L, lloraderos: Math.ceil(d.L / 1.5 - 1e-9) * Math.max(1, Math.floor(hv / 1.5)),
      formaleta: 2 * hv * d.L + 2 * hz * d.L,
    };
    return { g: { ...g, hv, talon }, Ka, Pa, Pq, Ph, Mo, Mr, W, pesos, FSv, FSd, e, qmax, qmin, chequeos, avisos, Mu, As, Vu, phiVc, vert, horiz, zap, zapL, barras, mat };
  }

  function seccionSVG(r, d) {
    const { tc, tb, hz, B, p, talon } = r.g, H = d.H;
    const W = 460, Hs = 360, m = 46;
    const k = Math.min((W - 2 * m - 110) / (B + 0.8), (Hs - 2 * m) / (H + 0.4));
    const X = x => m + 30 + x * k, Y = z => Hs - m - z * k;
    const pts = (a) => a.map(([x, z]) => `${X(x)},${Y(z)}`).join(' ');
    const muro = pts([[0, 0], [B, 0], [B, hz], [p + tb, hz], [p + tb, H], [p + tb - tc, H], [p, hz], [0, hz]]);
    const relleno = pts([[p + tb, hz], [B + 0.6, hz], [B + 0.6, H], [p + tb, H]]);
    const cota = (x1, z1, x2, z2, t, dx = 0, dy = 0) => `<line x1="${X(x1)}" y1="${Y(z1)}" x2="${X(x2)}" y2="${Y(z2)}" class="c"/><text x="${(X(x1) + X(x2)) / 2 + dx}" y="${(Y(z1) + Y(z2)) / 2 + dy}">${t}</text>`;
    const xe = X(B + 0.65), emp = 70;
    return `<svg viewBox="0 0 ${W} ${Hs}" class="muro-svg">
      <defs><pattern id="rel" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#b08a5a" stroke-width="1"/></pattern></defs>
      <polygon points="${relleno}" fill="url(#rel)" stroke="none"/>
      <polygon points="${muro}" fill="#d9d9d6" stroke="#333" stroke-width="1.5"/>
      <line x1="${X(-0.3)}" y1="${Y(hz + 0.3)}" x2="${X(p)}" y2="${Y(hz + 0.3)}" stroke="#7a5a2a" stroke-dasharray="5 3"/>
      <line x1="${X(p + tb)}" y1="${Y(H)}" x2="${X(B + 0.6)}" y2="${Y(H)}" stroke="#7a5a2a" stroke-width="1.5"/>
      <polygon points="${xe},${Y(H)} ${xe + emp * r.Pq / r.Ph * 0.6},${Y(H)} ${xe + emp},${Y(0)} ${xe},${Y(0)}" fill="rgba(192,57,43,.18)" stroke="#c0392b"/>
      <text x="${xe + 4}" y="${Y(0) + 16}" class="r">Ea = ${num(r.Ph, 1)} kN/m</text>
      ${cota(0, -0.25, B, -0.25, `B = ${num(B, 2)}`, 0, 14)}
      ${cota(0, -0.08, p, -0.08, `p = ${num(p, 2)}`, 0, -4)}
      ${cota(p + tb, -0.08, B, -0.08, `talón ${num(talon, 2)}`, 0, -4)}
      ${cota(-0.25, 0, -0.25, H, `H = ${num(H, 2)}`, -6, 0)}
      ${cota(p + tb - tc, H + 0.12, p + tb, H + 0.12, `${num(tc * 100, 0)} cm`, 0, -4)}
      ${cota(p, hz + 0.08, p + tb, hz + 0.08, `${num(tb * 100, 0)} cm`, 0, -4)}
      ${cota(B + 0.15, 0, B + 0.15, hz, `${num(hz * 100, 0)} cm`, 18, 4)}
    </svg>`;
  }

  async function vista(raiz) {
    const guardados = await DB.ajuste('contencion', {});
    const d = Object.fromEntries(DATOS.map(([k, , v]) => [k, guardados[k] ?? v]));
    GEOM.forEach(([k]) => { d[k] = guardados[k] || ''; });
    let mezcla = guardados.mezcla || '1:2:3';
    raiz.innerHTML = `<div class="cabecera"><a class="volver" href="#/planos">← Planos</a><h1>Muro de contención en voladizo</h1>
        <p class="sub">Prediseño para una primera idea en campo: empuje de Rankine, estabilidad, presiones, refuerzo preliminar y cantidades.</p></div>
      <div class="calc-layout"><div>
        <section class="card"><h2>Datos del suelo y del muro</h2><div class="grid">
          ${DATOS.map(([k, t]) => `<label class="campo"><span>${esc(t)}</span><input data-k="${k}" type="number" step="any" inputmode="decimal" value="${d[k]}"></label>`).join('')}
          <label class="campo"><span>Concreto</span><select data-mezcla>${Object.entries(CONCRETOS).map(([k, c]) => `<option value="${k}"${k === mezcla ? ' selected' : ''}>${esc(c.t)}</option>`).join('')}</select></label></div></section>
        <section class="card"><h2>Geometría <span class="sub" style="font-weight:400">— vacío = predimensionado automático</span></h2><div class="grid" data-geom></div></section>
        <section class="card"><h2>Sección</h2><div data-svg></div></section>
      </div><div class="resultado" data-res></div></div>`;

    function actualizar() {
      for (const inp of $$('[data-k]', raiz)) d[inp.dataset.k] = inp.value === '' ? '' : +inp.value;
      if (!(d.H > 0) || !(d.L > 0) || !(d.phi > 0 && d.phi < 60)) { $('[data-res]', raiz).innerHTML = '<div class="card"><p class="vacio">Revise H, L y φ.</p></div>'; return; }
      const auto = predimensionar(d);
      const geom = $('[data-geom]', raiz);
      if (!geom.children.length) geom.innerHTML = GEOM.map(([k, t]) => `<label class="campo"><span>${esc(t)}</span><input data-k="${k}" type="number" step="any" inputmode="decimal" value="${d[k]}"></label>`).join('');
      const r = calcular(d, mezcla);
      GEOM.forEach(([k]) => { $(`[data-k="${k}"]`, geom).placeholder = num(['B', 'p'].includes(k) ? r.g[k] : auto[k], 2); });
      DB.guardarAjuste('contencion', { ...d, mezcla });
      $('[data-svg]', raiz).innerHTML = seccionSVG(r, d);
      const fila = (t, v, u = '') => `<tr><td>${esc(t)}</td><td class="num">${v}</td><td>${esc(u)}</td></tr>`;
      const m = r.mat;
      $('[data-res]', raiz).innerHTML = `<section class="card"><h2>Estabilidad</h2>
          <table class="tabla res-tabla"><tbody>
          ${fila('Coeficiente activo Ka', num(r.Ka, 3))}${fila('Empuje total Ea', num(r.Ph, 2), 'kN/m')}${fila('Peso total W', num(r.W, 2), 'kN/m')}
          ${r.chequeos.map(([t, v, lim, ok]) => `<tr class="${ok ? '' : 'falla'}"><td>${esc(t)}</td><td class="num">${num(v, 2)}</td><td>${esc(lim)} ${ok ? '✓' : '✗'}</td></tr>`).join('')}
          </tbody></table>
          ${r.avisos.map(a => `<p class="aviso">⚠ ${esc(a)}</p>`).join('')}</section>
        <section class="card"><h2>Refuerzo preliminar</h2><table class="tabla res-tabla"><tbody>
          ${fila('Momento último en la base del vástago', num(r.Mu, 1), 'kN·m/m')}
          ${fila('Vertical, cara del relleno', `${r.vert.b} c/${num(r.vert.s, 3)}`, 'm')}${fila('Horizontal, cada cara', `${r.horiz.b} c/${num(r.horiz.s, 3)}`, 'm')}
          ${fila('Zapata, transversal inferior', `${r.zap.b} c/${num(r.zap.s, 3)}`, 'm')}${fila('Zapata, superior y longitudinal', `${r.zapL.b} c/${num(r.zapL.s, 3)}`, 'm')}
          </tbody></table></section>
        <section class="card"><h2>Cantidades (${num(d.L, 1)} m de muro)</h2><table class="tabla res-tabla"><tbody>
          <tr class="dest">${`<td>Concreto</td><td class="num">${num(m.vol, 2)}</td><td>m³</td>`}</tr>
          ${fila('Cemento (con 5 % de desperdicio)', num(m.cemento, 0), 'bto')}${fila('Arena', num(m.arena, 2), 'm³')}${fila('Grava', num(m.grava, 2), 'm³')}
          <tr class="dest"><td>Acero de refuerzo (con 5 %)</td><td class="num">${num(m.kgAcero, 0)}</td><td>kg</td></tr>
          ${fila('Alambre negro #18 (2 %)', num(Math.ceil(m.kgAcero * 0.02 * 2) / 2, 1), 'kg')}
          ${fila('Formaleta (dos caras)', num(m.formaleta, 1), 'm²')}${fila('Excavación de la zapata', num(m.excavacion, 2), 'm³')}${fila('Solado 1:3:6', num(m.solado, 2), 'm³')}
          ${fila('Relleno compactado sobre el talón', num(m.relleno, 2), 'm³')}${fila('Filtro de grava (e = 30 cm)', num(m.filtro, 2), 'm³')}
          ${fila('Geotextil', num(m.geotextil, 1), 'm²')}${fila('Tubo de drenaje perforado 4"', num(m.dren, 1), 'm')}${fila('Lloraderos PVC 3" (c/1,5 m)', num(m.lloraderos, 0), 'un')}
          </tbody></table>
          <div class="acciones"><button class="btn pri" data-pdf>📄 PDF</button></div>
          <ul class="notas"><li>Prediseño: no considera sismo (Mononobe-Okabe), nivel freático, cohesión ni empuje pasivo.</li>
            <li>El diseño definitivo requiere estudio de suelos y diseño estructural (NSR-10 Títulos H y C).</li></ul></section>`;
      $('[data-pdf]', raiz).onclick = () => pdf(r, d, mezcla);
    }

    raiz.addEventListener('input', ev => { if (ev.target.matches('[data-k]')) actualizar(); });
    raiz.addEventListener('change', ev => { if (ev.target.matches('[data-mezcla]')) { mezcla = ev.target.value; actualizar(); } });
    actualizar();
  }

  async function pdf(r, d, mezcla) {
    const c = await Reporte.empresa();
    const fila = (...v) => `<tr>${v.map((x, i) => `<td${i ? ' class="num"' : ''}>${x}</td>`).join('')}</tr>`;
    const html = `<div class="r-hoja">${Reporte.encabezado(c, null, 'Prediseño de muro de contención en voladizo', `Fecha: ${esc(UI.fechaCorta(UI.hoy()))}`)}
      <div class="r-sec">Datos</div><table class="r-tabla"><tbody>
        ${DATOS.map(([k, t]) => fila(esc(t), num(+d[k], 2))).join('')}${fila('Concreto', esc(CONCRETOS[mezcla].t))}</tbody></table>
      <div class="r-sec">Sección adoptada</div><div class="r-muro">${seccionSVG(r, d)}</div>
      <table class="r-tabla"><tbody>${fila('Corona tc / base del vástago tb (m)', `${num(r.g.tc, 2)} / ${num(r.g.tb, 2)}`)}${fila('Zapata B × hz (m)', `${num(r.g.B, 2)} × ${num(r.g.hz, 2)}`)}
        ${fila('Puntera / talón (m)', `${num(r.g.p, 2)} / ${num(r.g.talon, 2)}`)}</tbody></table>
      <div class="r-sec">Estabilidad</div><table class="r-tabla"><tbody>
        ${fila('Ka', num(r.Ka, 3))}${fila('Empuje total (kN/m)', num(r.Ph, 2))}
        ${r.chequeos.map(([t, v, lim, ok]) => fila(esc(t), `${num(v, 2)} (${esc(lim)}) ${ok ? 'Cumple' : 'NO CUMPLE'}`)).join('')}</tbody></table>
      ${r.avisos.map(a => `<p class="r-nota">⚠ ${esc(a)}</p>`).join('')}
      <div class="r-sec">Refuerzo preliminar y cantidades (${num(d.L, 1)} m)</div><table class="r-tabla"><tbody>
        ${r.barras.map(b => fila(esc(b.t), `${b.c} ${b.b} × ${num(b.l, 2)} m = ${num(b.kg, 1)} kg`)).join('')}
        ${fila('Concreto (m³)', num(r.mat.vol, 2))}${fila('Cemento (bultos)', num(r.mat.cemento, 0))}${fila('Acero con 5 % (kg)', num(r.mat.kgAcero, 0))}
        ${fila('Excavación (m³)', num(r.mat.excavacion, 2))}${fila('Filtro de grava (m³)', num(r.mat.filtro, 2))}${fila('Lloraderos PVC 3" (un)', num(r.mat.lloraderos, 0))}</tbody></table>
      <p class="r-nota">Prediseño sin sismo, nivel freático ni empuje pasivo. Requiere estudio de suelos y diseño estructural según NSR-10 Títulos H y C.</p></div>`;
    Reporte.imprimir(html, Reporte.nombreArchivo(`Muro de contencion H=${d.H} m`));
  }

  return { vista, calcular, predimensionar };
})();
