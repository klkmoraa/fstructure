import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { saveProjectToStorage } from '../data/projectStorage';
import type { ProjectModel } from '../types';
import type { ProjectRepository } from '../storage/projectRepository';
import { recordLocalMetric } from '../analytics/localMetrics';
import type { UnifiedProjectSession } from '../storage/unifiedProjectSession';
import { registerPendingWrite } from '../shared/pendingWrites';

// Kept here as a literal so the optional IndexedDB module can remain lazy in
// the editor shell; this key carries only revision notifications, never data.
const PROJECT_LIBRARY_CHANGE_KEY = 'structureCo.project-library.changed';

/**
 * Sólo el id del último archivo abierto (nunca sus datos): al recargar en la
 * Home sin `?project=` se vuelve a él en lugar de empezar uno en blanco.
 */
const LAST_OPEN_PROJECT_KEY = 'fstructure.last-open-project';
export const readLastOpenProject = (): string | undefined => {
  try { return localStorage.getItem(LAST_OPEN_PROJECT_KEY) ?? undefined; } catch { return undefined; }
};

export interface ProjectStorageState {
  issue: 'recovered' | 'load-failed' | 'save-failed' | 'repository-degraded' | 'conflict' | null;
  message: string | null;
}

interface ProjectPersistenceOptions {
  unified: boolean;
  unifiedReady: boolean;
  project: ProjectModel;
  projectRef: MutableRefObject<ProjectModel>;
  unifiedSessionRef: MutableRefObject<UnifiedProjectSession | null>;
  /** Sube cuando hay que guardar aunque el proyecto sea el mismo objeto (fin de transacción, reparación). */
  persistenceRevision: number;
  /** Durante un arrastre no se guarda: se guarda al confirmar. */
  transactionActive: boolean;
  setStorageState: Dispatch<SetStateAction<ProjectStorageState>>;
}

/**
 * Autoguardado del Modelo 2D: el bundle unificado cuando la mesa es el proyecto
 * completo; si no, la biblioteca IndexedDB con su espejo compatible en
 * `localStorage`, la migración del guardado antiguo y la protección de
 * conflictos entre pestañas. Nada sale del dispositivo. El guardado espera
 * 250 ms, salvo que `flushPendingWrites` lo adelante (al ocultar o cerrar la
 * página, antes de copiar o de recargar); va por la misma sesión y su cola.
 *
 * Devuelve las referencias de revisión que `replaceProject` actualiza al abrir
 * otra versión.
 */
