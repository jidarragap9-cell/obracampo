/* Arranque, rutas y vistas de proyectos y ajustes. */
const App = (() => {
  const { esc, $, toast, num, moneda, fechaCorta, fechaLarga } = UI;

  /* Cada vista dibuja en una raíz nueva para que sus eventos se descarten al navegar. */
  function nuevaRaiz() {
    const raiz = document.createElement('div');
    $('#main').replaceChildren(raiz);
    return raiz;
  }

  const rutas = [
    [/^#\/?$/, () => vistaProyectos()],
    [/^#\/proyecto\/nuevo$/, () => formProyecto()],
    [/^#\/proyecto\/(\w+)\/editar$/, id => formProyecto(id)],
    [/^#\/proyecto\/(\w+)(?:\/(\w+))?$/, (id, tab) => vistaProyecto(id, tab || 'bitacora')],
    [/^#\/bitacora\/(\w+)$/, id => Bitacora.editor(nuevaRaiz(), id)],
    [/^#\/calc\/?$/, () => Calc.lista(nuevaRaiz())],
    [/^#\/calc\/(\w+)(?:\/(\w+))?$/, (tipo, pid) => Calc.vista(nuevaRaiz(), tipo, pid)],
    [/^#\/cant\/(\w+)$/, async id => {
      const r = await DB.obtener('cantidades', id);
      if (r) Calc.vista(nuevaRaiz(), r.tipo, r.proyectoId, r);
      else location.hash = '#/';
    }],
    [/^#\/precios\/?$/, () => { location.replace('#/precios/apu'); }],
    [/^#\/precios\/insumos$/, () => Precios.vistaInsumos(nuevaRaiz())],
    [/^#\/precios\/apu$/, () => Precios.vistaAPUs(nuevaRaiz())],
    [/^#\/apu\/(\w+)$/, id => Precios.editorAPU(nuevaRaiz(), id)],
    [/^#\/ajustes$/, () => vistaAjustes()],
  ];

  async function enrutar() {
    const h = location.hash || '#/';
    document.title = 'ObraCampo';
    for (const [re, fn] of rutas) {
      const m = h.match(re);
      if (!m) continue;
      const seccion = h.startsWith('#/calc') ? 'calc' : h.startsWith('#/ajustes') ? 'ajustes'
        : h.startsWith('#/precios') || h.startsWith('#/apu') ? 'precios' : 'proyectos';
      document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('activo', a.dataset.nav === seccion));
      window.scrollTo(0, 0);
      try { await fn(...m.slice(1)); }
      catch (err) {
        console.error(err);
        nuevaRaiz().innerHTML = `<div class="card"><h2>Ocurrió un error</h2><p class="sub">${esc(err.message)}</p></div>`;
      }
      return;
    }
    location.hash = '#/';
  }

  function avanceTiempo(p) {
    if (!p.fechaInicio || !p.plazoDias) return null;
    const dias = Math.floor((Date.now() - new Date(p.fechaInicio + 'T00:00:00')) / 864e5) + 1;
    return { dias, plazo: +p.plazoDias, pct: Math.min(100, Math.max(0, dias / p.plazoDias * 100)) };
  }

  /* ---------- Proyectos ---------- */
  async function vistaProyectos() {
    const raiz = nuevaRaiz();
    const proyectos = (await DB.todos('proyectos')).sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
    const conteos = await Promise.all(proyectos.map(p => Promise.all([DB.contar('bitacora', p.id), DB.contar('cantidades', p.id)])));
    raiz.innerHTML = `<div class="cabecera"><h1>Proyectos</h1>
        <p class="sub">Bitácora de obra, cantidades e informes técnicos. Todo queda guardado en este dispositivo y funciona sin internet.</p>
        <div class="acciones"><a class="btn pri" href="#/proyecto/nuevo">+ Nuevo proyecto</a><a class="btn" href="#/calc">🧮 Calculadoras rápidas</a></div></div>
      ${proyectos.length ? `<div class="tarjetas">${proyectos.map((p, i) => {
        const t = avanceTiempo(p);
        return `<a class="card tarjeta" href="#/proyecto/${p.id}"><h2>${esc(p.nombre)}</h2><p class="sub">${esc(p.ubicacion || '')}</p>
          ${t ? `<div class="barra"><i style="width:${t.pct}%"></i></div><p class="sub">Día ${t.dias} de ${t.plazo}</p>` : ''}
          <div class="estadisticas"><span class="chip">📒 ${conteos[i][0]} registros</span><span class="chip">🧮 ${conteos[i][1]} cálculos</span></div></a>`;
      }).join('')}</div>`
      : `<div class="card"><h2>Comience aquí</h2><ol class="sub" style="line-height:1.9;margin:0;padding-left:20px">
          <li>Configure su empresa, logo y matrícula en <a href="#/ajustes">Ajustes</a> (aparecen en los informes).</li>
          <li>Cree un proyecto con los datos del contrato.</li>
          <li>Cada día de obra, abra un registro de bitácora: clima, personal, actividades, fotos y firmas.</li>
          <li>Calcule cantidades y guárdelas en el proyecto. Exporte todo a PDF.</li></ol></div>`}`;
  }

  const CAMPOS_PROYECTO = [
    ['nombre', 'Nombre del proyecto *', 'text', 'Ej.: Construcción vivienda de dos pisos'],
    ['objeto', 'Objeto del contrato', 'textarea'],
    ['contrato', 'Contrato No.', 'text'],
    ['contratante', 'Contratante / cliente', 'text'],
    ['contratista', 'Contratista', 'text'],
    ['interventoria', 'Interventoría / supervisión', 'text'],
    ['residente', 'Residente de obra', 'text'],
    ['interventor', 'Nombre del interventor o supervisor', 'text'],
    ['ubicacion', 'Ubicación', 'text'],
    ['fechaInicio', 'Fecha de inicio', 'date'],
    ['plazoDias', 'Plazo (días calendario)', 'number'],
    ['valor', 'Valor del contrato (COP)', 'number'],
  ];

  async function formProyecto(id) {
    const raiz = nuevaRaiz();
    const p = id ? await DB.obtener('proyectos', id) : { ubicacion: 'Santa Rosa del Sur, Bolívar', fechaInicio: UI.hoy() };
    if (!p) { location.hash = '#/'; return; }
    raiz.innerHTML = `<div class="cabecera"><a class="volver" href="${id ? `#/proyecto/${id}/datos` : '#/'}">← Volver</a>
        <h1>${id ? 'Editar proyecto' : 'Nuevo proyecto'}</h1></div>
      <form class="card" id="f-proy"><div class="grid g2">
        ${CAMPOS_PROYECTO.map(([k, l, t, ph]) => t === 'textarea'
          ? `<label class="campo ancho"><span>${l}</span><textarea name="${k}">${esc(p[k] || '')}</textarea></label>`
          : `<label class="campo"><span>${l}</span><input name="${k}" type="${t}"${t === 'number' ? ' inputmode="decimal" step="any"' : ''} value="${esc(p[k] ?? '')}" placeholder="${esc(ph || '')}"${k === 'nombre' ? ' required' : ''}></label>`).join('')}
        <div class="campo"><span>Coordenadas GPS</span><div class="fila"><input name="coordenadas" value="${esc(p.coordenadas || '')}" placeholder="lat, lon">
          <button type="button" class="btn" data-gps aria-label="Tomar ubicación actual">📍</button></div></div>
      </div><div class="acciones"><button class="btn pri" type="submit">Guardar proyecto</button></div></form>`;
    const form = $('#f-proy', raiz);
    $('[data-gps]', form).onclick = async () => {
      try { const u = await UI.ubicacion(); form.coordenadas.value = `${u.lat}, ${u.lon}`; }
      catch (err) { toast(err.message, 'error'); }
    };
    form.onsubmit = async ev => {
      ev.preventDefault();
      const datos = Object.fromEntries(new FormData(form));
      const nuevo = { ...p, ...datos, id: p.id || UI.uid(), creado: p.creado || new Date().toISOString() };
      await DB.guardar('proyectos', nuevo);
      toast('Proyecto guardado');
      location.hash = `#/proyecto/${nuevo.id}${id ? '/datos' : ''}`;
    };
  }

  async function vistaProyecto(id, tab) {
    const p = await DB.obtener('proyectos', id);
    if (!p) { location.hash = '#/'; return; }
    const raiz = nuevaRaiz();
    const t = avanceTiempo(p);
    raiz.innerHTML = `<div class="cabecera"><a class="volver" href="#/">← Proyectos</a><h1>${esc(p.nombre)}</h1>
        <p class="sub">${esc([p.ubicacion, p.contrato && 'Contrato ' + p.contrato].filter(Boolean).join(' · '))}</p>
        ${t ? `<div class="barra"><i style="width:${t.pct}%"></i></div><p class="sub">Día ${t.dias} de ${t.plazo} · ${num(t.pct, 0)} % del plazo transcurrido</p>` : ''}</div>
      <nav class="tabs">${[['bitacora', '📒 Bitácora'], ['cantidades', '🧮 Cantidades'], ['presupuesto', '💲 Presupuesto'], ['datos', '📋 Datos del proyecto']]
        .map(([k, l]) => `<a href="#/proyecto/${id}/${k}" class="${k === tab ? 'activo' : ''}">${l}</a>`).join('')}</nav><div id="tab"></div>`;
    const cont = $('#tab', raiz);
    if (tab === 'cantidades') return tabCantidades(cont, p);
    if (tab === 'presupuesto') return Presupuesto.tab(cont, p);
    if (tab === 'datos') return tabDatos(cont, p);
    return tabBitacora(cont, p);
  }

  async function tabBitacora(cont, p) {
    const regs = (await DB.porProyecto('bitacora', p.id)).sort((a, b) => b.numero - a.numero);
    cont.innerHTML = `<div class="acciones" style="margin:0 0 12px"><button class="btn pri" data-nuevo>+ Nuevo registro diario</button>
        ${regs.length ? '<button class="btn" data-pdf>📄 Informe completo (PDF)</button>' : ''}</div>
      <div class="card" style="padding:0">${regs.length ? regs.map(r => `<a class="lista-item" href="#/bitacora/${r.id}">
          <div class="num-reg">${r.numero}</div>
          <div style="flex:1;min-width:0"><strong>${esc(fechaLarga(r.fecha))}</strong><div class="sub recorte">${esc(Bitacora.resumen(r))}</div></div>
          <span class="chip ${r.estado === 'cerrado' ? 'ok' : ''}">${r.estado === 'cerrado' ? 'Cerrado' : 'Borrador'}</span></a>`).join('')
        : '<p class="vacio">Aún no hay registros. Cree el primero al iniciar la jornada.</p>'}</div>`;
    $('[data-nuevo]', cont).onclick = () => Bitacora.nuevo(p.id);
    const pdf = $('[data-pdf]', cont);
    if (pdf) pdf.onclick = () => { toast('Preparando informe…'); Reporte.proyecto(p.id); };
  }

  async function tabCantidades(cont, p) {
    const regs = (await DB.porProyecto('cantidades', p.id)).sort((a, b) => (a.creado < b.creado ? -1 : 1));
    cont.innerHTML = `${regs.length ? `<div class="acciones" style="margin:0 0 12px"><button class="btn" data-pdf>📄 Memoria de cantidades (PDF)</button></div>
      <div class="card" style="padding:0">${regs.map(r => {
        const def = Calc.porId(r.tipo);
        const dest = (r.resultado?.filas || []).filter(f => f.dest).slice(0, 4);
        return `<div class="lista-item"><div class="num-reg" style="font-size:26px">${def?.icono || '🧮'}</div>
          <a href="#/cant/${r.id}" style="flex:1;min-width:0;color:inherit;text-decoration:none"><strong>${esc(r.titulo)}</strong>
            <div class="sub">${esc(def?.nombre || r.tipo)} · ${esc(fechaCorta((r.modificado || r.creado || '').slice(0, 10)))}</div>
            <div class="chips">${dest.map(f => `<span class="chip">${esc(f.e.replace(/\s*\(.*\)/, '').trim())}: ${esc(Calc.valorTexto(f))} ${esc(f.u || '')}</span>`).join('')}</div></a>
          <button class="btn-icono" data-borrar="${r.id}" aria-label="Eliminar cálculo">🗑️</button></div>`;
      }).join('')}</div>` : ''}
      <h2 class="titulo-sec">Nuevo cálculo</h2><div class="tarjetas">${Calc.tarjetasHTML(p.id)}</div>`;
    const pdf = $('[data-pdf]', cont);
    if (pdf) pdf.onclick = () => Reporte.cantidades(p.id);
    cont.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-borrar]');
      if (!b || !(await UI.confirmar('¿Eliminar este cálculo?', { texto: 'Eliminar', peligro: true }))) return;
      await DB.borrar('cantidades', b.dataset.borrar);
      toast('Cálculo eliminado');
      enrutar();
    });
  }

  function tabDatos(cont, p) {
    const fila = (t, v) => `<tr><th>${esc(t)}</th><td>${esc(v || '—')}</td></tr>`;
    cont.innerHTML = `<div class="card"><table class="tabla datos"><tbody>
        ${CAMPOS_PROYECTO.filter(([k]) => !['nombre', 'valor', 'fechaInicio'].includes(k)).map(([k, l]) => fila(l.replace(' *', ''), p[k])).join('')}
        ${fila('Fecha de inicio', fechaLarga(p.fechaInicio))}${fila('Valor del contrato', p.valor ? moneda(p.valor) : '')}${fila('Coordenadas GPS', p.coordenadas)}
      </tbody></table>
      <div class="acciones"><a class="btn pri" href="#/proyecto/${p.id}/editar">✏️ Editar datos</a><button class="btn peligro" data-eliminar>Eliminar proyecto</button></div></div>`;
    $('[data-eliminar]', cont).onclick = async () => {
      if (!(await UI.confirmar(`Se eliminará "${p.nombre}" con toda su bitácora, fotos y cálculos. Esta acción no se puede deshacer.`, { texto: 'Eliminar todo', peligro: true }))) return;
      await DB.borrarProyecto(p.id);
      toast('Proyecto eliminado');
      location.hash = '#/';
    };
  }

  /* ---------- Ajustes ---------- */
  async function vistaAjustes() {
    const raiz = nuevaRaiz();
    const a = {};
    for (const k of ['empresa', 'nit', 'profesional', 'matricula', 'logo']) a[k] = await DB.ajuste(k, '');
    const sello = await DB.ajuste('sello', true);
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const persistente = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    raiz.innerHTML = `<div class="cabecera"><h1>Ajustes</h1><p class="sub">Estos datos aparecen en el encabezado y las firmas de los informes.</p></div>
      <section class="card"><h2>Empresa y profesional</h2><div class="grid g2">
        <label class="campo"><span>Empresa / razón social</span><input data-k="empresa" value="${esc(a.empresa)}"></label>
        <label class="campo"><span>NIT</span><input data-k="nit" value="${esc(a.nit)}"></label>
        <label class="campo"><span>Ingeniero responsable</span><input data-k="profesional" value="${esc(a.profesional)}"></label>
        <label class="campo"><span>Matrícula profesional (COPNIA)</span><input data-k="matricula" value="${esc(a.matricula)}"></label>
        <div class="campo"><span>Logo para informes</span><div class="fila" style="align-items:center">
          ${a.logo ? `<img class="logo-prev" src="${a.logo}" alt="Logo">` : '<span class="sub">Sin logo</span>'}
          <label class="btn sm">Cambiar<input type="file" accept="image/*" hidden data-logo></label>${a.logo ? '<button class="btn sm peligro" data-quitar-logo>Quitar</button>' : ''}</div></div>
        <label class="campo check"><input type="checkbox" data-sello${sello ? ' checked' : ''}><span>Estampar fecha, hora y proyecto en las fotos</span></label>
      </div></section>
      <section class="card"><h2>Copia de seguridad</h2>
        <p class="sub">Los datos viven solo en este dispositivo. Descargue una copia con frecuencia y guárdela en Drive o en el PC.</p>
        <div class="acciones"><button class="btn pri" data-exportar>⬇ Descargar copia (.json)</button>
          <label class="btn">⬆ Restaurar copia<input type="file" accept=".json,application/json" hidden data-importar></label></div>
        <p class="sub" style="margin-top:12px">${est ? `Espacio usado: ${num(est.usage / 1048576, 1)} MB de ${num(est.quota / 1073741824, 1)} GB disponibles. ` : ''}
          Almacenamiento persistente: ${persistente ? 'activado ✓' : 'no confirmado (instale la app para activarlo)'}.</p></section>
      <section class="card"><h2>Instalar en la tablet</h2><p class="sub">En Chrome abra el menú ⋮ y elija <b>Agregar a la pantalla principal</b> o <b>Instalar app</b>.
        Quedará como una aplicación más y funcionará sin conexión.</p></section>`;

    raiz.addEventListener('input', ev => {
      const k = ev.target.dataset.k;
      if (k) DB.guardarAjuste(k, ev.target.value.trim());
    });
    raiz.addEventListener('change', async ev => {
      const t = ev.target;
      if (t.matches('[data-sello]')) return DB.guardarAjuste('sello', t.checked);
      if (t.matches('[data-logo]') && t.files[0]) {
        await DB.guardarAjuste('logo', await UI.comprimirImagen(t.files[0], { max: 600, calidad: 0.9 }));
        return vistaAjustes();
      }
      if (t.matches('[data-importar]') && t.files[0]) {
        try {
          const datos = JSON.parse(await UI.leerArchivo(t.files[0], true));
          if (!(await UI.confirmar(`Se restaurarán ${datos.proyectos?.length || 0} proyecto(s). Los registros con el mismo identificador se reemplazarán.`))) return;
          await DB.importar(datos);
          toast('Copia restaurada');
          location.hash = '#/';
        } catch (err) { toast(err.message, 'error'); }
      }
    });
    raiz.addEventListener('click', async ev => {
      if (ev.target.closest('[data-quitar-logo]')) { await DB.guardarAjuste('logo', ''); vistaAjustes(); }
      if (ev.target.closest('[data-exportar]')) {
        const datos = await DB.exportar();
        UI.descargar(`obracampo-respaldo-${UI.hoy()}.json`, JSON.stringify(datos));
        toast('Copia descargada');
      }
    });
  }

  /* ---------- Arranque ---------- */
  window.addEventListener('hashchange', enrutar);
  enrutar();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(console.warn);
  navigator.storage?.persist?.();

  return { enrutar };
})();
