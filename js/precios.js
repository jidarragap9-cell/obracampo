/* Base de precios: insumos y análisis de precios unitarios (APU).
   Los APU toman el precio vigente de cada insumo, así que actualizar un precio actualiza todos los presupuestos. */
const Precios = (() => {
  const { esc, $, uid, toast, moneda, num } = UI;
  const n = x => (Number.isFinite(+x) ? +x : 0);

  const TIPOS = [['material', 'Materiales'], ['equipo', 'Equipo y herramienta'], ['mano_obra', 'Mano de obra'], ['transporte', 'Transporte']];
  const UNIDADES = ['un', 'm', 'm²', 'm³', 'kg', 'bto', 'gal', 'L', 'día', 'h', 'viaje', 'global'];
  const ordenar = (a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''), 'es', { numeric: true });

  /* ---------- Base de ejemplo (precios aproximados 2026; deben actualizarse con cotizaciones locales) ---------- */
  const INSUMOS_BASE = [
    ['MAT-001', 'Cemento gris uso general (bulto 50 kg)', 'bto', 'material', 36000],
    ['MAT-002', 'Arena de río lavada', 'm³', 'material', 95000],
    ['MAT-003', 'Arena de pega', 'm³', 'material', 85000],
    ['MAT-004', 'Triturado 3/4"', 'm³', 'material', 130000],
    ['MAT-005', 'Recebo común', 'm³', 'material', 60000],
    ['MAT-006', 'Agua', 'm³', 'material', 6000],
    ['MAT-007', 'Acero de refuerzo 420 MPa (60.000 psi)', 'kg', 'material', 5200],
    ['MAT-008', 'Alambre negro #18', 'kg', 'material', 8500],
    ['MAT-009', 'Bloque #4 de arcilla 10×20×40', 'un', 'material', 1900],
    ['MAT-010', 'Bloque #5 de arcilla 12×20×40', 'un', 'material', 2300],
    ['MAT-011', 'Ladrillo tolete común', 'un', 'material', 900],
    ['MAT-012', 'Tabla ordinaria para formaleta 0,30 × 3 m', 'un', 'material', 14000],
    ['MAT-013', 'Puntilla con cabeza 2" a 3"', 'kg', 'material', 9000],
    ['MAT-014', 'Vinilo tipo 1', 'gal', 'material', 48000],
    ['MAT-015', 'Cerámica para piso 45×45 tráfico medio', 'm²', 'material', 35000],
    ['MAT-016', 'Pegante cerámico (bulto 25 kg)', 'bto', 'material', 28000],
    ['MAT-017', 'Boquilla', 'kg', 'material', 4000],
    ['MAT-018', 'Plástico negro (polietileno)', 'm²', 'material', 2000],
    ['MAT-019', 'Estaca de madera', 'un', 'material', 1500],
    ['MAT-020', 'Concreto premezclado 3000 psi', 'm³', 'material', 520000],
    ['EQ-001', 'Mezcladora de concreto 1 bulto', 'día', 'equipo', 70000],
    ['EQ-002', 'Vibrador de concreto', 'día', 'equipo', 55000],
    ['EQ-003', 'Vibrocompactador tipo rana', 'día', 'equipo', 120000],
    ['EQ-004', 'Andamio tubular (cuerpo)', 'día', 'equipo', 6000],
    ['EQ-005', 'Retroexcavadora con operador', 'h', 'equipo', 170000],
    ['EQ-006', 'Equipo de topografía (estación total)', 'día', 'equipo', 180000],
    ['MO-001', 'Cuadrilla: 1 oficial + 1 ayudante', 'día', 'mano_obra', 190000],
    ['MO-002', 'Cuadrilla: 1 oficial + 2 ayudantes', 'día', 'mano_obra', 265000],
    ['MO-003', 'Cuadrilla de armado: 1 armador + 1 ayudante', 'día', 'mano_obra', 200000],
    ['MO-004', 'Cuadrilla de topografía: topógrafo + 2 cadeneros', 'día', 'mano_obra', 320000],
    ['MO-005', 'Oficial', 'día', 'mano_obra', 110000],
    ['MO-006', 'Ayudante', 'día', 'mano_obra', 75000],
    ['TR-001', 'Volqueta 6 m³ (viaje dentro del casco urbano)', 'viaje', 'transporte', 180000],
  ];
  // Materiales y equipo: [código, cantidad, desperdicio %]. Mano de obra: [código, rendimiento en unidades por día].
  const CONCRETO_3000 = [['MAT-001', 7, 5], ['MAT-002', 0.56, 5], ['MAT-004', 0.84, 5], ['MAT-006', 0.18, 0]];
  const APUS_BASE = [
    { codigo: '1.01', descripcion: 'Localización y replanteo', unidad: 'm²', capitulo: 'Preliminares',
      lineas: { material: [['MAT-019', 0.05, 0], ['MAT-013', 0.005, 0]], equipo: [['EQ-006', 0.0025, 0]], mano_obra: [['MO-004', 400]] } },
    { codigo: '2.01', descripcion: 'Excavación manual en material común, h ≤ 2 m', unidad: 'm³', capitulo: 'Excavaciones y rellenos',
      lineas: { mano_obra: [['MO-002', 5]] } },
    { codigo: '2.02', descripcion: 'Retiro de material sobrante en volqueta, incluye cargue', unidad: 'm³', capitulo: 'Excavaciones y rellenos',
      lineas: { mano_obra: [['MO-006', 8]], transporte: [['TR-001', 0.21, 0]] } },
    { codigo: '2.03', descripcion: 'Relleno compactado con recebo común', unidad: 'm³', capitulo: 'Excavaciones y rellenos',
      lineas: { material: [['MAT-005', 1.3, 0], ['MAT-006', 0.1, 0]], equipo: [['EQ-003', 0.1, 0]], mano_obra: [['MO-002', 10]] } },
    { codigo: '3.01', descripcion: 'Solado de limpieza e = 5 cm, concreto 1500 psi', unidad: 'm²', capitulo: 'Cimentación',
      lineas: { material: [['MAT-001', 0.21, 5], ['MAT-002', 0.025, 5], ['MAT-004', 0.05, 5], ['MAT-006', 0.008, 0]], equipo: [['EQ-001', 0.025, 0]], mano_obra: [['MO-002', 40]] } },
    { codigo: '3.02', descripcion: 'Concreto para zapatas 3000 psi, mezclado en obra', unidad: 'm³', capitulo: 'Cimentación',
      lineas: { material: CONCRETO_3000, equipo: [['EQ-001', 0.17, 0], ['EQ-002', 0.17, 0]], mano_obra: [['MO-002', 3]] } },
    { codigo: '3.03', descripcion: 'Concreto para vigas de cimentación 3000 psi, incluye formaleta', unidad: 'm³', capitulo: 'Cimentación',
      lineas: { material: [...CONCRETO_3000, ['MAT-012', 4, 0], ['MAT-013', 0.3, 0]], equipo: [['EQ-001', 0.2, 0], ['EQ-002', 0.2, 0]], mano_obra: [['MO-002', 2.5]] } },
    { codigo: '4.01', descripcion: 'Concreto para columnas 3000 psi, incluye formaleta', unidad: 'm³', capitulo: 'Estructura',
      lineas: { material: [...CONCRETO_3000, ['MAT-012', 6, 0], ['MAT-013', 0.5, 0]], equipo: [['EQ-001', 0.33, 0], ['EQ-002', 0.33, 0], ['EQ-004', 2, 0]], mano_obra: [['MO-002', 1.5]] } },
    { codigo: '4.02', descripcion: 'Acero de refuerzo 420 MPa, figurado y armado', unidad: 'kg', capitulo: 'Estructura',
      lineas: { material: [['MAT-007', 1, 5], ['MAT-008', 0.02, 0]], mano_obra: [['MO-003', 200]] } },
    { codigo: '5.01', descripcion: 'Muro en bloque #4 de arcilla, mortero de pega 1:4', unidad: 'm²', capitulo: 'Mampostería',
      lineas: { material: [['MAT-009', 12.5, 3], ['MAT-001', 0.087, 5], ['MAT-003', 0.014, 5], ['MAT-006', 0.003, 0]], mano_obra: [['MO-001', 10]] } },
    { codigo: '5.02', descripcion: 'Muro en ladrillo tolete en soga, mortero de pega 1:4', unidad: 'm²', capitulo: 'Mampostería',
      lineas: { material: [['MAT-011', 57, 5], ['MAT-001', 0.18, 5], ['MAT-003', 0.029, 5], ['MAT-006', 0.006, 0]], mano_obra: [['MO-001', 7]] } },
    { codigo: '6.01', descripcion: 'Pañete liso sobre muros, mortero 1:4, e = 1,5 cm', unidad: 'm²', capitulo: 'Pañetes',
      lineas: { material: [['MAT-001', 0.131, 0], ['MAT-003', 0.021, 0], ['MAT-006', 0.004, 0]], equipo: [['EQ-004', 0.15, 0]], mano_obra: [['MO-001', 14]] } },
    { codigo: '7.01', descripcion: 'Placa de contrapiso e = 10 cm, concreto 2500 psi', unidad: 'm²', capitulo: 'Pisos',
      lineas: { material: [['MAT-001', 0.6, 5], ['MAT-002', 0.048, 5], ['MAT-004', 0.096, 5], ['MAT-006', 0.017, 0], ['MAT-018', 1.05, 0]], equipo: [['EQ-001', 0.02, 0]], mano_obra: [['MO-002', 25]] } },
    { codigo: '7.02', descripcion: 'Piso en cerámica 45×45 tráfico medio, incluye pegante y boquilla', unidad: 'm²', capitulo: 'Pisos',
      lineas: { material: [['MAT-015', 1, 8], ['MAT-016', 0.2, 5], ['MAT-017', 0.5, 5]], mano_obra: [['MO-001', 12]] } },
    { codigo: '8.01', descripcion: 'Pintura en vinilo tipo 1 sobre pañete, tres manos', unidad: 'm²', capitulo: 'Pintura',
      lineas: { material: [['MAT-014', 0.1, 5]], equipo: [['EQ-004', 0.05, 0]], mano_obra: [['MO-005', 35]] } },
  ];

  async function cargarBase() {
    const porCodigo = new Map((await DB.todos('insumos')).map(i => [i.codigo, i]));
    const nuevos = [];
    for (const [codigo, descripcion, unidad, tipo, precio] of INSUMOS_BASE) {
      if (porCodigo.has(codigo)) continue;
      const i = { id: uid(), codigo, descripcion, unidad, tipo, precio };
      porCodigo.set(codigo, i);
      nuevos.push(i);
    }
    await DB.guardarVarios('insumos', nuevos);
    const codigosApu = new Set((await DB.todos('apus')).map(a => a.codigo));
    const linea = (tipo, [codigo, valor, desp]) => (tipo === 'mano_obra'
      ? { insumoId: porCodigo.get(codigo).id, rend: valor }
      : { insumoId: porCodigo.get(codigo).id, cantidad: valor, desp: desp || 0 });
    const apus = APUS_BASE.filter(a => !codigosApu.has(a.codigo)).map(a => ({
      id: uid(), codigo: a.codigo, descripcion: a.descripcion, unidad: a.unidad, capitulo: a.capitulo, herramienta: 5,
      lineas: Object.fromEntries(TIPOS.map(([t]) => [t, (a.lineas[t] || []).map(l => linea(t, l))])),
    }));
    await DB.guardarVarios('apus', apus);
    toast(`Base cargada: ${nuevos.length} insumos y ${apus.length} APU`);
  }

  /* ---------- Cálculo ---------- */
  async function mapaInsumos() {
    return new Map((await DB.todos('insumos')).map(i => [i.id, i]));
  }
  // Mano de obra: la cantidad es el inverso del rendimiento (jornales por unidad).
  const cantidadLinea = (l, tipo) => (tipo === 'mano_obra' ? (n(l.rend) > 0 ? 1 / n(l.rend) : 0) : n(l.cantidad) * (1 + n(l.desp) / 100));
  const valorLinea = (l, tipo, insumos) => n(insumos.get(l.insumoId)?.precio) * cantidadLinea(l, tipo);

  function calcular(apu, insumos) {
    const sec = {};
    for (const [t] of TIPOS) sec[t] = (apu.lineas?.[t] || []).reduce((s, l) => s + valorLinea(l, t, insumos), 0);
    const herramienta = sec.mano_obra * n(apu.herramienta) / 100;
    const total = Math.round(sec.material + sec.equipo + sec.mano_obra + sec.transporte + herramienta);
    return { sec, herramienta, total };
  }

  /* ---------- CSV (compatible con Excel en español: separador ;) ---------- */
  const campoCSV = v => (/[;"\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const filaCSV = arr => arr.map(campoCSV).join(';');

  function dividirCSV(linea, sep) {
    const out = [];
    let actual = '', comillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (comillas && linea[i + 1] === '"') { actual += '"'; i++; } else comillas = !comillas;
      } else if (c === sep && !comillas) { out.push(actual); actual = ''; } else actual += c;
    }
    out.push(actual);
    return out.map(s => s.trim());
  }
  // Precios en formato colombiano: "36.000", "$ 36.000" o "36000".
  const precioCSV = s => parseFloat(String(s).replace(/[$\s.]/g, '').replace(',', '.'));
  function tipoCSV(s) {
    const t = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (t.includes('mano')) return 'mano_obra';
    if (t.includes('equip') || t.includes('herram')) return 'equipo';
    if (t.includes('transp')) return 'transporte';
    return 'material';
  }

  /* ---------- Vistas ---------- */
  function cabecera(activa) {
    return `<div class="cabecera"><h1>Base de precios</h1>
        <p class="sub">Insumos y análisis de precios unitarios (APU). Si cambia un precio, se actualizan todos los APU y presupuestos.</p></div>
      <nav class="tabs">${[['apu', '📐 Análisis unitarios (APU)'], ['insumos', '📦 Insumos y precios']]
        .map(([k, l]) => `<a href="#/precios/${k}" class="${k === activa ? 'activo' : ''}">${l}</a>`).join('')}</nav>`;
  }
  const avisoVacio = () => `<div class="card"><h2>La base de precios está vacía</h2>
      <p class="sub">Puede empezar con una base de ejemplo de ${INSUMOS_BASE.length} insumos y ${APUS_BASE.length} APU típicos de vivienda.
      Los precios son aproximados: actualícelos con cotizaciones de su zona antes de presentar un presupuesto.</p>
      <div class="acciones"><button class="btn pri" data-base>Cargar base de ejemplo</button></div></div>`;

  async function vistaInsumos(raiz) {
    let todos = (await DB.todos('insumos')).sort(ordenar);
    const filtro = { tipo: '', texto: '' };
    const borrados = new Set();
    let temporizador;
    raiz.innerHTML = `${cabecera('insumos')}${todos.length ? '' : avisoVacio()}
      <section class="card"><div class="grid" style="margin-bottom:12px">
          <label class="campo"><span>Buscar</span><input type="search" data-buscar placeholder="Código o descripción"></label>
          <label class="campo"><span>Tipo</span><select data-tipo><option value="">Todos</option>${TIPOS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label></div>
        <div id="t-insumos"></div>
        <div class="acciones"><button class="btn" data-exportar>⬇ Exportar a Excel (CSV)</button>
          <label class="btn">⬆ Importar precios (CSV)<input type="file" accept=".csv,text/csv,text/plain" hidden data-importar></label>
          <span id="estado-guardado" class="sub" style="align-self:center"></span></div>
        <p class="sub" style="margin-top:8px">Columnas del CSV: código; descripción; unidad; tipo; precio. Si el código ya existe se actualizan su descripción, unidad y precio.</p></section>`;

    const columnas = [
      { id: 'codigo', titulo: 'Código', tipo: 'text', ancho: '12%' },
      { id: 'descripcion', titulo: 'Descripción', tipo: 'text', ancho: '44%' },
      { id: 'unidad', titulo: 'Und.', tipo: 'text', sugerencias: UNIDADES },
      { id: 'tipo', titulo: 'Tipo', tipo: 'select', opciones: TIPOS },
      { id: 'precio', titulo: 'Precio (COP)', tipo: 'number' },
    ];
    const estado = t => { $('#estado-guardado', raiz).textContent = t; };
    const programarGuardado = () => {
      clearTimeout(temporizador);
      estado('Guardando…');
      temporizador = setTimeout(async () => {
        await DB.guardarVarios('insumos', todos);
        if (borrados.size) { await DB.borrarVarios('insumos', [...borrados]); borrados.clear(); }
        estado('Guardado ✓');
      }, 700);
    };

    function pintar() {
      const texto = filtro.texto.toLowerCase();
      const vista = todos.filter(i => (!filtro.tipo || i.tipo === filtro.tipo) && (!texto || `${i.codigo} ${i.descripcion}`.toLowerCase().includes(texto)));
      const visibles = new Set(vista);
      const cont = document.createElement('div');
      $('#t-insumos', raiz).replaceChildren(cont);
      // La tabla edita una vista filtrada: las filas nuevas y las quitadas se reflejan en la lista completa.
      UI.tablaEditable(cont, columnas, vista, () => {
        const enVista = new Set(vista);
        for (const i of vista) if (!todos.includes(i)) todos.push(i);
        todos = todos.filter(i => {
          if (visibles.has(i) && !enVista.has(i)) { borrados.add(i.id); return false; }
          return true;
        });
        vista.forEach(i => visibles.add(i));
        programarGuardado();
      }, { nuevaFila: () => ({ id: uid(), codigo: '', descripcion: '', unidad: 'un', tipo: filtro.tipo || 'material', precio: '' }), textoAgregar: '+ Agregar insumo' });
    }
    pintar();

    raiz.addEventListener('input', ev => {
      if (ev.target.matches('[data-buscar]')) { filtro.texto = ev.target.value; pintar(); }
      if (ev.target.matches('[data-tipo]')) { filtro.tipo = ev.target.value; pintar(); }
    });
    raiz.addEventListener('click', async ev => {
      if (ev.target.closest('[data-base]')) { await cargarBase(); App.enrutar(); }
      if (ev.target.closest('[data-exportar]')) {
        const nombreTipo = t => (TIPOS.find(x => x[0] === t) || [, t])[1];
        const csv = [filaCSV(['Código', 'Descripción', 'Unidad', 'Tipo', 'Precio']),
          ...todos.map(i => filaCSV([i.codigo, i.descripcion, i.unidad, nombreTipo(i.tipo), Math.round(n(i.precio))]))].join('\r\n');
        UI.descargar(`insumos-obracampo-${UI.hoy()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
      }
    });
    raiz.addEventListener('change', async ev => {
      if (!ev.target.matches('[data-importar]') || !ev.target.files[0]) return;
      const texto = await UI.leerArchivo(ev.target.files[0], true);
      ev.target.value = '';
      const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
      if (!lineas.length) return;
      const sep = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
      const porCodigo = new Map(todos.map(i => [i.codigo, i]));
      let nuevos = 0, actualizados = 0;
      for (const l of lineas) {
        const [codigo, descripcion, unidad, tipo, precio] = dividirCSV(l, sep);
        if (!codigo || /^c[oó]digo$/i.test(codigo) || !Number.isFinite(precioCSV(precio))) continue;
        const existente = porCodigo.get(codigo);
        if (existente) {
          Object.assign(existente, { descripcion: descripcion || existente.descripcion, unidad: unidad || existente.unidad, precio: precioCSV(precio) });
          actualizados++;
        } else {
          const i = { id: uid(), codigo, descripcion, unidad: unidad || 'un', tipo: tipoCSV(tipo), precio: precioCSV(precio) };
          todos.push(i);
          porCodigo.set(codigo, i);
          nuevos++;
        }
      }
      todos.sort(ordenar);
      await DB.guardarVarios('insumos', todos);
      toast(`${actualizados} precios actualizados y ${nuevos} insumos nuevos`);
      pintar();
    });
  }

  async function vistaAPUs(raiz) {
    const [apus, insumos] = await Promise.all([DB.todos('apus'), mapaInsumos()]);
    apus.sort(ordenar);
    raiz.innerHTML = `${cabecera('apu')}${apus.length || insumos.size ? '' : avisoVacio()}
      <div class="acciones" style="margin:0 0 12px"><button class="btn pri" data-nuevo>+ Nuevo APU</button>
        ${apus.length ? '<button class="btn" data-pdf>📄 Todos los APU (PDF)</button>' : ''}</div>
      ${apus.length ? `<section class="card"><label class="campo" style="margin-bottom:8px"><span>Buscar</span>
          <input type="search" data-buscar placeholder="Código, descripción o capítulo"></label>
        <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Código</th><th>Descripción</th><th>Und.</th><th style="text-align:right">Valor unitario</th></tr></thead>
        <tbody>${apus.map(a => `<tr class="fila-link" data-ir="${a.id}" data-texto="${esc(`${a.codigo} ${a.descripcion} ${a.capitulo || ''}`.toLowerCase())}">
          <td>${esc(a.codigo)}</td><td>${esc(a.descripcion)}<div class="sub">${esc(a.capitulo || '')}</div></td><td>${esc(a.unidad)}</td>
          <td class="num"><strong>${moneda(calcular(a, insumos).total)}</strong></td></tr>`).join('')}</tbody></table></div></section>` : ''}`;

    raiz.addEventListener('input', ev => {
      if (!ev.target.matches('[data-buscar]')) return;
      const q = ev.target.value.toLowerCase();
      raiz.querySelectorAll('[data-texto]').forEach(tr => { tr.hidden = !tr.dataset.texto.includes(q); });
    });
    raiz.addEventListener('click', async ev => {
      if (ev.target.closest('[data-base]')) { await cargarBase(); return App.enrutar(); }
      if (ev.target.closest('[data-pdf]')) return pdfAPUs(apus);
      if (ev.target.closest('[data-nuevo]')) {
        const a = { id: uid(), codigo: '', descripcion: 'Nuevo análisis unitario', unidad: 'm²', capitulo: '', herramienta: 5,
          lineas: Object.fromEntries(TIPOS.map(([t]) => [t, []])) };
        await DB.guardar('apus', a);
        location.hash = `#/apu/${a.id}`;
        return;
      }
      const fila = ev.target.closest('[data-ir]');
      if (fila) location.hash = `#/apu/${fila.dataset.ir}`;
    });
  }

  async function editorAPU(raiz, id) {
    const apu = await DB.obtener('apus', id);
    if (!apu) { location.hash = '#/precios/apu'; return; }
    const insumos = await mapaInsumos();
    apu.lineas ||= {};
    for (const [t] of TIPOS) apu.lineas[t] ||= [];
    const precio = l => n(insumos.get(l.insumoId)?.precio);
    const und = l => insumos.get(l.insumoId)?.unidad || '';
    const opcionesDe = tipo => [['', '— Seleccione —'], ...[...insumos.values()].filter(i => i.tipo === tipo).sort(ordenar)
      .map(i => [i.id, `${i.codigo ? i.codigo + ' · ' : ''}${i.descripcion}`])];

    let temporizador;
    const estado = t => { const s = $('#estado-guardado', raiz); if (s) s.textContent = t; };
    const guardar = () => {
      clearTimeout(temporizador);
      estado('Guardando…');
      temporizador = setTimeout(async () => { await DB.guardar('apus', apu); estado('Guardado ✓'); }, 600);
    };
    const campo = (k, etiqueta, tipo = 'text', extra = '') => `<label class="campo${k === 'descripcion' ? ' ancho' : ''}"><span>${etiqueta}</span>
      <input data-k="${k}" type="${tipo}"${tipo === 'number' ? ' inputmode="decimal" step="any"' : ''} value="${esc(apu[k] ?? '')}"${extra}></label>`;

    raiz.innerHTML = `<div class="cabecera"><a class="volver" href="#/precios/apu">← Base de precios</a>
        <div class="fila-tit"><h1>Análisis de precio unitario</h1><span id="estado-guardado" class="sub"></span></div>
        <div class="acciones"><button class="btn" data-acc="pdf">📄 PDF</button><button class="btn" data-acc="duplicar">⧉ Duplicar</button>
          <button class="btn peligro" data-acc="eliminar">Eliminar</button></div></div>
      <datalist id="dl-und-apu">${UNIDADES.map(u => `<option value="${u}">`).join('')}</datalist>
      <div class="dos-col">
        <section class="card"><h2>Datos del APU</h2><div class="grid">
          ${campo('codigo', 'Código')}${campo('unidad', 'Unidad', 'text', ' list="dl-und-apu"')}${campo('capitulo', 'Capítulo')}
          ${campo('herramienta', 'Herramienta menor (% de M.O.)', 'number')}${campo('descripcion', 'Descripción de la actividad')}
        </div></section>
        <aside class="card"><h2>Resumen</h2><div id="apu-res"></div></aside>
      </div>
      ${TIPOS.map(([t, nombre]) => `<section class="card"><h2>${nombre} <span class="chip" data-sub="${t}"></span></h2><div data-sec="${t}"></div></section>`).join('')}`;

    function resumen() {
      const r = calcular(apu, insumos);
      for (const [t] of TIPOS) raiz.querySelector(`[data-sub="${t}"]`).textContent = moneda(r.sec[t]);
      $('#apu-res', raiz).innerHTML = `<table class="tabla res-tabla"><tbody>
          ${TIPOS.map(([t, nombre]) => `<tr><td>${nombre}</td><td class="num">${moneda(r.sec[t])}</td></tr>`).join('')}
          <tr><td>Herramienta menor (${num(n(apu.herramienta), 1)} % de M.O.)</td><td class="num">${moneda(r.herramienta)}</td></tr>
          <tr class="dest"><td>Valor unitario por ${esc(apu.unidad)}</td><td class="num">${moneda(r.total)}</td></tr></tbody></table>
        <p class="sub" style="margin-top:8px">Los precios vienen de la base de insumos. Mano de obra = jornal ÷ rendimiento.</p>`;
    }

    for (const [t] of TIPOS) {
      const columnas = t === 'mano_obra' ? [
        { id: 'insumoId', titulo: 'Cuadrilla / trabajador', tipo: 'select', opciones: opcionesDe(t), ancho: '46%' },
        { id: 'jornal', titulo: 'Jornal', tipo: 'calc', texto: true, alinearDerecha: true, f: l => moneda(precio(l)) },
        { id: 'rend', titulo: 'Rend. (und/día)', tipo: 'number' },
        { id: 'vp', titulo: 'V. parcial', tipo: 'calc', texto: true, alinearDerecha: true, f: l => moneda(valorLinea(l, t, insumos)) },
      ] : [
        { id: 'insumoId', titulo: 'Insumo', tipo: 'select', opciones: opcionesDe(t), ancho: '38%' },
        { id: 'und', titulo: 'Und.', tipo: 'calc', texto: true, f: und },
        { id: 'cantidad', titulo: 'Cantidad', tipo: 'number' },
        { id: 'desp', titulo: 'Desp. %', tipo: 'number' },
        { id: 'vu', titulo: 'V. unitario', tipo: 'calc', texto: true, alinearDerecha: true, f: l => moneda(precio(l)) },
        { id: 'vp', titulo: 'V. parcial', tipo: 'calc', texto: true, alinearDerecha: true, f: l => moneda(valorLinea(l, t, insumos)) },
      ];
      UI.tablaEditable(raiz.querySelector(`[data-sec="${t}"]`), columnas, apu.lineas[t], () => { resumen(); guardar(); }, {
        nuevaFila: () => (t === 'mano_obra' ? { insumoId: '', rend: '' } : { insumoId: '', cantidad: '', desp: 0 }),
        textoAgregar: '+ Agregar línea',
      });
    }
    resumen();

    raiz.addEventListener('input', ev => {
      const k = ev.target.dataset.k;
      if (!k) return;
      apu[k] = k === 'herramienta' ? (ev.target.value === '' ? '' : parseFloat(ev.target.value)) : ev.target.value;
      resumen();
      guardar();
    });
    raiz.addEventListener('click', async ev => {
      const acc = ev.target.closest('[data-acc]')?.dataset.acc;
      if (acc === 'pdf') return pdfAPUs([apu]);
      if (acc === 'duplicar') {
        clearTimeout(temporizador);
        await DB.guardar('apus', apu);
        const copia = { ...structuredClone(apu), id: uid(), codigo: `${apu.codigo} (copia)` };
        await DB.guardar('apus', copia);
        toast('APU duplicado');
        location.hash = `#/apu/${copia.id}`;
      }
      if (acc === 'eliminar') {
        const usado = (await DB.todos('presupuestos')).some(p => p.capitulos.some(c => c.items.some(i => i.apuId === apu.id)));
        const msg = usado ? 'Este APU se usa en al menos un presupuesto; esos ítems quedarán sin precio. ¿Eliminarlo de todas formas?' : '¿Eliminar este APU?';
        if (!(await UI.confirmar(msg, { texto: 'Eliminar', peligro: true }))) return;
        clearTimeout(temporizador);
        await DB.borrar('apus', apu.id);
        toast('APU eliminado');
        location.hash = '#/precios/apu';
      }
    });
  }

  /* ---------- Informe de APU ---------- */
  function apuHTML(a, insumos) {
    const r = calcular(a, insumos);
    const seccionTabla = (t, nombre) => {
      const lineas = (a.lineas?.[t] || []).filter(l => insumos.get(l.insumoId));
      if (!lineas.length) return '';
      const mo = t === 'mano_obra';
      const columnas = mo ? 5 : 6;
      const cab = mo
        ? '<th>Descripción</th><th style="width:8%">Und.</th><th style="width:14%">Jornal</th><th style="width:14%">Rend. (und/día)</th><th style="width:15%">V. parcial</th>'
        : '<th>Descripción</th><th style="width:8%">Und.</th><th style="width:11%">Cantidad</th><th style="width:8%">Desp. %</th><th style="width:13%">V. unitario</th><th style="width:15%">V. parcial</th>';
      const filas = lineas.map(l => {
        const i = insumos.get(l.insumoId);
        const medio = mo ? `<td class="n">${moneda(n(i.precio))}</td><td class="n">${num(n(l.rend), 2)}</td>`
          : `<td class="n">${num(n(l.cantidad), 4)}</td><td class="n">${num(n(l.desp), 1)}</td><td class="n">${moneda(n(i.precio))}</td>`;
        return `<tr><td>${esc(i.descripcion)}</td><td>${esc(i.unidad)}</td>${medio}<td class="n">${moneda(valorLinea(l, t, insumos))}</td></tr>`;
      }).join('');
      return `<table class="r-tabla"><tr><th colspan="${columnas}" class="r-subsec">${esc(nombre)}</th></tr><tr>${cab}</tr>${filas}
        <tr class="total"><td colspan="${columnas - 1}">Subtotal ${esc(nombre.toLowerCase())}</td><td class="n">${moneda(r.sec[t])}</td></tr></table>`;
    };
    return `<div class="r-apu"><table class="r-tabla">
        <tr><th style="width:12%">Código</th><td style="width:16%"><b>${esc(a.codigo)}</b></td><th style="width:12%">Unidad</th><td>${esc(a.unidad)}</td></tr>
        <tr><th>Actividad</th><td colspan="3"><b>${esc(a.descripcion)}</b></td></tr></table>
      ${TIPOS.map(([t, nombre]) => seccionTabla(t, nombre)).join('')}
      <table class="r-tabla">${n(a.herramienta) ? `<tr><td>Herramienta menor (${num(n(a.herramienta), 1)} % de la mano de obra)</td><td class="n" style="width:15%">${moneda(r.herramienta)}</td></tr>` : ''}
        <tr class="total"><td>VALOR UNITARIO TOTAL POR ${esc(String(a.unidad).toUpperCase())}</td><td class="n" style="width:15%">${moneda(r.total)}</td></tr></table></div>`;
  }

  async function pdfAPUs(lista, proyecto = null) {
    const insumos = await mapaInsumos();
    const c = await Reporte.empresa();
    const derecha = `Fecha: <b>${esc(UI.fechaCorta(UI.hoy()))}</b><br>Análisis: <b>${lista.length}</b>`;
    const html = `<section class="r-hoja">${Reporte.encabezado(c, proyecto, 'Análisis de precios unitarios', derecha)}
      ${[...lista].sort(ordenar).map(a => apuHTML(a, insumos)).join('')}
      <div class="r-pie">Precios en pesos colombianos. Generado con ObraCampo · ${new Date().toLocaleString('es-CO')}</div></section>`;
    Reporte.imprimir(html, Reporte.nombreArchivo(`APU${proyecto ? ' - ' + proyecto.nombre : ''}`));
  }

  return { TIPOS, ordenar, calcular, mapaInsumos, cargarBase, vistaInsumos, vistaAPUs, editorAPU, pdfAPUs, filaCSV };
})();