export function useProjectPersistence({
  unified, unifiedReady, project, projectRef, unifiedSessionRef, persistenceRevision, transactionActive, setStorageState,
}: ProjectPersistenceOptions) {
  const repositoryRef = useRef<ProjectRepository | null>(null);
  const repositoryRevisionRef = useRef<{ projectId: string; revision: number } | null>(null);
  const repositoryBlockedProjectIdRef = useRef<string | null>(null);
  const repositorySaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const projectChecksumRef = useRef<((project: ProjectModel) => Promise<string>) | null>(null);
  /** El guardado que espera sus 250 ms; `flushPendingWrites` lo adelanta (al ocultar la página, antes de copiar o recargar). */
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => registerPendingWrite(async () => {
    const save = pendingSaveRef.current;
    pendingSaveRef.current = null;
    // Nunca rechaza: un fallo ya queda en el estado de almacenamiento, como en el autoguardado.
    if (save) await save().catch(() => undefined);
  }), []);

  useEffect(() => {
    if (!unified || !unifiedReady) return;
    try { localStorage.setItem(LAST_OPEN_PROJECT_KEY, project.id); } catch { /* modo privado: se empieza como antes */ }
  }, [unified, unifiedReady, project.id]);

  useEffect(() => {
    if (unified || typeof indexedDB === 'undefined') return undefined;
    let active = true;
    void import('../storage/projectRepository').then(async ({ getProjectRepository, migrateLegacyProject, projectChecksum }) => {
      const repository = getProjectRepository();
      const migration = await migrateLegacyProject(repository, localStorage);
      if (!active) return;
      repositoryRef.current = repository;
      projectChecksumRef.current = projectChecksum;
      if (migration.record) repositoryRevisionRef.current = { projectId: migration.record.id, revision: migration.record.revision };
      if (migration.status === 'conflict') {
        repositoryBlockedProjectIdRef.current = projectRef.current.id;
        setStorageState({
          issue: 'conflict',
          message: 'IndexedDB ya contiene otra revisión. La copia compatible se conservó como recuperación; abre una versión desde Proyectos locales para desbloquear ese ID.',
        });
      }
    }).catch((error: unknown) => {
      if (!active) return;
      setStorageState({
        issue: 'repository-degraded',
        message: error instanceof Error ? error.message : 'La biblioteca local no está disponible; el proyecto sigue protegido en el guardado compatible.',
      });
    });
    return () => { active = false; };
  }, [unified, projectRef, setStorageState]);

  useEffect(() => {
    if (unified) return;
    const onLibraryChange = (event: StorageEvent) => {
      if (event.key !== PROJECT_LIBRARY_CHANGE_KEY || !event.newValue) return;
      try {
        const change = JSON.parse(event.newValue) as { projectId?: unknown; revision?: unknown };
        if (typeof change.projectId !== 'string' || change.projectId !== projectRef.current.id || typeof change.revision !== 'number') return;
        if (repositoryRevisionRef.current?.projectId === change.projectId && repositoryRevisionRef.current.revision === change.revision) return;
        const changedProjectId = change.projectId;
        const repository = repositoryRef.current;
        const checksum = projectChecksumRef.current;
        if (!repository || !checksum) return;
        // Otra pestaña escribió una revisión distinta. Marcamos el ID antes
        // de cualquier await para que un autosave pendiente no gane la carrera
        // y, después, conservamos la edición local si realmente difiere.
        repositoryBlockedProjectIdRef.current = changedProjectId;
        const localProject = structuredClone(projectRef.current);
        repositorySaveChainRef.current = repositorySaveChainRef.current.catch(() => undefined).then(async () => {
          try {
            const saved = await repository.openProject(changedProjectId);
            if (!saved) return;
            if (await checksum(localProject) === saved.checksum) {
              repositoryRevisionRef.current = { projectId: saved.id, revision: saved.revision };
              repositoryBlockedProjectIdRef.current = null;
              return;
            }
            await repository.createRecovery(localProject, 'conflict');
            saveProjectToStorage(localStorage, saved.project);
            recordLocalMetric(localStorage, { name: 'conflict_detected', code: 'cross-tab' });
            setStorageState({
              issue: 'conflict',
              message: 'Otra pestaña guardó una revisión distinta. Esta edición se protegió como recuperación hasta que elijas una versión en Proyectos locales.',
            });
          } catch (error) {
            setStorageState({
              issue: 'repository-degraded',
              message: error instanceof Error ? error.message : 'No se pudo proteger la edición al sincronizar otra pestaña.',
            });
          }
        });
      } catch {
        // A malformed notification must not interrupt the editor.
      }
    };
    window.addEventListener('storage', onLibraryChange);
    return () => window.removeEventListener('storage', onLibraryChange);
  }, [unified, projectRef, setStorageState]);

  useEffect(() => {
    if (transactionActive || !unifiedReady) return;
    const save = (): Promise<void> => {
      if (unified) {
        const session = unifiedSessionRef.current;
        if (!session) return Promise.resolve();
        return session.save2D(project).then(async (record) => {
          setStorageState(session.status);
          // Compatibility library surfaces read this mirror. Only the bundle owns revisions.
          const { getProjectRepository } = await import('../storage/projectRepository');
          const mirror = getProjectRepository();
          const previous = await mirror.openProject(record.id);
          await mirror.saveProject(record.bundle.model2d, previous?.revision);
        }).catch((error: unknown) => setStorageState(session.status.issue ? session.status : {
          issue: 'repository-degraded', message: `Bundle guardado; espejo de biblioteca no disponible: ${String(error)}`,
        }));
      }
      try {
        const repository = repositoryRef.current;
        const persistCompatible = (next: ProjectModel) => {
          saveProjectToStorage(localStorage, next);
          setStorageState((current) => current.issue === 'save-failed'
            ? { issue: null, message: null }
            : current);
        };
        if (!repository) {
          persistCompatible(project);
          return Promise.resolve();
        }
        // A conflict is already a durable recovery. Do not keep rewriting the
        // compatibility mirror while the user is deciding which revision wins.
        if (repositoryBlockedProjectIdRef.current === project.id) return Promise.resolve();
        repositorySaveChainRef.current = repositorySaveChainRef.current.catch(() => undefined).then(async () => {
          const expected = repositoryRevisionRef.current?.projectId === project.id
            ? repositoryRevisionRef.current.revision
            : undefined;
          try {
            const record = await repository.saveProject(project, expected);
            repositoryRevisionRef.current = { projectId: record.id, revision: record.revision };
            persistCompatible(record.project);
            localStorage.setItem(PROJECT_LIBRARY_CHANGE_KEY, JSON.stringify({ projectId: record.id, revision: record.revision, at: record.updatedAt }));
            if (repositoryBlockedProjectIdRef.current === record.id) repositoryBlockedProjectIdRef.current = null;
            setStorageState((current) => current.issue === 'repository-degraded' || current.issue === 'conflict'
              ? { issue: null, message: null }
              : current);
          } catch (error) {
            const conflict = error instanceof Error && error.name === 'RepositoryConflictError';
            if (conflict) {
              repositoryBlockedProjectIdRef.current = project.id;
              // The local edit is now a recovery in IndexedDB. Mirror the
              // canonical saved side so an offline reload cannot manufacture
              // a second conflict from the compatibility store.
              const saved = await repository.openProject(project.id).catch(() => null);
              if (saved) saveProjectToStorage(localStorage, saved.project);
            } else {
              persistCompatible(project);
            }
            setStorageState({
              issue: conflict ? 'conflict' : 'repository-degraded',
              message: error instanceof Error ? error.message : 'La biblioteca IndexedDB no pudo guardar; el espejo compatible permanece disponible.',
            });
          }
        });
        return repositorySaveChainRef.current;
      } catch (error) {
        setStorageState({
          issue: 'save-failed',
          message: error instanceof Error ? error.message : 'No se pudo guardar el proyecto.',
        });
        return Promise.resolve();
      }
    };
    pendingSaveRef.current = save;
    const handle = window.setTimeout(() => {
      // Ya lo adelantó `flushPendingWrites`, o lo reemplazó un cambio posterior.
      if (pendingSaveRef.current !== save) return;
      pendingSaveRef.current = null;
      void save();
    }, 250);
    return () => {
      window.clearTimeout(handle);
      if (pendingSaveRef.current === save) pendingSaveRef.current = null;
    };
  }, [project, persistenceRevision, transactionActive, unified, unifiedReady, unifiedSessionRef, setStorageState]);

  return { repositoryRevisionRef, repositoryBlockedProjectIdRef };
}
