/* Calculadoras de cantidades de obra.
   Valores de referencia usuales en Colombia (NSR-10 y prácticas de APU). Ajústelos según el diseño y las especificaciones del proyecto. */
const Calc = (() => {
  const { esc, num, $, uid, toast } = UI;
  const n = x => (Number.isFinite(+x) ? +x : 0);
  const BULTO = 50; // kg por bulto de cemento
  const ahora = () => new Date().toISOString();

  // Materiales por m³ de concreto (agregados en volumen suelto). Referenciales: el concreto estructural requiere diseño de mezcla.
  const CONCRETOS = {
    '1:2:2': { t: '≈ 3500 psi (24.5 MPa) · 1:2:2', cem: 420, arena: 0.67, grava: 0.67, agua: 190 },
    '1:2:3': { t: '≈ 3000 psi (21 MPa) · 1:2:3', cem: 350, arena: 0.56, grava: 0.84, agua: 180 },
    '1:2:4': { t: '≈ 2500 psi (17.5 MPa) · 1:2:4', cem: 300, arena: 0.48, grava: 0.96, agua: 170 },
    '1:3:4': { t: '≈ 2000 psi (14 MPa) · 1:3:4', cem: 260, arena: 0.62, grava: 0.83, agua: 170 },
    '1:3:6': { t: '≈ 1500 psi (10.5 MPa) · 1:3:6 · solados', cem: 210, arena: 0.50, grava: 1.01, agua: 160 },
  };
  // Materiales por m³ de mortero.
  const MORTEROS = {
    '1:3': { t: '1:3 · pega estructural', cem: 454, arena: 1.10, agua: 250 },
    '1:4': { t: '1:4 · pega y pañetes', cem: 364, arena: 1.16, agua: 240 },
    '1:5': { t: '1:5 · pañetes interiores', cem: 302, arena: 1.20, agua: 240 },
    '1:6': { t: '1:6 · no estructural', cem: 261, arena: 1.26, agua: 235 },
  };
  // Barras corrugadas (NSR-10): diámetro nominal en mm y masa en kg/m.
  const BARRAS = {
    '#2': { t: '#2 (1/4")', d: 6.4, kg: 0.250 },
    '#3': { t: '#3 (3/8")', d: 9.5, kg: 0.560 },
    '#4': { t: '#4 (1/2")', d: 12.7, kg: 0.994 },
    '#5': { t: '#5 (5/8")', d: 15.9, kg: 1.552 },
    '#6': { t: '#6 (3/4")', d: 19.1, kg: 2.235 },
    '#7': { t: '#7 (7/8")', d: 22.2, kg: 3.042 },
    '#8': { t: '#8 (1")', d: 25.4, kg: 3.973 },
  };
  // Unidades de mampostería: soga (l), altura (h) y espesor (e) en cm.
  const UNIDADES = {
    b4: { t: 'Bloque #4 arcilla (10×20×40)', l: 40, h: 20, e: 10 },
    b5: { t: 'Bloque #5 arcilla (12×20×40)', l: 40, h: 20, e: 12 },
    farol: { t: 'Ladrillo farol (10×20×30)', l: 30, h: 20, e: 10 },
    tolete: { t: 'Ladrillo tolete en soga (6×12×24)', l: 24, h: 6, e: 12 },
    estructural: { t: 'Ladrillo estructural (12×9×29)', l: 29, h: 9, e: 12 },
    bc12: { t: 'Bloque concreto (12×20×40)', l: 40, h: 20, e: 12 },
    bc15: { t: 'Bloque concreto (15×20×40)', l: 40, h: 20, e: 15 },
  };
  const opc = o => Object.entries(o).map(([v, x]) => [v, x.t]);

  const cementoFilas = kg => [
    { e: 'Cemento', v: kg, u: 'kg', d: 0 },
    { e: 'Cemento (bultos de 50 kg)', v: Math.ceil(kg / BULTO - 1e-9), u: 'bto', d: 0, dest: true },
  ];
  function materialesMortero(vol, clave) {
    const m = MORTEROS[clave];
    return [...cementoFilas(vol * m.cem), { e: 'Arena', v: vol * m.arena, u: 'm³', d: 2, dest: true }, { e: 'Agua', v: vol * m.agua, u: 'L', d: 0 }];
  }

  const DEF = [
    {
      id: 'concreto', nombre: 'Concreto', icono: '🏗️', desc: 'Zapatas, vigas, columnas, losas, placas y andenes',
      campos: [
        {
          id: 'elementos', tipo: 'filas', label: 'Elementos',
          columnas: [
            { id: 'desc', titulo: 'Elemento', tipo: 'text', ancho: '28%', sugerencias: ['Zapata', 'Viga de cimentación', 'Columna', 'Viga aérea', 'Losa maciza', 'Placa de contrapiso', 'Andén', 'Muro de contención', 'Solado'] },
            { id: 'n', titulo: 'Cant.', tipo: 'number', dec: 0 },
            { id: 'l', titulo: 'Largo (m)', tipo: 'number' },
            { id: 'a', titulo: 'Ancho (m)', tipo: 'number' },
            { id: 'h', titulo: 'Alto/esp. (m)', tipo: 'number' },
            { id: 'vol', titulo: 'Vol. (m³)', tipo: 'calc', dec: 3, f: r => n(r.n) * n(r.l) * n(r.a) * n(r.h) },
          ],
          def: [{ desc: 'Zapata', n: 4, l: 1.2, a: 1.2, h: 0.4 }, { desc: 'Viga de cimentación', n: 1, l: 24, a: 0.3, h: 0.35 }],
          nuevaFila: () => ({ desc: '', n: 1, l: '', a: '', h: '' }),
        },
        { id: 'dosif', tipo: 'sel', label: 'Resistencia / dosificación', opciones: opc(CONCRETOS), def: '1:2:3' },
        { id: 'desp', tipo: 'num', label: 'Desperdicio', unidad: '%', def: 5 },
      ],
      calcular(v) {
        const vol = v.elementos.reduce((s, r) => s + n(r.n) * n(r.l) * n(r.a) * n(r.h), 0);
        const vt = vol * (1 + n(v.desp) / 100);
        const d = CONCRETOS[v.dosif];
        return {
          filas: [
            { e: 'Volumen geométrico', v: vol, u: 'm³', d: 3 },
            { e: `Volumen con ${num(n(v.desp), 0)} % de desperdicio`, v: vt, u: 'm³', d: 2, dest: true },
            ...cementoFilas(vt * d.cem),
            { e: 'Arena', v: vt * d.arena, u: 'm³', d: 2, dest: true },
            { e: 'Grava / triturado', v: vt * d.grava, u: 'm³', d: 2, dest: true },
            { e: 'Agua', v: vt * d.agua, u: 'L', d: 0 },
          ],
          notas: [
            'Dosificación volumétrica de referencia. Para concreto estructural use diseño de mezcla y ensayo de cilindros (NSR-10, Título C).',
            'Si usa concreto premezclado, pida el volumen con desperdicio.',
          ],
        };
      },
    },
    {
      id: 'mamposteria', nombre: 'Mampostería', icono: '🧱', desc: 'Muros en bloque o ladrillo y mortero de pega',
      campos: [
        { id: 'largo', tipo: 'num', label: 'Largo del muro', unidad: 'm', def: 10 },
        { id: 'alto', tipo: 'num', label: 'Altura', unidad: 'm', def: 2.4 },
        { id: 'vanos', tipo: 'num', label: 'Área de vanos a descontar', unidad: 'm²', def: 0 },
        { id: 'unidad', tipo: 'sel', label: 'Unidad de mampostería', opciones: opc(UNIDADES), def: 'b4' },
        { id: 'junta', tipo: 'num', label: 'Espesor de junta', unidad: 'cm', def: 1 },
        { id: 'mortero', tipo: 'sel', label: 'Mortero de pega', opciones: opc(MORTEROS), def: '1:4' },
        { id: 'despU', tipo: 'num', label: 'Desperdicio de unidades', unidad: '%', def: 5 },
        { id: 'despM', tipo: 'num', label: 'Desperdicio de mortero', unidad: '%', def: 30 },
      ],
      calcular(v) {
        const u = UNIDADES[v.unidad];
        const j = n(v.junta) / 100;
        const area = Math.max(0, n(v.largo) * n(v.alto) - n(v.vanos));
        const porM2 = 1 / ((u.l / 100 + j) * (u.h / 100 + j));
        const morM2 = Math.max(0, u.e / 100 - porM2 * (u.l * u.h * u.e) / 1e6);
        const vm = area * morM2 * (1 + n(v.despM) / 100);
        return {
          filas: [
            { e: 'Área neta de muro', v: area, u: 'm²', d: 2 },
            { e: 'Unidades por m²', v: porM2, u: 'un/m²', d: 1 },
            { e: 'Unidades totales', v: Math.ceil(area * porM2 * (1 + n(v.despU) / 100)), u: 'un', d: 0, dest: true },
            { e: 'Mortero de pega', v: vm, u: 'm³', d: 3, dest: true },
            ...materialesMortero(vm, v.mortero),
          ],
          notas: ['El desperdicio de mortero cubre el material que cae en las celdas de las unidades huecas.'],
        };
      },
    },
    {
      id: 'panete', nombre: 'Pañete / revoque', icono: '🪣', desc: 'Mortero para pañetes en muros y cielos',
      campos: [
        { id: 'area', tipo: 'num', label: 'Área a pañetar', unidad: 'm²', def: 50 },
        { id: 'esp', tipo: 'num', label: 'Espesor promedio', unidad: 'cm', def: 1.5 },
        { id: 'mortero', tipo: 'sel', label: 'Mortero', opciones: opc(MORTEROS), def: '1:4' },
        { id: 'desp', tipo: 'num', label: 'Desperdicio', unidad: '%', def: 15 },
      ],
      calcular(v) {
        const vol = n(v.area) * n(v.esp) / 100 * (1 + n(v.desp) / 100);
        return { filas: [{ e: 'Volumen de mortero', v: vol, u: 'm³', d: 3, dest: true }, ...materialesMortero(vol, v.mortero)], notas: [] };
      },
    },
    {
      id: 'mortero', nombre: 'Mortero (volumen)', icono: '⚖️', desc: 'Materiales para un volumen conocido de mortero',
      campos: [
        { id: 'vol', tipo: 'num', label: 'Volumen de mortero', unidad: 'm³', def: 1 },
        { id: 'mortero', tipo: 'sel', label: 'Dosificación', opciones: opc(MORTEROS), def: '1:4' },
        { id: 'desp', tipo: 'num', label: 'Desperdicio', unidad: '%', def: 5 },
      ],
      calcular(v) {
        const vol = n(v.vol) * (1 + n(v.desp) / 100);
        return { filas: [{ e: 'Volumen con desperdicio', v: vol, u: 'm³', d: 3 }, ...materialesMortero(vol, v.mortero)], notas: [] };
      },
    },
    {
      id: 'acero', nombre: 'Acero de refuerzo', icono: '🔩', desc: 'Despiece por barras: kilos y varillas comerciales',
      campos: [
        {
          id: 'barras', tipo: 'filas', label: 'Despiece',
          columnas: [
            { id: 'desc', titulo: 'Elemento / marca', tipo: 'text', ancho: '28%', sugerencias: ['Zapata — parrilla', 'Columna — longitudinal', 'Viga — superior', 'Viga — inferior', 'Losa — malla', 'Flejes'] },
            { id: 'barra', titulo: 'Barra', tipo: 'select', opciones: opc(BARRAS) },
            { id: 'n', titulo: 'Cant.', tipo: 'number', dec: 0 },
            { id: 'l', titulo: 'Long. c/u (m)', tipo: 'number' },
            { id: 'kg', titulo: 'Peso (kg)', tipo: 'calc', dec: 1, f: r => n(r.n) * n(r.l) * (BARRAS[r.barra]?.kg || 0) },
          ],
          def: [{ desc: 'Columna — longitudinal', barra: '#5', n: 24, l: 3.2 }, { desc: 'Viga — superior', barra: '#4', n: 6, l: 6 }],
          nuevaFila: () => ({ desc: '', barra: '#4', n: 1, l: '' }),
        },
        { id: 'lc', tipo: 'sel', label: 'Longitud comercial', opciones: [[6, '6 m'], [9, '9 m'], [12, '12 m']], def: 6 },
        { id: 'desp', tipo: 'num', label: 'Desperdicio', unidad: '%', def: 5 },
        { id: 'alambre', tipo: 'num', label: 'Alambre negro #18', unidad: '% del acero', def: 2 },
      ],
      calcular(v) {
        const metros = {};
        for (const r of v.barras) if (BARRAS[r.barra]) metros[r.barra] = (metros[r.barra] || 0) + n(r.n) * n(r.l);
        const k = 1 + n(v.desp) / 100;
        const lc = n(v.lc) || 6;
        const filas = [];
        let total = 0;
        for (const b of Object.keys(BARRAS)) {
          if (!metros[b]) continue;
          const kg = metros[b] * BARRAS[b].kg * k;
          total += kg;
          filas.push({ e: `${BARRAS[b].t} — ${num(metros[b], 1)} m`, v: kg, u: 'kg', d: 1 });
          filas.push({ e: `   Varillas ${BARRAS[b].t} de ${lc} m`, v: Math.ceil(metros[b] * k / lc), u: 'un', d: 0, dest: true });
        }
        filas.push({ e: 'Total acero con desperdicio', v: total, u: 'kg', d: 1, dest: true });
        filas.push({ e: 'Alambre negro #18', v: total * n(v.alambre) / 100, u: 'kg', d: 1 });
        return { filas, notas: ['El número de varillas no optimiza cortes; revise traslapos y ganchos en el despiece.'] };
      },
    },
    {
      id: 'estribos', nombre: 'Flejes / estribos', icono: '⛓️', desc: 'Cantidad, longitud de corte y varillas para flejes',
      campos: [
        { id: 'cant', tipo: 'num', label: 'Número de elementos', unidad: 'un', def: 8, dec: 0 },
        { id: 'L', tipo: 'num', label: 'Longitud del elemento', unidad: 'm', def: 2.6 },
        { id: 's', tipo: 'num', label: 'Separación', unidad: 'm', def: 0.1 },
        { id: 'b', tipo: 'num', label: 'Base de la sección', unidad: 'm', def: 0.3 },
        { id: 'h', tipo: 'num', label: 'Altura de la sección', unidad: 'm', def: 0.3 },
        { id: 'rec', tipo: 'num', label: 'Recubrimiento', unidad: 'cm', def: 4 },
        { id: 'barra', tipo: 'sel', label: 'Barra', opciones: opc(BARRAS), def: '#3' },
        { id: 'lc', tipo: 'sel', label: 'Longitud comercial', opciones: [[6, '6 m'], [9, '9 m'], [12, '12 m']], def: 6 },
      ],
      calcular(v) {
        const r = n(v.rec) / 100;
        const barra = BARRAS[v.barra];
        const gancho = Math.max(6 * barra.d / 1000, 0.075);
        const lEst = 2 * (n(v.b) - 2 * r) + 2 * (n(v.h) - 2 * r) + 2 * gancho;
        const porElem = n(v.s) > 0 ? Math.floor(n(v.L) / n(v.s)) + 1 : 0;
        const total = porElem * n(v.cant);
        const lc = n(v.lc) || 6;
        const piezas = lEst > 0 ? Math.floor(lc / lEst) : 0;
        return {
          filas: [
            { e: 'Flejes por elemento', v: porElem, u: 'un', d: 0 },
            { e: 'Total de flejes', v: total, u: 'un', d: 0, dest: true },
            { e: 'Longitud de corte de cada fleje', v: lEst, u: 'm', d: 2, dest: true },
            { e: 'Longitud total', v: total * lEst, u: 'm', d: 1 },
            { e: 'Peso', v: total * lEst * barra.kg, u: 'kg', d: 1 },
            { e: `Flejes por varilla de ${lc} m`, v: piezas, u: 'un', d: 0 },
            { e: `Varillas ${barra.t} de ${lc} m`, v: piezas ? Math.ceil(total / piezas) : 0, u: 'un', d: 0, dest: true },
          ],
          notas: ['Incluye dos ganchos sísmicos de 135° con extensión de 6 db y mínimo 75 mm (NSR-10). Verifique separaciones en las zonas de confinamiento.'],
        };
      },
    },
    {
      id: 'pintura', nombre: 'Pintura', icono: '🎨', desc: 'Galones y cuñetes de vinilo o esmalte',
      campos: [
        { id: 'area', tipo: 'num', label: 'Área a pintar', unidad: 'm²', def: 120 },
        { id: 'manos', tipo: 'num', label: 'Número de manos', unidad: 'manos', def: 2, dec: 0 },
        { id: 'rend', tipo: 'num', label: 'Rendimiento por mano', unidad: 'm²/galón', def: 25 },
        { id: 'desp', tipo: 'num', label: 'Desperdicio', unidad: '%', def: 10 },
      ],
      calcular(v) {
        const gal = n(v.rend) > 0 ? n(v.area) * n(v.manos) / n(v.rend) * (1 + n(v.desp) / 100) : 0;
        const cunetes = Math.floor(gal / 5);
        const sueltos = Math.ceil(gal - cunetes * 5 - 1e-9);
        return {
          filas: [
            { e: 'Pintura requerida', v: gal, u: 'gal', d: 1, dest: true },
            { e: 'Compra sugerida', v: `${cunetes} cuñete(s) de 5 gal + ${sueltos} galón(es)`, u: '' },
          ],
          notas: ['Revise el rendimiento indicado por el fabricante; depende de la textura y absorción de la superficie.'],
        };
      },
    },
    {
      id: 'enchape', nombre: 'Pisos y enchapes', icono: '🔲', desc: 'Cerámica, porcelanato, pegante y boquilla',
      campos: [
        { id: 'area', tipo: 'num', label: 'Área', unidad: 'm²', def: 40 },
        { id: 'caja', tipo: 'num', label: 'Rendimiento por caja', unidad: 'm²/caja', def: 1.5 },
        { id: 'desp', tipo: 'num', label: 'Desperdicio (cortes)', unidad: '%', def: 8 },
        { id: 'peg', tipo: 'num', label: 'Consumo de pegante', unidad: 'kg/m²', def: 5 },
        { id: 'bulto', tipo: 'num', label: 'Bulto de pegante', unidad: 'kg', def: 25 },
        { id: 'boq', tipo: 'num', label: 'Consumo de boquilla', unidad: 'kg/m²', def: 0.5 },
      ],
      calcular(v) {
        const a = n(v.area) * (1 + n(v.desp) / 100);
        const peg = n(v.area) * n(v.peg);
        return {
          filas: [
            { e: 'Área con desperdicio', v: a, u: 'm²', d: 2 },
            { e: 'Cajas', v: n(v.caja) > 0 ? Math.ceil(a / n(v.caja) - 1e-9) : 0, u: 'cajas', d: 0, dest: true },
            { e: 'Pegante', v: peg, u: 'kg', d: 0 },
            { e: 'Bultos de pegante', v: n(v.bulto) > 0 ? Math.ceil(peg / n(v.bulto) - 1e-9) : 0, u: 'bto', d: 0, dest: true },
            { e: 'Boquilla', v: n(v.area) * n(v.boq), u: 'kg', d: 1, dest: true },
          ],
          notas: [],
        };
      },
    },
    {
      id: 'excavacion', nombre: 'Excavación y retiro', icono: '🚜', desc: 'Volumen en banco, suelto y viajes de volqueta',
      campos: [
        { id: 'cant', tipo: 'num', label: 'Número de excavaciones', unidad: 'un', def: 1, dec: 0 },
        { id: 'largo', tipo: 'num', label: 'Largo', unidad: 'm', def: 10 },
        { id: 'ancho', tipo: 'num', label: 'Ancho', unidad: 'm', def: 0.6 },
        { id: 'prof', tipo: 'num', label: 'Profundidad', unidad: 'm', def: 0.8 },
        { id: 'abund', tipo: 'num', label: 'Factor de abundamiento', unidad: '%', def: 25 },
        { id: 'volq', tipo: 'num', label: 'Capacidad de la volqueta', unidad: 'm³', def: 6 },
      ],
      calcular(v) {
        const banco = n(v.cant) * n(v.largo) * n(v.ancho) * n(v.prof);
        const suelto = banco * (1 + n(v.abund) / 100);
        return {
          filas: [
            { e: 'Volumen en banco', v: banco, u: 'm³', d: 2, dest: true },
            { e: 'Volumen suelto', v: suelto, u: 'm³', d: 2 },
            { e: 'Viajes de volqueta', v: n(v.volq) > 0 ? Math.ceil(suelto / n(v.volq) - 1e-9) : 0, u: 'viajes', d: 0, dest: true },
          ],
          notas: ['Abundamiento típico: arenas 10–15 %, arcillas 25–40 %, roca fracturada 50 % o más.'],
        };
      },
    },
  ];

  const porId = id => DEF.find(d => d.id === id);

  function valoresIniciales(def) {
    const v = {};
    for (const c of def.campos) v[c.id] = c.tipo === 'filas' ? structuredClone(c.def || []) : (c.def ?? (c.tipo === 'sel' ? c.opciones[0][0] : ''));
    return v;
  }

  const valorTexto = f => (typeof f.v === 'number' ? num(f.v, f.d ?? 2) : f.v);

  function resultadoHTML(r, clase = 'tabla res-tabla', conNotas = true) {
    return `<table class="${clase}"><tbody>${r.filas.map(f => `<tr class="${f.dest ? 'dest' : ''}"><td>${esc(f.e)}</td><td class="num">${esc(valorTexto(f))}</td><td>${esc(f.u || '')}</td></tr>`).join('')}</tbody></table>
      ${conNotas && r.notas?.length ? `<ul class="notas">${r.notas.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
  }

  /* Datos de entrada en formato de informe. */
  function entradasHTML(rec) {
    const def = porId(rec.tipo);
    if (!def) return '';
    const e = rec.entradas || {};
    const textoOpcion = (c, val) => c.opciones.find(o => String(o[0]) === String(val))?.[1] ?? val;
    const simples = def.campos.filter(c => c.tipo !== 'filas').map(c => {
      const val = c.tipo === 'sel' ? textoOpcion(c, e[c.id]) : `${num(n(e[c.id]), c.dec ?? 2)}${c.unidad ? ' ' + c.unidad : ''}`;
      return `<tr><th>${esc(c.label)}</th><td>${esc(val)}</td></tr>`;
    }).join('');
    let html = simples ? `<table class="r-tabla">${simples}</table>` : '';
    for (const c of def.campos.filter(c => c.tipo === 'filas')) {
      html += `<table class="r-tabla"><tr>${c.columnas.map(k => `<th>${esc(k.titulo)}</th>`).join('')}</tr>${(e[c.id] || []).map(f => `<tr>${c.columnas.map(k => {
        if (k.tipo === 'calc') return `<td class="n">${num(k.f(f), k.dec ?? 2)}</td>`;
        if (k.tipo === 'number') return `<td class="n">${num(n(f[k.id]), k.dec ?? 2)}</td>`;
        return `<td>${esc(k.tipo === 'select' ? textoOpcion(k, f[k.id]) : f[k.id])}</td>`;
      }).join('')}</tr>`).join('')}</table>`;
    }
    return html;
  }

  const textoResumen = (titulo, r) => [titulo, ...r.filas.map(f => `• ${f.e.trim()}: ${valorTexto(f)} ${f.u || ''}`.trim())].join('\n');

  const tarjetasHTML = pid => DEF.map(d => `<a class="card tarjeta calc-card" href="#/calc/${d.id}${pid ? '/' + pid : ''}">
      <div class="ico">${d.icono}</div><h2>${esc(d.nombre)}</h2><p class="sub">${esc(d.desc)}</p></a>`).join('');

  function lista(main) {
    main.innerHTML = `<div class="cabecera"><h1>Calculadoras de cantidades</h1>
      <p class="sub">Resultados al instante. Guarde cada cálculo en un proyecto para incluirlo en la memoria de cantidades.</p></div>
      <div class="tarjetas">${tarjetasHTML()}</div>`;
  }

  function campoHTML(c, val) {
    if (c.tipo === 'sel') {
      return `<label class="campo"><span>${esc(c.label)}</span><select data-id="${c.id}">${c.opciones.map(([o, t]) =>
        `<option value="${esc(o)}"${String(o) === String(val) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    }
    return `<label class="campo"><span>${esc(c.label)}${c.unidad ? ` (${esc(c.unidad)})` : ''}</span>
      <input type="number" inputmode="decimal" step="any" data-id="${c.id}" value="${esc(val)}"></label>`;
  }

  async function vista(main, tipo, pid, registro) {
    const def = porId(tipo);
    if (!def) return lista(main);
    const v = valoresIniciales(def);
    if (registro) Object.assign(v, structuredClone(registro.entradas));
    const proyecto = pid ? await DB.obtener('proyectos', pid) : null;
    main.innerHTML = `<div class="cabecera"><a class="volver" href="${proyecto ? `#/proyecto/${pid}/cantidades` : '#/calc'}">← ${proyecto ? esc(proyecto.nombre) : 'Calculadoras'}</a>
        <h1>${def.icono} ${esc(registro?.titulo || def.nombre)}</h1><p class="sub">${esc(def.desc)}</p></div>
      <div class="calc-layout"><div id="calc-form"></div>
        <aside class="card resultado"><h2>Resultado</h2><div id="calc-res"></div>
          <div class="acciones"><button class="btn pri" data-acc="guardar">💾 ${registro ? 'Actualizar' : 'Guardar en proyecto'}</button>
          ${navigator.share ? '<button class="btn" data-acc="compartir">↗ Compartir</button>' : ''}</div></aside></div>`;

    const form = $('#calc-form', main);
    for (const c of def.campos.filter(c => c.tipo === 'filas')) {
      const sec = document.createElement('section');
      sec.className = 'card';
      sec.innerHTML = `<h2>${esc(c.label)}</h2><div></div>`;
      form.append(sec);
      UI.tablaEditable(sec.lastElementChild, c.columnas, v[c.id], recalcular, { nuevaFila: c.nuevaFila });
    }
    const simples = def.campos.filter(c => c.tipo !== 'filas');
    if (simples.length) {
      const sec = document.createElement('section');
      sec.className = 'card';
      sec.innerHTML = `<h2>Datos</h2><div class="grid">${simples.map(c => campoHTML(c, v[c.id])).join('')}</div>`;
      form.append(sec);
      sec.addEventListener('input', e => {
        const id = e.target.dataset.id;
        if (!id) return;
        const c = def.campos.find(x => x.id === id);
        v[id] = c.tipo === 'num' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value;
        recalcular();
      });
    }

    $('[data-acc="guardar"]', main).onclick = () => guardar(def, v, pid, registro);
    const compartir = $('[data-acc="compartir"]', main);
    if (compartir) compartir.onclick = () => navigator.share({ title: def.nombre, text: textoResumen(registro?.titulo || def.nombre, def.calcular(v)) }).catch(() => {});
    recalcular();

    function recalcular() {
      const res = $('#calc-res', main);
      try { res.innerHTML = resultadoHTML(def.calcular(v)); }
      catch (err) { console.error(err); res.innerHTML = '<p class="vacio">Revise los datos ingresados.</p>'; }
    }
  }

  async function guardar(def, v, pid, registro) {
    const proyectos = await DB.todos('proyectos');
    if (!proyectos.length) { toast('Primero cree un proyecto para guardar cálculos', 'error'); return; }
    const destino = registro?.proyectoId || pid || proyectos[0].id;
    const cuerpo = `<div class="grid" style="grid-template-columns:1fr">
      <label class="campo"><span>Proyecto</span><select name="pid">${proyectos.map(p => `<option value="${p.id}"${p.id === destino ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
      <label class="campo"><span>Nombre del cálculo</span><input name="titulo" value="${esc(registro?.titulo || def.nombre)}" placeholder="Ej.: Zapatas eje A"></label></div>`;
    UI.modal({
      titulo: registro ? 'Actualizar cálculo' : 'Guardar cálculo', cuerpo,
      botones: [
        { texto: 'Cancelar' },
        {
          texto: 'Guardar', clase: 'pri', accion: async caja => {
            const titulo = $('[name=titulo]', caja).value.trim() || def.nombre;
            const proyectoId = $('[name=pid]', caja).value;
            const rec = registro || { id: uid(), tipo: def.id, creado: ahora() };
            Object.assign(rec, { proyectoId, titulo, entradas: structuredClone(v), resultado: def.calcular(v), modificado: ahora() });
            await DB.guardar('cantidades', rec);
            toast('Cálculo guardado');
            location.hash = `#/proyecto/${proyectoId}/cantidades`;
          },
        },
      ],
    });
  }

  return { DEF, porId, lista, vista, tarjetasHTML, resultadoHTML, entradasHTML, valorTexto, CONCRETOS, MORTEROS, BARRAS, BULTO };
})();
