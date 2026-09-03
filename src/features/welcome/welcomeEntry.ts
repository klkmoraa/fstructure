import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectRepository } from '../../storage/projectRepository';

/**
 * CRI-104 · ¿Quién está abriendo StructureCo?
 *
 * La decisión "quien regresa entra directo a la Mesa" se toma leyendo el
 * repositorio IndexedDB QUE YA EXISTE — `listProjects()` y `listRecoveries()`,
 * las dos lecturas que `ProjectHub` ya hace — y nada más. No se escribe una
 * preferencia nueva, no se toca `localStorage`, no se migra un solo registro:
 * si el usuario borra su biblioteca, vuelve a ser un usuario nuevo, que es
 * exactamente lo que debe pasar.
 *
 * El módulo del repositorio se carga con `import()` dinámico a propósito:
 * `WelcomeScreen` NO es `lazy` (vive en el chunk de entrada), y `ProjectHub`
 * ya arrastra `storage/projectRepository` en su propio chunk perezoso. Traerlo
 * aquí de forma estática lo subiría al arranque de todos los usuarios para
 * responder una pregunta que sólo importa después del primer pintado.
 */

export type WelcomeEntryStatus =
  /** Todavía no se sabe: la lectura del repositorio no ha terminado. */
  | 'unknown'
  /** Sin proyectos guardados. La bienvenida se muestra entera. */
  | 'new'
  /** Hay proyectos guardados de verdad. */
  | 'returning';

export interface WelcomeEntry {
  status: WelcomeEntryStatus;
  projects: number;
  recoveries: number;
  /**
   * Identidades de lo que hay guardado.
   *
   * El recuento contesta «¿hay biblioteca?»; los ids contestan «¿es el proyecto
   * abierto uno de ellos?», que es una pregunta distinta y necesaria: el
   * proyecto en memoria lo hidrata `ProjectProvider` desde `localStorage`
   * (`structureCo.project`) y la biblioteca vive en IndexedDB
   * (`structureCo.projects`). Son dos almacenes, y pueden no coincidir.
   */
  projectIds: readonly string[];
}

const PENDING: WelcomeEntry = { status: 'unknown', projects: 0, recoveries: 0, projectIds: [] };
const FRESH: WelcomeEntry = { status: 'new', projects: 0, recoveries: 0, projectIds: [] };

/**
 * Lee el inventario real. Ante cualquier fallo —IndexedDB no disponible, una
 * base bloqueada, un registro corrupto— devuelve `new`: el coste de enseñar la
 * bienvenida a alguien que ya la conocía es una pantalla de más; el de saltarla
 * por un error de lectura sería esconderle su propia biblioteca.
 */
export const readWelcomeEntry = async (repository?: ProjectRepository): Promise<WelcomeEntry> => {
  try {
    const active = repository
      ?? (typeof indexedDB === 'undefined' ? null : (await import('../../storage/projectRepository')).getProjectRepository());
    if (!active) return FRESH;
    const [projects, recoveries] = await Promise.all([active.listProjects(), active.listRecoveries()]);
    return {
      status: projects.length > 0 ? 'returning' : 'new',
      projects: projects.length,
      recoveries: recoveries.length,
      projectIds: projects.map((registro) => registro.id),
    };
  } catch {
    return FRESH;
  }
};

export interface WelcomeEntryRead {
  /** Lo último que se sabe. `unknown` mientras la lectura no ha terminado. */
  entry: WelcomeEntry;
  /**
   * La MISMA lectura, como promesa.
   *
   * Existe por el clic que llega antes de que la lectura termine. Decidir con
   * `unknown` no es decidir: es responder «usuario nuevo» a quien todavía no se
   * ha preguntado, y devolver a quien vuelve al camino de dos clics que este
   * cableado quita. Quien tenga que enrutar espera aquí —normalmente ya está
   * resuelta— en vez de leer un estado a medias.
   */
  settled: () => Promise<WelcomeEntry>;
}

export const useWelcomeEntry = (repository?: ProjectRepository): WelcomeEntryRead => {
  const [entry, setEntry] = useState<WelcomeEntry>(PENDING);
  const readRef = useRef<Promise<WelcomeEntry> | null>(null);

  useEffect(() => {
    let alive = true;
    const read = readWelcomeEntry(repository);
    readRef.current = read;
    void read.then((next) => { if (alive) setEntry(next); });
    return () => { alive = false; };
  }, [repository]);

  // El respaldo cubre el caso imposible en la práctica —un clic antes de que
  // corran los efectos— sin dejar que `settled()` devuelva `null`.
  const settled = useCallback(() => readRef.current ?? readWelcomeEntry(repository), [repository]);

  return { entry, settled };
};

/**
 * El salto directo a la Mesa.
 *
 * Tres condiciones, las tres observables y las tres derivadas del repositorio:
 *
 * 1. **Hay proyectos guardados.** Quien no tiene nada guardado no se salta la
 *    bienvenida: no tendría a dónde saltar.
 * 2. **No hay copias de recuperación pendientes.** `RecoveryRecord` es un
 *    mecanismo de seguridad de datos: si existe una copia recuperable, la
 *    bienvenida —donde vive la recuperación— tiene que verse. Saltársela
 *    dejaría el trabajo protegido fuera de la vista, que es justo el riesgo
 *    que el contrato de CRI-104 marca como inaceptable.
 * 3. **El proyecto abierto es uno de los guardados.** Tener biblioteca no dice
 *    nada sobre el lienzo al que se entraría: `ProjectProvider` hidrata desde
 *    `localStorage` y la biblioteca vive en IndexedDB, así que con la copia de
 *    `localStorage` ausente o ilegible —`loadProjectFromStorage` devuelve
 *    entonces un proyecto en blanco— el salto directo llevaría a un lienzo
 *    vacío anunciando que continúa el trabajo guardado. Y sin la bienvenida
 *    delante, el usuario ya no ve el nombre de lo que abre: la pantalla que se
 *    salta es justamente la que lo enseñaba, junto a «Continuar».
 *
 *    Cuando no coinciden, la respuesta correcta no es adivinar cuál abrir: es
 *    la bienvenida, donde están todos y se elige.
 */
export const shouldResumeDirectly = (entry: WelcomeEntry, openProjectId: string): boolean =>
  entry.status === 'returning'
  && entry.recoveries === 0
  && entry.projectIds.includes(openProjectId);
