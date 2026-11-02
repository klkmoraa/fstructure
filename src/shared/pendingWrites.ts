/**
 * Guardados diferidos de la app: el autoguardado del Modelo 2D espera 250 ms y
 * el taller de Diseño 600 ms antes de escribir. Antes de copiar el proyecto
 * —«Convertir en proyecto completo»—, de recargar por una versión nueva o al
 * ocultar la página se vacían todos, para que el último cambio no se quede en
 * la espera. Cada guardado sigue su camino de siempre (la misma sesión y cola
 * del proyecto), sólo que sin esperar.
 */
type Flush = () => Promise<void>;
const flushers = new Set<Flush>();

/** Registra un guardado pendiente mientras su superficie está montada; devuelve cómo quitarlo. */
export function registerPendingWrite(flush: Flush): () => void {
  flushers.add(flush);
  return () => { flushers.delete(flush); };
}

/** Vacía todos los guardados pendientes; un fallo se propaga para no copiar a medias. */
export async function flushPendingWrites(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()));
}

/**
 * Al cerrar la pestaña, navegar fuera (`pagehide`) o dejarla en segundo plano
 * (`visibilitychange` a oculta, lo único seguro en móvil) se vacían los
 * guardados pendientes: una escritura de IndexedDB empezada ahí casi siempre
 * termina. Sin avisos `beforeunload`: guardar no le pide nada a la persona.
 */
export function flushPendingWritesOnHide(target: Window = window): () => void {
  const flush = () => { void flushPendingWrites().catch(() => undefined); };
  const onVisibility = () => { if (target.document.visibilityState === 'hidden') flush(); };
  target.addEventListener('pagehide', flush);
  target.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    target.removeEventListener('pagehide', flush);
    target.document.removeEventListener('visibilitychange', onVisibility);
  };
}
