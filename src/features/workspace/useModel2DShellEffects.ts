import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { AnalysisResult, ProjectModel } from '../../types';
import { isOwnHistoryScope } from './commandRegistry';
import type { ShellClass } from './shellComposition';
import type { SurfaceId } from './surfacePresentation';
import { nextAvailableInspectorDetent, normalizeInspectorDetent, type useWorkspaceLayoutPreferences } from './useWorkspaceLayoutPreferences';
import { emitWorkspaceCommand } from './workspaceCommands';
import { analysisFeedback } from './analysisFeedback';

/*
 * Efectos del shell del Modelo 2D que no dependen de su composición: atajos
 * globales, altura de la hoja del inspector y el
 * aviso del Doctor tras un análisis. `WorkspaceShell` los usa tal cual.
 */

type LayoutController = ReturnType<typeof useWorkspaceLayoutPreferences>;

/**
 * Respaldo de foco para el cierre de una superficie: enfoca el primer lanzador
 * visible de `selector` **sólo** si nadie reclamó el foco.
 *
 * `SurfacePresentationProvider` ya devuelve el foco al disparador que abrió la
 * superficie cuando ese disparador sigue montado, y lo hace en su propio
 * `requestAnimationFrame`. Un respaldo incondicional se ejecuta después y le
 * roba el foco a ese disparador: en K0 eso mandaba el foco a Utilidades aunque
 * Resultados se hubiera abierto —y cerrado— desde su botón persistente de la
 * barra. Encolar este cuadro después del bróker y comprobar `activeElement`
 * conserva el respaldo para el caso que lo justifica —un item de menú que se
 * desmonta con la hoja— sin pisar la restauración correcta.
 */
export const focusStableLauncherIfUnclaimed = (selector: string): void => {
  window.requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const launcher = [...document.querySelectorAll<HTMLElement>(selector)]
      .find((candidate) => candidate.isConnected && candidate.getClientRects().length > 0);
    launcher?.focus({ preventScroll: true });
  });
};

/**
 * Ctrl/Cmd+K alterna la paleta salvo que haya una superficie modal o de datos
 * activa. Ctrl/Cmd+Z y Ctrl/Cmd+Y mueven el mismo deshacer/rehacer que los
 * botones del historial (G-01 · CRI-103) — pero nunca con el foco en un campo
 * de texto, la rejilla del Datasheet o una superficie modal con su propio
 * historial: lo peor sería deshacer una operación del modelo creyendo deshacer
 * una celda.
 */
