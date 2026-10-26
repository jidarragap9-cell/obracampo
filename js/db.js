/* Almacenamiento local (IndexedDB). Todos los datos quedan en la tablet y funcionan sin internet. */
const DB = (() => {
  const NOMBRE = 'obracampo';
  const VERSION = 2;
  const ALMACENES = ['proyectos', 'bitacora', 'fotos', 'cantidades', 'ajustes', 'insumos', 'apus', 'presupuestos'];
  let conexion = null;

  function abrir() {
    if (conexion) return conexion;
    conexion = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOMBRE, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const crear = (nombre, llave, indice) => {
          if (db.objectStoreNames.contains(nombre)) return;
          const s = db.createObjectStore(nombre, { keyPath: llave });
          if (indice) s.createIndex(...indice);
        };
        crear('proyectos', 'id');
        crear('bitacora', 'id', ['proyecto', 'proyectoId']);
        crear('fotos', 'id', ['registro', 'registroId']);
        crear('cantidades', 'id', ['proyecto', 'proyectoId']);
        crear('ajustes', 'clave');
        // Versión 2: base de precios y presupuestos
        crear('insumos', 'id');
        crear('apus', 'id');
        crear('presupuestos', 'proyectoId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return conexion;
  }

  async function operacion(almacenes, modo, fn) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(almacenes, modo);
      const req = fn(tx);
      tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }

  const una = (a, modo, fn) => operacion(a, modo, tx => fn(tx.objectStore(a)));

  return {
    obtener: (a, id) => una(a, 'readonly', s => s.get(id)),
    todos: a => una(a, 'readonly', s => s.getAll()),
    porProyecto: (a, pid) => una(a, 'readonly', s => s.index('proyecto').getAll(pid)),
    contar: (a, pid) => una(a, 'readonly', s => s.index('proyecto').count(pid)),
    guardar: (a, obj) => una(a, 'readwrite', s => s.put(obj)),
    borrar: (a, id) => una(a, 'readwrite', s => s.delete(id)),
    guardarVarios: (a, lista) => una(a, 'readwrite', s => { lista.forEach(o => s.put(o)); }),
    borrarVarios: (a, ids) => una(a, 'readwrite', s => { ids.forEach(id => s.delete(id)); }),

    async ajuste(clave, defecto) {
      const r = await this.obtener('ajustes', clave);
      return r ? r.valor : defecto;
    },
    guardarAjuste: (clave, valor) => una('ajustes', 'readwrite', s => s.put({ clave, valor })),

    /* Borra un registro de bitácora con sus fotos. */
    async borrarRegistro(id) {
      const fotos = await una('fotos', 'readonly', s => s.index('registro').getAllKeys(id));
      return operacion(['bitacora', 'fotos'], 'readwrite', tx => {
        tx.objectStore('bitacora').delete(id);
        fotos.forEach(f => tx.objectStore('fotos').delete(f));
      });
    },

    /* Borra el proyecto completo: bitácora, fotos y cantidades. */
    async borrarProyecto(pid) {
      const registros = await this.porProyecto('bitacora', pid);
      const cantidades = await this.porProyecto('cantidades', pid);
      for (const r of registros) await this.borrarRegistro(r.id);
      return operacion(['proyectos', 'cantidades', 'presupuestos'], 'readwrite', tx => {
        cantidades.forEach(c => tx.objectStore('cantidades').delete(c.id));
        tx.objectStore('presupuestos').delete(pid);
        tx.objectStore('proyectos').delete(pid);
      });
    },

    async exportar() {
      const datos = { app: 'ObraCampo', version: VERSION, fecha: new Date().toISOString() };
      for (const a of ALMACENES) datos[a] = await this.todos(a);
      return datos;
    },

    async importar(datos) {
      if (!datos || datos.app !== 'ObraCampo') throw new Error('El archivo no es una copia de seguridad de ObraCampo');
      return operacion(ALMACENES, 'readwrite', tx => {
        for (const a of ALMACENES) for (const o of datos[a] || []) tx.objectStore(a).put(o);
      });
    },
  };
})();
