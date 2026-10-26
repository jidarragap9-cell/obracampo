/* Utilidades de interfaz: formato, modales, lienzo para firmas y anotaciones, fotos y tablas editables. */
const UI = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

  function hoy() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  const horaActual = () => new Date().toTimeString().slice(0, 5);
  const num = (v, dec = 2) => (Number.isFinite(v) ? v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—');
  const moneda = v => (Number.isFinite(+v) && v !== '' ? (+v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) : '—');
  const fechaLarga = iso => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '');
  const fechaCorta = iso => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

  let temporizadorToast;
  function toast(msg, tipo = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'visible ' + tipo;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => (t.className = ''), 2800);
  }

  /* Ventana modal. Un botón cuya acción devuelve false deja la ventana abierta. */
  function modal({ titulo, cuerpo, botones = [], alCerrar, ancho, fijo = false }) {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true"${ancho ? ` style="max-width:${ancho}"` : ''}>
      <header><h3>${esc(titulo)}</h3><button type="button" class="btn-icono" data-x aria-label="Cerrar">✕</button></header>
      <div class="modal-cuerpo"></div><footer></footer></div>`;
    const caja = $('.modal-cuerpo', fondo);
    if (typeof cuerpo === 'string') caja.innerHTML = cuerpo;
    else if (cuerpo) caja.append(cuerpo);
    let cerrado = false;
    const cerrar = motivo => {
      if (cerrado) return;
      cerrado = true;
      fondo.remove();
      alCerrar && alCerrar(motivo);
    };
    const pie = $('footer', fondo);
    for (const b of botones) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn ' + (b.clase || '');
      el.textContent = b.texto;
      el.onclick = async () => {
        const r = b.accion ? await b.accion(caja) : undefined;
        if (r !== false) cerrar('boton');
      };
      pie.append(el);
    }
    $('[data-x]', fondo).onclick = () => cerrar('x');
    if (!fijo) fondo.addEventListener('pointerdown', e => { if (e.target === fondo) cerrar('fondo'); });
    document.body.append(fondo);
    return { fondo, caja, cerrar };
  }

  function confirmar(mensaje, { texto = 'Aceptar', peligro = false } = {}) {
    return new Promise(resolve => {
      let ok = false;
      modal({
        titulo: 'Confirmar', cuerpo: `<p style="margin:0">${esc(mensaje)}</p>`,
        botones: [{ texto: 'Cancelar' }, { texto, clase: peligro ? 'peligro' : 'pri', accion: () => { ok = true; } }],
        alCerrar: () => resolve(ok),
      });
    });
  }

  function verImagen(src, titulo = 'Foto') {
    modal({ titulo, cuerpo: `<img class="ver" src="${src}" alt="">`, ancho: '1000px' });
  }

  const cargarImagen = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  /* Lienzo para firmar o anotar sobre una foto. Optimizado para lápiz (presión y rechazo de palma). */
  async function lienzo({ titulo = 'Dibujar', fondo = null, ancho = 900, alto = 300 } = {}) {
    let img = null;
    if (fondo) {
      img = await cargarImagen(fondo);
      ancho = img.naturalWidth;
      alto = img.naturalHeight;
    }
    return new Promise(resolve => {
      const cv = document.createElement('canvas');
      cv.width = ancho;
      cv.height = alto;
      cv.className = 'lienzo';
      const ctx = cv.getContext('2d');
      const historial = [];
      const pintarFondo = () => {
        if (img) ctx.drawImage(img, 0, 0);
        else { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ancho, alto); }
      };
      pintarFondo();

      const colores = fondo ? ['#e53935', '#fdd835', '#1e88e5', '#ffffff', '#111111'] : ['#111111', '#1e3a8a'];
      let color = colores[0];
      const grosor = fondo ? Math.max(3, ancho / 260) : 3.2;
      let dibujando = false, ultimo = null, conLapiz = false, trazos = 0;

      const pos = e => {
        const r = cv.getBoundingClientRect();
        return { x: (e.clientX - r.left) * ancho / r.width, y: (e.clientY - r.top) * alto / r.height };
      };
      cv.addEventListener('pointerdown', e => {
        if (e.pointerType === 'pen') conLapiz = true;
        if (conLapiz && e.pointerType === 'touch') return; // rechazo de palma cuando se usa el lápiz
        e.preventDefault();
        historial.push(ctx.getImageData(0, 0, ancho, alto));
        if (historial.length > 20) historial.shift();
        dibujando = true;
        ultimo = pos(e);
        cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener('pointermove', e => {
        if (!dibujando || (conLapiz && e.pointerType === 'touch')) return;
        const p = pos(e);
        const presion = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
        ctx.strokeStyle = color;
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.lineWidth = grosor * (0.4 + presion * 1.2);
        ctx.beginPath();
        ctx.moveTo(ultimo.x, ultimo.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ultimo = p;
        trazos++;
      });
      const fin = () => { dibujando = false; };
      cv.addEventListener('pointerup', fin);
      cv.addEventListener('pointercancel', fin);

      const cuerpo = document.createElement('div');
      cuerpo.innerHTML = `<div class="herramientas">${colores.map((c, i) => `<button type="button" class="color${i ? '' : ' activo'}" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}
        <span style="flex:1"></span><button type="button" class="btn sm" data-deshacer>↶ Deshacer</button><button type="button" class="btn sm" data-limpiar>Limpiar</button></div>`;
      cuerpo.append(cv);
      cuerpo.addEventListener('click', e => {
        const c = e.target.closest('[data-color]');
        if (c) { color = c.dataset.color; $$('.color', cuerpo).forEach(b => b.classList.toggle('activo', b === c)); }
        if (e.target.closest('[data-deshacer]') && historial.length) ctx.putImageData(historial.pop(), 0, 0);
        if (e.target.closest('[data-limpiar]')) { historial.length = 0; pintarFondo(); trazos = 0; }
      });

      let resultado = null;
      modal({
        titulo, cuerpo, fijo: true, ancho: fondo ? '1100px' : '760px',
        botones: [
          { texto: 'Cancelar' },
          { texto: 'Guardar', clase: 'pri', accion: () => { if (trazos) resultado = cv.toDataURL(fondo ? 'image/jpeg' : 'image/png', 0.85); } },
        ],
        alCerrar: () => resolve(resultado),
      });
    });
  }

  /* Reduce la foto (máx. 1600 px) y opcionalmente le estampa fecha, hora y proyecto. */
  async function comprimirImagen(archivo, { max = 1600, calidad = 0.78, sello = '' } = {}) {
    const url = URL.createObjectURL(archivo);
    try {
      const img = await cargarImagen(url);
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      if (sello) {
        const fs = Math.max(14, Math.round(w / 48));
        const pad = Math.round(fs * 0.5);
        ctx.font = `600 ${fs}px system-ui, sans-serif`;
        const tw = Math.min(ctx.measureText(sello).width, w - pad * 2);
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, h - fs - pad * 2, tw + pad * 2, fs + pad * 2);
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.fillText(sello, pad, h - (fs + pad * 2) / 2, w - pad * 2);
      }
      return cv.toDataURL('image/jpeg', calidad);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const leerArchivo = (archivo, comoTexto = false) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    comoTexto ? r.readAsText(archivo) : r.readAsDataURL(archivo);
  });

  function descargar(nombre, contenido, tipo = 'application/json') {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function ubicacion() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('GPS no disponible'));
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), precision: Math.round(p.coords.accuracy) }),
        e => reject(new Error(e.code === 1 ? 'Permiso de ubicación denegado' : 'No se pudo obtener la ubicación')),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
      );
    });
  }

  /* Tabla editable. Modifica `filas` en el sitio y llama alCambiar() en cada edición.
     Columnas: { id, titulo, tipo: 'text'|'number'|'select'|'calc', opciones, sugerencias, ancho, f (para calc), dec, texto (calc que devuelve texto) } */
  function tablaEditable(cont, columnas, filas, alCambiar, { nuevaFila = () => ({}), textoAgregar = '+ Agregar fila' } = {}) {
    const listas = columnas.filter(c => c.sugerencias).map(c => {
      c._lista = 'dl-' + uid();
      return `<datalist id="${c._lista}">${c.sugerencias.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
    }).join('');
    const formatoCalc = (c, f) => (c.texto ? c.f(f) : num(c.f(f), c.dec ?? 2));

    function celda(c, f, i) {
      const val = f[c.id] ?? '';
      if (c.tipo === 'calc') return `<td class="${c.texto && !c.alinearDerecha ? '' : 'num '}calc" data-calc="${c.id}">${esc(formatoCalc(c, f))}</td>`;
      if (c.tipo === 'select') {
        return `<td><select data-i="${i}" data-c="${c.id}" aria-label="${esc(c.titulo)}">${c.opciones.map(([v, t]) =>
          `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td>`;
      }
      const numero = c.tipo === 'number';
      return `<td><input type="${numero ? 'number' : 'text'}"${numero ? ' inputmode="decimal" step="any"' : ''} data-i="${i}" data-c="${c.id}"
        value="${esc(val)}"${c._lista ? ` list="${c._lista}"` : ''} aria-label="${esc(c.titulo)}" placeholder="${esc(c.placeholder || '')}"></td>`;
    }

    function pintar() {
      cont.innerHTML = `${listas}<div class="tabla-scroll"><table class="tabla editable"><thead><tr>${columnas.map(c => `<th${c.ancho ? ` style="width:${c.ancho}"` : ''}>${esc(c.titulo)}</th>`).join('')}<th class="acc"></th></tr></thead>
        <tbody>${filas.map((f, i) => `<tr>${columnas.map(c => celda(c, f, i)).join('')}<td class="acc"><button type="button" class="btn-icono" data-quitar="${i}" aria-label="Quitar fila">✕</button></td></tr>`).join('')
        || `<tr><td colspan="${columnas.length + 1}" class="vacio">Sin filas</td></tr>`}</tbody></table></div>
        <button type="button" class="btn sm" data-agregar>${esc(textoAgregar)}</button>`;
    }

    cont.addEventListener('input', e => {
      const el = e.target;
      if (!el.dataset.c) return;
      const i = +el.dataset.i;
      const c = columnas.find(x => x.id === el.dataset.c);
      filas[i][c.id] = c.tipo === 'number' ? (el.value === '' ? '' : parseFloat(el.value)) : el.value;
      const tr = el.closest('tr');
      for (const cc of columnas.filter(x => x.tipo === 'calc')) tr.querySelector(`[data-calc="${cc.id}"]`).textContent = formatoCalc(cc, filas[i]);
      alCambiar();
    });
    cont.addEventListener('click', e => {
      const q = e.target.closest('[data-quitar]');
      if (q) { filas.splice(+q.dataset.quitar, 1); pintar(); alCambiar(); return; }
      if (e.target.closest('[data-agregar]')) {
        filas.push(nuevaFila());
        pintar();
        alCambiar();
        $('tbody tr:last-child input, tbody tr:last-child select', cont)?.focus();
      }
    });
    pintar();
  }

  return {
    esc, uid, $, $$, hoy, horaActual, num, moneda, fechaLarga, fechaCorta, toast, modal, confirmar, verImagen,
    lienzo, comprimirImagen, leerArchivo, descargar, ubicacion, tablaEditable,
  };
})();