export function useModel2DShortcuts({ paletteBlocked, toggleSurface, canUndo, canRedo, undo, redo }: {
  paletteBlocked: boolean;
  toggleSurface: (surface: SurfaceId, trigger?: HTMLElement | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (paletteBlocked) return;
      event.preventDefault();
      toggleSurface('palette', document.activeElement instanceof HTMLElement ? document.activeElement : null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteBlocked, toggleSurface]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      const isUndo = key === 'z';
      const isRedo = key === 'y';
      if (!isUndo && !isRedo) return;
      if (isOwnHistoryScope(event.target)) return;
      if (isUndo) {
        if (!canUndo) return;
        event.preventDefault();
        undo();
      } else {
        if (!canRedo) return;
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canRedo, canUndo, redo, undo]);
}

/**
 * Altura de la hoja del inspector en un teléfono: se ajusta a la ventana al
 * girar o redimensionar, sube a una altura legible cuando se pide para leer o
 * editar, y recorre sus alturas con el asa.
 */
const inspectorViewportHeight = () => {
  const viewport = window.visualViewport;
  return viewport && Math.abs(viewport.scale - 1) <= 0.01 ? viewport.height : window.innerHeight;
};

export function useInspectorDetent({ preferences: layout, setPreference }: LayoutController, shellClass: ShellClass) {
  useEffect(() => {
    const normalizeDetent = () => {
      const next = normalizeInspectorDetent(layout.inspectorDetent, {
        width: window.innerWidth,
        height: inspectorViewportHeight(),
      });
      if (next !== layout.inspectorDetent) setPreference('inspectorDetent', next);
    };
    normalizeDetent();
    window.addEventListener('resize', normalizeDetent);
    window.addEventListener('orientationchange', normalizeDetent);
    window.visualViewport?.addEventListener('resize', normalizeDetent);
    return () => {
      window.removeEventListener('resize', normalizeDetent);
      window.removeEventListener('orientationchange', normalizeDetent);
      window.visualViewport?.removeEventListener('resize', normalizeDetent);
    };
  }, [layout.inspectorDetent, setPreference]);

  // Una hoja que se pide para leer o editar no nace en su altura mínima, donde
  // sólo cabe la cabecera.
  const ensureReadableDetent = useCallback(() => {
    if (shellClass === 'K0' && layout.inspectorDetent === 'compact') setPreference('inspectorDetent', 'medium');
  }, [layout.inspectorDetent, setPreference, shellClass]);

  const cycleInspectorDetent = useCallback((direction: 1 | -1) => {
    const next = nextAvailableInspectorDetent(layout.inspectorDetent, direction, {
      width: window.innerWidth,
      height: inspectorViewportHeight(),
    });
    if (next !== layout.inspectorDetent) setPreference('inspectorDetent', next);
  }, [layout.inspectorDetent, setPreference]);

  return { ensureReadableDetent, cycleInspectorDetent };
}

type PendingModelDoctorNotification = {
  id: number;
  projectId: string;
  analysisAtRequest: AnalysisResult | null;
  hasStarted: boolean;
};

/**
 * Tras un análisis pedido por la persona, muestra el estado real de la corrida
 * y una acción explícita para revisar sus resultados o sus límites. Sólo la última petición cuenta y un cambio de
 * proyecto la descarta.
 */
export function useModelDoctorNotification({ project, analysis, isAnalyzing, t }: {
  project: ProjectModel;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  t: (key: TranslationKey) => string;
}) {
  const [pendingModelDoctorNotification, setPendingModelDoctorNotification] = useState<PendingModelDoctorNotification | null>(null);
  const modelDoctorNotificationIdRef = useRef(0);
  const pendingModelDoctorNotificationIdRef = useRef<number | null>(null);

  const requestNotification = useCallback((projectId: string, analysisAtRequest: AnalysisResult | null) => {
    const id = modelDoctorNotificationIdRef.current + 1;
    modelDoctorNotificationIdRef.current = id;
    pendingModelDoctorNotificationIdRef.current = id;
    setPendingModelDoctorNotification({ id, projectId, analysisAtRequest, hasStarted: false });
  }, []);

  const resetNotification = useCallback(() => {
    pendingModelDoctorNotificationIdRef.current = null;
    setPendingModelDoctorNotification(null);
  }, []);

  useEffect(() => {
    const request = pendingModelDoctorNotification;
    if (!request) return undefined;
    if (request.projectId !== project.id) {
      if (pendingModelDoctorNotificationIdRef.current === request.id) {
        pendingModelDoctorNotificationIdRef.current = null;
        setPendingModelDoctorNotification(null);
      }
      return undefined;
    }
    if (isAnalyzing) {
      if (!request.hasStarted) {
        setPendingModelDoctorNotification((current) => current?.id === request.id
          ? { ...current, hasStarted: true }
          : current);
      }
      return undefined;
    }
    if (!request.hasStarted || analysis === request.analysisAtRequest) return undefined;

    if (!analysis) return undefined;
    if (pendingModelDoctorNotificationIdRef.current !== request.id) return undefined;
    // Consume before emitting: Strict Mode and view updates must not duplicate it.
    pendingModelDoctorNotificationIdRef.current = null;
    setPendingModelDoctorNotification(null);
    const notice = analysisFeedback(analysis, project.settings.language, t('modelDoctor.open'));
    // Routine confirmations do not cover the drawing. Every warning and error
    // still follows the existing notification path, with its original details.
    if (notice.tone === 'warning' || notice.tone === 'error') {
      emitWorkspaceCommand('show-toast', notice);
    }
    return undefined;
  }, [analysis, isAnalyzing, pendingModelDoctorNotification, project, t]);

  return { requestNotification, resetNotification };
}
