/**
 * Guardados diferidos de la mesa (el taller de Diseño espera 600 ms antes de
 * escribir). Antes de copiar el proyecto —«Convertir en proyecto completo»— se
 * vacían todos, para que la copia lleve el último cambio.
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
