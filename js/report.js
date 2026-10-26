/* Informes técnicos en formato carta. Se generan como HTML de impresión: en la tablet use "Guardar como PDF". */
const Reporte = (() => {
  const { esc, num, fechaLarga, fechaCorta } = UI;
  const n = x => (Number.isFinite(+x) ? +x : 0);

  async function empresa() {
    const [nombre, nit, logo, profesional, matricula] = await Promise.all(
      ['empresa', 'nit', 'logo', 'profesional', 'matricula'].map(k => DB.ajuste(k, '')));
    return { nombre, nit, logo, profesional, matricula };
  }

  function encabezado(c, p, titulo, derecha) {
    return `<table class="r-enc"><tr>
        <td class="r-logo">${c.logo ? `<img src="${c.logo}" alt="">` : ''}</td>
        <td class="r-tit">${c.nombre ? `<div class="r-emp">${esc(c.nombre)}</div>` : ''}${c.nit ? `<div>NIT ${esc(c.nit)}</div>` : ''}<div class="r-doc">${esc(titulo)}</div></td>
        <td class="r-der">${derecha}</td></tr></table>
      ${p ? `<table class="r-tabla">
        <tr><th>Proyecto</th><td colspan="3">${esc(p.nombre)}</td></tr>
        ${p.objeto ? `<tr><th>Objeto</th><td colspan="3">${esc(p.objeto)}</td></tr>` : ''}
        <tr><th style="width:17%">Contrato No.</th><td style="width:33%">${esc(p.contrato || '—')}</td><th style="width:17%">Ubicación</th><td>${esc(p.ubicacion || '—')}</td></tr>
        <tr><th>Contratante</th><td>${esc(p.contratante || '—')}</td><th>Contratista</th><td>${esc(p.contratista || '—')}</td></tr>
        <tr><th>Interventoría</th><td>${esc(p.interventoria || '—')}</td><th>Residente</th><td>${esc(p.residente || '—')}</td></tr>
      </table>` : ''}`;
  }

  function tabla(columnas, filas, total) {
    if (!filas.length) return '<div class="r-texto">Sin registro.</div>';
    return `<table class="r-tabla"><tr>${columnas.map(([, t, w]) => `<th${w ? ` style="width:${w}"` : ''}>${esc(t)}</th>`).join('')}</tr>
      ${filas.map(f => `<tr>${columnas.map(([k, , , numerica]) => `<td${numerica ? ' class="n"' : ''}>${esc(f[k] ?? '')}</td>`).join('')}</tr>`).join('')}
      ${total ? `<tr class="total">${total}</tr>` : ''}</table>`;
  }

  const seccion = t => `<div class="r-sec">${esc(t)}</div>`;
  const texto = t => `<div class="r-texto">${esc(t || 'Sin observaciones.')}</div>`;

  function diaDeObra(p, fecha) {
    if (!p.fechaInicio || !fecha) return '';
    const dia = Math.round((new Date(fecha + 'T12:00:00') - new Date(p.fechaInicio + 'T12:00:00')) / 864e5) + 1;
    return `<br>Día de obra: <b>${dia}</b>${p.plazoDias ? ` de ${p.plazoDias}` : ''}`;
  }

  async function registroHTML(c, p, e) {
    const fotos = [];
    for (const f of e.fotos || []) {
      const d = await DB.obtener('fotos', f.id);
      if (d) fotos.push({ ...f, data: d.data });
    }
    const personal = (e.personal || []).filter(x => x.cargo || +x.cantidad);
    const totalPersonal = personal.reduce((s, x) => s + n(x.cantidad), 0);
    const derecha = `Registro No. <b>${e.numero}</b><br>Fecha: <b>${esc(fechaCorta(e.fecha))}</b>${diaDeObra(p, e.fecha)}<br>Estado: ${e.estado === 'cerrado' ? 'Cerrado' : 'Borrador'}`;
    return `<section class="r-hoja">
      ${encabezado(c, p, 'Bitácora de obra — Registro diario', derecha)}
      ${seccion('Datos de la jornada')}
      <table class="r-tabla">
        <tr><th style="width:17%">Fecha</th><td colspan="3">${esc(fechaLarga(e.fecha))}</td></tr>
        <tr><th>Horario</th><td style="width:33%">${esc(e.horaInicio)} a ${esc(e.horaFin)}</td><th style="width:17%">Ubicación GPS</th><td>${e.ubicacion ? `${e.ubicacion.lat}, ${e.ubicacion.lon}` : '—'}</td></tr>
        <tr><th>Clima mañana</th><td>${esc(e.climaManana)}</td><th>Clima tarde</th><td>${esc(e.climaTarde)}</td></tr>
        <tr><th>Horas de lluvia</th><td>${num(n(e.lluviaHoras), 1)}</td><th>Condición</th><td>${esc(e.condicion)}</td></tr>
      </table>
      ${seccion(`Personal en obra (${totalPersonal})`)}
      ${tabla([['cargo', 'Cargo'], ['cantidad', 'Cantidad', '18%', true]], personal, personal.length ? `<td>Total</td><td class="n">${totalPersonal}</td>` : '')}
      ${seccion('Equipos y maquinaria')}
      ${tabla([['descripcion', 'Equipo'], ['cantidad', 'Cant.', '10%', true], ['horas', 'Horas', '10%', true], ['estado', 'Estado', '20%']], (e.equipos || []).filter(x => x.descripcion))}
      ${seccion('Materiales recibidos')}
      ${tabla([['material', 'Material'], ['cantidad', 'Cant.', '10%', true], ['unidad', 'Und.', '8%'], ['proveedor', 'Proveedor', '22%'], ['remision', 'Remisión', '15%']], (e.materiales || []).filter(x => x.material))}
      ${seccion('Actividades ejecutadas')}
      ${tabla([['item', 'Ítem', '8%'], ['descripcion', 'Descripción'], ['cantidad', 'Cant.', '10%', true], ['unidad', 'Und.', '8%'], ['avance', 'Avance %', '10%', true]], (e.actividades || []).filter(x => x.descripcion))}
      ${seccion('Observaciones generales e incidencias')}${texto(e.observaciones)}
      ${e.instrucciones ? seccion('Órdenes e instrucciones de interventoría') + texto(e.instrucciones) : ''}
      ${e.sst ? seccion('Seguridad y salud en el trabajo y ambiental') + texto(e.sst) : ''}
      ${e.visitas ? seccion('Visitas a la obra') + texto(e.visitas) : ''}
      ${fotos.length ? seccion('Registro fotográfico') + `<div class="r-fotos">${fotos.map((f, i) => `<div class="r-foto"><img src="${f.data}" alt=""><div><b>Foto ${i + 1}.</b> ${esc(f.desc || '')}</div></div>`).join('')}</div>` : ''}
      <div class="r-firmas">${Object.values(e.firmas || {}).map(f => `<div class="r-firma"><div class="img">${f.img ? `<img src="${f.img}" alt="">` : ''}</div>
        <div class="linea"><b>${esc(f.nombre || '')}</b><br>${esc(f.cargo || '')}</div></div>`).join('')}</div>
      <div class="r-pie">Generado con ObraCampo · ${new Date().toLocaleString('es-CO')}</div>
    </section>`;
  }

  async function cantidadesHTML(c, p) {
    const regs = (await DB.porProyecto('cantidades', p.id)).sort((a, b) => (a.creado < b.creado ? -1 : 1));
    if (!regs.length) return '';
    const derecha = `Fecha: <b>${esc(fechaCorta(UI.hoy()))}</b><br>Cálculos: <b>${regs.length}</b>`;
    return `<section class="r-hoja">${encabezado(c, p, 'Memoria de cantidades de obra', derecha)}
      ${regs.map((r, i) => {
        const def = Calc.porId(r.tipo);
        return `<div class="r-titulo-calc">${i + 1}. ${esc(r.titulo)} <span style="font-weight:400">— ${esc(def?.nombre || r.tipo)}</span></div>
          ${seccion('Datos de entrada')}${Calc.entradasHTML(r)}
          ${seccion('Resultados')}${Calc.resultadoHTML(r.resultado, 'r-tabla', false)}
          ${(r.resultado.notas || []).map(x => `<div class="r-nota">Nota: ${esc(x)}</div>`).join('')}`;
      }).join('')}
      ${c.profesional ? `<div class="r-firmas"><div class="r-firma"><div class="img"></div><div class="linea"><b>${esc(c.profesional)}</b><br>${c.matricula ? `Matrícula profesional ${esc(c.matricula)}` : ''}</div></div></div>` : ''}
      <div class="r-pie">Valores de referencia; verificar contra diseños y especificaciones técnicas. Generado con ObraCampo · ${new Date().toLocaleString('es-CO')}</div>
    </section>`;
  }

  async function imprimir(html, titulo) {
    const zona = document.getElementById('print-area');
    zona.innerHTML = html;
    await Promise.all([...zona.querySelectorAll('img')].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
    document.title = titulo; // Chrome usa el título como nombre del PDF
    window.print();
  }

  const nombreArchivo = t => t.replace(/[\\/:*?"<>|]+/g, '').slice(0, 90);

  return {
    async bitacora(id) {
      const e = await DB.obtener('bitacora', id);
      const p = await DB.obtener('proyectos', e.proyectoId);
      const c = await empresa();
      imprimir(await registroHTML(c, p, e), nombreArchivo(`Bitacora ${e.numero} - ${p.nombre} - ${e.fecha}`));
    },
    async proyecto(pid) {
      const p = await DB.obtener('proyectos', pid);
      const c = await empresa();
      const regs = (await DB.porProyecto('bitacora', pid)).sort((a, b) => a.numero - b.numero);
      let html = '';
      for (const e of regs) html += await registroHTML(c, p, e);
      imprimir(html + await cantidadesHTML(c, p), nombreArchivo(`Informe de obra - ${p.nombre}`));
    },
    async cantidades(pid) {
      const p = await DB.obtener('proyectos', pid);
      imprimir(await cantidadesHTML(await empresa(), p), nombreArchivo(`Memoria de cantidades - ${p.nombre}`));
    },
    // Piezas reutilizadas por los informes de presupuesto y APU
    empresa, encabezado, seccion, imprimir, nombreArchivo,
  };
})();
