/* Banco de materiales para atención de emergencias (gestión del riesgo): inventario, entradas,
   actas de entrega a familias damnificadas con firmas y PDF, y cruce con las cantidades de un plano. */
const Banco = (() => {
  const { esc, $, $$, uid, toast, num, moneda, fechaCorta, fechaLarga } = UI;
  const n = x => (Number.isFinite(+x) ? +x : 0);

  const UNIDADES = ['un', 'kg', 'bto', 'm', 'm²', 'm³', 'rollo', 'caja', 'gal', 'L', 'global'];
  const CATEGORIAS = ['Cubierta', 'Estructura', 'Mampostería y concreto', 'Herrajes y fijaciones', 'Albergue y protección', 'Otros'];
  const EVENTOS = ['Vendaval', 'Inundación', 'Avenida torrencial', 'Movimiento en masa (deslizamiento)', 'Incendio estructural', 'Sismo', 'Colapso estructural', 'Otro'];

  // Lista base de ejemplo: cantidades en cero para que cargue las del contrato o convenio de suministro.
  const BASE = [
    ['CUB-01', 'Teja de zinc ondulada cal. 34 — 3,05 m (10′)', 'un', 'Cubierta'],
    ['CUB-02', 'Teja de zinc ondulada cal. 34 — 2,44 m (8′)', 'un', 'Cubierta'],
    ['CUB-03', 'Teja de zinc ondulada cal. 34 — 3,66 m (12′)', 'un', 'Cubierta'],
    ['CUB-04', 'Teja de fibrocemento perfil 7 No. 6 (1,83 m)', 'un', 'Cubierta'],
    ['CUB-05', 'Teja de fibrocemento perfil 7 No. 8 (2,44 m)', 'un', 'Cubierta'],
    ['CUB-06', 'Caballete para teja', 'un', 'Cubierta'],
    ['FIJ-01', 'Gancho o amarre para teja', 'un', 'Herrajes y fijaciones'],
    ['FIJ-02', 'Tornillo autoperforante con arandela para teja', 'un', 'Herrajes y fijaciones'],
    ['FIJ-03', 'Clavo para zinc con arandela', 'kg', 'Herrajes y fijaciones'],
    ['EST-01', 'Perfil PHR C 100 × 50 cal. 16 — 6 m', 'un', 'Estructura'],
    ['EST-02', 'Perfil tubular 50 × 50 cal. 16 — 6 m', 'un', 'Estructura'],
    ['EST-03', 'Listón de madera 2" × 3" — 3 m', 'un', 'Estructura'],
    ['EST-04', 'Varilla corrugada #3 (3/8") — 6 m', 'un', 'Estructura'],
    ['EST-05', 'Varilla corrugada #4 (1/2") — 6 m', 'un', 'Estructura'],
    ['EST-06', 'Alambre negro #18', 'kg', 'Estructura'],
    ['MAM-01', 'Cemento gris uso general — bulto 50 kg', 'bto', 'Mampostería y concreto'],
    ['MAM-02', 'Bloque #4 de arcilla 10 × 20 × 40', 'un', 'Mampostería y concreto'],
    ['MAM-03', 'Arena de pega', 'm³', 'Mampostería y concreto'],
    ['MAM-04', 'Triturado o gravilla', 'm³', 'Mampostería y concreto'],
    ['ALB-01', 'Plástico negro de polietileno calibre 6', 'm', 'Albergue y protección'],
    ['ALB-02', 'Lona o carpa de emergencia 4 × 6 m', 'un', 'Albergue y protección'],
  ];

  /* ---------- Datos ---------- */
  async function cargar() {
    const [items, movs] = await Promise.all([DB.todos('banco'), DB.todos('movimientos')]);
    items.sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''), 'es', { numeric: true }));
    movs.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.numero || 0) - (a.numero || 0));
    return { items, movs };
  }
  // Entradas y salidas por ítem. `excluir` omite un movimiento (el que se está editando).
  function saldos(items, movs, excluir = null) {
    const s = Object.fromEntries(items.map(i => [i.id, { entradas: 0, entregas: 0 }]));
    for (const m of movs) {
      if (m.id === excluir || m.anulado) continue;
      for (const l of m.items || []) {
        if (!s[l.itemId]) continue;
        s[l.itemId][m.tipo === 'entrada' ? 'entradas' : 'entregas'] += n(l.cantidad);
      }
    }
    for (const i of items) s[i.id].disponible = n(i.inicial) + s[i.id].entradas - s[i.id].entregas;
    return s;
  }
  const etiquetaItem = i => `${i.codigo ? i.codigo + ' — ' : ''}${i.descripcion || 'Sin descripción'}`;

  /* ---------- Vistas ---------- */
  function cabecera(activa) {
    return `<div class="cabecera"><h1>Banco de materiales</h1>
        <p class="sub">Suministro de materiales para atención de emergencias: inventario, entradas y actas de entrega a familias afectadas.</p></div>
      <nav class="tabs">${[['inventario', '📦 Inventario'], ['entregas', '🤝 Entregas'], ['entradas', '📥 Entradas']]
        .map(([k, l]) => `<a href="#/banco/${k}" class="${k === activa ? 'activo' : ''}">${l}</a>`).join('')}</nav>`;
  }

  async function vistaInventario(raiz) {
    let { items, movs } = await cargar();
    let sal = saldos(items, movs);
    const borrados = new Set();
    const usados = new Set(movs.flatMap(m => (m.items || []).map(l => l.itemId)));
    let temporizador, texto = '';
    const entregas = movs.filter(m => m.tipo === 'entrega' && !m.anulado);
    const personas = entregas.reduce((s, m) => s + n(m.beneficiario?.personas), 0);
    const valor = () => items.reduce((s, i) => s + Math.max(0, sal[i.id]?.disponible || 0) * n(i.valor), 0);
    raiz.innerHTML = `${cabecera('inventario')}
      <div class="tarjetas resumen-banco">
        <div class="card"><p class="sub">Materiales</p><p class="cifra">${items.length}</p></div>
        <div class="card"><p class="sub">Valor disponible</p><p class="cifra" data-valor>${moneda(valor())}</p></div>
        <div class="card"><p class="sub">Actas de entrega</p><p class="cifra">${entregas.length}</p></div>
        <div class="card"><p class="sub">Familias / personas atendidas</p><p class="cifra">${entregas.length} / ${personas}</p></div>
      </div>
      ${items.length ? '' : `<div class="card"><h2>El banco está vacío</h2>
        <p class="sub">Cargue los materiales del contrato o convenio de suministro: escríbalos abajo, impórtelos desde Excel (CSV) o empiece con una lista base de ${BASE.length} materiales típicos de atención de emergencias (con cantidades en cero).</p>
        <div class="acciones"><button class="btn pri" data-base>Cargar lista base</button></div></div>`}
      <section class="card">
        <div class="fila" style="margin-bottom:12px;flex-wrap:wrap"><input type="search" data-buscar placeholder="Buscar por código o material" style="max-width:360px">
          <a class="btn pri" href="#/banco/mov/nueva-entrega">+ Nueva entrega</a><a class="btn" href="#/banco/mov/nueva-entrada">+ Registrar entrada</a></div>
        <div id="t-banco"></div>
        <div class="acciones"><button class="btn" data-pdf>📄 Informe de inventario (PDF)</button><button class="btn" data-exportar>⬇ Exportar (CSV)</button>
          <label class="btn">⬆ Importar (CSV)<input type="file" accept=".csv,text/csv,text/plain" hidden data-importar></label>
          <span data-estado class="sub" style="align-self:center"></span></div>
        <p class="sub" style="margin-top:8px">«Cant. inicial» es lo recibido al iniciar el contrato. Las entradas y entregas se registran en sus pestañas y el disponible se calcula solo.
          CSV: código; material; unidad; cantidad inicial; valor unitario; categoría.</p></section>`;

    const columnas = [
      { id: 'codigo', titulo: 'Código', tipo: 'text', ancho: '9%' },
      { id: 'descripcion', titulo: 'Material', tipo: 'text', ancho: '30%' },
      { id: 'unidad', titulo: 'Und.', tipo: 'text', sugerencias: UNIDADES },
      { id: 'categoria', titulo: 'Categoría', tipo: 'select', opciones: CATEGORIAS.map(c => [c, c]) },
      { id: 'inicial', titulo: 'Cant. inicial', tipo: 'number' },
      { id: 'valor', titulo: 'Valor unit. (COP)', tipo: 'number' },
      { id: 'mov', titulo: 'Entradas / entregas', tipo: 'calc', texto: true, f: i => sal[i.id] ? `+${num(sal[i.id].entradas, 0)} / −${num(sal[i.id].entregas, 0)}` : '—' },
      { id: 'disp', titulo: 'Disponible', tipo: 'calc', dec: 0, alinearDerecha: true, f: i => n(i.inicial) + (sal[i.id]?.entradas || 0) - (sal[i.id]?.entregas || 0) },
    ];
    const estado = t => { $('[data-estado]', raiz).textContent = t; };
    const guardar = () => {
      clearTimeout(temporizador);
      estado('Guardando…');
      temporizador = setTimeout(async () => {
        await DB.guardarVarios('banco', items);
        if (borrados.size) { await DB.borrarVarios('banco', [...borrados]); borrados.clear(); }
        sal = saldos(items, movs);
        $('[data-valor]', raiz).textContent = moneda(valor());
        estado('Guardado ✓');
      }, 600);
    };
    function pintar() {
      const t = texto.toLowerCase();
      const vista = items.filter(i => !t || `${i.codigo} ${i.descripcion}`.toLowerCase().includes(t));
      const visibles = new Set(vista);
      const cont = document.createElement('div');
      $('#t-banco', raiz).replaceChildren(cont);
      UI.tablaEditable(cont, columnas, vista, () => {
        const enVista = new Set(vista);
        for (const i of vista) if (!items.includes(i)) { items.push(i); sal[i.id] = { entradas: 0, entregas: 0, disponible: 0 }; }
        const quitados = [...visibles].filter(i => !enVista.has(i));
        if (quitados.some(i => usados.has(i.id))) { toast('No se puede quitar un material que ya tiene entradas o entregas', 'error'); pintar(); return; }
        for (const i of quitados) { borrados.add(i.id); visibles.delete(i); }
        items = items.filter(i => !quitados.includes(i));
        vista.forEach(i => visibles.add(i));
        guardar();
      }, { nuevaFila: () => ({ id: uid(), codigo: '', descripcion: '', unidad: 'un', categoria: CATEGORIAS[0], inicial: 0, valor: '' }), textoAgregar: '+ Agregar material' });
    }
    pintar();

    raiz.addEventListener('input', e => { if (e.target.matches('[data-buscar]')) { texto = e.target.value; pintar(); } });
    raiz.addEventListener('click', async e => {
      if (e.target.closest('[data-base]')) {
        await DB.guardarVarios('banco', BASE.map(([codigo, descripcion, unidad, categoria]) => ({ id: uid(), codigo, descripcion, unidad, categoria, inicial: 0, valor: '' })));
        toast('Lista base cargada: escriba las cantidades del contrato');
        App.enrutar();
      }
      if (e.target.closest('[data-exportar]')) {
        const lineas = [Precios.filaCSV(['Código', 'Material', 'Unidad', 'Cantidad inicial', 'Valor unitario', 'Categoría', 'Entradas', 'Entregas', 'Disponible'])];
        for (const i of items) lineas.push(Precios.filaCSV([i.codigo, i.descripcion, i.unidad, i.inicial, i.valor, i.categoria, sal[i.id]?.entradas, sal[i.id]?.entregas, sal[i.id]?.disponible]));
        UI.descargar(`banco-materiales-${UI.hoy()}.csv`, '﻿' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
      }
      if (e.target.closest('[data-pdf]')) pdfInventario();
    });
    raiz.addEventListener('change', async e => {
      if (!e.target.matches('[data-importar]') || !e.target.files[0]) return;
      try {
        const nuevos = importarCSV(await UI.leerArchivo(e.target.files[0], true), items);
        await DB.guardarVarios('banco', nuevos);
        toast(`${nuevos.length} materiales importados o actualizados`);
        App.enrutar();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function importarCSV(texto, items) {
    const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lineas.length) throw new Error('El archivo está vacío');
    const sep = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
    const partir = l => {
      const out = []; let actual = '', com = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') { if (com && l[i + 1] === '"') { actual += '"'; i++; } else com = !com; } else if (c === sep && !com) { out.push(actual.trim()); actual = ''; } else actual += c;
      }
      out.push(actual.trim());
      return out;
    };
    const numero = s => { const t = String(s ?? '').replace(/[$\s]/g, ''); return t === '' ? '' : parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) || 0; };
    const porCodigo = Object.fromEntries(items.filter(i => i.codigo).map(i => [String(i.codigo).toLowerCase(), i]));
    const salida = [];
    for (const l of lineas) {
      const [codigo, descripcion, unidad, inicial, valor, categoria] = partir(l);
      if (!descripcion || /^(material|descrip)/i.test(descripcion)) continue;
      const previo = codigo && porCodigo[codigo.toLowerCase()];
      salida.push({ ...(previo || { id: uid() }), codigo, descripcion, unidad: unidad || 'un', inicial: numero(inicial) || 0, valor: numero(valor), categoria: categoria || previo?.categoria || 'Otros' });
    }
    if (!salida.length) throw new Error('No se encontraron filas válidas (código; material; unidad; cantidad; valor)');
    return salida;
  }

  async function vistaMovimientos(raiz, tipo) {
    const { items, movs } = await cargar();
    const nombres = Object.fromEntries(items.map(i => [i.id, i]));
    const lista = movs.filter(m => m.tipo === tipo);
    const entrega = tipo === 'entrega';
    raiz.innerHTML = `${cabecera(entrega ? 'entregas' : 'entradas')}
      <div class="acciones" style="margin:0 0 12px"><a class="btn pri" href="#/banco/mov/nueva-${tipo}">+ ${entrega ? 'Nueva acta de entrega' : 'Registrar entrada'}</a>
        ${entrega && lista.length ? '<button class="btn" data-consolidado>📄 Consolidado de entregas (PDF)</button>' : ''}</div>
      <div class="card" style="padding:0">${lista.length ? lista.map(m => {
        const resumen = (m.items || []).map(l => `${num(n(l.cantidad), 0)} ${nombres[l.itemId]?.unidad || ''} ${nombres[l.itemId]?.descripcion || '(material eliminado)'}`).join(' · ');
        return `<a class="lista-item" href="#/banco/mov/${m.id}"><div class="num-reg">${m.numero || '—'}</div>
          <div style="flex:1;min-width:0"><strong>${esc(entrega ? m.beneficiario?.nombre || 'Sin beneficiario' : m.proveedor || m.soporte || 'Entrada de materiales')}</strong>
            <div class="sub">${esc(fechaCorta(m.fecha))}${entrega ? ` · ${esc(m.evento || '')}${m.beneficiario?.sector ? ' · ' + esc(m.beneficiario.sector) : ''}` : m.soporte ? ' · ' + esc(m.soporte) : ''}</div>
            <div class="sub recorte">${esc(resumen)}</div></div>
          ${m.anulado ? '<span class="chip">Anulada</span>' : entrega ? `<span class="chip ${m.firmas?.beneficiario ? 'ok' : ''}">${m.firmas?.beneficiario ? 'Firmada' : 'Sin firma'}</span>` : ''}</a>`;
      }).join('') : `<p class="vacio">${entrega ? 'Aún no hay actas de entrega.' : 'Aún no hay entradas registradas.'}</p>`}</div>`;
    $('[data-consolidado]', raiz)?.addEventListener('click', () => pdfConsolidado(items, lista.filter(m => !m.anulado)));
  }

  /* ---------- Editor de entrega o entrada ---------- */
  async function editor(raiz, id) {
    const { items, movs } = await cargar();
    let m = movs.find(x => x.id === id);
    const nuevo = !m;
    if (nuevo) {
      const tipo = id === 'nueva-entrada' ? 'entrada' : 'entrega';
      let borrador = null;
      try { borrador = JSON.parse(sessionStorage.getItem('obracampo-borrador-entrega') || 'null'); sessionStorage.removeItem('obracampo-borrador-entrega'); } catch { /* sin borrador */ }
      const [funcionario, entidad] = await Promise.all([DB.ajuste('profesional', ''), DB.ajuste('empresa', '')]);
      m = {
        id: uid(), tipo, numero: Math.max(0, ...movs.filter(x => x.tipo === tipo).map(x => n(x.numero))) + 1, fecha: UI.hoy(),
        evento: EVENTOS[0], beneficiario: {}, items: [], obs: '', firmas: {}, funcionario, cargo: entidad ? `Enlace de gestión del riesgo — ${entidad}` : 'Enlace de gestión del riesgo',
        ...(tipo === 'entrega' && borrador ? { items: borrador.items, obs: borrador.obs } : {}),
      };
    }
    const entrega = m.tipo === 'entrega';
    m.items = m.items || [];
    const sal = saldos(items, movs, m.id);
    const porId = Object.fromEntries(items.map(i => [i.id, i]));
    const campo = (k, t, tipo = 'text', v = m[k]) => `<label class="campo"><span>${t}</span><input data-k="${k}" type="${tipo}" value="${esc(v ?? '')}"${tipo === 'number' ? ' inputmode="decimal" step="any"' : ''}></label>`;
    const ben = (k, t, tipo = 'text') => `<label class="campo"><span>${t}</span><input data-b="${k}" type="${tipo}" value="${esc(m.beneficiario?.[k] ?? '')}"${tipo === 'number' ? ' inputmode="numeric"' : ''}></label>`;
    raiz.innerHTML = `<div class="cabecera"><a class="volver" href="#/banco/${entrega ? 'entregas' : 'entradas'}">← Banco de materiales</a>
        <h1>${entrega ? `Acta de entrega No. ${m.numero}` : `Entrada No. ${m.numero}`}</h1>
        ${m.anulado ? '<p class="aviso">Este movimiento está anulado: no afecta el inventario.</p>' : ''}</div>
      ${items.length ? '' : '<div class="card"><p class="aviso">El banco no tiene materiales. Primero cárguelos en <a href="#/banco/inventario">Inventario</a>.</p></div>'}
      <section class="card"><h2>${entrega ? 'Evento y fecha' : 'Datos de la entrada'}</h2><div class="grid g2">
        ${campo('fecha', 'Fecha', 'date')}${campo('numero', entrega ? 'Acta No.' : 'Entrada No.', 'number')}
        ${entrega ? `<label class="campo"><span>Tipo de evento</span><select data-k="evento">${EVENTOS.map(e => `<option${e === m.evento ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select></label>
          ${campo('fechaEvento', 'Fecha del evento', 'date')}${campo('registro', 'Registro / RUD / censo No.')}`
          : `${campo('proveedor', 'Proveedor o entidad que entrega')}${campo('soporte', 'Soporte (remisión, factura, contrato)')}`}
      </div></section>
      ${entrega ? `<section class="card"><h2>Familia beneficiaria</h2><div class="grid g2">
        ${ben('nombre', 'Nombre del jefe de hogar')}${ben('documento', 'Documento de identidad')}${ben('telefono', 'Teléfono', 'tel')}
        ${ben('sector', 'Vereda, barrio o corregimiento')}${ben('direccion', 'Dirección o referencia')}${ben('personas', 'Personas en el hogar', 'number')}
      </div></section>` : ''}
      <section class="card"><h2>Materiales</h2><div id="t-items"></div><div class="sub" data-total style="margin-top:8px"></div></section>
      <section class="card"><h2>Observaciones</h2><textarea data-k="obs" placeholder="${entrega ? 'Daños observados en la vivienda, uso que se dará a los materiales, compromisos…' : ''}">${esc(m.obs || '')}</textarea></section>
      ${entrega ? `<section class="card"><h2>Firmas</h2><div class="grid g2">
        <div class="firma"><div class="firma-img" data-ver="beneficiario">${m.firmas?.beneficiario ? `<img src="${m.firmas.beneficiario}" alt="Firma">` : 'Sin firma'}</div>
          <button class="btn" data-firmar="beneficiario">✍ Firma del beneficiario</button></div>
        <div class="firma"><div class="firma-img" data-ver="funcionario">${m.firmas?.funcionario ? `<img src="${m.firmas.funcionario}" alt="Firma">` : 'Sin firma'}</div>
          <button class="btn" data-firmar="funcionario">✍ Firma de quien entrega</button>
          ${campo('funcionario', 'Nombre de quien entrega')}${campo('cargo', 'Cargo')}</div>
      </div></section>` : ''}
      <div class="acciones" style="margin-bottom:24px"><button class="btn pri" data-guardar>Guardar</button>
        ${entrega ? '<button class="btn" data-pdf>📄 Acta en PDF</button>' : ''}
        ${nuevo ? '' : `<button class="btn" data-anular>${m.anulado ? 'Reactivar' : 'Anular'}</button><button class="btn peligro" data-borrar>Eliminar</button>`}</div>`;

    const columnas = [
      { id: 'itemId', titulo: 'Material', tipo: 'select', opciones: [['', '— Elija —'], ...items.map(i => [i.id, `${etiquetaItem(i)} (${i.unidad || 'un'})`])] },
      { id: 'cantidad', titulo: 'Cantidad', tipo: 'number' },
      { id: 'disp', titulo: entrega ? 'Disponible' : 'Saldo actual', tipo: 'calc', dec: 0, f: l => sal[l.itemId]?.disponible ?? NaN },
      { id: 'valor', titulo: 'Valor', tipo: 'calc', texto: true, alinearDerecha: true, f: l => (porId[l.itemId]?.valor ? moneda(n(l.cantidad) * n(porId[l.itemId].valor)) : '—') },
    ];
    const total = () => {
      const v = m.items.reduce((s, l) => s + n(l.cantidad) * n(porId[l.itemId]?.valor), 0);
      $('[data-total]', raiz).textContent = v ? `Valor total: ${moneda(v)}` : '';
    };
    UI.tablaEditable($('#t-items', raiz), columnas, m.items, total, { nuevaFila: () => ({ itemId: '', cantidad: '' }), textoAgregar: '+ Agregar material' });
    total();

    raiz.addEventListener('input', e => {
      const k = e.target.dataset.k, b = e.target.dataset.b;
      if (k) m[k] = k === 'numero' ? n(e.target.value) : e.target.value;
      if (b) m.beneficiario = { ...m.beneficiario, [b]: b === 'personas' ? n(e.target.value) : e.target.value };
    });
    raiz.addEventListener('change', e => { if (e.target.dataset.k === 'evento') m.evento = e.target.value; });

    async function guardar() {
      m.items.splice(0, m.items.length, ...m.items.filter(l => l.itemId && n(l.cantidad) > 0));
      if (entrega && !m.anulado) {
        const exceso = m.items.filter(l => n(l.cantidad) > (sal[l.itemId]?.disponible ?? 0) + 1e-9);
        if (exceso.length) {
          toast(`No alcanza el inventario: ${exceso.map(l => `${porId[l.itemId]?.descripcion} (disp. ${num(sal[l.itemId]?.disponible ?? 0, 0)})`).join(', ')}`, 'error');
          return false;
        }
      }
      m.modificado = new Date().toISOString();
      m.creado = m.creado || m.modificado;
      await DB.guardar('movimientos', m);
      toast('Guardado');
      return true;
    }
    raiz.addEventListener('click', async e => {
      const firmar = e.target.closest('[data-firmar]')?.dataset.firmar;
      if (firmar) {
        const img = await UI.lienzo({ titulo: firmar === 'beneficiario' ? 'Firma del beneficiario' : 'Firma de quien entrega' });
        if (img) { m.firmas = { ...m.firmas, [firmar]: img }; $(`[data-ver="${firmar}"]`, raiz).innerHTML = `<img src="${img}" alt="Firma">`; }
        return;
      }
      if (e.target.closest('[data-guardar]')) { if (await guardar()) location.hash = `#/banco/${entrega ? 'entregas' : 'entradas'}`; }
      if (e.target.closest('[data-pdf]')) { if (await guardar()) pdfActa(m, items); }
      if (e.target.closest('[data-anular]')) { m.anulado = !m.anulado; await DB.guardar('movimientos', m); toast(m.anulado ? 'Anulado' : 'Reactivado'); App.enrutar(); }
      if (e.target.closest('[data-borrar]') && await UI.confirmar('¿Eliminar este movimiento? El inventario se recalcula.', { texto: 'Eliminar', peligro: true })) {
        await DB.borrar('movimientos', m.id);
        location.hash = `#/banco/${entrega ? 'entregas' : 'entradas'}`;
      }
    });
  }

  /* ---------- Informes ---------- */
  async function pdfActa(m, items) {
    const c = await Reporte.empresa();
    const porId = Object.fromEntries(items.map(i => [i.id, i]));
    const b = m.beneficiario || {};
    const filas = m.items.map(l => ({ ...porId[l.itemId], cantidad: n(l.cantidad) }));
    const total = filas.reduce((s, f) => s + f.cantidad * n(f.valor), 0);
    const der = `Acta No. <b>${esc(m.numero)}</b><br>Fecha: <b>${esc(fechaCorta(m.fecha))}</b>${m.registro ? `<br>Registro: ${esc(m.registro)}` : ''}`;
    const html = `<section class="r-hoja">${Reporte.encabezado(c, null, 'Acta de entrega de materiales — Atención de emergencias', der)}
      ${Reporte.seccion('Evento')}
      <table class="r-tabla"><tr><th style="width:20%">Tipo de evento</th><td>${esc(m.evento || '—')}</td><th style="width:20%">Fecha del evento</th><td>${esc(fechaCorta(m.fechaEvento) || '—')}</td></tr></table>
      ${Reporte.seccion('Familia beneficiaria')}
      <table class="r-tabla">
        <tr><th style="width:20%">Jefe de hogar</th><td>${esc(b.nombre || '—')}</td><th style="width:20%">Documento</th><td>${esc(b.documento || '—')}</td></tr>
        <tr><th>Vereda / barrio</th><td>${esc(b.sector || '—')}</td><th>Teléfono</th><td>${esc(b.telefono || '—')}</td></tr>
        <tr><th>Dirección</th><td>${esc(b.direccion || '—')}</td><th>Personas en el hogar</th><td>${esc(b.personas || '—')}</td></tr></table>
      ${Reporte.seccion('Materiales entregados')}
      <table class="r-tabla"><tr><th style="width:12%">Código</th><th>Material</th><th style="width:8%">Und.</th><th style="width:10%">Cantidad</th><th style="width:14%">Valor unit.</th><th style="width:15%">Valor total</th></tr>
        ${filas.map(f => `<tr><td>${esc(f.codigo || '')}</td><td>${esc(f.descripcion || '')}</td><td>${esc(f.unidad || '')}</td><td class="n">${num(f.cantidad, 0)}</td>
          <td class="n">${f.valor ? moneda(f.valor) : ''}</td><td class="n">${f.valor ? moneda(f.cantidad * n(f.valor)) : ''}</td></tr>`).join('')}
        ${total ? `<tr class="total"><td colspan="5">Total</td><td class="n">${moneda(total)}</td></tr>` : ''}</table>
      ${Reporte.seccion('Observaciones')}<div class="r-texto">${esc(m.obs || 'Sin observaciones.')}</div>
      <p class="r-nota" style="font-size:9pt;margin-top:8px">El beneficiario declara que recibe a satisfacción los materiales relacionados, que su vivienda resultó afectada por el evento descrito
        y que los destinará exclusivamente a su reparación o rehabilitación. Entrega realizada en el marco de la Ley 1523 de 2012 (Sistema Nacional de Gestión del Riesgo de Desastres).</p>
      <div class="r-firmas">
        <div class="r-firma"><div class="img">${m.firmas?.beneficiario ? `<img src="${m.firmas.beneficiario}" alt="">` : ''}</div>
          <div class="linea"><b>${esc(b.nombre || '')}</b><br>Beneficiario · C.C. ${esc(b.documento || '')}</div></div>
        <div class="r-firma"><div class="img">${m.firmas?.funcionario ? `<img src="${m.firmas.funcionario}" alt="">` : ''}</div>
          <div class="linea"><b>${esc(m.funcionario || '')}</b><br>${esc(m.cargo || 'Entrega')}</div></div></div>
      <div class="r-pie">Generado con ObraCampo · ${new Date().toLocaleString('es-CO')}</div></section>`;
    Reporte.imprimir(html, Reporte.nombreArchivo(`Acta entrega ${m.numero} - ${b.nombre || ''} - ${m.fecha}`));
  }

  async function pdfInventario() {
    const [{ items, movs }, c] = await Promise.all([cargar(), Reporte.empresa()]);
    const sal = saldos(items, movs);
    const valor = items.reduce((s, i) => s + Math.max(0, sal[i.id].disponible) * n(i.valor), 0);
    const html = `<section class="r-hoja">${Reporte.encabezado(c, null, 'Banco de materiales — Estado del inventario', `Fecha: <b>${esc(fechaCorta(UI.hoy()))}</b>`)}
      <table class="r-tabla"><tr><th style="width:10%">Código</th><th>Material</th><th style="width:7%">Und.</th><th style="width:9%">Inicial</th><th style="width:9%">Entradas</th>
        <th style="width:9%">Entregas</th><th style="width:9%">Disponible</th><th style="width:13%">Valor disponible</th></tr>
        ${items.map(i => `<tr><td>${esc(i.codigo || '')}</td><td>${esc(i.descripcion || '')}</td><td>${esc(i.unidad || '')}</td><td class="n">${num(n(i.inicial), 0)}</td>
          <td class="n">${num(sal[i.id].entradas, 0)}</td><td class="n">${num(sal[i.id].entregas, 0)}</td><td class="n"><b>${num(sal[i.id].disponible, 0)}</b></td>
          <td class="n">${i.valor ? moneda(Math.max(0, sal[i.id].disponible) * n(i.valor)) : ''}</td></tr>`).join('')}
        <tr class="total"><td colspan="7">Valor total disponible</td><td class="n">${moneda(valor)}</td></tr></table>
      <p class="r-nota">Actas de entrega vigentes: ${movs.filter(m => m.tipo === 'entrega' && !m.anulado).length}. Entradas registradas: ${movs.filter(m => m.tipo === 'entrada' && !m.anulado).length}.</p>
      <div class="r-pie">Generado con ObraCampo · ${new Date().toLocaleString('es-CO')}</div></section>`;
    Reporte.imprimir(html, Reporte.nombreArchivo(`Inventario banco de materiales ${UI.hoy()}`));
  }

  async function pdfConsolidado(items, entregas) {
    const c = await Reporte.empresa();
    const porId = Object.fromEntries(items.map(i => [i.id, i]));
    const html = `<section class="r-hoja">${Reporte.encabezado(c, null, 'Consolidado de entregas — Banco de materiales', `Fecha: <b>${esc(fechaCorta(UI.hoy()))}</b><br>Actas: <b>${entregas.length}</b>`)}
      <table class="r-tabla"><tr><th style="width:6%">Acta</th><th style="width:10%">Fecha</th><th>Beneficiario</th><th style="width:12%">Documento</th><th style="width:14%">Sector</th><th style="width:12%">Evento</th><th style="width:28%">Materiales</th></tr>
        ${entregas.slice().reverse().map(m => `<tr><td class="n">${esc(m.numero)}</td><td>${esc(fechaCorta(m.fecha))}</td><td>${esc(m.beneficiario?.nombre || '')}</td><td>${esc(m.beneficiario?.documento || '')}</td>
          <td>${esc(m.beneficiario?.sector || '')}</td><td>${esc(m.evento || '')}</td>
          <td>${esc((m.items || []).map(l => `${num(n(l.cantidad), 0)} ${porId[l.itemId]?.unidad || ''} ${porId[l.itemId]?.descripcion || ''}`).join('; '))}</td></tr>`).join('')}</table>
      <div class="r-pie">Generado con ObraCampo · ${new Date().toLocaleString('es-CO')}</div></section>`;
    Reporte.imprimir(html, Reporte.nombreArchivo(`Consolidado entregas ${UI.hoy()}`));
  }

  /* ---------- Cruce con las cantidades de un plano ---------- */
  const normalizar = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[″"′']/g, ' ').replace(/[×(),—–\-]/g, ' ');
  const VACIAS = new Set(['de', 'la', 'el', 'y', 'en', 'con', 'para', 'por', 'x', 'm', 'un', 'piezas', 'pieza', 'uso', 'general', 'bulto', 'bultos', 'varillas', 'cal.', 'ancho']);
  const raiz = x => (x.length > 4 && x.endsWith('s') ? x.slice(0, -1) : x);
  const fichas = t => new Set(normalizar(t).split(/\s+/).map(x => raiz(x.replace(/\.$/, ''))).filter(x => x && !VACIAS.has(x)));
  function parecido(a, b) {
    const A = fichas(a), B = fichas(b);
    if (!A.size || !B.size) return 0;
    let comun = 0;
    for (const x of A) if (B.has(x) || (x === 'acero' && B.has('varilla'))) comun++;
    return comun / Math.max(A.size, B.size);
  }

  async function revisarPlano(plano, q) {
    const materiales = q.secciones.find(s => s.id === 'materiales')?.filas || [];
    const { items, movs } = await cargar();
    if (!items.length) { toast('El banco de materiales está vacío. Cárguelo en Banco › Inventario.', 'error'); return; }
    const sal = saldos(items, movs);
    const filas = materiales.filter(([, v]) => n(v) > 0).map(([t, v, u]) => {
      let mejor = null, puntaje = 0;
      for (const i of items) {
        const p = parecido(t, i.descripcion) + (i.unidad === u ? 0.1 : 0);
        if (p > puntaje) { puntaje = p; mejor = i; }
      }
      const req = ['un', 'bto'].includes(u) ? Math.ceil(n(v) - 1e-9) : Math.round(n(v) * 100) / 100;
      return { t, u, req, itemId: puntaje >= 0.45 ? mejor.id : '' };
    });
    const estadoFila = f => {
      if (!f.itemId) return '<span class="chip">Sin asignar</span>';
      const d = sal[f.itemId].disponible;
      return d >= f.req ? '<span class="chip ok">Alcanza</span>' : `<span class="chip alerta">Faltan ${num(f.req - Math.max(0, d), 0)}</span>`;
    };
    const opciones = sel => `<option value="">— No tomar del banco —</option>${items.map(i => `<option value="${i.id}"${i.id === sel ? ' selected' : ''}>${esc(etiquetaItem(i))} (disp. ${num(sal[i.id].disponible, 0)} ${esc(i.unidad || '')})</option>`).join('')}`;
    const cuerpo = document.createElement('div');
    const pintar = () => {
      cuerpo.innerHTML = `<p class="sub" style="margin-bottom:8px">Asigne cada material del plano a un material del banco. La app sugiere la coincidencia más probable.</p>
        <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Material del plano</th><th class="num">Requerido</th><th>Material del banco</th><th>Estado</th></tr></thead><tbody>
        ${filas.map((f, i) => `<tr><td>${esc(f.t)}</td><td class="num">${num(f.req, f.u === 'un' || f.u === 'bto' ? 0 : 2)} ${esc(f.u)}</td>
          <td><select data-i="${i}" style="min-width:220px">${opciones(f.itemId)}</select></td><td>${estadoFila(f)}</td></tr>`).join('')}</tbody></table></div>`;
    };
    pintar();
    cuerpo.addEventListener('change', e => { const i = e.target.dataset.i; if (i != null) { filas[+i].itemId = e.target.value; pintar(); } });
    UI.modal({
      titulo: `Banco de materiales — ${plano.nombre}`, cuerpo, ancho: '1000px',
      botones: [{ texto: 'Cerrar' }, {
        texto: 'Crear acta de entrega con estas cantidades', clase: 'pri', accion: () => {
          const lineas = filas.filter(f => f.itemId).map(f => ({ itemId: f.itemId, cantidad: Math.min(f.req, Math.max(0, sal[f.itemId].disponible)) })).filter(l => l.cantidad > 0);
          if (!lineas.length) { toast('No hay materiales asignados con existencias', 'error'); return false; }
          try { sessionStorage.setItem('obracampo-borrador-entrega', JSON.stringify({ items: lineas, obs: `Materiales según el plano «${plano.nombre}».` })); } catch { /* sin almacenamiento de sesión */ }
          location.hash = '#/banco/mov/nueva-entrega';
        },
      }],
    });
  }

  return { vistaInventario, vistaMovimientos, editor, revisarPlano };
})();
