import { useCallback, useEffect, useState } from 'react';
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
  /** Lo último que se leyó. `unknown` mientras la primera lectura no termina. */
  entry: WelcomeEntry;
  /**
   * Una lectura FRESCA del inventario, para decidir en el momento de decidir.
   *
   * No devuelve el `entry` de arriba ni una promesa cacheada, y es a propósito.
   * El inventario no es un dato estable que pueda congelarse al montar: la
   * biblioteca de IndexedDB se llena también DESPUÉS del primer pintado, porque
   * `ProjectProvider` corre `migrateLegacyProject()` por su cuenta para subir
   * la copia compatible de `localStorage`. Un valor capturado al montar deja a
   * quien vuelve marcado como nuevo durante toda la vida de la pantalla.
   *
   * Queda una ventana que esto NO cierra: un clic mientras esa migración está
   * todavía en vuelo lee una biblioteca aún vacía. La consecuencia es entrar a
   * la bienvenida en vez de al proyecto —el comportamiento anterior, con
   * «Continuar» a un clic—, así que la degradación va del lado seguro; cerrarla
   * del todo exigiría que la pantalla supiera cuándo acaba una migración que
   * hoy no publica ese hecho.
   */
  read: () => Promise<WelcomeEntry>;
}

export const useWelcomeEntry = (repository?: ProjectRepository): WelcomeEntryRead => {
  const [entry, setEntry] = useState<WelcomeEntry>(PENDING);

  useEffect(() => {
    let alive = true;
    void readWelcomeEntry(repository).then((next) => { if (alive) setEntry(next); });
    return () => { alive = false; };
  }, [repository]);

  const read = useCallback(() => readWelcomeEntry(repository), [repository]);

  return { entry, read };
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
