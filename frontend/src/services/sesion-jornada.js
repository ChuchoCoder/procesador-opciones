/**
 * La sesión de una jornada: qué se guarda al salir y cómo se interpreta lo
 * guardado al volver.
 *
 * Esta lógica vivía dentro de un `useEffect` de 85 líneas en `ProcessorScreen`,
 * mezclada con llamadas a setters de React, así que no se podía ejercitar: ni
 * el chequeo de versión, ni la migración del formato viejo de selección, ni la
 * validación de los enums. Son exactamente las tres cosas que se rompen en
 * silencio cuando cambia la forma de lo persistido.
 *
 * Acá es puro: entra lo que estaba en storage, sale una decisión. El
 * componente sólo aplica esa decisión a su estado.
 *
 * Ver CONTEXT.md: "jornada" es el día de trading que se está procesando.
 */

/** Versión del snapshot. Un valor distinto invalida lo guardado. */
export const LAST_SESSION_STORAGE_VERSION = 1;

/** Qué hacer con lo que había en storage. */
export const ACCIONES_SESION = Object.freeze({
  /** No había nada utilizable; no se toca el storage. */
  IGNORAR: 'ignorar',
  /** Había algo, pero es inservible: hay que borrarlo. */
  DESCARTAR: 'descartar',
  /** Se puede restaurar. */
  RESTAURAR: 'restaurar',
});

/**
 * Arma el snapshot que se persiste.
 *
 * @param {object} estado
 * @returns {object}
 */
export const construirSnapshotSesion = ({
  fileName = null,
  report,
  selectedGroupId,
  selectedGroupIds,
  activeOperationType,
  activePreview,
  ahora = Date.now(),
}) => ({
  version: LAST_SESSION_STORAGE_VERSION,
  savedAt: ahora,
  fileName: fileName ?? null,
  report,
  selectedGroupId,
  selectedGroupIds,
  activeOperationType,
  activePreview,
});

/**
 * Normaliza las selecciones de grupo guardadas, cubriendo el formato viejo.
 *
 * Hasta cierto punto se guardaba un único `selectedGroupId` (string) para toda
 * la pantalla. Hoy se guarda `selectedGroupIds`, un valor por tipo de
 * operación. Un snapshot viejo se migra replicando ese único valor a todos los
 * tipos.
 *
 * @param {object} stored - el snapshot guardado
 * @param {string[]} tipos - los tipos de operación que existen hoy
 * @returns {Record<string,string>|null} las selecciones, o null si no hay nada que restaurar
 */
export const normalizarSeleccionesGuardadas = (stored = {}, tipos = []) => {
  if (stored.selectedGroupIds && typeof stored.selectedGroupIds === 'object') {
    const entradas = Object.entries(stored.selectedGroupIds)
      .filter(([, valor]) => typeof valor === 'string');

    return entradas.length > 0 ? Object.fromEntries(entradas) : null;
  }

  // Formato viejo: un solo valor para todos los tipos.
  if (typeof stored.selectedGroupId === 'string' && tipos.length > 0) {
    return Object.fromEntries(tipos.map((tipo) => [tipo, stored.selectedGroupId]));
  }

  return null;
};

/**
 * Decide qué hacer con lo que había en storage.
 *
 * @param {*} stored - lo que devolvió el storage (puede ser cualquier cosa)
 * @param {object} opciones
 * @param {string[]} opciones.tipos - tipos de operación válidos
 * @param {string[]} opciones.alcancesPreview - valores válidos de preview
 * @returns {{accion: string, sesion?: object}}
 */
export const interpretarSesionGuardada = (stored, { tipos = [], alcancesPreview = [] } = {}) => {
  if (!stored || typeof stored !== 'object') {
    return { accion: ACCIONES_SESION.IGNORAR };
  }

  if (stored.version !== LAST_SESSION_STORAGE_VERSION || !stored.report) {
    return { accion: ACCIONES_SESION.DESCARTAR };
  }

  const report = stored.report;
  if (typeof report !== 'object') {
    return { accion: ACCIONES_SESION.DESCARTAR };
  }

  return {
    accion: ACCIONES_SESION.RESTAURAR,
    sesion: {
      report,
      warnings: Array.isArray(report?.summary?.warnings) ? report.summary.warnings : [],
      // Un snapshot sin nombre de archivo sigue siendo restaurable: viene de
      // una sincronización con el broker, no de un CSV.
      fileName: stored.fileName || 'Operaciones previas',
      selecciones: normalizarSeleccionesGuardadas(stored, tipos),
      activeOperationType: tipos.includes(stored.activeOperationType)
        ? stored.activeOperationType
        : null,
      activePreview: alcancesPreview.includes(stored.activePreview)
        ? stored.activePreview
        : null,
    },
  };
};
