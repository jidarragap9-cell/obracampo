/* Presupuesto de obra por capítulos con AIU (administración, imprevistos y utilidad) e IVA sobre la utilidad. */
const Presupuesto = (() => {
  const { esc, $, uid, toast, moneda, num } = UI;
  const n = x => (Number.isFinite(+x) ? +x : 0);
  const nuevo = pid => ({ proyectoId: pid, aiu: { a: 10, i: 2, u: 5, iva: 19 }, capitulos: [] });

  /* ---------- Valor en letras (pesos colombianos) ---------- */
  const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE',
    'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO',
    'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function cientos(v) {
    if (v === 100) return 'CIEN';
    const r = v % 100;
    const decenas = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ' Y ' + UNIDADES[r % 10] : '');
    return [CENTENAS[Math.floor(v / 100)], decenas].filter(Boolean).join(' ');
  }
  function letras(v) {
    if (v === 0) return 'CERO';
    const millones = Math.floor(v / 1e6), miles = Math.floor((v % 1e6) / 1000), resto = v % 1000;
    return [
      millones ? (millones === 1 ? 'UN MILLÓN' : letras(millones) + ' MILLONES') : '',
      miles ? (miles === 1 ? 'MIL' : cientos(miles) + ' MIL') : '',
      resto ? cientos(resto) : '',
    ].filter(Boolean).join(' ');
  }
  function valorEnLetras(valor) {
    const v = Math.round(Math.abs(valor));
    return `${letras(v)}${v >= 1e6 && v % 1e6 === 0 ? ' DE' : ''} ${v === 1 ? 'PESO' : 'PESOS'} M/CTE`;
  }

  /* ---------- Cálculo ---------- */
  const valorItem = (it, vuDe) => Math.round(n(it.cantidad) * vuDe(it.apuId));

  function totales(pres, vuDe) {
    const capitulos = pres.capitulos.map(c => c.items.reduce((s, it) => s + valorItem(it, vuDe), 0));
    const directo = capitulos.reduce((s, v) => s + v, 0);
    const a = Math.round(directo * n(pres.aiu.a) / 100);
    const i = Math.round(directo * n(pres.aiu.i) / 100);
    const u = Math.round(directo * n(pres.aiu.u) / 100);
    const iva = Math.round(u * n(pres.aiu.iva) / 100);
    return { capitulos, directo, a, i, u, iva, total: directo + a + i + u + iva };
  }

  const filasResumen = (t, aiu) => [
    ['Costo directo', t.directo],
    [`Administración (${num(n(aiu.a), 1)} %)`, t.a],
    [`Imprevistos (${num(n(aiu.i), 1)} %)`, t.i],
    [`Utilidad (${num(n(aiu.u), 1)} %)`, t.u],
    [`IVA sobre la utilidad (${num(n(aiu.iva), 1)} %)`, t.iva],
  ];

  async function contexto(pid) {
    const [apusLista, insumos, guardado] = await Promise.all([DB.todos('apus'), Precios.mapaInsumos(), DB.obtener('presupuestos', pid)]);
    const apus = new Map(apusLista.map(a => [a.id, a]));
    const vu = new Map(apusLista.map(a => [a.id, Precios.calcular(a, insumos).total]));
    return { apusLista: apusLista.sort(Precios.ordenar), apus, vuDe: id => vu.get(id) || 0, pres: guardado || nuevo(pid) };
  }

  /* ---------- Pestaña del proyecto ---------- */
  async function tab(cont, p) {
    const { apusLista, apus, vuDe, pres } = await contexto(p.id);
    if (!apusLista.length) {
      cont.innerHTML = `<div class="card"><h2>Primero arme la base de precios</h2>
        <p class="sub">El presupuesto se construye con los análisis de precios unitarios (APU) de la base de precios.</p>
        <div class="acciones"><button class="btn pri" data-base>Cargar base de ejemplo</button><a class="btn" href="#/precios/apu">Ir a la base de precios</a></div></div>`;
      $('[data-base]', cont).onclick = async () => { await Precios.cargarBase(); App.enrutar(); };
      return;
    }
    let temporizador;
    const guardar = () => { clearTimeout(temporizador); temporizador = setTimeout(() => DB.guardar('presupuestos', pres), 600); };
    const opcionesApu = [['', '— Seleccione una actividad —'], ...apusLista.map(a => [a.id, `${a.codigo} · ${a.descripcion}`])];
    const capitulosBase = [...new Set(apusLista.map(a => a.capitulo).filter(Boolean))];

    cont.innerHTML = `<datalist id="dl-capitulos">${capitulosBase.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="dos-col">
        <section class="card"><h2>AIU</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
          ${[['a', 'Administración'], ['i', 'Imprevistos'], ['u', 'Utilidad'], ['iva', 'IVA sobre utilidad']].map(([k, l]) =>
            `<label class="campo"><span>${l} (%)</span><input type="number" inputmode="decimal" step="any" data-aiu="${k}" value="${esc(pres.aiu[k])}"></label>`).join('')}
          </div>
          <div class="acciones"><button class="btn pri" data-acc="pdf">📄 Presupuesto (PDF)</button>
            <button class="btn" data-acc="apus">📄 APU usados (PDF)</button><button class="btn" data-acc="csv">⬇ Excel (CSV)</button></div></section>
        <aside class="card"><h2>Resumen del presupuesto</h2><div id="pres-res"></div></aside>
      </div>
      <div id="capitulos"></div>
      <div class="acciones" style="margin:0 0 16px"><button class="btn" data-acc="capitulo">+ Agregar capítulo</button></div>`;

    function actualizar() {
      const t = totales(pres, vuDe);
      t.capitulos.forEach((v, ci) => { const el = cont.querySelector(`[data-subcap="${ci}"]`); if (el) el.textContent = moneda(v); });
      const dif = n(p.valor) ? t.total - n(p.valor) : null;
      $('#pres-res', cont).innerHTML = `<table class="tabla res-tabla"><tbody>
          ${filasResumen(t, pres.aiu).map(([e, v]) => `<tr><td>${esc(e)}</td><td class="num">${moneda(v)}</td></tr>`).join('')}
          <tr class="dest"><td>Valor total</td><td class="num">${moneda(t.total)}</td></tr></tbody></table>
        <p class="sub" style="margin-top:8px">${esc(valorEnLetras(t.total))}</p>
        ${dif !== null ? `<p class="sub" style="margin-top:8px">Valor del contrato: ${moneda(n(p.valor))}. El presupuesto ${dif > 0 ? 'lo supera' : 'queda por debajo'} en ${moneda(Math.abs(dif))}.</p>` : ''}`;
    }

    function pintarCapitulos() {
      const zona = $('#capitulos', cont);
      zona.replaceChildren();
      pres.capitulos.forEach((cap, ci) => {
        const sec = document.createElement('section');
        sec.className = 'card';
        sec.innerHTML = `<div class="fila" style="align-items:center;margin-bottom:10px">
            <strong class="num-reg" style="min-width:32px">${ci + 1}</strong>
            <input data-cap="${ci}" value="${esc(cap.nombre)}" list="dl-capitulos" placeholder="Nombre del capítulo (ej.: Cimentación)" aria-label="Nombre del capítulo">
            <span class="chip" data-subcap="${ci}"></span>
            <button type="button" class="btn-icono" data-quitar-cap="${ci}" aria-label="Eliminar capítulo">🗑️</button></div><div></div>`;
        zona.append(sec);
        UI.tablaEditable(sec.lastElementChild, [
          { id: 'num', titulo: 'Ítem', tipo: 'calc', texto: true, f: it => `${ci + 1}.${cap.items.indexOf(it) + 1}` },
          { id: 'apuId', titulo: 'Actividad (APU)', tipo: 'select', opciones: opcionesApu, ancho: '46%' },
          { id: 'und', titulo: 'Und.', tipo: 'calc', texto: true, f: it => apus.get(it.apuId)?.unidad || '' },
          { id: 'cantidad', titulo: 'Cantidad', tipo: 'number' },
          { id: 'vu', titulo: 'V. unitario', tipo: 'calc', texto: true, alinearDerecha: true, f: it => moneda(vuDe(it.apuId)) },
          { id: 'vp', titulo: 'V. parcial', tipo: 'calc', texto: true, alinearDerecha: true, f: it => moneda(valorItem(it, vuDe)) },
        ], cap.items, () => { actualizar(); guardar(); }, { nuevaFila: () => ({ id: uid(), apuId: '', cantidad: '' }), textoAgregar: '+ Agregar ítem' });
      });
      actualizar();
    }
    pintarCapitulos();

    cont.addEventListener('input', ev => {
      const d = ev.target.dataset;
      if (d.aiu) { pres.aiu[d.aiu] = ev.target.value === '' ? '' : parseFloat(ev.target.value); actualizar(); guardar(); }
      if (d.cap !== undefined) { pres.capitulos[+d.cap].nombre = ev.target.value; guardar(); }
    });
    cont.addEventListener('click', async ev => {
      const quitar = ev.target.closest('[data-quitar-cap]');
      if (quitar) {
        const cap = pres.capitulos[+quitar.dataset.quitarCap];
        if (cap.items.length && !(await UI.confirmar(`¿Eliminar el capítulo "${cap.nombre || 'sin nombre'}" con sus ${cap.items.length} ítems?`, { texto: 'Eliminar', peligro: true }))) return;
        pres.capitulos.splice(+quitar.dataset.quitarCap, 1);
        pintarCapitulos();
        guardar();
        return;
      }
      switch (ev.target.closest('[data-acc]')?.dataset.acc) {
        case 'capitulo':
          pres.capitulos.push({ id: uid(), nombre: '', items: [{ id: uid(), apuId: '', cantidad: '' }] });
          pintarCapitulos();
          guardar();
          cont.querySelector(`[data-cap="${pres.capitulos.length - 1}"]`).focus();
          break;
        case 'pdf': clearTimeout(temporizador); await DB.guardar('presupuestos', pres); pdf(p.id); break;
        case 'apus': {
          const usados = new Set(pres.capitulos.flatMap(c => c.items.map(i => i.apuId)));
          const lista = apusLista.filter(a => usados.has(a.id));
          if (!lista.length) { toast('Aún no hay actividades en el presupuesto'); break; }
          Precios.pdfAPUs(lista, p);
          break;
        }
        case 'csv': clearTimeout(temporizador); await DB.guardar('presupuestos', pres); csv(p.id); break;
      }
    });
  }

  /* ---------- Informes ---------- */
  async function pdf(pid) {
    const p = await DB.obtener('proyectos', pid);
    const { apus, vuDe, pres } = await contexto(pid);
    const c = await Reporte.empresa();
    const t = totales(pres, vuDe);
    const filas = pres.capitulos.map((cap, ci) => `<tr class="r-cap"><td>${ci + 1}</td><td colspan="4">${esc(cap.nombre || `Capítulo ${ci + 1}`)}</td><td class="n">${moneda(t.capitulos[ci])}</td></tr>
      ${cap.items.filter(it => it.apuId).map((it, ii) => {
        const apu = apus.get(it.apuId);
        return `<tr><td>${ci + 1}.${ii + 1}</td><td>${esc(apu?.descripcion || '(APU eliminado)')}</td><td>${esc(apu?.unidad || '')}</td>
          <td class="n">${num(n(it.cantidad), 2)}</td><td class="n">${moneda(vuDe(it.apuId))}</td><td class="n">${moneda(valorItem(it, vuDe))}</td></tr>`;
      }).join('')}`).join('');
    const derecha = `Fecha: <b>${esc(UI.fechaCorta(UI.hoy()))}</b><br>Capítulos: <b>${pres.capitulos.length}</b>`;
    const html = `<section class="r-hoja">${Reporte.encabezado(c, p, 'Presupuesto de obra', derecha)}
      <table class="r-tabla"><tr><th style="width:7%">Ítem</th><th>Descripción</th><th style="width:7%">Und.</th><th style="width:10%">Cantidad</th>
        <th style="width:14%">V. unitario</th><th style="width:15%">V. parcial</th></tr>${filas}</table>
      <table class="r-tabla r-resumen">${filasResumen(t, pres.aiu).map(([e, v]) => `<tr><th>${esc(e)}</th><td class="n">${moneda(v)}</td></tr>`).join('')}
        <tr class="total"><th>VALOR TOTAL</th><td class="n">${moneda(t.total)}</td></tr></table>
      <div class="r-texto" style="border-top:1px solid #000;margin-top:6px"><b>Valor en letras:</b> ${esc(valorEnLetras(t.total))}</div>
      ${c.profesional ? `<div class="r-firmas"><div class="r-firma"><div class="img"></div><div class="linea"><b>${esc(c.profesional)}</b><br>${c.matricula ? `Matrícula profesional ${esc(c.matricula)}` : ''}</div></div></div>` : ''}
      <div class="r-pie">Precios en pesos colombianos. Generado con ObraCampo · ${new Date().toLocaleString('es-CO')}</div></section>`;
    Reporte.imprimir(html, Reporte.nombreArchivo(`Presupuesto - ${p.nombre}`));
  }

  async function csv(pid) {
    const p = await DB.obtener('proyectos', pid);
    const { apus, vuDe, pres } = await contexto(pid);
    const t = totales(pres, vuDe);
    const decimal = v => n(v).toFixed(2).replace('.', ',');
    const filas = [[p.nombre], [], ['Ítem', 'Descripción', 'Unidad', 'Cantidad', 'Valor unitario', 'Valor parcial']];
    pres.capitulos.forEach((cap, ci) => {
      filas.push([ci + 1, (cap.nombre || `Capítulo ${ci + 1}`).toUpperCase(), '', '', '', t.capitulos[ci]]);
      cap.items.filter(it => it.apuId).forEach((it, ii) => {
        const apu = apus.get(it.apuId);
        filas.push([`${ci + 1}.${ii + 1}`, apu?.descripcion || '(APU eliminado)', apu?.unidad || '', decimal(it.cantidad), vuDe(it.apuId), valorItem(it, vuDe)]);
      });
    });
    filas.push([]);
    for (const [e, v] of filasResumen(t, pres.aiu)) filas.push(['', e, '', '', '', v]);
    filas.push(['', 'VALOR TOTAL', '', '', '', t.total], ['', valorEnLetras(t.total)]);
    UI.descargar(Reporte.nombreArchivo(`Presupuesto - ${p.nombre}`) + '.csv', '﻿' + filas.map(Precios.filaCSV).join('\r\n'), 'text/csv;charset=utf-8');
  }

  return { tab, valorEnLetras };
})();
