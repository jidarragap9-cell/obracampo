/* Bitácora de obra: registro diario con clima, personal, equipos, materiales, actividades, fotos y firmas. */
const Bitacora = (() => {
  const { esc, $, $$, uid, toast } = UI;

  const CLIMAS = ['Soleado', 'Parcialmente nublado', 'Nublado', 'Lluvia ligera', 'Lluvia fuerte', 'Tormenta eléctrica'];
  const CONDICIONES = ['Normal', 'Afectada parcialmente', 'Suspendida'];
  const CARGOS = ['Director de obra', 'Ingeniero residente', 'Maestro de obra', 'Oficial', 'Ayudante', 'Armador', 'Carpintero', 'Soldador',
    'Electricista', 'Plomero', 'Operador de maquinaria', 'Conductor', 'Inspector SST', 'Topógrafo', 'Cadenero', 'Almacenista', 'Vigilante'];
  const EQUIPOS = ['Mezcladora', 'Vibrador de concreto', 'Retroexcavadora', 'Volqueta', 'Vibrocompactador (rana)', 'Canguro', 'Motoniveladora',
    'Andamio', 'Formaleta metálica', 'Motobomba', 'Cortadora de concreto', 'Planta eléctrica', 'Pulidora', 'Taladro', 'Estación total', 'Nivel de precisión'];
  const MATERIALES = ['Cemento gris', 'Arena de río', 'Arena de pega', 'Triturado 3/4"', 'Recebo', 'Acero de refuerzo', 'Alambre negro', 'Bloque #4',
    'Bloque #5', 'Ladrillo tolete', 'Concreto premezclado', 'Tubería PVC sanitaria', 'Tubería PVC presión', 'Puntilla', 'Madera / tabla'];
  const UNIDADES = ['un', 'm', 'm²', 'm³', 'kg', 'ton', 'bto', 'gl', 'viaje', 'día', 'h', 'global'];
  const conOpciones = lista => lista.map(x => [x, x]);

  const resumen = r => {
    const personas = (r.personal || []).reduce((s, p) => s + (+p.cantidad || 0), 0);
    const act = (r.actividades || []).map(a => a.descripcion).filter(Boolean).join('; ');
    return `${personas} personas · ${r.climaManana} · ${act || 'Sin actividades registradas'}`;
  };

  async function nuevo(pid) {
    const p = await DB.obtener('proyectos', pid);
    const lista = await DB.porProyecto('bitacora', pid);
    const numero = lista.reduce((m, b) => Math.max(m, b.numero || 0), 0) + 1;
    const e = {
      id: uid(), proyectoId: pid, numero, fecha: UI.hoy(), horaInicio: '07:00', horaFin: '17:00',
      climaManana: 'Soleado', climaTarde: 'Soleado', lluviaHoras: 0, condicion: 'Normal',
      personal: [{ cargo: 'Maestro de obra', cantidad: 1 }, { cargo: 'Oficial', cantidad: 0 }, { cargo: 'Ayudante', cantidad: 0 }],
      equipos: [], materiales: [], actividades: [{ item: '', descripcion: '', cantidad: '', unidad: 'm²', avance: '' }],
      observaciones: '', instrucciones: '', sst: '', visitas: '', fotos: [],
      firmas: {
        residente: { nombre: p?.residente || '', cargo: 'Residente de obra', img: null },
        interventor: { nombre: p?.interventor || '', cargo: 'Interventor / supervisor', img: null },
      },
      ubicacion: null, estado: 'borrador', creado: new Date().toISOString(),
    };
    await DB.guardar('bitacora', e);
    location.hash = `#/bitacora/${e.id}`;
  }

  const campo = (etiqueta, html, clase = '') => `<label class="campo ${clase}"><span>${etiqueta}</span>${html}</label>`;
  const selectHTML = (clave, opciones, valor) => `<select data-campo="${clave}">${opciones.map(o => `<option${o === valor ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const textoUbicacion = u => (u ? `${u.lat}, ${u.lon} (±${u.precision} m)` : 'Sin registrar');

  async function editor(contenedor, id) {
    const e = await DB.obtener('bitacora', id);
    if (!e) { contenedor.innerHTML = '<div class="card"><p class="vacio">Registro no encontrado.</p></div>'; return; }
    // Raíz propia por vista para que los eventos no queden pegados a #main.
    const main = document.createElement('div');
    const p = await DB.obtener('proyectos', e.proyectoId);
    const cerrado = e.estado === 'cerrado';
    const datosFoto = {};
    for (const f of e.fotos) datosFoto[f.id] = (await DB.obtener('fotos', f.id))?.data;

    let temporizador;
    const estado = t => { const s = $('#estado-guardado', main); if (s) s.textContent = t; };
    const guardarYa = async () => { e.modificado = new Date().toISOString(); await DB.guardar('bitacora', e); estado('Guardado ✓'); };
    const guardar = () => {
      if (cerrado) return;
      clearTimeout(temporizador);
      estado('Guardando…');
      temporizador = setTimeout(guardarYa, 600);
    };

    main.innerHTML = `<div class="cabecera">
        <a class="volver" href="#/proyecto/${p.id}/bitacora">← ${esc(p.nombre)}</a>
        <div class="fila-tit"><h1>Bitácora · Registro No. ${e.numero}</h1>
          <span class="chip ${cerrado ? 'ok' : ''}">${cerrado ? '🔒 Cerrado' : 'Borrador'}</span><span id="estado-guardado" class="sub"></span></div>
        <div class="acciones"><button class="btn" data-acc="pdf">📄 Ver / exportar PDF</button>
          ${cerrado ? '' : `<button class="btn" data-acc="copiar">⧉ Copiar personal y equipos del registro anterior</button>
          <button class="btn pri" data-acc="cerrar">🔒 Cerrar registro</button><button class="btn peligro" data-acc="eliminar">Eliminar</button>`}</div>
      </div>
      <fieldset class="editor"${cerrado ? ' disabled' : ''}>
        <section class="card"><h2>Datos generales</h2><div class="grid">
          ${campo('Fecha', `<input type="date" data-campo="fecha" value="${esc(e.fecha)}">`)}
          ${campo('Hora de inicio', `<input type="time" data-campo="horaInicio" value="${esc(e.horaInicio)}">`)}
          ${campo('Hora de finalización', `<input type="time" data-campo="horaFin" value="${esc(e.horaFin)}">`)}
          <div class="campo"><span>Ubicación GPS</span><div class="fila"><input id="txt-ubicacion" value="${esc(textoUbicacion(e.ubicacion))}" readonly><button type="button" class="btn" data-acc="gps" aria-label="Registrar ubicación">📍</button></div></div>
        </div></section>
        <section class="card"><h2>Condiciones climáticas</h2><div class="grid">
          ${campo('Clima en la mañana', selectHTML('climaManana', CLIMAS, e.climaManana))}
          ${campo('Clima en la tarde', selectHTML('climaTarde', CLIMAS, e.climaTarde))}
          ${campo('Horas de lluvia', `<input type="number" inputmode="decimal" step="0.5" min="0" data-campo="lluviaHoras" value="${esc(e.lluviaHoras)}">`)}
          ${campo('Condición de los trabajos', selectHTML('condicion', CONDICIONES, e.condicion))}
        </div></section>
        <section class="card"><h2>Personal en obra <span class="chip" id="tot-personal"></span></h2><div id="t-personal"></div></section>
        <section class="card"><h2>Equipos y maquinaria</h2><div id="t-equipos"></div></section>
        <section class="card"><h2>Materiales recibidos</h2><div id="t-materiales"></div></section>
        <section class="card"><h2>Actividades ejecutadas</h2><div id="t-actividades"></div></section>
        <section class="card"><h2>Observaciones</h2><div class="grid g2">
          ${campo('Observaciones generales e incidencias', `<textarea data-campo="observaciones">${esc(e.observaciones)}</textarea>`)}
          ${campo('Órdenes e instrucciones de interventoría', `<textarea data-campo="instrucciones">${esc(e.instrucciones)}</textarea>`)}
          ${campo('Seguridad y salud en el trabajo (SST) y ambiental', `<textarea data-campo="sst">${esc(e.sst)}</textarea>`)}
          ${campo('Visitas a la obra', `<textarea data-campo="visitas">${esc(e.visitas)}</textarea>`)}
        </div></section>
        <section class="card"><h2>Registro fotográfico</h2>
          <div class="acciones solo-edicion" style="margin-top:0">
            <label class="btn pri">📷 Tomar foto<input type="file" accept="image/*" capture="environment" hidden data-fotos></label>
            <label class="btn">🖼️ Desde galería<input type="file" accept="image/*" multiple hidden data-fotos></label></div>
          <div id="fotos" class="fotos"></div></section>
        <section class="card"><h2>Firmas</h2><div class="grid g2" id="firmas"></div></section>
      </fieldset>`;
    contenedor.replaceChildren(main);

    const editorEl = $('fieldset.editor', main);

    const totalPersonal = () => { $('#tot-personal', main).textContent = `${e.personal.reduce((s, x) => s + (+x.cantidad || 0), 0)} personas`; };
    UI.tablaEditable($('#t-personal', main), [
      { id: 'cargo', titulo: 'Cargo', tipo: 'text', ancho: '70%', sugerencias: CARGOS },
      { id: 'cantidad', titulo: 'Cantidad', tipo: 'number' },
    ], e.personal, () => { totalPersonal(); guardar(); }, { nuevaFila: () => ({ cargo: '', cantidad: 1 }) });
    totalPersonal();
    UI.tablaEditable($('#t-equipos', main), [
      { id: 'descripcion', titulo: 'Equipo', tipo: 'text', ancho: '45%', sugerencias: EQUIPOS },
      { id: 'cantidad', titulo: 'Cant.', tipo: 'number' },
      { id: 'horas', titulo: 'Horas', tipo: 'number' },
      { id: 'estado', titulo: 'Estado', tipo: 'select', opciones: conOpciones(['Operativo', 'Stand-by', 'Varado', 'En mantenimiento']) },
    ], e.equipos, guardar, { nuevaFila: () => ({ descripcion: '', cantidad: 1, horas: 8, estado: 'Operativo' }) });
    UI.tablaEditable($('#t-materiales', main), [
      { id: 'material', titulo: 'Material', tipo: 'text', ancho: '34%', sugerencias: MATERIALES },
      { id: 'cantidad', titulo: 'Cant.', tipo: 'number' },
      { id: 'unidad', titulo: 'Unidad', tipo: 'text', sugerencias: UNIDADES },
      { id: 'proveedor', titulo: 'Proveedor', tipo: 'text' },
      { id: 'remision', titulo: 'Remisión / factura', tipo: 'text' },
    ], e.materiales, guardar, { nuevaFila: () => ({ material: '', cantidad: '', unidad: 'un', proveedor: '', remision: '' }) });
    UI.tablaEditable($('#t-actividades', main), [
      { id: 'item', titulo: 'Ítem', tipo: 'text', ancho: '9%' },
      { id: 'descripcion', titulo: 'Descripción de la actividad', tipo: 'text', ancho: '45%' },
      { id: 'cantidad', titulo: 'Cant.', tipo: 'number' },
      { id: 'unidad', titulo: 'Unidad', tipo: 'text', sugerencias: UNIDADES },
      { id: 'avance', titulo: 'Avance %', tipo: 'number' },
    ], e.actividades, guardar, { nuevaFila: () => ({ item: '', descripcion: '', cantidad: '', unidad: 'm²', avance: '' }) });

    function pintarFotos() {
      $('#fotos', main).innerHTML = e.fotos.length ? e.fotos.map((f, i) => `<figure class="foto">
          <img src="${datosFoto[f.id] || ''}" data-ver="${i}" alt="Foto ${i + 1}">
          <figcaption><input data-desc="${i}" value="${esc(f.desc)}" placeholder="Descripción de la foto ${i + 1}" aria-label="Descripción de la foto ${i + 1}">
          <span class="acciones-foto solo-edicion"><button type="button" class="btn sm" data-anotar="${i}">✏️ Anotar</button>
          <button type="button" class="btn sm peligro" data-qfoto="${i}" aria-label="Eliminar foto">✕</button></span></figcaption></figure>`).join('')
        : '<p class="vacio">Sin fotos. Use la cámara para documentar el avance de obra.</p>';
    }
    function pintarFirmas() {
      $('#firmas', main).innerHTML = Object.entries(e.firmas).map(([k, f]) => `<div class="firma">
          <div class="firma-img">${f.img ? `<img src="${f.img}" alt="Firma de ${esc(f.nombre)}">` : '<span>Sin firma</span>'}</div>
          <input data-fnombre="${k}" value="${esc(f.nombre)}" placeholder="Nombre completo" aria-label="Nombre">
          <input data-fcargo="${k}" value="${esc(f.cargo)}" placeholder="Cargo" aria-label="Cargo">
          <button type="button" class="btn sm solo-edicion" data-firmar="${k}">✍️ Firmar con el lápiz</button></div>`).join('');
    }
    pintarFotos();
    pintarFirmas();

    editorEl.addEventListener('input', ev => {
      const t = ev.target, d = t.dataset;
      if (d.campo) e[d.campo] = t.type === 'number' ? (t.value === '' ? '' : parseFloat(t.value)) : t.value;
      else if (d.desc !== undefined) e.fotos[+d.desc].desc = t.value;
      else if (d.fnombre) e.firmas[d.fnombre].nombre = t.value;
      else if (d.fcargo) e.firmas[d.fcargo].cargo = t.value;
      else return;
      guardar();
    });

    editorEl.addEventListener('change', async ev => {
      if (!ev.target.matches('[data-fotos]')) return;
      const archivos = [...ev.target.files];
      ev.target.value = '';
      if (!archivos.length) return;
      const sello = await DB.ajuste('sello', true);
      toast(`Procesando ${archivos.length} foto(s)…`);
      for (const archivo of archivos) {
        const fecha = new Date();
        const texto = sello ? `${fecha.toLocaleDateString('es-CO')} ${fecha.toTimeString().slice(0, 5)} · ${p.nombre}${e.ubicacion ? ` · ${e.ubicacion.lat}, ${e.ubicacion.lon}` : ''}` : '';
        const data = await UI.comprimirImagen(archivo, { sello: texto });
        const f = { id: uid(), desc: '' };
        await DB.guardar('fotos', { id: f.id, registroId: e.id, proyectoId: e.proyectoId, data });
        datosFoto[f.id] = data;
        e.fotos.push(f);
      }
      pintarFotos();
      await guardarYa();
    });

    main.addEventListener('click', async ev => {
      const b = ev.target.closest('button, img[data-ver]');
      if (!b || !main.contains(b)) return;
      const d = b.dataset;
      if (d.ver !== undefined) return UI.verImagen(datosFoto[e.fotos[+d.ver].id], e.fotos[+d.ver].desc || `Foto ${+d.ver + 1}`);
      if (d.anotar !== undefined) {
        const f = e.fotos[+d.anotar];
        const nueva = await UI.lienzo({ titulo: 'Anotar sobre la foto', fondo: datosFoto[f.id] });
        if (nueva) {
          datosFoto[f.id] = nueva;
          await DB.guardar('fotos', { id: f.id, registroId: e.id, proyectoId: e.proyectoId, data: nueva });
          pintarFotos();
        }
        return;
      }
      if (d.qfoto !== undefined) {
        if (!(await UI.confirmar('¿Eliminar esta foto?', { texto: 'Eliminar', peligro: true }))) return;
        const [f] = e.fotos.splice(+d.qfoto, 1);
        await DB.borrar('fotos', f.id);
        pintarFotos();
        return guardarYa();
      }
      if (d.firmar) {
        const img = await UI.lienzo({ titulo: `Firma — ${e.firmas[d.firmar].cargo}` });
        if (img) { e.firmas[d.firmar].img = img; pintarFirmas(); guardarYa(); }
        return;
      }
      switch (d.acc) {
        case 'gps':
          try {
            toast('Obteniendo ubicación…');
            e.ubicacion = await UI.ubicacion();
            $('#txt-ubicacion', main).value = textoUbicacion(e.ubicacion);
            guardarYa();
          } catch (err) { toast(err.message, 'error'); }
          break;
        case 'pdf':
          clearTimeout(temporizador);
          if (!cerrado) await guardarYa();
          Reporte.bitacora(e.id);
          break;
        case 'copiar': {
          const anterior = (await DB.porProyecto('bitacora', e.proyectoId)).filter(x => x.numero < e.numero).sort((a, b) => b.numero - a.numero)[0];
          if (!anterior) { toast('No hay un registro anterior'); break; }
          e.personal = structuredClone(anterior.personal);
          e.equipos = structuredClone(anterior.equipos);
          await guardarYa();
          editor(contenedor, e.id);
          toast(`Copiado del registro No. ${anterior.numero}`);
          break;
        }
        case 'cerrar': {
          const aviso = e.firmas.residente.img ? '' : ' Aún no tiene la firma del residente.';
          if (!(await UI.confirmar(`Al cerrar el registro No. ${e.numero} ya no se podrá modificar, igual que en el libro de obra físico.${aviso} ¿Desea cerrarlo?`, { texto: 'Cerrar registro' }))) break;
          clearTimeout(temporizador);
          e.estado = 'cerrado';
          e.cerradoEn = new Date().toISOString();
          await guardarYa();
          editor(contenedor, e.id);
          toast('Registro cerrado');
          break;
        }
        case 'eliminar':
          if (!(await UI.confirmar(`¿Eliminar el registro No. ${e.numero} y sus fotos? Esta acción no se puede deshacer.`, { texto: 'Eliminar', peligro: true }))) break;
          clearTimeout(temporizador);
          await DB.borrarRegistro(e.id);
          toast('Registro eliminado');
          location.hash = `#/proyecto/${e.proyectoId}/bitacora`;
          break;
      }
    });
  }

  return { nuevo, editor, resumen };
})();
