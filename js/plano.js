/* Planos: dibujo en planta por capas (tipo BIM), estructura automática, vista 3D, cantidades, PDF y DXF. */
const Planos = (() => {
  const E = Elementos;
  const { esc, $, $$, toast, num } = UI;

  const ICONOS = {
    sel: '<path d="M5 3l14 8-6 2-2 6z"/>',
    muro: '<rect x="3" y="9" width="18" height="6"/><path d="M6 15l4-6M11 15l4-6M16 15l4-6"/>',
    columna: '<rect x="6" y="6" width="12" height="12" fill="currentColor"/>',
    viga: '<path d="M3 9h18M3 15h18" stroke-dasharray="3 2"/>',
    vigaCim: '<path d="M3 8h18M3 14h18" stroke-dasharray="3 2"/><path d="M3 19h18"/>',
    zapata: '<rect x="3" y="3" width="18" height="18" stroke-dasharray="3 2"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/>',
    puerta: '<path d="M3 20h5M17 20h4M8 20V8"/><path d="M8 8a12 12 0 0 1 12 12" stroke-dasharray="2 2"/>',
    ventana: '<rect x="3" y="9" width="18" height="6"/><path d="M3 11.2h18M3 12.8h18"/>',
    cubierta: '<path d="M2 12l10-7 10 7"/><path d="M5 10.5V19h14v-8.5" stroke-dasharray="3 2"/>',
    cota: '<path d="M4 13h16M4 9v8M20 9v8M3 15l3-4M18 15l3-4"/>',
    bloque: '<circle cx="12" cy="10" r="6"/><path d="M12 16v5M9 21h6"/>',
    generico: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    mano: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-3 0-4.5-1.5-6.5-4.5L3 14a1.5 1.5 0 0 1 2.4-1.8L8 15"/>',
    deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    rehacer: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  };
  const icono = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS[k]}</svg>`;

  const HERRAMIENTAS = [
    ['sel', 'Selec.'], ['muro', 'Muro'], ['columna', 'Columna'], ['viga', 'Viga aérea'], ['vigaCim', 'Viga cim.'], ['zapata', 'Zapata'],
    ['puerta', 'Puerta'], ['ventana', 'Ventana'], ['cubierta', 'Cubierta'], ['generico', 'Elemento'], ['bloque', 'Bloques'], ['cota', 'Cota'], ['mano', 'Mover'],
  ];
  const LINEALES = ['muro', 'viga', 'vigaCim'];
  const CADENA = [...LINEALES, 'cota', 'cubierta'];
  const BARRAS_OPC = [['', 'Automático'], ...Object.entries(Calc.BARRAS).map(([k, b]) => [k, b.t])];

  const AYUDA = {
    sel: 'Toque un elemento para ver y editar sus propiedades. Arrástrelo para moverlo, o arrastre los extremos de muros y vigas para alargarlos (los muros unidos se mueven con él).',
    muro: 'Toque el punto inicial y siga tocando para encadenar muros. Para una medida exacta escriba la longitud arriba y pulse Enter. Termine con ✓, tocando dos veces el último punto o cerrando en el primero.',
    columna: 'Toque donde va la columna. Si la pone sobre un muro, se orienta con él.',
    viga: 'Viga aérea (de amarre o corona). Se dibuja igual que un muro.',
    vigaCim: 'Viga de cimentación. Se dibuja igual que un muro.',
    zapata: 'Toque el centro de la zapata. Si toca una columna, se centra bajo ella.',
    puerta: 'Toque sobre un muro. La puerta abre hacia el lado del muro donde tocó.',
    ventana: 'Toque sobre un muro para insertar la ventana.',
    cubierta: 'Toque los vértices del contorno de apoyo (eje de los muros) y cierre tocando el primer punto. El alero se proyecta solo con la medida que indique.',
    cota: 'Toque dos puntos para acotar. Luego puede arrastrar la cota para separarla.',
    bloque: 'Elija el bloque en la galería y toque el plano para colocarlo. Puede girarlo y escalarlo.',
    generico: 'Toque donde va el elemento. Defina nombre, medidas, color y cómo se mide para las cantidades. Guárdelo en la biblioteca para usarlo en otros planos.',
    mano: 'Arrastre para mover la vista. Con dos dedos puede mover y hacer zoom con cualquier herramienta.',
  };

  const CAMPOS = {
    muro: () => [['unidad', 'Ladrillo o bloque', 'sel', Object.entries(E.MAMPOSTERIA).map(([k, u]) => [k, u.t])], ['alto', 'Altura del muro (m)'],
      ['panete', 'Caras con pañete', 'sel', [[0, 'Ninguna'], [1, 'Una cara'], [2, 'Dos caras']]]],
    columna: () => [['b', 'Lado b (m) — a lo largo del muro'], ['h', 'Lado h (m)'], ['alto', 'Altura desde el piso (m)'], ['angG', 'Giro (°)']],
    viga: () => [['base', 'Base (m)'], ['altura', 'Altura (m)']],
    vigaCim: () => [['base', 'Base (m)'], ['altura', 'Altura (m)']],
    zapata: () => [['B', 'Ancho B (m) — eje X'], ['L', 'Largo L (m) — eje Y'], ['h', 'Espesor h (m)'], ['prof', 'Profundidad de desplante (m)']],
    puerta: () => [['ancho', 'Ancho (m)'], ['alto', 'Alto (m)'], ['estilo', 'Tipo', 'sel', [['batiente', 'Batiente'], ['doble', 'Doble hoja'], ['corrediza', 'Corrediza']]],
      ['giro', 'Bisagra', 'sel', [['izq', 'Al inicio del muro'], ['der', 'Al final del muro']]], ['lado', 'Abre hacia', 'sel', [[1, 'Lado A'], [-1, 'Lado B']]]],
    ventana: () => [['ancho', 'Ancho (m)'], ['alto', 'Alto (m)'], ['antepecho', 'Antepecho (m)']],
    cubierta: el => {
      const t = E.TEJAS[el.teja] || E.TEJAS.zinc;
      const d = E.datosCubierta(el);
      const perfil = (pre, tit) => [[pre + 'Perfil', `${tit}: perfil`, 'sel', E.opcionesPerfil()], [pre + 'Medida', `${tit}: medida`, 'sel', E.opcionesMedida(d[pre + 'Perfil'])],
        ...(E.PERFILES[d[pre + 'Perfil']]?.cal ? [[pre + 'Cal', `${tit}: calibre`, 'sel', E.opcionesCalibre()]] : [])];
      return [['—', 'Forma y teja'], ['forma', 'Forma', 'sel', [['dos', 'Dos aguas'], ['una', 'Una agua']]],
        ['dir', 'Sentido de la pendiente', 'sel', [['y', 'Norte – sur (eje Y)'], ['x', 'Oriente – occidente (eje X)']]],
        ['pendiente', 'Pendiente (%)'], ['alero', 'Alero (m)'],
        ['teja', 'Teja', 'sel', Object.entries(E.TEJAS).map(([k, x]) => [k, x.t])],
        ['util', 'Ancho útil (m)', 'num', null, num(t.util, 3)], ['traslapo', 'Traslapo longitudinal (m)', 'num', null, num(t.traslapo, 2)],
        ['sep', 'Separación máx. de correas (m)', 'num', null, num(t.sep, 2)],
        ['—', 'Estructura (se genera sola)'],
        ['apoyo', 'Apoyo de las correas', 'sel', [['muros', 'Sobre muros (culatas)'], ['cerchas', 'Cerchas metálicas']]],
        ...perfil('correa', 'Correas'),
        ...(d.apoyo === 'cerchas' ? [['sepCerchas', 'Separación máx. de cerchas (m)'], ...perfil('cordon', 'Cordones'), ...perfil('celosia', 'Celosía')] : [])];
    },
    bloque: () => [['escala', 'Escala'], ['angG', 'Giro (°)']],
    generico: () => [['nombre', 'Nombre', 'txt'], ['material', 'Material o descripción', 'txt'], ['L', 'Largo (m)'], ['A', 'Ancho (m)'], ['H', 'Alto (m)'],
      ['z', 'Elevación de la base (m)'], ['angG', 'Giro (°)'], ['color', 'Color', 'sel', E.COLORES],
      ['medida', 'Se mide en', 'sel', [['un', 'Unidades (un)'], ['m', 'Metros (largo)'], ['m²', 'm² (largo × ancho)'], ['m³', 'm³ (volumen)']]]],
    cota: () => [['off', 'Separación de la cota (m)']],
  };
  const TEXTO = new Set(['unidad', 'teja', 'simbolo', 'long', 'estribo', 'forma', 'dir', 'apoyo', 'estilo', 'giro', 'nombre', 'material', 'color', 'medida',
    ...['correa', 'cordon', 'celosia'].flatMap(p => [p + 'Perfil', p + 'Medida', p + 'Cal'])]);

  /* ---------- Lista ---------- */
  const tarjeta = nombres => pl => `<a class="card tarjeta" href="#/plano/${pl.id}"><h2>${esc(pl.nombre)}</h2>
      <p class="sub">${esc(pl.proyectoId ? nombres[pl.proyectoId] || 'Proyecto eliminado' : 'Sin proyecto')} · ${esc(E.SISTEMAS[pl.cfg?.sistema || 'E'].split(' — ')[0])}</p>
      <div class="estadisticas"><span class="chip">${pl.elementos?.length || 0} elementos</span><span class="chip">${esc(UI.fechaCorta((pl.modificado || '').slice(0, 10)))}</span></div></a>`;

  async function lista(raiz) {
    const [planos, proyectos] = await Promise.all([DB.todos('planos'), DB.todos('proyectos')]);
    const nombres = Object.fromEntries(proyectos.map(p => [p.id, p.nombre]));
    planos.sort((a, b) => (b.modificado || '').localeCompare(a.modificado || ''));
    raiz.innerHTML = `<div class="cabecera"><h1>Planos y modelado</h1>
        <p class="sub">Dibuje muros, columnas, vigas, zapatas, puertas, ventanas y cubierta por capas. La app calcula materiales, acero de refuerzo y alambre, y muestra el isométrico.</p>
        <div class="acciones"><button class="btn pri" data-nuevo>+ Nuevo plano</button></div></div>
      ${planos.length ? `<div class="tarjetas">${planos.map(tarjeta(nombres)).join('')}</div>` : '<div class="card"><p class="vacio">Aún no hay planos. Cree el primero.</p></div>'}
      <h2 class="titulo-sec">Prediseño</h2>
      <div class="tarjetas">
        <a class="card tarjeta" href="#/contencion"><div class="ico-tarjeta">🧱</div><h2>Muro de contención</h2>
          <p class="sub">Muro en voladizo: predimensionado, chequeo de volcamiento, deslizamiento y presiones, y cantidades.</p></a>
        <div class="card tarjeta deshabilitada"><div class="ico-tarjeta">🌉</div><h2>Puentes</h2><p class="sub">Próximamente: prediseño de puentes peatonales y vehiculares.</p></div>
      </div>`;
    $('[data-nuevo]', raiz).onclick = () => crear();
  }

  async function tab(cont, p) {
    const planos = (await DB.porProyecto('planos', p.id)).sort((a, b) => (b.modificado || '').localeCompare(a.modificado || ''));
    cont.innerHTML = `<div class="acciones" style="margin:0 0 12px"><button class="btn pri" data-nuevo>+ Nuevo plano</button></div>
      ${planos.length ? `<div class="tarjetas">${planos.map(tarjeta({ [p.id]: p.nombre })).join('')}</div>` : '<div class="card"><p class="vacio">Este proyecto aún no tiene planos.</p></div>'}`;
    $('[data-nuevo]', cont).onclick = () => crear(p.id);
  }

  async function crear(pid = null) {
    const proyectos = await DB.todos('proyectos');
    UI.modal({
      titulo: 'Nuevo plano',
      cuerpo: `<div class="grid g2">
        <label class="campo"><span>Nombre del plano</span><input data-nombre value="Planta primer piso"></label>
        <label class="campo"><span>Proyecto</span><select data-proy><option value="">Sin proyecto</option>
          ${proyectos.map(p => `<option value="${p.id}"${p.id === pid ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Sistema estructural</span><select data-sis>${Object.entries(E.SISTEMAS).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select></label>
        <label class="campo"><span>Número de pisos</span><select data-pisos><option value="1">1 piso</option><option value="2">2 pisos</option></select></label></div>`,
      botones: [{ texto: 'Cancelar' }, {
        texto: 'Crear y dibujar', clase: 'pri', accion: async caja => {
          const pl = E.nuevoPlano($('[data-proy]', caja).value || null, $('[data-nombre]', caja).value.trim() || 'Plano');
          pl.cfg.sistema = $('[data-sis]', caja).value;
          pl.cfg.pisos = +$('[data-pisos]', caja).value;
          if (pl.cfg.sistema === 'DMO') Object.assign(pl.plantillas.viga, { base: 0.25, altura: 0.30 });
          await DB.guardar('planos', pl);
          location.hash = `#/plano/${pl.id}`;
        },
      }],
    });
  }

  /* ---------- Bloques: símbolos en planta (en metros, centrados) ---------- */
  const LINEA = '#3a3f47', VERDE = '#4a7c3a', HOJA = '#cfe3c1', HOJA2 = '#b8d6a3', VIDRIO = '#bcd2e6', LOZA = '#ffffff', AGUA = '#e3eef7', TELA = '#dfe7f1';
  function festoneado(g, r, n) {
    g.beginPath();
    for (let j = 0; j <= n * 10; j++) {
      const a = j * 2 * Math.PI / (n * 10), rr = r * (0.88 + 0.12 * Math.abs(Math.sin(a * n / 2)));
      j ? g.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : g.moveTo(rr, 0);
    }
    g.closePath();
  }
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  const pinta = (g, relleno) => { if (relleno) { g.fillStyle = relleno; g.fill(); } g.stroke(); };
  const caja = (g, x, y, w, h, r = 0, relleno = LOZA) => { rr(g, x, y, w, h, r); pinta(g, relleno); };
  const elipse = (g, x, y, rx, ry, relleno = LOZA) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); pinta(g, relleno); };
  const traza = (g, ...p) => { g.beginPath(); for (let i = 0; i < p.length; i += 2) i ? g.lineTo(p[i], p[i + 1]) : g.moveTo(p[i], p[i + 1]); g.stroke(); };
  const sombra = (g, r) => { g.save(); g.fillStyle = 'rgba(40,50,40,.10)'; g.beginPath(); g.ellipse(r * 0.12, r * 0.12, r, r, 0, 0, 7); g.fill(); g.restore(); };
  function silla2d(g, x, y, dx, dy) {
    caja(g, x - 0.2, y - 0.2, 0.4, 0.4, 0.05, '#f6f1ea');
    g.save(); g.lineWidth *= 1.8;
    if (Math.abs(dx) > Math.abs(dy)) traza(g, x - dx * 0.2, y - 0.18, x - dx * 0.2, y + 0.18); else traza(g, x - 0.18, y - dy * 0.2, x + 0.18, y - dy * 0.2);
    g.restore();
  }
  function cama2d(g, w) {
    caja(g, -w / 2, -0.95, w, 1.9, 0.04);
    caja(g, -w / 2 - 0.02, -1.0, w + 0.04, 0.07, 0.02, '#d9c7ae');
    const n = w > 1.2 ? [[-w / 2 + 0.08, w / 2 - 0.12], [0.04, w / 2 - 0.12]] : [[-w / 2 + 0.1, w - 0.2]];
    for (const [x, ww] of n) caja(g, x, -0.88, ww, 0.3, 0.08, '#f1f4f8');
    caja(g, -w / 2, -0.4, w, 1.35, 0.03, TELA);
    traza(g, -w / 2, -0.25, w / 2, -0.25);
    traza(g, w / 2 - 0.35, -0.4, w / 2, -0.05);
  }
  // [título, categoría, radio de selección (m), dibujo]
  const BLOQUES = {
    arbol: ['Árbol', 'Vegetación', 1.5, g => {
      sombra(g, 1.45);
      festoneado(g, 1.5, 14); g.strokeStyle = VERDE; pinta(g, HOJA);
      festoneado(g, 1.0, 10); g.fillStyle = HOJA2; g.fill();
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; g.moveTo(0, 0); g.lineTo(1.05 * Math.cos(a), 1.05 * Math.sin(a)); } g.stroke();
      elipse(g, 0, 0, 0.13, 0.13, '#7a5230');
    }],
    arbusto: ['Arbusto', 'Vegetación', 0.6, g => { sombra(g, 0.58); festoneado(g, 0.6, 9); g.strokeStyle = VERDE; pinta(g, HOJA); festoneado(g, 0.35, 7); g.fillStyle = HOJA2; g.fill(); }],
    palma: ['Palma', 'Vegetación', 1.6, g => {
      sombra(g, 1.5); g.strokeStyle = VERDE;
      for (let i = 0; i < 9; i++) {
        const a = i * 2 * Math.PI / 9, c = Math.cos(a), s = Math.sin(a), n = { x: -s, y: c };
        g.beginPath(); g.moveTo(0.12 * c, 0.12 * s);
        g.quadraticCurveTo(0.8 * c + 0.28 * n.x, 0.8 * s + 0.28 * n.y, 1.6 * c, 1.6 * s);
        g.quadraticCurveTo(0.8 * c - 0.28 * n.x, 0.8 * s - 0.28 * n.y, 0.12 * c, 0.12 * s);
        pinta(g, i % 2 ? HOJA : HOJA2);
        traza(g, 0.12 * c, 0.12 * s, 1.55 * c, 1.55 * s);
      }
      elipse(g, 0, 0, 0.16, 0.16, '#8a6a4a');
    }],
    carro: ['Carro', 'Vehículos y personas', 2.3, g => {
      for (const [x, y] of [[-0.95, -1.35], [0.95, -1.35], [-0.95, 1.35], [0.95, 1.35]]) caja(g, x - 0.1, y - 0.3, 0.2, 0.6, 0.06, '#3a3f47');
      caja(g, -0.9, -2.15, 1.8, 4.3, 0.42, '#f5f7fa');
      g.beginPath(); g.moveTo(-0.72, -0.62); g.lineTo(-0.62, -1.18); g.lineTo(0.62, -1.18); g.lineTo(0.72, -0.62); g.closePath(); pinta(g, VIDRIO);
      caja(g, -0.7, -0.55, 1.4, 1.45, 0.12, '#e7ecf2');
      g.beginPath(); g.moveTo(-0.7, 0.95); g.lineTo(0.7, 0.95); g.lineTo(0.6, 1.35); g.lineTo(-0.6, 1.35); g.closePath(); pinta(g, VIDRIO);
      traza(g, -0.55, -1.5, -0.6, -2.0); traza(g, 0.55, -1.5, 0.6, -2.0);
      caja(g, -1.05, -0.7, 0.15, 0.12, 0.03, '#e7ecf2'); caja(g, 0.9, -0.7, 0.15, 0.12, 0.03, '#e7ecf2');
    }],
    moto: ['Motocicleta', 'Vehículos y personas', 1.0, g => {
      caja(g, -0.07, -0.95, 0.14, 0.4, 0.06, '#3a3f47'); caja(g, -0.07, 0.55, 0.14, 0.4, 0.06, '#3a3f47');
      elipse(g, 0, 0, 0.17, 0.55, '#e7ecf2'); traza(g, -0.38, -0.55, 0.38, -0.55); elipse(g, 0, 0.2, 0.12, 0.25, '#cfd8e3');
    }],
    persona: ['Persona', 'Vehículos y personas', 0.35, g => { elipse(g, 0, 0, 0.3, 0.15, '#dfe6ee'); elipse(g, 0, 0, 0.11, 0.11, '#c9b39b'); }],
    inodoro: ['Sanitario', 'Baño', 0.45, g => {
      caja(g, -0.22, -0.37, 0.44, 0.17, 0.03);
      elipse(g, 0, 0.08, 0.19, 0.27); elipse(g, 0, 0.11, 0.12, 0.18, AGUA);
    }],
    lavamanos: ['Lavamanos', 'Baño', 0.36, g => { caja(g, -0.28, -0.23, 0.56, 0.46, 0.06); elipse(g, 0, 0.03, 0.2, 0.14, AGUA); elipse(g, 0, -0.15, 0.03, 0.03, '#9aa3ad'); }],
    ducha: ['Ducha', 'Baño', 0.64, g => {
      caja(g, -0.45, -0.45, 0.9, 0.9, 0, '#f3f7fa');
      g.save(); g.strokeStyle = '#b9c3cc'; traza(g, -0.45, -0.45, 0.45, 0.45); traza(g, 0.45, -0.45, -0.45, 0.45); g.restore();
      elipse(g, 0, 0, 0.05, 0.05, '#cfd8e3'); elipse(g, 0.36, -0.36, 0.06, 0.06, '#cfd8e3');
    }],
    estufa: ['Estufa', 'Cocina y ropas', 0.42, g => {
      caja(g, -0.3, -0.3, 0.6, 0.6, 0.03, '#f4f6f9');
      for (const [x, y] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) { elipse(g, x, y, 0.1, 0.1, '#e1e5ea'); elipse(g, x, y, 0.05, 0.05, '#c3cad3'); }
    }],
    lavaplatos: ['Lavaplatos', 'Cocina y ropas', 0.66, g => {
      caja(g, -0.6, -0.27, 1.2, 0.54, 0.03); caja(g, -0.52, -0.2, 0.56, 0.4, 0.06, AGUA); elipse(g, -0.24, 0, 0.03, 0.03, '#9aa3ad');
      g.beginPath(); for (let x = 0.12; x < 0.55; x += 0.08) { g.moveTo(x, -0.18); g.lineTo(x, 0.18); } g.stroke();
    }],
    nevera: ['Nevera', 'Cocina y ropas', 0.5, g => { caja(g, -0.35, -0.35, 0.7, 0.7, 0.04, '#f4f6f9'); traza(g, -0.35, 0.22, 0.35, 0.22); caja(g, 0.18, 0.25, 0.12, 0.05, 0.02, '#cfd8e3'); }],
    lavadero: ['Lavadero', 'Cocina y ropas', 0.58, g => {
      caja(g, -0.3, -0.5, 0.6, 1.0, 0.04, '#eef1f4'); caja(g, -0.24, -0.44, 0.48, 0.42, 0.04, AGUA);
      g.beginPath(); for (let y = 0.05; y < 0.46; y += 0.06) { g.moveTo(-0.22, y); g.lineTo(0.22, y); } g.stroke();
    }],
    cama: ['Cama doble', 'Habitación', 1.2, g => cama2d(g, 1.4)],
    camaSencilla: ['Cama sencilla', 'Habitación', 1.07, g => cama2d(g, 1.0)],
    closet: ['Clóset', 'Habitación', 0.67, g => {
      caja(g, -0.6, -0.3, 1.2, 0.6, 0.02, '#f6f1ea'); traza(g, -0.55, 0, 0.55, 0);
      g.beginPath(); for (let x = -0.45; x < 0.5; x += 0.15) { g.moveTo(x - 0.05, -0.18); g.lineTo(x + 0.05, 0.18); } g.stroke();
    }],
    sofa: ['Sofá', 'Sala y comedor', 1.08, g => {
      caja(g, -1.0, -0.42, 2.0, 0.84, 0.1, '#d5dce6'); caja(g, -1.0, -0.42, 2.0, 0.22, 0.08, '#c5cfdb');
      caja(g, -1.0, -0.42, 0.2, 0.84, 0.08, '#c5cfdb'); caja(g, 0.8, -0.42, 0.2, 0.84, 0.08, '#c5cfdb');
      for (const x of [-0.8, -0.2, 0.4]) caja(g, x, -0.2, 0.6, 0.6, 0.06, '#e6ebf1');
    }],
    mesa: ['Comedor redondo (4)', 'Sala y comedor', 1.0, g => {
      for (const [x, y] of [[0, -0.75], [0, 0.75], [-0.75, 0], [0.75, 0]]) silla2d(g, x, y, -x / 0.75, -y / 0.75);
      elipse(g, 0, 0, 0.5, 0.5, '#efe6d8');
    }],
    mesaRect: ['Comedor (6)', 'Sala y comedor', 1.3, g => {
      for (const y of [-0.55, 0, 0.55]) { silla2d(g, -0.68, y, 1, 0); silla2d(g, 0.68, y, -1, 0); }
      caja(g, -0.45, -0.9, 0.9, 1.8, 0.04, '#efe6d8');
    }],
    escritorio: ['Escritorio', 'Sala y comedor', 0.75, g => { silla2d(g, 0, 0.5, 0, -1); caja(g, -0.6, -0.3, 1.2, 0.6, 0.02, '#efe6d8'); }],
    silla: ['Silla', 'Sala y comedor', 0.3, g => silla2d(g, 0, 0, 0, -1)],
    puntoEncuentro: ['Punto de encuentro', 'Gestión del riesgo', 0.85, g => {
      g.save(); g.strokeStyle = '#13652b'; caja(g, -0.6, -0.6, 1.2, 1.2, 0.12, '#1e8e3e');
      g.fillStyle = '#fff'; g.strokeStyle = '#fff';
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * Math.PI / 2);
        g.beginPath(); g.moveTo(-0.07, -0.5); g.lineTo(0.07, -0.5); g.lineTo(0.07, -0.3); g.lineTo(0.15, -0.3); g.lineTo(0, -0.14); g.lineTo(-0.15, -0.3); g.lineTo(-0.07, -0.3); g.closePath(); g.fill();
        g.restore();
      }
      g.beginPath(); g.arc(0, 0, 0.07, 0, 7); g.fill(); g.restore();
    }],
    flecha: ['Ruta de evacuación', 'Gestión del riesgo', 1.05, g => {
      g.save(); g.strokeStyle = '#13652b';
      g.beginPath(); g.moveTo(-0.3, 0.9); g.lineTo(0.3, 0.9); g.lineTo(0.3, -0.2); g.lineTo(0.6, -0.2); g.lineTo(0, -1); g.lineTo(-0.6, -0.2); g.lineTo(-0.3, -0.2); g.closePath();
      pinta(g, '#1e8e3e'); g.restore();
    }],
    extintor: ['Extintor', 'Gestión del riesgo', 0.3, g => {
      g.save(); g.strokeStyle = '#9b1c14'; elipse(g, 0, 0, 0.25, 0.25, '#d93025');
      g.fillStyle = '#fff'; rr(g, -0.06, -0.15, 0.12, 0.26, 0.04); g.fill(); g.fillRect(-0.02, -0.2, 0.08, 0.05); g.restore();
    }],
    carpa: ['Carpa / albergue', 'Gestión del riesgo', 2.1, g => {
      caja(g, -1.5, -1.5, 3, 3, 0.05, '#dbe8fb'); g.save(); g.strokeStyle = '#3a7bd5'; traza(g, 0, -1.5, 0, 1.5);
      traza(g, -1.5, -1.5, 0, -1.2); traza(g, 1.5, -1.5, 0, -1.2); traza(g, -1.5, 1.5, 0, 1.2); traza(g, 1.5, 1.5, 0, 1.2); g.restore();
      for (const [x, y] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) elipse(g, x, y, 0.05, 0.05, LINEA);
    }],
    tanque: ['Tanque de agua', 'Gestión del riesgo', 0.6, g => { elipse(g, 0, 0, 0.55, 0.55, '#dfe7ef'); elipse(g, 0, 0, 0.25, 0.25, '#cfd8e3'); traza(g, -0.55, 0, -0.25, 0); }],
    poste: ['Poste de luz', 'Gestión del riesgo', 0.3, g => {
      g.save(); g.setLineDash([0.08, 0.08]); g.beginPath(); g.arc(0, 0, 0.9, 0, 7); g.strokeStyle = '#c9a227'; g.stroke(); g.restore();
      elipse(g, 0, 0, 0.12, 0.12, '#cfd8e3'); traza(g, -0.12, 0, 0.12, 0); traza(g, 0, -0.12, 0, 0.12);
    }],
  };
  const radioBloque = b => (BLOQUES[b.simbolo] || BLOQUES.arbol)[2] * (b.escala || 1);
  function dibujarBloque(g, simbolo, k) {
    g.lineWidth = 1.1 / k; g.strokeStyle = LINEA; g.lineJoin = 'round';
    (BLOQUES[simbolo] || BLOQUES.arbol)[3](g);
  }
  // Miniaturas de la galería (se generan una vez)
  const miniaturas = {};
  function miniatura(k) {
    if (miniaturas[k]) return miniaturas[k];
    const c = document.createElement('canvas'), tam = 112;
    c.width = c.height = tam;
    const g = c.getContext('2d'), esc = tam * 0.42 / BLOQUES[k][2];
    g.translate(tam / 2, tam / 2); g.scale(esc, esc);
    dibujarBloque(g, k, esc / 1.6);
    return (miniaturas[k] = c.toDataURL());
  }

  // Alzado de la cercha tipo, para el panel de la cubierta
  function cerchaSVG(c) {
    const b = c.cerchas.barras, xs = b.flatMap(x => [x.x1, x.x2]), zs = b.flatMap(x => [x.z1, x.z2]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const W = 280, H = 120, m = 10, k = Math.min((W - 2 * m) / (x1 - x0 || 1), (H - 2 * m - 16) / (z1 - z0 || 0.01));
    const X = x => m + (W - 2 * m - (x1 - x0) * k) / 2 + (x - x0) * k, Y = z => H - m - 16 - (z - z0) * k;
    return `<svg viewBox="0 0 ${W} ${H}" class="detalle">${b.map(x => `<line x1="${X(x.x1).toFixed(1)}" y1="${Y(x.z1).toFixed(1)}" x2="${X(x.x2).toFixed(1)}" y2="${Y(x.z2).toFixed(1)}"
      stroke="${x.tipo === 'cordon' ? '#6e328c' : '#a77bc0'}" stroke-width="${x.tipo === 'cordon' ? 2.4 : 1.2}" stroke-linecap="round"/>`).join('')}
      <text x="${W / 2}" y="${H - 6}" text-anchor="middle">Cercha tipo · luz ${num(c.S, 2)} m · altura ${num(c.f, 2)} m · ${c.cerchas.paneles} paneles</text></svg>`;
  }

  /* ---------- Patrones de relleno de muros ---------- */
  function patrones(g) {
    const hacer = (fondo, linea, dibujo) => {
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      const x = c.getContext('2d');
      x.fillStyle = fondo; x.fillRect(0, 0, 8, 8);
      x.strokeStyle = x.fillStyle = linea; x.lineWidth = 1;
      dibujo(x);
      return g.createPattern(c, 'repeat');
    };
    const diag = x => { x.beginPath(); x.moveTo(-1, 9); x.lineTo(9, -1); x.moveTo(-1, 1); x.lineTo(1, -1); x.moveTo(7, 9); x.lineTo(9, 7); x.stroke(); };
    return {
      diagonal: hacer('#f7e1d3', '#c46a45', diag),
      cruzado: hacer('#efc8bb', '#a8452a', x => { diag(x); x.beginPath(); x.moveTo(-1, -1); x.lineTo(9, 9); x.stroke(); }),
      puntos: hacer('#e8e8e4', '#7d7d78', x => { x.fillRect(1, 1, 1.4, 1.4); x.fillRect(5, 5, 1.4, 1.4); }),
    };
  }

  /* ---------- Editor ---------- */
  async function editor(raiz, id) {
    const plano = await DB.obtener('planos', id);
    if (!plano) { location.hash = '#/planos'; return; }
    plano.cfg = { ...E.CFG, ...(plano.cfg || {}) };
    plano.plantillas = Object.fromEntries(Object.entries(E.PLANTILLAS).map(([k, v]) => [k, { ...v, ...(plano.plantillas?.[k] || {}) }]));
    plano.capasOcultas = plano.capasOcultas || [];
    plano.elementos = plano.elementos || [];
    for (const e of plano.elementos) if (e.tipo === 'cubierta') E.normalizarCubierta(Object.assign(e, { ...E.PLANTILLAS.cubierta, ...e }));
    let biblioteca = await DB.ajuste('biblioteca', []);

    const st = {
      herr: plano.elementos.length ? 'sel' : 'muro', modo: 'planta', sel: null,
      vista: plano.vista ? { ...plano.vista } : null,
      cam: { theta: 0.65, phi: 0.62, zoom: 1, px: 0, py: 0 }, cubierta3d: 'ver', acabado3d: 'ladrillo', terreno3d: 'opaco',
      puntos: [], cursor: null, coord: null,
      orto: true, iman: true, rejilla: true, etiquetas: true, estrCub: false, lapiz: false,
      deshacer: [], rehacer: [], panel: true, panelMin: false,
    };

    document.body.classList.add('modo-editor');
    const ac = new AbortController();
    raiz.innerHTML = `<div class="ed">
      <div class="ed-lienzo">
        <canvas></canvas>
        <header class="ed-barra flot izq">
          <a class="btn-icono" href="${plano.proyectoId ? `#/proyecto/${plano.proyectoId}/planos` : '#/planos'}" aria-label="Salir del plano">←</a>
          <input class="ed-nombre" data-nombre value="${esc(plano.nombre)}" aria-label="Nombre del plano">
          <button class="btn-icono" data-accion="deshacer" title="Deshacer (Ctrl+Z)" aria-label="Deshacer">${icono('deshacer')}</button>
          <button class="btn-icono" data-accion="rehacer" title="Rehacer (Ctrl+Y)" aria-label="Rehacer">${icono('rehacer')}</button>
        </header>
        <div class="ed-barra flot der">
          <div class="seg"><button data-modo="planta" class="activo">Planta</button><button data-modo="3d">3D</button></div>
          <button class="btn-flot" data-accion="estructura" title="Estructura automática">⚡<span>Estructura</span></button>
          <button class="btn-flot" data-accion="capas" title="Capas">◧<span>Capas</span></button>
          <button class="btn-flot" data-accion="ajustes" title="Ajustes de cálculo">⚙<span>Ajustes</span></button>
          <button class="btn-flot pri" data-accion="cantidades" title="Cantidades">Σ<span>Cantidades</span></button>
          <button class="btn-flot" data-accion="exportar" title="Exportar">⇪<span>Exportar</span></button>
          <button class="btn-flot" data-accion="panel" title="Mostrar u ocultar propiedades" aria-label="Panel de propiedades">☰</button>
        </div>
        <nav class="ed-herr flot">${HERRAMIENTAS.map(([k, t]) => `<button data-herr="${k}" title="${esc(t)}">${icono(k)}<span>${esc(t)}</span></button>`).join('')}</nav>
        <aside class="ed-panel flot"></aside>
        <div class="ed-flotante flot" hidden><span>Longitud</span><input data-longitud type="number" inputmode="decimal" step="any" placeholder="m">
          <button class="btn sm" data-accion="colocar">↵</button><button class="btn sm pri" data-accion="terminar">✓ Terminar</button></div>
        <div class="ed-estado"></div>
        <button class="ed-resumen flot" data-accion="cantidades" title="Ver cantidades"></button>
      </div></div>`;

    const cont = $('.ed', raiz), cv = $('canvas', raiz), g = cv.getContext('2d');
    const panelEl = $('.ed-panel', raiz), estadoEl = $('.ed-estado', raiz), flotante = $('.ed-flotante', raiz), resumenEl = $('.ed-resumen', raiz);
    const pat = patrones(g);
    let W = 0, H = 0, dpr = 1;

    /* ----- Persistencia e historial ----- */
    let tGuardar;
    const guardarYa = () => {
      clearTimeout(tGuardar);
      plano.modificado = new Date().toISOString();
      if (st.vista) plano.vista = { ...st.vista };
      return DB.guardar('planos', plano);
    };
    const guardarPronto = () => { clearTimeout(tGuardar); tGuardar = setTimeout(guardarYa, 500); };
    const instantanea = () => JSON.stringify(plano.elementos);
    function cambiar(fn) {
      st.deshacer.push(instantanea());
      if (st.deshacer.length > 80) st.deshacer.shift();
      st.rehacer = [];
      fn();
      despues();
    }
    function despues() {
      if (st.sel && !buscarId(st.sel)) st.sel = null;
      guardarPronto(); pintar(); panel(); resumen();
    }
    function historial(desde, hacia) {
      if (!desde.length) return;
      hacia.push(instantanea());
      plano.elementos = JSON.parse(desde.pop());
      despues();
    }
    const buscarId = i => plano.elementos.find(e => e.id === i);
    const oculto = t => plano.capasOcultas.includes(t);
    const r3 = v => Math.round(v * 1000) / 1000;
    const pr3 = p => ({ x: r3(p.x), y: r3(p.y) });

    window.addEventListener('hashchange', () => {
      guardarYa();
      document.body.classList.remove('modo-editor');
      ac.abort();
      obs.disconnect();
    }, { once: true });

    /* ----- Vista y coordenadas ----- */
    const aMundo = p => ({ x: (p.x - st.vista.ox) / st.vista.esc, y: (p.y - st.vista.oy) / st.vista.esc });
    function puntosModelo() {
      const pts = [];
      for (const e of plano.elementos) {
        if (e.a) pts.push(e.a, e.b);
        if (e.puntos) pts.push(...E.desfasar(e.puntos, +e.alero || 0));
        if (e.x != null) {
          const r = e.tipo === 'zapata' ? Math.max(e.B, e.L) / 2 : e.tipo === 'bloque' ? radioBloque(e) : e.tipo === 'generico' ? Math.hypot(+e.L || 1, +e.A || 1) / 2 : 0.3;
          pts.push({ x: e.x - r, y: e.y - r }, { x: e.x + r, y: e.y + r });
        }
      }
      return pts;
    }
    function encuadre(w, h, margen = 60) {
      const pts = puntosModelo();
      if (!pts.length) return { esc: 32, ox: w / 2, oy: h / 2 };
      const b = E.caja(pts);
      const k = Math.max(4, Math.min(400, Math.min((w - 2 * margen) / Math.max(b.w, 1), (h - 2 * margen) / Math.max(b.h, 1))));
      return { esc: k, ox: w / 2 - (b.x0 + b.w / 2) * k, oy: h / 2 - (b.y0 + b.h / 2) * k };
    }
    const paso = () => { const e = st.vista.esc; return e >= 150 ? 0.01 : e >= 60 ? 0.05 : e >= 25 ? 0.1 : e >= 10 ? 0.25 : 0.5; };

    const obs = new ResizeObserver(() => {
      const r = cv.parentElement.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      if (!st.vista) st.vista = encuadre(W, H);
      pintar();
    });
    obs.observe(cv.parentElement);

    /* ----- Imán y ortogonal ----- */
    function ajustar(pw, base = null, excluir = null) {
      const tol = 14 / st.vista.esc;
      if (st.iman) {
        let mejor = null;
        const prueba = (q, tipo, pri) => {
          const d = E.dist(pw, q);
          if (d < tol && (!mejor || pri < mejor.pri || (pri === mejor.pri && d < mejor.d))) mejor = { x: q.x, y: q.y, tipo, d, pri };
        };
        for (const e of plano.elementos) {
          if (e.id === excluir || oculto(e.tipo)) continue;
          if (e.a) { prueba(e.a, 'extremo', 0); prueba(e.b, 'extremo', 0); }
          if (LINEALES.includes(e.tipo)) prueba({ x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }, 'medio', 1);
          if (e.tipo === 'columna' || e.tipo === 'zapata') prueba(e, 'centro', 0);
          if (e.puntos && e.id !== excluir) e.puntos.forEach(q => prueba(q, 'extremo', 0));
        }
        if (st.puntos.length > 1) prueba(st.puntos[0], 'extremo', 0);
        if (!mejor) for (const e of plano.elementos) {
          if (e.id === excluir || !LINEALES.includes(e.tipo) || oculto(e.tipo)) continue;
          const pr = E.proyectar(pw, e.a, e.b);
          if (pr.d < tol && (!mejor || pr.d < mejor.d)) mejor = { ...pr.q, tipo: 'sobre', d: pr.d, pri: 2 };
        }
        if (mejor) return mejor;
      }
      const q = { ...pw };
      const k = paso();
      if (base && st.orto) {
        if (Math.abs(q.x - base.x) >= Math.abs(q.y - base.y)) { q.y = base.y; if (st.rejilla) q.x = base.x + Math.round((q.x - base.x) / k) * k; }
        else { q.x = base.x; if (st.rejilla) q.y = base.y + Math.round((q.y - base.y) / k) * k; }
      } else if (st.rejilla) { q.x = Math.round(q.x / k) * k; q.y = Math.round(q.y / k) * k; }
      return { ...pr3(q), tipo: 'rejilla' };
    }

    /* ----- Dibujo en planta ----- */
    function render(g, W, H, V, op = {}) {
      const S = p => ({ x: p.x * V.esc + V.ox, y: p.y * V.esc + V.oy });
      const camino = (pts, cerrar = true) => {
        g.beginPath();
        pts.forEach((p, i) => { const s = S(p); i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y); });
        if (cerrar) g.closePath();
      };
      const linea = (a, b) => { const p = S(a), q = S(b); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); };
      const mas = (p, v, k) => ({ x: p.x + v.x * k, y: p.y + v.y * k });
      const ctx = E.contexto(plano), etq = E.etiquetas(plano);
      const vis = t => !oculto(t);
      g.save();
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, W, H);
      g.lineCap = 'butt'; g.lineJoin = 'miter';

      // Rejilla
      if (op.interactivo && st.rejilla) {
        const lineas = (p, color) => {
          if (p * V.esc < 7) return;
          g.strokeStyle = color; g.lineWidth = 1; g.beginPath();
          const x0 = Math.floor(-V.ox / V.esc / p) * p, y0 = Math.floor(-V.oy / V.esc / p) * p;
          for (let x = x0; x * V.esc + V.ox < W; x += p) { const sx = Math.round(x * V.esc + V.ox) + 0.5; g.moveTo(sx, 0); g.lineTo(sx, H); }
          for (let y = y0; y * V.esc + V.oy < H; y += p) { const sy = Math.round(y * V.esc + V.oy) + 0.5; g.moveTo(0, sy); g.lineTo(W, sy); }
          g.stroke();
        };
        lineas(V.esc >= 60 ? 0.1 : 0.5, '#f1f3f6');
        lineas(1, '#e1e6ec');
        lineas(5, '#cdd5df');
      }

      // Zapatas y vigas de cimentación (ocultas bajo el piso: línea discontinua)
      g.setLineDash([7, 4]);
      if (vis('zapata')) for (const z of ctx.de('zapata')) {
        const pts = E.rectangulo(z.x, z.y, z.B, z.L);
        camino(pts); g.fillStyle = 'rgba(138,109,59,.10)'; g.fill();
        g.strokeStyle = '#8a6d3b'; g.lineWidth = 1.3; g.stroke();
        g.lineWidth = 0.6; linea(pts[0], pts[2]); linea(pts[1], pts[3]);
      }
      if (vis('vigaCim')) for (const v of ctx.de('vigaCim')) {
        camino(E.franja(v.a, v.b, v.base)); g.fillStyle = 'rgba(154,106,47,.14)'; g.fill();
        g.strokeStyle = '#9a6a2f'; g.lineWidth = 1.2; g.stroke();
      }
      g.setLineDash([]);

      // Muros: contorno unido y relleno según el ladrillo
      // Cada muro se corta en las caras de las columnas para que la unión no se sobreponga.
      const muros = vis('muro') ? ctx.de('muro') : [];
      const franjas = muros.flatMap(m => {
        const L = E.largo(m) || 1, u = { x: (m.b.x - m.a.x) / L, y: (m.b.y - m.a.y) / L }, [extA, extB] = E.extremosMuro(m, muros);
        const cols = vis('columna') ? ctx.columnasEn(m).map(p => ({ s: p.s, traslapo: p.along })) : [];
        return E.tramosLibres(L, cols, extA, extB).map(([a, b]) => ({ m, pts: E.franja(mas(m.a, u, a), mas(m.a, u, b), E.espesorMuro(m)) }));
      });
      g.strokeStyle = '#1d1d1d'; g.lineWidth = 3;
      franjas.forEach(f => { camino(f.pts); g.stroke(); });
      franjas.forEach(f => { camino(f.pts); g.fillStyle = pat[(E.MAMPOSTERIA[f.m.unidad] || E.MAMPOSTERIA.h10).patron]; g.fill(); });

      // Vanos
      const vanos = [...(vis('puerta') ? ctx.de('puerta') : []), ...(vis('ventana') ? ctx.de('ventana') : [])];
      for (const v of vanos) {
        const m = buscarId(v.muro);
        if (!m || !vis('muro')) continue;
        const t = E.espesorMuro(m), L = E.largo(m) || 1;
        const u = { x: (m.b.x - m.a.x) / L, y: (m.b.y - m.a.y) / L }, n = { x: -u.y, y: u.x };
        const P = s => mas(m.a, u, s);
        const s0 = v.s - v.ancho / 2, s1 = v.s + v.ancho / 2;
        camino(E.franja(P(s0), P(s1), t + 4 / V.esc)); g.fillStyle = '#fff'; g.fill();
        g.strokeStyle = '#1d1d1d'; g.lineWidth = 1.4;
        linea(mas(P(s0), n, t / 2), mas(P(s0), n, -t / 2)); linea(mas(P(s1), n, t / 2), mas(P(s1), n, -t / 2));
        if (v.tipo === 'ventana') {
          g.strokeStyle = '#1f8fb8'; g.lineWidth = 1;
          for (const k of [t / 2, -t / 2]) linea(mas(P(s0), n, k), mas(P(s1), n, k));
          g.lineWidth = 1.4;
          for (const k of [t / 7, -t / 7]) linea(mas(P(s0), n, k), mas(P(s1), n, k));
        } else {
          const lado = v.lado || 1;
          g.strokeStyle = '#2f6b3a'; g.lineWidth = 1.6;
          if (v.estilo === 'corrediza') {
            g.lineWidth = 2.2;
            linea(mas(P(s0), n, lado * t / 5), mas(P(v.s + v.ancho * 0.05), n, lado * t / 5));
            linea(mas(P(v.s - v.ancho * 0.05), n, -lado * t / 5), mas(P(s1), n, -lado * t / 5));
          } else {
            const hojas = v.estilo === 'doble' ? [[s0, v.ancho / 2, 1], [s1, v.ancho / 2, -1]]
              : [[v.giro === 'der' ? s1 : s0, v.ancho, v.giro === 'der' ? -1 : 1]];
            for (const [sh, w, du] of hojas) {
              const bis = mas(P(sh), n, lado * t / 2), punta = mas(bis, n, lado * w);
              g.lineWidth = 1.8; linea(bis, punta);
              const c = S(bis), a1 = Math.atan2(n.y * lado, n.x * lado), a2 = Math.atan2(u.y * du, u.x * du);
              let d = a2 - a1;
              while (d > Math.PI) d -= 2 * Math.PI;
              while (d <= -Math.PI) d += 2 * Math.PI;
              g.lineWidth = 0.9; g.setLineDash([4, 3]);
              g.beginPath(); g.arc(c.x, c.y, w * V.esc, a1, a2, d < 0); g.stroke(); g.setLineDash([]);
            }
          }
        }
      }

      // Columnas
      if (vis('columna')) for (const c of ctx.de('columna')) {
        camino(E.rectangulo(c.x, c.y, c.b, c.h, c.ang || 0));
        g.fillStyle = '#4b525c'; g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1.2; g.stroke();
      }

      // Elementos personalizados
      if (vis('generico')) for (const e of ctx.de('generico')) {
        const r = E.rectangulo(e.x, e.y, +e.L || 1, +e.A || 1, e.ang || 0), color = e.color || '#0e7c86';
        camino(r); g.fillStyle = color + '30'; g.fill(); g.strokeStyle = color === '#f2f2ee' ? '#555' : color; g.lineWidth = 1.6; g.stroke();
        g.lineWidth = 0.7; g.setLineDash([4, 3]); linea(r[0], r[2]); linea(r[1], r[3]); g.setLineDash([]);
      }

      // Vigas aéreas (sobre el plano de corte: discontinuas)
      if (vis('viga')) for (const v of ctx.de('viga')) {
        const f = E.franja(v.a, v.b, v.base);
        g.strokeStyle = '#1f5fa8'; g.lineWidth = 1.3; g.setLineDash([9, 4]);
        linea(f[0], f[1]); linea(f[3], f[2]);
        g.setLineDash([2, 3]); linea(f[0], f[3]); linea(f[1], f[2]); g.setLineDash([]);
      }

      // Cubierta
      if (vis('cubierta')) for (const c of ctx.de('cubierta')) {
        const cont = E.desfasar(c.puntos, +c.alero || 0), bb = E.caja(cont), ap = E.caja(c.puntos);
        g.strokeStyle = '#8e44ad'; g.lineWidth = 1.5; g.setLineDash([14, 4, 2, 4]);
        camino(cont); g.stroke();
        const ejeX = c.dir === 'x';
        const mid = ejeX ? (ap.x0 + ap.x1) / 2 : (ap.y0 + ap.y1) / 2;
        g.lineWidth = 2;
        if (c.forma === 'dos') linea(ejeX ? { x: mid, y: bb.y0 } : { x: bb.x0, y: mid }, ejeX ? { x: mid, y: bb.y1 } : { x: bb.x1, y: mid });
        g.setLineDash([]);
        const flechas = c.forma === 'dos'
          ? [[ejeX ? (bb.x0 + mid) / 2 : (bb.x0 + bb.x1) / 2, ejeX ? (bb.y0 + bb.y1) / 2 : (bb.y0 + mid) / 2, -1], [ejeX ? (mid + bb.x1) / 2 : (bb.x0 + bb.x1) / 2, ejeX ? (bb.y0 + bb.y1) / 2 : (mid + bb.y1) / 2, 1]]
          : [[(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2, 1]];
        g.fillStyle = g.strokeStyle = '#8e44ad'; g.lineWidth = 1.4; g.font = '600 12px system-ui'; g.textAlign = 'center';
        for (const [x, y, sg] of flechas) {
          const d = ejeX ? { x: sg, y: 0 } : { x: 0, y: sg };
          const a = S(mas({ x, y }, d, -0.6)), b = S(mas({ x, y }, d, 0.6));
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          g.beginPath(); g.moveTo(b.x, b.y);
          g.lineTo(b.x - 9 * Math.cos(ang - 0.4), b.y - 9 * Math.sin(ang - 0.4)); g.lineTo(b.x - 9 * Math.cos(ang + 0.4), b.y - 9 * Math.sin(ang + 0.4));
          g.closePath(); g.fill();
          const sp = S({ x, y });
          g.fillText(`P = ${num(+c.pendiente, 0)} %`, sp.x + (ejeX ? 0 : 34), sp.y + (ejeX ? -10 : 4));
        }
        // Estructura generada: correas (discontinuas) y cerchas
        if (st.estrCub || (op.interactivo && st.sel === c.id)) {
          const est = E.estructuraCubierta(c, 0);
          g.strokeStyle = 'rgba(142,68,173,.6)'; g.lineWidth = 1; g.setLineDash([6, 3]);
          for (const x of est.correas) linea(x.a, x.b);
          g.setLineDash([]); g.lineWidth = 2.4; g.strokeStyle = 'rgba(110,50,140,.8)';
          for (const ch of est.cerchas) { const b = E.caja(ch.barras.flatMap(x => [x.a, x.b])); linea({ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y1 }); }
        }
      }

      // Bloques
      if (vis('bloque')) for (const b of ctx.de('bloque')) {
        const s = S(b), k = V.esc * (b.escala || 1);
        g.save(); g.translate(s.x, s.y); g.rotate(b.ang || 0); g.scale(k, k);
        dibujarBloque(g, b.simbolo, k);
        g.restore();
      }

      // Cotas
      const dibCota = (a, b, off, color = '#222') => {
        const L = E.dist(a, b);
        if (L < 1e-3) return;
        const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }, n = { x: -u.y, y: u.x }, sg = off >= 0 ? 1 : -1;
        const A = mas(a, n, off), B = mas(b, n, off);
        g.strokeStyle = color; g.lineWidth = 0.8;
        linea(mas(a, n, sg * 0.08), mas(A, n, sg * 0.12)); linea(mas(b, n, sg * 0.08), mas(B, n, sg * 0.12));
        linea(mas(A, u, -0.1), mas(B, u, 0.1));
        g.lineWidth = 1.6;
        const tick = { x: (u.x + n.x) * 0.09, y: (u.y + n.y) * 0.09 };
        for (const P of [A, B]) linea(mas(P, tick, -1), mas(P, tick, 1));
        const m = S({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
        let ang = Math.atan2(u.y, u.x);
        if (ang > Math.PI / 2 + 1e-6) ang -= Math.PI; else if (ang <= -Math.PI / 2 + 1e-6) ang += Math.PI;
        g.save(); g.translate(m.x, m.y); g.rotate(ang);
        g.fillStyle = color; g.font = '600 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.fillText(num(L, 2), 0, -3); g.restore();
      };
      if (vis('cota')) for (const c of ctx.de('cota')) dibCota(c.a, c.b, c.off ?? 0.5);

      // Etiquetas
      if (st.etiquetas) {
        g.font = '700 11px system-ui'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        const texto = (t, p, color, dx = 0, dy = 0) => {
          const s = S(p); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText(t, s.x + dx, s.y + dy);
          g.fillStyle = color; g.fillText(t, s.x + dx, s.y + dy);
        };
        if (vis('columna')) for (const c of ctx.de('columna')) texto(etq.get(c.id), c, '#3d4450', Math.max(c.b, c.h) * V.esc / 2 + 3, -Math.max(c.b, c.h) * V.esc / 2 - 2);
        if (vis('zapata')) for (const z of ctx.de('zapata')) texto(`${etq.get(z.id)} ${num(z.B, 2)}×${num(z.L, 2)}`, { x: z.x - z.B / 2, y: z.y + z.L / 2 }, '#8a6d3b', 2, 12);
        for (const t of ['viga', 'vigaCim']) if (vis(t)) for (const v of ctx.de(t)) {
          const L = E.largo(v) || 1, n = { x: -(v.b.y - v.a.y) / L, y: (v.b.x - v.a.x) / L };
          const lado = t === 'viga' ? 1 : -1;
          texto(`${etq.get(v.id)} ${num(v.base * 100, 0)}×${num(v.altura * 100, 0)}`, mas({ x: (v.a.x + v.b.x) / 2, y: (v.a.y + v.b.y) / 2 }, n, lado * (v.base / 2 + 0.05)),
            t === 'viga' ? '#1f5fa8' : '#9a6a2f', -22, lado > 0 ? -3 : 11);
        }
        for (const v of vanos) {
          const m = buscarId(v.muro);
          if (!m) continue;
          const L = E.largo(m) || 1, u = { x: (m.b.x - m.a.x) / L, y: (m.b.y - m.a.y) / L }, n = { x: -u.y, y: u.x };
          const lado = v.tipo === 'puerta' ? -(v.lado || 1) : 1;
          texto(etq.get(v.id), mas(mas(m.a, u, v.s), n, lado * (E.espesorMuro(m) / 2 + 0.25)), v.tipo === 'puerta' ? '#2f6b3a' : '#1f8fb8', -8, 4);
        }
        if (vis('generico')) for (const e of ctx.de('generico')) {
          g.textAlign = 'center'; texto(`${etq.get(e.id)} ${e.nombre || ''}`.trim(), e, '#0b5a61', 0, 4); g.textAlign = 'left';
        }
        if (vis('cubierta')) for (const c of ctx.de('cubierta')) {
          const bb = E.caja(E.desfasar(c.puntos, +c.alero || 0));
          texto(`${etq.get(c.id)} · ${(E.TEJAS[c.teja] || E.TEJAS.zinc).t.split(' (')[0]} · alero ${num(+c.alero, 2)} m`, { x: bb.x0, y: bb.y0 }, '#8e44ad', 2, -6);
        }
      }

      // Escala gráfica y norte
      const yb = H - (op.interactivo ? 62 : 24);
      let largoE = [0.5, 1, 2, 5, 10, 20, 50].find(x => x * V.esc >= 70) || 50;
      const px = largoE * V.esc, xb = W - px - 24;
      g.fillStyle = '#222'; g.fillRect(xb, yb, px / 2, 5); g.strokeStyle = '#222'; g.lineWidth = 1; g.strokeRect(xb, yb, px, 5);
      g.font = '600 11px system-ui'; g.textAlign = 'center'; g.fillText('0', xb, yb - 4); g.fillText(`${num(largoE, largoE < 1 ? 1 : 0)} m`, xb + px, yb - 4);
      const xn = W - 30, yn = op.interactivo ? H - 104 : 34;
      g.beginPath(); g.moveTo(xn, yn - 18); g.lineTo(xn - 7, yn + 4); g.lineTo(xn, yn - 1); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(xn, yn - 18); g.lineTo(xn + 7, yn + 4); g.lineTo(xn, yn - 1); g.closePath(); g.stroke();
      g.fillText('N', xn, yn + 17);

      if (op.interactivo) superposicion(g, S, camino, linea, mas, dibCota);
      g.restore();
    }

    // Selección, vista previa y cursor
    function superposicion(g, S, camino, linea, mas, dibCota) {
      const el = st.sel && buscarId(st.sel);
      const asa = p => { const s = S(p); g.fillStyle = '#fff'; g.strokeStyle = '#e67e22'; g.lineWidth = 2; g.fillRect(s.x - 5, s.y - 5, 10, 10); g.strokeRect(s.x - 5, s.y - 5, 10, 10); };
      if (el) {
        g.strokeStyle = '#f39c12'; g.lineWidth = 2.5; g.setLineDash([]);
        if (LINEALES.includes(el.tipo)) {
          camino(E.franja(el.a, el.b, el.tipo === 'muro' ? E.espesorMuro(el) : el.base)); g.stroke();
          asa(el.a); asa(el.b);
          const m = S({ x: (el.a.x + el.b.x) / 2, y: (el.a.y + el.b.y) / 2 });
          etiquetaFlotante(g, `${num(E.largo(el), 2)} m`, m.x, m.y - 16);
        } else if (el.tipo === 'columna') { camino(E.rectangulo(el.x, el.y, el.b, el.h, el.ang || 0)); g.stroke(); }
        else if (el.tipo === 'zapata') { camino(E.rectangulo(el.x, el.y, el.B, el.L)); g.stroke(); }
        else if (el.tipo === 'cubierta') { camino(E.desfasar(el.puntos, +el.alero || 0)); g.stroke(); camino(el.puntos); g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]); el.puntos.forEach(asa); }
        else if (el.tipo === 'cota') { dibCota(el.a, el.b, el.off ?? 0.5, '#e67e22'); asa(el.a); asa(el.b); }
        else if (el.tipo === 'bloque') { const s = S(el); g.beginPath(); g.arc(s.x, s.y, radioBloque(el) * st.vista.esc, 0, 7); g.stroke(); }
        else if (el.tipo === 'generico') { camino(E.rectangulo(el.x, el.y, +el.L || 1, +el.A || 1, el.ang || 0)); g.stroke(); }
        else if (el.tipo === 'puerta' || el.tipo === 'ventana') {
          const m = buscarId(el.muro);
          if (m) { const L = E.largo(m) || 1, u = { x: (m.b.x - m.a.x) / L, y: (m.b.y - m.a.y) / L }; camino(E.franja(mas(m.a, u, el.s - el.ancho / 2), mas(m.a, u, el.s + el.ancho / 2), E.espesorMuro(m) + 0.12)); g.stroke(); }
        }
      }
      const c = st.cursor;
      if (st.puntos.length && c) {
        const ult = st.puntos[st.puntos.length - 1];
        if (LINEALES.includes(st.herr)) {
          const pl = plano.plantillas[st.herr];
          camino(E.franja(ult, c, st.herr === 'muro' ? (E.MAMPOSTERIA[pl.unidad] || E.MAMPOSTERIA.h10).e : pl.base));
          g.fillStyle = 'rgba(31,95,168,.15)'; g.fill(); g.strokeStyle = '#1f5fa8'; g.lineWidth = 1.2; g.setLineDash([5, 3]); g.stroke(); g.setLineDash([]);
        } else if (st.herr === 'cota') dibCota(ult, c, 0.5, '#1f5fa8');
        else if (st.herr === 'cubierta') {
          camino([...st.puntos, c], false); g.strokeStyle = '#8e44ad'; g.lineWidth = 1.5; g.setLineDash([6, 4]); g.stroke(); g.setLineDash([]);
        }
        g.fillStyle = '#1f5fa8';
        for (const p of st.puntos) { const s = S(p); g.beginPath(); g.arc(s.x, s.y, 3.5, 0, 7); g.fill(); }
        const L = E.dist(ult, c);
        if (L > 1e-3) {
          const a = S(ult), b = S(c);
          const ang = Math.round(-Math.atan2(c.y - ult.y, c.x - ult.x) * 180 / Math.PI);
          etiquetaFlotante(g, `${num(L, 2)} m${st.orto && ang % 90 === 0 ? '' : ` · ${ang}°`}`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 16);
        }
      }
      if (c && st.herr !== 'sel' && st.herr !== 'mano') {
        const s = S(c);
        g.strokeStyle = '#1f5fa8'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(s.x - 12, s.y); g.lineTo(s.x + 12, s.y); g.moveTo(s.x, s.y - 12); g.lineTo(s.x, s.y + 12); g.stroke();
        if (c.tipo && c.tipo !== 'rejilla') {
          g.strokeStyle = '#e67e22'; g.lineWidth = 2;
          if (c.tipo === 'sobre') { g.beginPath(); g.moveTo(s.x, s.y - 7); g.lineTo(s.x + 7, s.y + 6); g.lineTo(s.x - 7, s.y + 6); g.closePath(); g.stroke(); }
          else if (c.tipo === 'medio') { g.beginPath(); g.arc(s.x, s.y, 6, 0, 7); g.stroke(); }
          else g.strokeRect(s.x - 6, s.y - 6, 12, 12);
        }
      }
    }
    function etiquetaFlotante(g, t, x, y) {
      g.font = '700 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const w = g.measureText(t).width + 12;
      g.fillStyle = 'rgba(31,58,95,.92)'; g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - 10, w, 20, 6) : g.rect(x - w / 2, y - 10, w, 20); g.fill();
      g.fillStyle = '#fff'; g.fillText(t, x, y + 0.5);
      g.textBaseline = 'alphabetic';
    }

    function pintar() {
      if (!W || !st.vista) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (st.modo === '3d') Iso.dibujar(g, plano, st.cam, W, H, { cubierta: st.cubierta3d, acabado: st.acabado3d, terreno: st.terreno3d, margenInferior: 70 });
      else render(g, W, H, st.vista, { interactivo: true });
      estado();
    }

    /* ----- Selección ----- */
    function buscar(p) {
      const tol = 10 / st.vista.esc;
      const orden = ['cota', 'puerta', 'ventana', 'columna', 'generico', 'bloque', 'viga', 'muro', 'vigaCim', 'zapata', 'cubierta'];
      for (const tipo of orden) {
        if (oculto(tipo)) continue;
        for (const e of [...plano.elementos].reverse()) {
          if (e.tipo !== tipo) continue;
          if (tipo === 'cota') {
            const L = E.dist(e.a, e.b) || 1, n = { x: -(e.b.y - e.a.y) / L, y: (e.b.x - e.a.x) / L }, off = e.off ?? 0.5;
            if (E.proyectar(p, { x: e.a.x + n.x * off, y: e.a.y + n.y * off }, { x: e.b.x + n.x * off, y: e.b.y + n.y * off }).d < tol) return e;
          } else if (tipo === 'bloque') { if (E.dist(p, e) < radioBloque(e)) return e; }
          else if (tipo === 'generico') {
            const c = Math.cos(-(e.ang || 0)), s = Math.sin(-(e.ang || 0)), dx = p.x - e.x, dy = p.y - e.y;
            if (Math.abs(dx * c - dy * s) <= (+e.L || 1) / 2 + tol && Math.abs(dx * s + dy * c) <= (+e.A || 1) / 2 + tol) return e;
          }
          else if (tipo === 'puerta' || tipo === 'ventana') {
            const m = buscarId(e.muro);
            if (!m) continue;
            const L = E.largo(m) || 1, q = { x: m.a.x + (m.b.x - m.a.x) / L * e.s, y: m.a.y + (m.b.y - m.a.y) / L * e.s };
            if (E.dist(p, q) < Math.max(e.ancho / 2, tol)) return e;
          } else if (tipo === 'columna') {
            const c = Math.cos(-(e.ang || 0)), s = Math.sin(-(e.ang || 0)), dx = p.x - e.x, dy = p.y - e.y;
            if (Math.abs(dx * c - dy * s) <= e.b / 2 + tol && Math.abs(dx * s + dy * c) <= e.h / 2 + tol) return e;
          } else if (LINEALES.includes(tipo)) {
            if (E.proyectar(p, e.a, e.b).d <= (tipo === 'muro' ? E.espesorMuro(e) : e.base) / 2 + tol) return e;
          } else if (tipo === 'zapata') { if (Math.abs(p.x - e.x) <= e.B / 2 + tol && Math.abs(p.y - e.y) <= e.L / 2 + tol) return e; }
          else if (tipo === 'cubierta') {
            const cont = E.desfasar(e.puntos, +e.alero || 0);
            if (cont.some((q, i) => E.proyectar(p, q, cont[(i + 1) % cont.length]).d < tol)) return e;
          }
        }
      }
      return null;
    }

    /* ----- Creación de elementos ----- */
    const copia = o => JSON.parse(JSON.stringify(o));
    function muroCercano(p, tolPx = 14) {
      let mejor = null;
      for (const m of plano.elementos) {
        if (m.tipo !== 'muro' || oculto('muro')) continue;
        const pr = E.proyectar(p, m.a, m.b);
        if (pr.d <= E.espesorMuro(m) / 2 + tolPx / st.vista.esc && (!mejor || pr.d < mejor.pr.d)) mejor = { m, pr };
      }
      return mejor;
    }

    function clic(p) {
      const h = st.herr, pl = plano.plantillas[h];
      if (CADENA.includes(h)) {
        if (!st.puntos.length) { st.puntos.push(pr3(p)); flotanteVisible(); pintar(); return; }
        const ult = st.puntos[st.puntos.length - 1];
        if (E.dist(p, ult) < 0.01) { terminar(); return; }
        if (h === 'cubierta') {
          if (st.puntos.length >= 3 && E.dist(p, st.puntos[0]) < 14 / st.vista.esc) { terminar(); return; }
          st.puntos.push(pr3(p)); pintar(); return;
        }
        if (h === 'cota') {
          cambiar(() => plano.elementos.push({ id: UI.uid(), tipo: 'cota', a: { ...ult }, b: pr3(p), off: pl.off }));
          st.puntos = []; flotanteVisible(); return;
        }
        cambiar(() => plano.elementos.push({ id: UI.uid(), tipo: h, a: { ...ult }, b: pr3(p), ...copia(pl) }));
        const cerrado = E.dist(p, st.puntos[0]) < 0.01;
        st.puntos.push(pr3(p));
        if (cerrado) terminar(); else pintar();
        return;
      }
      if (h === 'columna') {
        const mc = muroCercano(p, 4);
        cambiar(() => plano.elementos.push({ id: UI.uid(), tipo: 'columna', ...pr3(p), ...copia(pl), ang: mc ? E.angulo(mc.m) : pl.ang || 0 }));
      } else if (h === 'zapata') {
        const col = plano.elementos.find(e => e.tipo === 'columna' && E.dist(e, p) < 0.4);
        cambiar(() => plano.elementos.push({ id: UI.uid(), tipo: 'zapata', ...pr3(col || p), ...copia(pl) }));
      } else if (h === 'bloque' || h === 'generico') {
        cambiar(() => plano.elementos.push({ id: UI.uid(), tipo: h, ...pr3(p), ...copia(pl) }));
      } else if (h === 'puerta' || h === 'ventana') {
        const mc = muroCercano(p);
        if (!mc) { toast('Toque sobre un muro para insertar el vano', 'error'); return; }
        const { m, pr } = mc, L = E.largo(m);
        if (L < pl.ancho + 0.05) { toast('El muro es más corto que el vano', 'error'); return; }
        const s = r3(Math.max(pl.ancho / 2, Math.min(L - pl.ancho / 2, pr.s)));
        const choca = plano.elementos.some(o => o.muro === m.id && Math.abs(o.s - s) < (o.ancho + pl.ancho) / 2);
        if (choca) { toast('Se cruza con otro vano del mismo muro', 'error'); return; }
        const u = { x: (m.b.x - m.a.x) / L, y: (m.b.y - m.a.y) / L };
        const lado = (p.x - pr.q.x) * -u.y + (p.y - pr.q.y) * u.x >= 0 ? 1 : -1;
        cambiar(() => plano.elementos.push({ id: UI.uid(), tipo: h, muro: m.id, s, ...copia(pl), ...(h === 'puerta' ? { lado } : {}) }));
      }
    }

    function terminar() {
      if (st.herr === 'cubierta' && st.puntos.length >= 3) {
        const pts = st.puntos.slice();
        cambiar(() => plano.elementos.push({ id: UI.uid(), tipo: 'cubierta', puntos: pts, ...copia(plano.plantillas.cubierta) }));
      }
      st.puntos = [];
      flotanteVisible();
      pintar();
    }

    function flotanteVisible() {
      flotante.hidden = !(st.modo === 'planta' && CADENA.includes(st.herr) && st.puntos.length);
    }

    function colocarLongitud() {
      const inp = $('[data-longitud]', flotante), L = parseFloat(inp.value);
      if (!(L > 0) || !st.puntos.length) { toast('Escriba una longitud en metros', 'error'); return; }
      const ult = st.puntos[st.puntos.length - 1], c = st.cursor && E.dist(st.cursor, ult) > 1e-3 ? st.cursor : { x: ult.x + 1, y: ult.y };
      let dx = c.x - ult.x, dy = c.y - ult.y;
      if (st.orto) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
      const d = Math.hypot(dx, dy) || 1;
      const p = { x: ult.x + dx / d * L, y: ult.y + dy / d * L };
      inp.value = '';
      clic(p);
      st.cursor = { ...p, tipo: 'rejilla' };
      pintar();
    }

    function eliminar(idEl) {
      cambiar(() => {
        plano.elementos = plano.elementos.filter(e => e.id !== idEl && e.muro !== idEl);
      });
      st.sel = null; panel();
    }

    /* ----- Punteros ----- */
    const punteros = new Map();
    let pulsado = null, gesto = null;
    const posicion = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    function actualizarCursor(ps) {
      const pw = aMundo(ps);
      st.coord = pw;
      const base = CADENA.includes(st.herr) && st.puntos.length ? st.puntos[st.puntos.length - 1] : null;
      st.cursor = ['sel', 'mano'].includes(st.herr) ? pw : ajustar(pw, base);
    }

    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      const ps = posicion(e);
      punteros.set(e.pointerId, ps);
      if (e.pointerType === 'pen') st.lapiz = true;
      if (punteros.size === 2) {
        pulsado = null;
        const [a, b] = [...punteros.values()];
        gesto = { d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vista0: { ...st.vista }, cam0: { ...st.cam } };
        return;
      }
      if (punteros.size > 2) return;
      if (st.modo === '3d') { pulsado = { tipo: 'orbita', x0: ps.x, y0: ps.y, th: st.cam.theta, ph: st.cam.phi, px: st.cam.px, py: st.cam.py, pan: e.button === 2 || e.button === 1 }; return; }
      if (st.herr === 'mano' || e.button === 1 || e.button === 2 || (st.lapiz && e.pointerType === 'touch')) {
        pulsado = { tipo: 'pan', x0: ps.x, y0: ps.y, ox: st.vista.ox, oy: st.vista.oy }; return;
      }
      actualizarCursor(ps);
      if (st.herr === 'sel') {
        const sel = st.sel && buscarId(st.sel);
        let asa = null;
        if (sel) {
          const S = p => ({ x: p.x * st.vista.esc + st.vista.ox, y: p.y * st.vista.esc + st.vista.oy });
          const cerca = p => Math.hypot(S(p).x - ps.x, S(p).y - ps.y) < 14;
          if (sel.a && cerca(sel.a)) asa = 'a';
          else if (sel.b && cerca(sel.b)) asa = 'b';
          else if (sel.puntos) { const i = sel.puntos.findIndex(cerca); if (i >= 0) asa = i; }
        }
        const objetivo = asa != null ? sel : buscar(st.cursor);
        pulsado = { tipo: 'sel', x0: ps.x, y0: ps.y, w0: { ...st.cursor }, objetivo, asa, movido: false, ox: st.vista.ox, oy: st.vista.oy };
      } else pulsado = { tipo: 'herr', x0: ps.x, y0: ps.y };
      pintar();
    }, { signal: ac.signal });

    cv.addEventListener('pointermove', e => {
      const ps = posicion(e);
      if (punteros.has(e.pointerId)) punteros.set(e.pointerId, ps);
      if (gesto && punteros.size >= 2) {
        const [a, b] = [...punteros.values()];
        const k = Math.hypot(b.x - a.x, b.y - a.y) / gesto.d0, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (st.modo === '3d') {
          st.cam.zoom = Math.max(0.2, Math.min(10, gesto.cam0.zoom * k));
          st.cam.px = gesto.cam0.px + m.x - gesto.m0.x; st.cam.py = gesto.cam0.py + m.y - gesto.m0.y;
        } else {
          const v0 = gesto.vista0, e2 = Math.max(2, Math.min(800, v0.esc * k));
          const wx = (gesto.m0.x - v0.ox) / v0.esc, wy = (gesto.m0.y - v0.oy) / v0.esc;
          st.vista = { esc: e2, ox: m.x - wx * e2, oy: m.y - wy * e2 };
        }
        pintar(); return;
      }
      if (!pulsado) {
        if (e.pointerType !== 'touch' && st.modo === 'planta') { actualizarCursor(ps); pintar(); }
        return;
      }
      const dx = ps.x - pulsado.x0, dy = ps.y - pulsado.y0;
      if (pulsado.tipo === 'pan') { st.vista.ox = pulsado.ox + dx; st.vista.oy = pulsado.oy + dy; pintar(); return; }
      if (pulsado.tipo === 'orbita') {
        if (pulsado.pan) { st.cam.px = pulsado.px + dx; st.cam.py = pulsado.py + dy; }
        else { st.cam.theta = pulsado.th + dx * 0.008; st.cam.phi = Math.max(0.08, Math.min(1.5, pulsado.ph + dy * 0.006)); }
        pintar(); return;
      }
      if (pulsado.tipo === 'herr') { actualizarCursor(ps); pintar(); return; }
      if (pulsado.tipo === 'sel') {
        if (!pulsado.movido && Math.hypot(dx, dy) < 6) return;
        const obj = pulsado.objetivo;
        if (!obj) { st.vista.ox = pulsado.ox + dx; st.vista.oy = pulsado.oy + dy; pulsado.movido = true; pintar(); return; }
        if (!pulsado.movido) {
          pulsado.movido = true;
          st.deshacer.push(instantanea()); st.rehacer = [];
          st.sel = obj.id;
          pulsado.orig = copia(obj);
          if (pulsado.asa === 'a' || pulsado.asa === 'b') {
            const p0 = obj[pulsado.asa];
            pulsado.unidos = plano.elementos.filter(o => o !== obj && (LINEALES.includes(o.tipo))).flatMap(o => ['a', 'b'].filter(k => E.dist(o[k], p0) < 0.01).map(k => [o, k]));
          }
        }
        const pw = aMundo(ps);
        st.coord = pw;
        if (pulsado.asa != null) {
          const o = pulsado.orig;
          const fijo = pulsado.asa === 'a' ? o.b : pulsado.asa === 'b' ? o.a : null;
          const q = ajustar(pw, fijo, obj.id);
          if (typeof pulsado.asa === 'number') obj.puntos[pulsado.asa] = pr3(q);
          else { obj[pulsado.asa] = pr3(q); for (const [u, k] of pulsado.unidos || []) u[k] = pr3(q); }
          st.cursor = q;
        } else mover(obj, pulsado.orig, pw.x - pulsado.w0.x, pw.y - pulsado.w0.y);
        pintar();
      }
    }, { signal: ac.signal });

    function mover(obj, o, dx, dy) {
      const k = paso();
      if (obj.tipo === 'puerta' || obj.tipo === 'ventana') {
        const m = buscarId(obj.muro);
        if (!m) return;
        const L = E.largo(m), u = { x: (m.b.x - m.a.x) / L, y: (m.b.y - m.a.y) / L };
        obj.s = r3(Math.max(obj.ancho / 2, Math.min(L - obj.ancho / 2, Math.round((o.s + dx * u.x + dy * u.y) / k) * k)));
        return;
      }
      if (obj.tipo === 'cota') {
        const L = E.dist(o.a, o.b) || 1, n = { x: -(o.b.y - o.a.y) / L, y: (o.b.x - o.a.x) / L };
        obj.off = r3(Math.round(((o.off ?? 0.5) + dx * n.x + dy * n.y) / k) * k);
        return;
      }
      dx = Math.round(dx / k) * k; dy = Math.round(dy / k) * k;
      const t = p => pr3({ x: p.x + dx, y: p.y + dy });
      if (obj.a) { obj.a = t(o.a); obj.b = t(o.b); }
      if (obj.puntos) obj.puntos = o.puntos.map(t);
      if (obj.x != null) Object.assign(obj, t(o));
    }

    const soltar = e => {
      punteros.delete(e.pointerId);
      if (gesto) { if (punteros.size < 2) { gesto = null; guardarPronto(); } pulsado = null; return; }
      const p = pulsado;
      pulsado = null;
      if (!p) return;
      if (e.type === 'pointercancel') { pintar(); return; }
      if (p.tipo === 'herr') { actualizarCursor(posicion(e)); clic(st.cursor); }
      else if (p.tipo === 'sel') {
        if (p.movido && p.objetivo) despues();
        else if (!p.movido) { st.sel = p.objetivo ? p.objetivo.id : null; if (st.sel) st.panelMin = false; pintar(); panel(); estado(); }
        else guardarPronto();
      } else guardarPronto();
    };
    cv.addEventListener('pointerup', soltar, { signal: ac.signal });
    cv.addEventListener('pointercancel', soltar, { signal: ac.signal });
    cv.addEventListener('contextmenu', e => e.preventDefault(), { signal: ac.signal });
    cv.addEventListener('pointerleave', e => { if (!pulsado && e.pointerType !== 'touch') { st.cursor = null; pintar(); } }, { signal: ac.signal });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.0015);
      if (st.modo === '3d') { st.cam.zoom = Math.max(0.2, Math.min(10, st.cam.zoom * k)); pintar(); return; }
      const ps = posicion(e), w = aMundo(ps), esc2 = Math.max(2, Math.min(800, st.vista.esc * k));
      st.vista = { esc: esc2, ox: ps.x - w.x * esc2, oy: ps.y - w.y * esc2 };
      actualizarCursor(ps); pintar(); guardarPronto();
    }, { passive: false, signal: ac.signal });

    window.addEventListener('keydown', e => {
      const enCampo = e.target.matches('input, select, textarea');
      if (e.key === 'Escape') { if (st.puntos.length) terminar(); else { st.sel = null; pintar(); panel(); } return; }
      if (enCampo) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? historial(st.rehacer, st.deshacer) : historial(st.deshacer, st.rehacer); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); historial(st.rehacer, st.deshacer); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel) { e.preventDefault(); eliminar(st.sel); return; }
      if (e.key === 'Enter' && st.puntos.length) { terminar(); return; }
      const atajo = { s: 'sel', m: 'muro', c: 'columna', v: 'viga', b: 'vigaCim', z: 'zapata', p: 'puerta', n: 'ventana', t: 'cubierta', d: 'cota', h: 'mano', e: 'generico', k: 'bloque' }[e.key.toLowerCase()];
      if (atajo && !e.ctrlKey && !e.metaKey) herramienta(atajo);
    }, { signal: ac.signal });

    /* ----- Barra de estado ----- */
    function estado() {
      const pild = (k, t) => `<button class="pild${st[k] ? ' activo' : ''}" data-t="${k}">${t}</button>`;
      const opcion = (clave, valores) => `<span class="pild-grupo">${valores.map(([v, t]) => `<button class="pild${st[clave] === v ? ' activo' : ''}" data-op3="${clave}:${v}">${t}</button>`).join('')}</span>`;
      const c = st.coord;
      if (st.modo === '3d') {
        estadoEl.innerHTML = `${opcion('cubierta3d', [['ver', 'Cubierta'], ['transparente', 'Transparente'], ['estructura', 'Solo estructura'], ['oculta', 'Sin cubierta']])}
          ${opcion('acabado3d', [['ladrillo', 'Ladrillo'], ['panete', 'Pañetado']])}
          ${opcion('terreno3d', [['opaco', 'Terreno'], ['translucido', 'Ver cimentación']])}
          <button class="pild" data-rot="-1" title="Girar">⟲</button><button class="pild" data-rot="1" title="Girar">⟳</button><button class="pild" data-accion="encuadrar">⤢ Encuadrar</button>`;
        return;
      }
      estadoEl.innerHTML = `<span class="pild info">${c ? `X ${num(c.x, 2)} · Y ${num(-c.y, 2)}` : '—'}</span>
        ${pild('rejilla', 'Rejilla')}${pild('orto', 'Orto')}${pild('iman', 'Imán')}${pild('etiquetas', 'Etiquetas')}
        ${plano.elementos.some(e => e.tipo === 'cubierta') ? pild('estrCub', 'Estructura cubierta') : ''}
        <button class="pild" data-accion="encuadrar">⤢ Encuadrar</button>`;
    }

    function resumen() {
      const q = E.cantidades(plano);
      const claves = ['Concreto', 'Acero', 'Tejas', 'Perfilería cubierta'];
      const datos = q.resumen.filter(([t]) => claves.includes(t)).slice(0, 3);
      resumenEl.hidden = !q.resumen.length;
      resumenEl.innerHTML = `${datos.map(([t, v]) => `<span>${esc(t)} <b>${esc(v)}</b></span>`).join('')}${q.avisos.length ? `<span class="alerta">⚠ ${q.avisos.length}</span>` : ''}<span class="mas">Σ</span>`;
    }

    /* ----- Panel de propiedades ----- */
    function campoHTML(obj, [k, t, tipo, opciones, ph], pre = '') {
      if (k === '—') return `<h3 class="ed-sep">${esc(t)}</h3>`;
      const base = pre ? obj.ref || {} : obj;
      if (tipo === 'txt') return `<label class="campo ancho"><span>${esc(t)}</span><input data-p="${pre}${k}" value="${esc(base[k] ?? '')}"></label>`;
      const v = k === 'angG' ? Math.round((obj.ang || 0) * 1800 / Math.PI) / 10 : base[k];
      if (tipo === 'sel') return `<label class="campo"><span>${esc(t)}</span><select data-p="${pre}${k}">${opciones.map(([val, txt]) =>
        `<option value="${esc(val)}"${String(val) === String(v ?? '') ? ' selected' : ''}>${esc(txt)}</option>`).join('')}</select></label>`;
      return `<label class="campo"><span>${esc(t)}</span><input data-p="${pre}${k}" type="number" step="any" inputmode="decimal" value="${v ?? ''}" placeholder="${esc(ph || '')}"></label>`;
    }

    function refuerzoHTML(el, ctx) {
      const ref = E.refuerzo(el, ctx);
      const zap = el.tipo === 'zapata';
      const campos = [['long', 'Ø longitudinal', 'sel', BARRAS_OPC],
        ...(zap ? [['s', 'Separación (m)', 'num', null, 'auto']] : [['n', 'N.º de barras', 'num', null, 'auto'], ['estribo', 'Ø estribo', 'sel', [['', 'Automático'], ['#2', '#2 (1/4")'], ['#3', '#3 (3/8")'], ['#4', '#4 (1/2")']]],
          ['so', 'Sep. zona confinada (m)', 'num', null, 'auto'], ['s', 'Sep. zona central (m)', 'num', null, 'auto']])];
      const kg = ref.barras.reduce((s, b) => s + b.n * b.l * Calc.BARRAS[b.barra].kg, 0);
      return `<h3 class="ed-sub">Acero de refuerzo</h3>
        <p class="sub">Vacío = automático según ${esc(E.SISTEMAS[ctx.cfg.sistema].split(' — ')[1] || '')}. Puede fijar el diámetro y la app recalcula la cantidad.</p>
        <div class="grid ed-grid">${campos.map(c => campoHTML(el, c, 'ref.')).join('')}</div>
        <div class="ed-ref"><b>${esc(ref.texto)}</b>${E.detalleSVG(ref.detalle)}
          <table class="tabla compacta"><thead><tr><th>Barra</th><th>Cant.</th><th>L c/u</th><th>kg</th></tr></thead><tbody>
          ${ref.barras.map(b => `<tr><td>${esc(b.barra)} <span class="sub">${esc(b.desc)}</span></td><td class="num">${b.n}</td><td class="num">${num(b.l, 2)}</td><td class="num">${num(b.n * b.l * Calc.BARRAS[b.barra].kg, 1)}</td></tr>`).join('')}
          <tr class="total"><td colspan="3">Total (${ref.amarres} amarres)</td><td class="num">${num(kg, 1)}</td></tr></tbody></table>
          ${ref.anclaje ? `<p class="sub">${esc(ref.anclaje)}.</p>` : ''}
          ${ref.avisos.map(a => `<p class="aviso">⚠ ${esc(a)}</p>`).join('')}</div>`;
    }

    function infoHTML(el, ctx) {
      const fila = (t, v) => `<tr><th>${esc(t)}</th><td class="num">${v}</td></tr>`;
      if (el.tipo === 'muro') {
        const i = E.muroInfo(el, ctx);
        return `<table class="tabla compacta datos"><tbody>${fila('Longitud', `${num(i.L, 2)} m`)}${fila('Área neta', `${num(i.neta, 2)} m²`)}
          ${fila('Vanos descontados', `${num(i.vanos, 2)} m²`)}${fila('Unidades (' + num(E.unidadesM2(i.u), 1) + '/m²)', `${num(i.unidades, 0)} un`)}
          ${fila('Mortero de pega', `${num(i.mortero, 3)} m³`)}${fila('Pañete', `${num(i.panete, 2)} m²`)}</tbody></table>`;
      }
      if (el.tipo === 'cubierta') {
        const c = E.cubiertaInfo(el);
        return `<table class="tabla compacta datos"><tbody>${fila('Área inclinada', `${num(c.areaReal, 2)} m²`)}
          ${c.tejas.map(t => fila(`Tejas ${t.nombre}`, `${t.total} un`)).join('')}
          ${fila(`Correas ${c.perfilCorrea.nombre}`, `${c.nCorreas} líneas · ${num(c.correasMl, 1)} m · ${c.correasPiezas} pzas de ${c.perfilCorrea.largo} m`)}
          ${c.correasKg ? fila('Peso de correas', `${num(c.correasKg, 1)} kg`) : ''}${c.caballetes ? fila('Caballetes', `${c.caballetes} un`) : ''}
          ${c.cerchas ? `${fila('Cerchas', `${c.cerchas.n} un de ${c.cerchas.paneles} paneles`)}
            ${fila(`Cordones ${c.cerchas.perfilCordon.nombre}`, `${num(c.cerchas.cordonMl, 1)} m · ${c.cerchas.cordonPiezas} pzas`)}
            ${fila(`Celosía ${c.cerchas.perfilCelosia.nombre}`, `${num(c.cerchas.celosiaMl, 1)} m · ${c.cerchas.celosiaPiezas} pzas`)}
            ${c.cerchas.kg ? fila('Peso de cerchas', `${num(c.cerchas.kg, 1)} kg`) : ''}` : fila('Culatas', `${num(c.culatas, 2)} m²`)}
          ${c.kgEstructura ? fila('Acero total estructura', `<b>${num(c.kgEstructura, 1)} kg</b>`) : ''}
          ${fila('Altura de cumbrera', `${num(c.f, 2)} m`)}</tbody></table>
          ${c.cerchas ? cerchaSVG(c) : ''}`;
      }
      if (el.tipo === 'generico') {
        const L = +el.L || 0, A = +el.A || 0, H = +el.H || 0;
        const q = { un: [1, 'un'], m: [L, 'm'], 'm²': [L * A, 'm²'], 'm³': [L * A * H, 'm³'] }[el.medida || 'un'];
        return `<table class="tabla compacta datos"><tbody>${fila('Cantidad para pago', `<b>${num(q[0], q[1] === 'un' ? 0 : 2)} ${q[1]}</b>`)}
          ${fila('Área en planta', `${num(L * A, 2)} m²`)}${fila('Volumen', `${num(L * A * H, 3)} m³`)}</tbody></table>`;
      }
      let vol = 0;
      if (el.tipo === 'columna') { const z = ctx.zapataBajo(el); vol = el.b * el.h * (el.alto + (z ? Math.max(0, z.prof - z.h) : 0)); }
      else if (el.tipo === 'zapata') vol = el.B * el.L * el.h;
      else if (el.tipo === 'vigaCim') vol = el.base * el.altura * E.largo(el);
      else if (el.tipo === 'viga') vol = el.base * el.altura * Math.max(0, E.largo(el) - ctx.columnasEn(el).reduce((s, p) => s + p.traslapo, 0));
      else return '';
      return `<table class="tabla compacta datos"><tbody>${LINEALES.includes(el.tipo) ? fila('Longitud', `${num(E.largo(el), 2)} m`) : ''}${fila('Concreto', `${num(vol, 3)} m³`)}</tbody></table>`;
    }

    function galeriaHTML(actual) {
      const cats = {};
      for (const [k, [t, cat]] of Object.entries(BLOQUES)) (cats[cat] = cats[cat] || []).push([k, t]);
      return `<div class="galeria">${Object.entries(cats).map(([cat, lista]) => `<h3 class="ed-sep">${esc(cat)}</h3>
        <div class="galeria-grid">${lista.map(([k, t]) => `<button class="blq${k === actual ? ' activo' : ''}" data-simbolo="${k}" title="${esc(t)}"><img src="${miniatura(k)}" alt=""><span>${esc(t)}</span></button>`).join('')}</div>`).join('')}</div>`;
    }
    function bibliotecaHTML() {
      return `<h3 class="ed-sep">Biblioteca de elementos</h3>${biblioteca.length
        ? `<div class="chips">${biblioteca.map((b, i) => `<span class="chip bib"><button data-bib="${i}" title="Usar">${esc(b.nombre)} · ${num(+b.L, 2)}×${num(+b.A, 2)}×${num(+b.H, 2)}</button><button data-bib-borrar="${i}" aria-label="Quitar de la biblioteca">✕</button></span>`).join('')}</div>`
        : '<p class="sub">Aún está vacía. Configure un elemento y pulse «Guardar en biblioteca».</p>'}`;
    }

    function panel() {
      cont.classList.toggle('sin-panel', !st.panel);
      const el = st.sel && buscarId(st.sel);
      const ctx = E.contexto(plano);
      // Sin selección ni herramienta de dibujo el panel queda recogido para dejar libre el dibujo.
      const contextual = !!el || !!CAMPOS[st.herr], min = contextual ? st.panelMin : !st.panelInfo;
      const cabeza = (color, titulo) => `<div class="ed-tit">${color ? `<span class="punto" style="background:${color}"></span>` : ''}<h2>${titulo}</h2>
        <button class="btn-icono min" data-accion="minimizar" title="${min ? 'Expandir' : 'Minimizar'}" aria-label="Minimizar panel">${min ? '▾' : '▴'}</button></div>`;
      panelEl.classList.toggle('minimizado', min);
      if (el) {
        const etq = E.etiquetas(plano).get(el.id);
        panelEl.innerHTML = `${cabeza(E.capa(el.tipo).color, `${esc(etq || '')} ${esc(el.tipo === 'generico' ? el.nombre || 'Elemento' : el.tipo === 'bloque' ? (BLOQUES[el.simbolo] || BLOQUES.arbol)[0] : E.NOMBRE_TIPO[el.tipo])}`)}
          <div class="ed-cuerpo-panel">
          ${el.tipo === 'bloque' ? galeriaHTML(el.simbolo) : ''}
          <div class="grid ed-grid">${CAMPOS[el.tipo](el).map(c => campoHTML(el, c)).join('')}</div>
          ${infoHTML(el, ctx)}
          ${['columna', 'viga', 'vigaCim', 'zapata'].includes(el.tipo) ? refuerzoHTML(el, ctx) : ''}
          <div class="acciones">${el.tipo === 'generico' ? '<button class="btn sm" data-accion="guardar-bib">★ Guardar en biblioteca</button>' : ''}
            <button class="btn sm" data-accion="duplicar">⧉ Duplicar</button><button class="btn sm peligro" data-accion="eliminar">🗑 Eliminar</button></div></div>`;
        return;
      }
      if (CAMPOS[st.herr]) {
        const pl = plano.plantillas[st.herr];
        panelEl.innerHTML = `${cabeza(E.capa(st.herr).color, `Nuevo: ${esc(E.NOMBRE_TIPO[st.herr])}`)}
          <div class="ed-cuerpo-panel"><p class="sub">${esc(AYUDA[st.herr])}</p>
          ${st.herr === 'bloque' ? galeriaHTML(pl.simbolo) : ''}
          ${st.herr === 'generico' ? bibliotecaHTML() : ''}
          <div class="grid ed-grid">${CAMPOS[st.herr](pl).map(c => campoHTML(pl, c)).join('')}</div>
          ${st.herr === 'muro' ? `<p class="sub">Espesor: ${num(E.MAMPOSTERIA[pl.unidad].e * 100, 1)} cm · ${num(E.unidadesM2(E.MAMPOSTERIA[pl.unidad]), 1)} unidades por m² con junta de 1 cm.</p>` : ''}</div>`;
        return;
      }
      const q = E.cantidades(plano);
      panelEl.innerHTML = `${cabeza('', `ⓘ ${esc(plano.nombre)}`)}
        <div class="ed-cuerpo-panel"><p class="sub">${esc(AYUDA[st.herr] || AYUDA.sel)}</p>
        <p class="sub"><b>Sistema:</b> ${esc(E.SISTEMAS[plano.cfg.sistema])} · ${plano.cfg.pisos} piso(s).</p>
        ${q.resumen.length ? `<table class="tabla compacta datos"><tbody>${q.resumen.map(([t, v]) => `<tr><th>${esc(t)}</th><td class="num">${esc(v)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${q.avisos.slice(0, 8).map(a => `<p class="aviso">⚠ ${esc(a)}</p>`).join('')}
        <div class="acciones"><button class="btn sm pri" data-accion="cantidades">Ver cantidades</button><button class="btn sm" data-accion="estructura">⚡ Estructura automática</button></div></div>`;
    }

    panelEl.addEventListener('change', e => {
      const k = e.target.dataset.p;
      if (!k) return;
      let v = e.target.value;
      const clave = k.replace('ref.', '');
      if (!TEXTO.has(clave)) v = v === '' ? '' : parseFloat(v);
      if (typeof v === 'number' && (!Number.isFinite(v) || (v <= 0 && !['angG', 'off', 'lado', 'z'].includes(clave)))) { toast('Valor no válido', 'error'); panel(); return; }
      const el = st.sel && buscarId(st.sel);
      const aplicar = obj => {
        if (k.startsWith('ref.')) {
          obj.ref = { ...(obj.ref || {}) };
          if (v === '') delete obj.ref[clave]; else obj.ref[clave] = v;
        } else if (k === 'angG') obj.ang = v * Math.PI / 180;
        else if (v === '' && ['util', 'traslapo', 'sep'].includes(k)) delete obj[k];
        else obj[k] = v;
        if ((obj.tipo === 'puerta' || obj.tipo === 'ventana') && obj.muro) {
          const m = buscarId(obj.muro);
          if (m) obj.s = Math.max(obj.ancho / 2, Math.min(E.largo(m) - obj.ancho / 2, obj.s));
        }
        if (obj.puntos || st.herr === 'cubierta') E.normalizarCubierta(obj);
      };
      if (el) cambiar(() => aplicar(el));
      else if (plano.plantillas[st.herr]) { aplicar(plano.plantillas[st.herr]); guardarPronto(); panel(); pintar(); }
    });
    panelEl.addEventListener('click', async e => {
      const simbolo = e.target.closest('[data-simbolo]')?.dataset.simbolo;
      if (simbolo) {
        const el = st.sel && buscarId(st.sel);
        if (el) cambiar(() => { el.simbolo = simbolo; });
        else { plano.plantillas.bloque.simbolo = simbolo; guardarPronto(); panel(); }
        return;
      }
      const ib = e.target.closest('[data-bib]')?.dataset.bib;
      if (ib != null) { Object.assign(plano.plantillas.generico, copia(biblioteca[+ib])); guardarPronto(); panel(); toast(`Plantilla: ${biblioteca[+ib].nombre}`); return; }
      const ibb = e.target.closest('[data-bib-borrar]')?.dataset.bibBorrar;
      if (ibb != null) { biblioteca.splice(+ibb, 1); await DB.guardarAjuste('biblioteca', biblioteca); panel(); return; }
      const a = e.target.closest('[data-accion]')?.dataset.accion;
      if (a === 'minimizar') { if (st.sel || CAMPOS[st.herr]) st.panelMin = !st.panelMin; else st.panelInfo = !st.panelInfo; panel(); return; }
      if (a === 'guardar-bib' && st.sel) {
        const el = buscarId(st.sel), datos = Object.fromEntries(['nombre', 'material', 'L', 'A', 'H', 'z', 'ang', 'color', 'medida'].map(k => [k, el[k]]));
        biblioteca = [...biblioteca.filter(b => b.nombre !== datos.nombre), datos];
        await DB.guardarAjuste('biblioteca', biblioteca);
        toast(`«${datos.nombre}» guardado en la biblioteca`);
        return;
      }
      if (a === 'cantidades') return verCantidades();
      if (a === 'estructura') return estructura();
      if (a === 'eliminar' && st.sel) eliminar(st.sel);
      if (a === 'duplicar' && st.sel) {
        const o = copia(buscarId(st.sel));
        o.id = UI.uid();
        if (o.tipo === 'puerta' || o.tipo === 'ventana') { toast('Inserte otro vano con su herramienta'); return; }
        mover(o, copia(o), 0.5, 0.5);
        cambiar(() => plano.elementos.push(o));
        st.sel = o.id; panel(); pintar();
      }
    });

    /* ----- Herramientas y acciones ----- */
    function herramienta(h) {
      if (st.puntos.length) terminar();
      st.herr = h; st.sel = null;
      if (CAMPOS[h]) st.panelMin = false;
      if (st.modo === '3d') modo('planta');
      $$('[data-herr]', raiz).forEach(b => b.classList.toggle('activo', b.dataset.herr === h));
      cv.style.cursor = h === 'mano' ? 'grab' : h === 'sel' ? 'default' : 'crosshair';
      flotanteVisible(); panel(); pintar();
    }
    function modo(m) {
      st.modo = m;
      $$('[data-modo]', raiz).forEach(b => b.classList.toggle('activo', b.dataset.modo === m));
      cont.classList.toggle('en-3d', m === '3d');
      flotanteVisible(); pintar();
    }

    raiz.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || panelEl.contains(b)) return;
      if (b.dataset.herr) return herramienta(b.dataset.herr);
      if (b.dataset.modo) return modo(b.dataset.modo);
      if (b.dataset.t) { st[b.dataset.t] = !st[b.dataset.t]; pintar(); return; }
      if (b.dataset.op3) { const [k, v] = b.dataset.op3.split(':'); st[k] = v; pintar(); return; }
      if (b.dataset.rot) { st.cam.theta += +b.dataset.rot * Math.PI / 4; pintar(); return; }
      const a = b.dataset.accion;
      if (a === 'deshacer') historial(st.deshacer, st.rehacer);
      else if (a === 'rehacer') historial(st.rehacer, st.deshacer);
      else if (a === 'terminar') terminar();
      else if (a === 'colocar') colocarLongitud();
      else if (a === 'encuadrar') { if (st.modo === '3d') Object.assign(st.cam, { zoom: 1, px: 0, py: 0 }); else st.vista = encuadre(W, H); pintar(); guardarPronto(); }
      else if (a === 'panel') { st.panel = !st.panel; panel(); }
      else if (a === 'capas') capas();
      else if (a === 'ajustes') ajustesPlano();
      else if (a === 'estructura') estructura();
      else if (a === 'cantidades') verCantidades();
      else if (a === 'exportar') exportar();
    }, { signal: ac.signal });
    $('[data-longitud]', flotante).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); colocarLongitud(); } });
    $('[data-nombre]', raiz).addEventListener('change', e => { plano.nombre = e.target.value.trim() || 'Plano'; guardarPronto(); });

    /* ----- Ventanas: capas, ajustes, estructura automática ----- */
    function capas() {
      const conteo = t => plano.elementos.filter(e => e.tipo === t).length;
      const cuerpo = document.createElement('div');
      cuerpo.innerHTML = `<p class="sub" style="margin-bottom:8px">Oculte capas para trabajar por partes. Las capas ocultas tampoco se seleccionan ni salen en el 3D.</p>
        <div class="capas">${E.CAPAS.map(c => `<label class="capa"><input type="checkbox" data-capa="${c.id}"${oculto(c.id) ? '' : ' checked'}>
          <span class="punto" style="background:${c.color}"></span><span>${esc(c.t)}</span><span class="chip">${conteo(c.id)}</span></label>`).join('')}</div>`;
      cuerpo.addEventListener('change', e => {
        const id = e.target.dataset.capa;
        plano.capasOcultas = e.target.checked ? plano.capasOcultas.filter(x => x !== id) : [...plano.capasOcultas, id];
        if (st.sel && oculto(buscarId(st.sel)?.tipo)) st.sel = null;
        guardarPronto(); pintar(); panel();
      });
      UI.modal({ titulo: 'Capas', cuerpo, ancho: '440px', botones: [{ texto: 'Listo', clase: 'pri' }] });
    }

    function ajustesPlano() {
      const c = plano.cfg;
      const sel = (k, t, opciones) => `<label class="campo"><span>${esc(t)}</span><select data-k="${k}">${opciones.map(([v, x]) => `<option value="${esc(v)}"${String(c[k]) === String(v) ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
      const n = (k, t) => `<label class="campo"><span>${esc(t)}</span><input data-k="${k}" type="number" step="any" inputmode="decimal" value="${c[k]}"></label>`;
      const mezclas = Object.entries(Calc.CONCRETOS).map(([k, x]) => [k, x.t]), morteros = Object.entries(Calc.MORTEROS).map(([k, x]) => [k, x.t]);
      UI.modal({
        titulo: 'Ajustes de cálculo del plano', ancho: '760px',
        cuerpo: `<div class="grid g2">
          ${sel('sistema', 'Sistema estructural', Object.entries(E.SISTEMAS))}${sel('pisos', 'Número de pisos', [[1, '1 piso'], [2, '2 pisos']])}
          ${sel('concreto', 'Concreto de columnas y vigas', mezclas)}${sel('concretoCim', 'Concreto de cimentación', mezclas)}
          ${sel('mortero', 'Mortero de pega', morteros)}${sel('morteroPanete', 'Mortero de pañete', morteros)}
          ${sel('varilla', 'Longitud comercial de varilla', [[6, '6 m'], [9, '9 m'], [12, '12 m']])}${n('traslapo', 'Traslapo (veces el diámetro)')}
          ${n('rec', 'Recubrimiento columnas y vigas (m)')}${n('recCim', 'Recubrimiento cimentación (m)')}
          ${n('despConcreto', 'Desperdicio de concreto (%)')}${n('despMamp', 'Desperdicio de ladrillo (%)')}
          ${n('despMortero', 'Desperdicio de mortero (%)')}${n('despAcero', 'Desperdicio de acero (%)')}
          ${n('solado', 'Espesor del solado (m)')}${n('sepColumnas', 'Separación máx. entre columnas de confinamiento (m)')}</div>
          <p class="sub" style="margin-top:10px">Los mínimos de refuerzo son de referencia (NSR-10). El diseño definitivo debe hacerlo y firmarlo un ingeniero estructural.</p>`,
        botones: [{ texto: 'Cancelar' }, {
          texto: 'Guardar', clase: 'pri', accion: caja => {
            st.deshacer.push(instantanea());
            for (const inp of $$('[data-k]', caja)) {
              const k = inp.dataset.k, v = inp.value;
              c[k] = k === 'sistema' || k.startsWith('concreto') || k.startsWith('mortero') ? v : +v;
            }
            despues();
          },
        }],
      });
    }

    function estructura() {
      const muros = plano.elementos.filter(e => e.tipo === 'muro');
      if (!muros.length) { toast('Primero dibuje los muros', 'error'); return; }
      const dmo = plano.cfg.sistema === 'DMO';
      UI.modal({
        titulo: 'Estructura automática', ancho: '560px',
        cuerpo: `<p class="sub">Genera los elementos a partir de los muros dibujados. No duplica los que ya existen.</p>
          <div class="capas">
          <label class="capa"><input type="checkbox" data-op="columnas" checked><span>Columnas en esquinas, cruces, extremos y cada ${num(plano.cfg.sepColumnas, 1)} m como máximo</span></label>
          <label class="capa"><input type="checkbox" data-op="vigas" checked><span>Vigas aéreas de amarre sobre los muros</span></label>
          <label class="capa"><input type="checkbox" data-op="vigasCim" checked><span>Vigas de cimentación bajo los muros</span></label>
          <label class="capa"><input type="checkbox" data-op="zapatas"${dmo ? ' checked' : ''}><span>Zapatas bajo las columnas</span></label>
          <label class="capa"><input type="checkbox" data-op="cubierta"${plano.elementos.some(e => e.tipo === 'cubierta') ? '' : ' checked'}><span>Cubierta sobre el contorno (alero de ${num(plano.plantillas.cubierta.alero, 2)} m)</span></label>
          <label class="capa"><input type="checkbox" data-op="cotas"><span>Cotas de todos los muros</span></label></div>`,
        botones: [{ texto: 'Cancelar' }, {
          texto: 'Generar', clase: 'pri', accion: caja => {
            const op = Object.fromEntries($$('[data-op]', caja).map(i => [i.dataset.op, i.checked]));
            const antes = plano.elementos.length;
            cambiar(() => generar(op));
            toast(`${plano.elementos.length - antes} elementos creados`);
          },
        }],
      });
    }

    function generar(op) {
      const els = plano.elementos, cfg = plano.cfg, pl = plano.plantillas;
      const muros = els.filter(e => e.tipo === 'muro');
      const dmo = cfg.sistema === 'DMO';
      const tMax = Math.max(...muros.map(E.espesorMuro));
      const hViga = dmo ? Math.max(0.30, pl.viga.altura) : Math.max(0.20, pl.viga.altura);
      if (op.columnas) {
        const cand = [];
        for (const m of muros) cand.push({ p: m.a, m }, { p: m.b, m });
        for (let i = 0; i < muros.length; i++) for (let j = i + 1; j < muros.length; j++) {
          const x = cruce(muros[i], muros[j]);
          if (x) cand.push({ p: x, m: muros[i] });
        }
        for (const m of muros) {
          const L = E.largo(m);
          const sobre = cand.filter(c => E.proyectar(c.p, m.a, m.b).d < 0.03).map(c => E.proyectar(c.p, m.a, m.b).s).sort((a, b) => a - b);
          for (let i = 1; i < sobre.length; i++) {
            const gap = sobre[i] - sobre[i - 1];
            const k = Math.ceil(gap / (+cfg.sepColumnas || 4) - 1e-9);
            for (let j = 1; j < k; j++) {
              const s = sobre[i - 1] + gap * j / k;
              cand.push({ p: { x: m.a.x + (m.b.x - m.a.x) * s / L, y: m.a.y + (m.b.y - m.a.y) * s / L }, m });
            }
          }
        }
        for (const c of cand) {
          if (els.some(e => e.tipo === 'columna' && E.dist(e, c.p) < 0.05)) continue;
          const t = E.espesorMuro(c.m);
          // Mínimo práctico de 15 cm para que quepan el refuerzo y el recubrimiento
          const h = dmo ? Math.max(0.25, t) : Math.max(0.15, t);
          const b = dmo ? Math.max(0.25, t) : Math.max(0.20, Math.ceil(0.02 / h / 0.05 - 1e-9) * 0.05);
          els.push({ id: UI.uid(), tipo: 'columna', ...pr3(c.p), b: r3(b), h: r3(h), alto: r3(c.m.alto + hViga), ang: E.angulo(c.m) });
        }
      }
      const existe = (tipo, m) => els.some(e => e.tipo === tipo && ((E.dist(e.a, m.a) < 0.02 && E.dist(e.b, m.b) < 0.02) || (E.dist(e.a, m.b) < 0.02 && E.dist(e.b, m.a) < 0.02)));
      if (op.vigas) for (const m of muros) {
        if (existe('viga', m)) continue;
        const base = dmo ? Math.max(0.25, E.espesorMuro(m)) : Math.max(0.15, E.espesorMuro(m));
        els.push({ id: UI.uid(), tipo: 'viga', a: { ...m.a }, b: { ...m.b }, base: r3(Math.max(base, pl.viga.base)), altura: r3(Math.max(hViga, 0.02 / base)) });
      }
      if (op.vigasCim) for (const m of muros) {
        if (existe('vigaCim', m)) continue;
        els.push({ id: UI.uid(), tipo: 'vigaCim', a: { ...m.a }, b: { ...m.b }, base: r3(Math.max(pl.vigaCim.base, E.espesorMuro(m))), altura: pl.vigaCim.altura });
      }
      if (op.zapatas) for (const c of els.filter(e => e.tipo === 'columna')) {
        if (els.some(e => e.tipo === 'zapata' && Math.abs(e.x - c.x) < e.B / 2 && Math.abs(e.y - c.y) < e.L / 2)) continue;
        els.push({ id: UI.uid(), tipo: 'zapata', x: c.x, y: c.y, ...copia(pl.zapata) });
      }
      if (op.cubierta && !els.some(e => e.tipo === 'cubierta')) {
        const b = E.caja(muros.flatMap(m => [m.a, m.b]));
        const t = tMax / 2;
        els.push({ id: UI.uid(), tipo: 'cubierta', puntos: [{ x: b.x0 - t, y: b.y0 - t }, { x: b.x1 + t, y: b.y0 - t }, { x: b.x1 + t, y: b.y1 + t }, { x: b.x0 - t, y: b.y1 + t }].map(pr3), ...copia(pl.cubierta), dir: b.w >= b.h ? 'y' : 'x' });
      }
      if (op.cotas) {
        const todos = muros.flatMap(m => [m.a, m.b]), cx = todos.reduce((s, p) => s + p.x, 0) / todos.length, cy = todos.reduce((s, p) => s + p.y, 0) / todos.length;
        plano.elementos = plano.elementos.filter(e => !(e.tipo === 'cota' && e.auto));
        for (const m of muros) {
          const L = E.largo(m);
          if (L < 0.3) continue;
          const n = { x: -(m.b.y - m.a.y) / L, y: (m.b.x - m.a.x) / L };
          const lado = ((m.a.x + m.b.x) / 2 - cx) * n.x + ((m.a.y + m.b.y) / 2 - cy) * n.y >= 0 ? 1 : -1;
          plano.elementos.push({ id: UI.uid(), tipo: 'cota', a: { ...m.a }, b: { ...m.b }, off: r3(lado * (E.espesorMuro(m) / 2 + 0.6)), auto: true });
        }
      }
    }
    function cruce(m1, m2) {
      const d1 = { x: m1.b.x - m1.a.x, y: m1.b.y - m1.a.y }, d2 = { x: m2.b.x - m2.a.x, y: m2.b.y - m2.a.y };
      const den = d1.x * d2.y - d1.y * d2.x;
      if (Math.abs(den) < 1e-9) return null;
      const t = ((m2.a.x - m1.a.x) * d2.y - (m2.a.y - m1.a.y) * d2.x) / den, u = ((m2.a.x - m1.a.x) * d1.y - (m2.a.y - m1.a.y) * d1.x) / den;
      return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999 ? { x: m1.a.x + d1.x * t, y: m1.a.y + d1.y * t } : null;
    }

    /* ----- Cantidades, PDF, CSV y DXF ----- */
    const celda = (v, col = []) => {
      const dec = col[1];
      if (typeof v === 'number' && dec != null) return `<td class="num">${num(v, dec === 'a' ? (Number.isInteger(v) ? 0 : 2) : dec)}</td>`;
      return `<td>${esc(v ?? '')}</td>`;
    };
    const tablaSec = (s, clase) => `<table class="${clase}"><thead><tr>${s.cols.map(c => `<th${c[1] != null ? ' class="num"' : ''}>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>
      ${s.filas.map(f => `<tr>${f.map((v, i) => celda(v, s.cols[i])).join('')}</tr>`).join('')}
      ${s.total ? `<tr class="total">${s.total.map((v, i) => celda(v, s.cols[i])).join('')}</tr>` : ''}</tbody></table>`;

    function verCantidades() {
      const q = E.cantidades(plano);
      if (!q.secciones.length) { toast('Dibuje elementos para calcular cantidades'); return; }
      UI.modal({
        titulo: `Cantidades — ${plano.nombre}`, ancho: '1100px',
        cuerpo: `${q.avisos.length ? `<div class="avisos">${q.avisos.map(a => `<p class="aviso">⚠ ${esc(a)}</p>`).join('')}</div>` : ''}
          ${q.secciones.map(s => `<section class="cant-sec"><h3>${esc(s.titulo)}</h3><div class="tabla-scroll">${tablaSec(s, 'tabla')}</div>
            ${(s.notas || []).map(n => `<p class="sub">${esc(n)}</p>`).join('')}</section>`).join('')}`,
        botones: [{ texto: '📦 Revisar en banco de materiales', accion: () => { Banco.revisarPlano(plano, q); return false; } },
          { texto: 'CSV para Excel', accion: () => { csv(q); return false; } }, { texto: '📄 PDF', clase: 'pri', accion: () => { pdf(); return false; } }, { texto: 'Cerrar' }],
      });
    }

    function csv(q) {
      const campo = v => { const s = typeof v === 'number' ? num(v, 3) : String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lineas = [];
      for (const s of q.secciones) {
        lineas.push(campo(s.titulo), s.cols.map(c => campo(c[0])).join(';'));
        for (const f of s.filas) lineas.push(f.map(campo).join(';'));
        if (s.total) lineas.push(s.total.map(campo).join(';'));
        lineas.push('');
      }
      UI.descargar(Reporte.nombreArchivo(`Cantidades ${plano.nombre}`) + '.csv', '﻿' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
      toast('CSV descargado');
    }

    function imagenPlanta(w = 1700, h = 1150) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g2 = c.getContext('2d');
      const sel = st.sel; st.sel = null;
      render(g2, w, h, encuadre(w, h, 70), { interactivo: false });
      st.sel = sel;
      return c.toDataURL('image/png');
    }
    function imagenIso(cam, cubierta, w = 1400, h = 1000) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      Iso.dibujar(c.getContext('2d'), plano, { zoom: 1, px: 0, py: 0, ...cam }, w, h, { cubierta, acabado: st.acabado3d, terreno: cubierta === 'oculta' ? 'translucido' : 'opaco' });
      return c.toDataURL('image/png');
    }

    async function pdf() {
      toast('Preparando PDF…');
      await guardarYa();
      const q = E.cantidades(plano);
      const [c, p] = await Promise.all([Reporte.empresa(), plano.proyectoId ? DB.obtener('proyectos', plano.proyectoId) : null]);
      const der = `Fecha: ${esc(UI.fechaCorta(UI.hoy()))}<br>${esc(E.SISTEMAS[plano.cfg.sistema].split(' — ')[0])}`;
      const html = `<div class="r-hoja">${Reporte.encabezado(c, p, `Plano — ${plano.nombre}`, der)}
          <div class="r-sec">Planta arquitectónica y estructural</div><img class="r-plano" src="${imagenPlanta()}" alt="">
          <div class="r-sec">Isométricos</div><div class="r-isos"><img src="${imagenIso({ theta: 0.65, phi: 0.6 }, 'ver')}" alt=""><img src="${imagenIso({ theta: -2.4, phi: 0.75 }, 'oculta')}" alt=""></div></div>
        <div class="r-hoja">${Reporte.encabezado(c, p, `Cantidades de obra — ${plano.nombre}`, der)}
          ${q.secciones.map(s => `<div class="r-sec">${esc(s.titulo)}</div>${tablaSec(s, 'r-tabla')}${(s.notas || []).map(n => `<p class="r-nota">${esc(n)}</p>`).join('')}`).join('')}
          ${q.avisos.length ? `<div class="r-sec">Avisos</div>${q.avisos.map(a => `<p class="r-nota">⚠ ${esc(a)}</p>`).join('')}` : ''}
          <p class="r-nota">Cantidades preliminares calculadas a partir del modelo dibujado. El refuerzo corresponde a mínimos de referencia de la NSR-10 y no reemplaza el diseño estructural.</p></div>`;
      Reporte.imprimir(html, Reporte.nombreArchivo(`Plano ${plano.nombre}`));
    }

    function dxf() {
      const L = [];
      const add = (...x) => L.push(...x.map(String));
      const capasDXF = { muro: ['MUROS', 1], columna: ['COLUMNAS', 7], viga: ['VIGAS', 5], vigaCim: ['VIGAS_CIMENTACION', 34], zapata: ['ZAPATAS', 32],
        puerta: ['PUERTAS', 3], ventana: ['VENTANAS', 4], cubierta: ['CUBIERTA', 6], bloque: ['BLOQUES', 82], cota: ['COTAS', 8], texto: ['TEXTOS', 7],
        generico: ['ELEMENTOS', 140] };
      const f = v => (Math.round(v * 10000) / 10000).toString();
      const linea = (capa, a, b) => add(0, 'LINE', 8, capa, 10, f(a.x), 20, f(-a.y), 30, 0, 11, f(b.x), 21, f(-b.y), 31, 0);
      const poli = (capa, pts) => pts.forEach((p, i) => linea(capa, p, pts[(i + 1) % pts.length]));
      const texto = (capa, p, t, alto = 0.15, rot = 0) => add(0, 'TEXT', 8, capa, 10, f(p.x), 20, f(-p.y), 30, 0, 40, alto, 1, t, 50, f(rot));
      add(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 6, 0, 'ENDSEC');
      add(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, Object.keys(capasDXF).length);
      for (const [n, col] of Object.values(capasDXF)) add(0, 'LAYER', 2, n, 70, 0, 62, col, 6, 'CONTINUOUS');
      add(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
      const etq = E.etiquetas(plano);
      for (const e of plano.elementos) {
        const [capa] = capasDXF[e.tipo] || ['0'];
        if (e.tipo === 'muro') poli(capa, E.franja(e.a, e.b, E.espesorMuro(e)));
        else if (e.tipo === 'viga' || e.tipo === 'vigaCim') { poli(capa, E.franja(e.a, e.b, e.base)); const m = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }; texto('TEXTOS', m, `${etq.get(e.id)} ${num(e.base * 100, 0)}x${num(e.altura * 100, 0)}`, 0.12, -E.angulo(e) * 180 / Math.PI); }
        else if (e.tipo === 'columna') { poli(capa, E.rectangulo(e.x, e.y, e.b, e.h, e.ang || 0)); texto('TEXTOS', { x: e.x + e.b / 2 + 0.05, y: e.y - e.h / 2 - 0.05 }, etq.get(e.id), 0.12); }
        else if (e.tipo === 'zapata') { poli(capa, E.rectangulo(e.x, e.y, e.B, e.L)); texto('TEXTOS', { x: e.x - e.B / 2, y: e.y + e.L / 2 + 0.2 }, `${etq.get(e.id)} ${num(e.B, 2)}x${num(e.L, 2)}`, 0.12); }
        else if (e.tipo === 'cubierta') { poli(capa, E.desfasar(e.puntos, +e.alero || 0)); }
        else if (e.tipo === 'cota') {
          const Lc = E.dist(e.a, e.b) || 1, n = { x: -(e.b.y - e.a.y) / Lc, y: (e.b.x - e.a.x) / Lc }, off = e.off ?? 0.5;
          const A = { x: e.a.x + n.x * off, y: e.a.y + n.y * off }, B = { x: e.b.x + n.x * off, y: e.b.y + n.y * off };
          linea(capa, e.a, A); linea(capa, e.b, B); linea(capa, A, B);
          let ang = -Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x) * 180 / Math.PI;
          if (ang > 90) ang -= 180; if (ang <= -90) ang += 180;
          texto(capa, { x: (A.x + B.x) / 2 + n.x * 0.08, y: (A.y + B.y) / 2 + n.y * 0.08 }, num(Lc, 2), 0.15, ang);
        } else if (e.tipo === 'bloque') add(0, 'CIRCLE', 8, capa, 10, f(e.x), 20, f(-e.y), 30, 0, 40, f(radioBloque(e)));
        else if (e.tipo === 'generico') { poli(capa, E.rectangulo(e.x, e.y, +e.L || 1, +e.A || 1, e.ang || 0)); texto('TEXTOS', { x: e.x, y: e.y }, `${etq.get(e.id)} ${e.nombre || ''}`, 0.12); }
        else if (e.tipo === 'puerta' || e.tipo === 'ventana') {
          const m = buscarId(e.muro);
          if (!m) continue;
          const Lm = E.largo(m), u = { x: (m.b.x - m.a.x) / Lm, y: (m.b.y - m.a.y) / Lm }, n = { x: -u.y, y: u.x }, t = E.espesorMuro(m);
          const P = s => ({ x: m.a.x + u.x * s, y: m.a.y + u.y * s }), s0 = e.s - e.ancho / 2, s1 = e.s + e.ancho / 2;
          const o = (p, k) => ({ x: p.x + n.x * k, y: p.y + n.y * k });
          linea(capa, o(P(s0), t / 2), o(P(s0), -t / 2)); linea(capa, o(P(s1), t / 2), o(P(s1), -t / 2));
          if (e.tipo === 'ventana') for (const k of [t / 2, t / 7, -t / 7, -t / 2]) linea(capa, o(P(s0), k), o(P(s1), k));
          else {
            const lado = e.lado || 1, der = e.giro === 'der';
            const bis = o(P(der ? s1 : s0), lado * t / 2), punta = o(bis, lado * e.ancho);
            linea(capa, bis, punta);
            const a1 = -Math.atan2(n.y * lado, n.x * lado) * 180 / Math.PI, a2 = -Math.atan2(u.y * (der ? -1 : 1), u.x * (der ? -1 : 1)) * 180 / Math.PI;
            const [ini, fin] = ((a2 - a1 + 360) % 360) <= 180 ? [a1, a2] : [a2, a1];
            add(0, 'ARC', 8, capa, 10, f(bis.x), 20, f(-bis.y), 30, 0, 40, f(e.ancho), 50, f(ini), 51, f(fin));
          }
          texto('TEXTOS', o(P(e.s), (t / 2 + 0.3) * (e.tipo === 'puerta' ? -(e.lado || 1) : 1)), etq.get(e.id), 0.12);
        }
      }
      add(0, 'ENDSEC', 0, 'EOF');
      UI.descargar(Reporte.nombreArchivo(plano.nombre) + '.dxf', L.join('\r\n'), 'application/dxf');
      toast('DXF descargado (unidades en metros)');
    }

    function exportar() {
      UI.modal({
        titulo: 'Exportar', ancho: '460px',
        cuerpo: `<div class="lista-export">
          <button class="btn" data-x="pdf">📄 PDF: planta, isométricos y cantidades</button>
          <button class="btn" data-x="dxf">📐 DXF para AutoCAD o BricsCAD</button>
          <button class="btn" data-x="png">🖼 Imagen PNG de la planta</button>
          <button class="btn" data-x="csv">📊 Cantidades en CSV para Excel</button></div>`,
        botones: [{ texto: 'Cerrar' }],
      }).caja.addEventListener('click', e => {
        const x = e.target.closest('[data-x]')?.dataset.x;
        if (x === 'pdf') pdf();
        if (x === 'dxf') dxf();
        if (x === 'csv') csv(E.cantidades(plano));
        if (x === 'png') {
          const a = Object.assign(document.createElement('a'), { href: imagenPlanta(2400, 1600), download: Reporte.nombreArchivo(plano.nombre) + '.png' });
          document.body.append(a); a.click(); a.remove();
        }
      });
    }

    herramienta(st.herr);
    resumen();
  }

  return { lista, tab, editor, crear };
})();
