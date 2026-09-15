import { lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Inspector } from '../inspector/Inspector';
import { ResultsPanel } from '../results/ResultsPanel';
import { DesignTool, Model2DTool } from './toolSurfaces';
import { DesignSurfaceContext, Model2DSurfaceContext } from './adapters/surfaceContexts';
import type { ToolId } from '../../shared/contracts';
import { Console } from '../shell/Console';
import { Instrument } from '../shell/Instrument';
import { ClassroomGuide } from '../classroom/ClassroomGuide';
import { ToastNotification } from './ToastNotification';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { SOLVER_2D } from '../../design-system/moduleIdentity';
import { createPersistedEditorLayerState, editorLayerReducer, persistEditorLayerState } from '../canvas/editorLayers';
import { activateEvidenceLayer } from '../canvas/evidenceLayers';
import { withCanvasViewSettings } from '../view/canvasViewSettings';
import { AppShellLayout } from './AppShellLayout';
import { WorkspaceTopBar } from './WorkspaceTopBar';
import { WorkspaceUtilities } from './WorkspaceUtilities';
import { ShellCompositionProvider } from './ShellCompositionProvider';
import { SurfacePresentationProvider } from './SurfacePresentationProvider';
import { useShellComposition } from './useShellComposition';
import { useSurfacePresentation } from './useSurfacePresentation';
import { nextAvailableInspectorDetent, normalizeInspectorDetent, useWorkspaceLayoutPreferences } from './useWorkspaceLayoutPreferences';
import { preloadDenseResultsSurface, type DenseResultView } from '../results/denseResults';
import { BROKER_SURFACE_IDS, reservesInspectorColumn, type SurfaceId } from './surfacePresentation';
import '../../design-system/components/ui.css';
import './phase1.css';
import './workspaceTopbar.css';
import './nativeWorkspaceMode.css';
/* La paleta se carga con `lazy()`, y su hoja viajaba SÓLO en ese trozo diferido:
   el modal se montaba, tomaba el foco y no se veía si la hoja del trozo no
   llegaba. La regla es la de CRI: una superficie modal no puede depender de un
   trozo diferido para existir visualmente, así que sus reglas entran también por
   esta entrada estable, que ya está cargada antes de que la paleta pueda
   abrirse. El componente conserva su propio import —la hoja vive junto a él— y
   el empaquetador resuelve el duplicado. */
import './commandPalette.css';
import '../canvas/mobileCanvasDensity.css';
import { emitWorkspaceCommand, onWorkspaceCommand } from './workspaceCommands';
import { isOwnHistoryScope } from './commandRegistry';
import type { AnalysisResult } from '../../types';
import type { RevisionSnapshot } from '../revision-comparison/revisionComparison';
import { DataSurfaceRetainedStateProvider } from './DataSurfaceRetainedState';
import { LazySurface } from './LazySurface';

const LazyCommandPalette = lazy(() => import('./CommandPalette').then((module) => ({ default: module.CommandPalette })));
const LazyLocalCommandAssistant = lazy(() => import('../ai/LocalCommandAssistant').then((module) => ({ default: module.LocalCommandAssistant })));
const LazyModelDoctor = lazy(() => import('../model-doctor/ModelDoctor').then((module) => ({ default: module.ModelDoctor })));
const LazyDatasheet = lazy(() => import('../datasheet/DatasheetPanel').then((module) => ({ default: module.DatasheetPanel })));
const LazyStructuralBom = lazy(() => import('../bom/StructuralBomPanel').then((module) => ({ default: module.StructuralBomPanel })));
const LazyRevisionComparison = lazy(() => import('../revision-comparison/RevisionComparisonPanel').then((module) => ({ default: module.RevisionComparisonPanel })));
const LazyDenseResults = lazy(() => preloadDenseResultsSurface());

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
const focusStableLauncherIfUnclaimed = (selector: string): void => {
  window.requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const launcher = [...document.querySelectorAll<HTMLElement>(selector)]
      .find((candidate) => candidate.isConnected && candidate.getClientRects().length > 0);
    launcher?.focus({ preventScroll: true });
  });
};

const renderWorkspaceSlot = (slot: WorkspaceSlot | undefined, context: WorkspaceSlotContext): ReactNode => (
  typeof slot === 'function' ? slot(context) : slot
);

export type WorkspaceId = 'model2d' | 'space3d' | 'fem';
export type WorkspaceSlotContext = { onOpenModel2D: () => void };
export type WorkspaceSlot = ReactNode | ((context: WorkspaceSlotContext) => ReactNode);

type WorkspaceShellProps = {
  onOpenHome: () => void;
  projectId: string;
  tool?: ToolId;
  onToolChange?: (tool: ToolId) => void;
  /** Contenido que ocupa el escenario central al abrir el módulo espacial. */
  space3dContent?: WorkspaceSlot;
  /** Contenido que ocupa el escenario central al abrir el módulo FEM. */
  femContent?: WorkspaceSlot;
};
type LayoutController = ReturnType<typeof useWorkspaceLayoutPreferences>;
type PendingModelDoctorNotification = {
  id: number;
  projectId: string;
  analysisAtRequest: AnalysisResult | null;
  hasStarted: boolean;
};

const WorkspaceBrokerContent = ({
  onOpenHome,
  projectId,
  space3dContent,
  femContent,
  tool,
  onToolChange,
  activeWorkspace,
  onOpenModel2D,
  onOpenSpace3D,
  onOpenFem,
  shellRef,
  layoutController,
}: WorkspaceShellProps & {
  activeWorkspace: WorkspaceId;
  onOpenModel2D: () => void;
  onOpenSpace3D: () => void;
  onOpenFem: () => void;
  shellRef: RefObject<HTMLDivElement | null>;
  layoutController: LayoutController;
}) => {
  const [modelDoctorAcknowledgedIds, setModelDoctorAcknowledgedIds] = useState<Set<string>>(() => new Set());
  const [dataSurfaceStateEpoch, setDataSurfaceStateEpoch] = useState(0);
  const [revisionBaseline, setRevisionBaseline] = useState<RevisionSnapshot | null>(null);
  const [editorLayers, dispatchEditorLayers] = useReducer(editorLayerReducer, undefined, createPersistedEditorLayerState);
  const { t, language } = useI18n();
  const { project, analysis, isAnalyzing, storageIssue, storageMessage, renameProject, setActiveTool, setResultTab, updateProjectView, analyze, undo, redo, canUndo, canRedo } = useProject();
  const [pendingModelDoctorNotification, setPendingModelDoctorNotification] = useState<PendingModelDoctorNotification | null>(null);
  const [localAssistantOpen, setLocalAssistantOpen] = useState(false);
  const localAssistantTriggerRef = useRef<HTMLElement | null>(null);
  const modelDoctorNotificationIdRef = useRef(0);
  const pendingModelDoctorNotificationIdRef = useRef<number | null>(null);
  const reportedAnalysisRef = useRef<AnalysisResult | null>(null);
  const { activeTool } = useWorkspaceUI();
  const { preferences: layout, setPreference, togglePreference } = layoutController;
  const { shellClass } = useShellComposition();
  const broker = useSurfacePresentation();
  const { openSurface, closeSurface, toggleSurface, markSurfaceReady, setSurfaceExtent } = broker;
  const isModel2D = activeWorkspace === 'model2d';
  const openModel2DSurface = useCallback((surface: SurfaceId, trigger?: HTMLElement | null) => {
    onOpenModel2D();
    openSurface(surface, trigger);
  }, [onOpenModel2D, openSurface]);
  useEffect(() => {
    if (isModel2D) return;
    BROKER_SURFACE_IDS.forEach((surface) => closeSurface(surface));
    setDataSurfaceStateEpoch((epoch) => epoch + 1);
    setLocalAssistantOpen(false);
    localAssistantTriggerRef.current = null;
  }, [closeSurface, isModel2D]);
  const detail = broker.stateFor('detail');
  const analysisSetup = broker.stateFor('analysisSetup');
  const view = broker.stateFor('view');
  const results = broker.stateFor('results');
  const design = broker.stateFor('design');
  const dense = broker.stateFor('dense');
  const [denseView, setDenseView] = useState<DenseResultView>('reactions');
  const datasheet = broker.stateFor('datasheet');
  const bom = broker.stateFor('bom');
  const comparison = broker.stateFor('comparison');
  const doctor = broker.stateFor('doctor');
  const palette = broker.stateFor('palette');
  // Intención del usuario: qué superficie quiere tener a mano. Gobierna el
  // botón de la consola y su alternancia, que deben poder CERRAR una superficie
  // abierta aunque otra capa la haya suspendido.
  const inspectorOpen = detail.open || analysisSetup.open || view.open;
  // Ocupación real: qué superficie está pintando. Gobierna la retícula, que sólo
  // puede pagar ancho por algo que se ve (ver `reservesInspectorColumn`).
  const inspectorShowsColumn = reservesInspectorColumn(detail, analysisSetup, view);
  const resultsWereOpenRef = useRef(results.open);

  const revealResultOverlay = useCallback(() => {
    updateProjectView((draft) => draft.settings.showResultOverlay === true
      ? draft
      : withCanvasViewSettings(draft, { showResultOverlay: true }));
  }, [updateProjectView]);

  useEffect(() => persistEditorLayerState(editorLayers), [editorLayers]);

  useEffect(() => {
    const normalizeDetent = () => {
      const next = normalizeInspectorDetent(layout.inspectorDetent, {
        width: window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
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

  const cycleInspectorDetent = useCallback((direction: 1 | -1) => {
    const next = nextAvailableInspectorDetent(layout.inspectorDetent, direction, {
      width: window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    });
    if (next !== layout.inspectorDetent) setPreference('inspectorDetent', next);
  }, [layout.inspectorDetent, setPreference]);

  useEffect(() => {
    const canOpenPalette = datasheet.status !== 'active' && bom.status !== 'active' && comparison.status !== 'active' && doctor.status !== 'active';
    const subscriptions = [
      onWorkspaceCommand('open-command-palette', () => {
        // Ctrl/Cmd+K ya respeta esta exclusión; el lanzador visible debe pasar
        // por la misma autoridad para no montar una segunda capa sobre Doctor
        // o Datasheet.
        if (canOpenPalette) openModel2DSurface('palette');
      }),
      onWorkspaceCommand('open-model-doctor', () => openModel2DSurface('doctor')),
      onWorkspaceCommand('open-local-assistant', ({ trigger }) => {
        onOpenModel2D();
        localAssistantTriggerRef.current = trigger ?? null;
        closeSurface('palette');
        setLocalAssistantOpen(true);
      }),
      onWorkspaceCommand('open-datasheet', () => openModel2DSurface('datasheet')),
      onWorkspaceCommand('open-structural-bom', () => openModel2DSurface('bom')),
      onWorkspaceCommand('open-revision-comparison', () => openModel2DSurface('comparison')),
      onWorkspaceCommand('open-results', (payload) => {
        closeSurface('design');
        openModel2DSurface('results', payload?.trigger);
      }),
      onWorkspaceCommand('toggle-results', (payload) => {
        if (results.open) closeSurface('results');
        else {
          closeSurface('design');
          openModel2DSurface('results', payload?.trigger);
        }
      }),
      onWorkspaceCommand('open-design', (payload) => {
        closeSurface('results');
        if (onToolChange) onToolChange('design');
        else onOpenModel2D();
        openSurface('design', payload?.trigger);
      }),
      onWorkspaceCommand('toggle-design', (payload) => {
        if (design.open) {
          closeSurface('design');
          onToolChange?.('model2d');
        }
        else {
          closeSurface('results');
          if (onToolChange) onToolChange('design');
          else onOpenModel2D();
          openSurface('design', payload?.trigger);
        }
      }),
      onWorkspaceCommand('analysis-requested', () => {
        onOpenModel2D();
        const id = modelDoctorNotificationIdRef.current + 1;
        modelDoctorNotificationIdRef.current = id;
        pendingModelDoctorNotificationIdRef.current = id;
        setPendingModelDoctorNotification({ id, projectId: project.id, analysisAtRequest: analysis, hasStarted: false });
      }),
      onWorkspaceCommand('open-analysis-setup', () => openModel2DSurface('analysisSetup')),
      /* Una magnitud elegida en cualquier superficie se enciende en el LIENZO.
         El shell es el único que tiene el reductor de capas, así que aquí es
         donde `resultTab` y la capa `results` se mueven juntos. */
      onWorkspaceCommand('activate-evidence-layer', ({ layer }) => {
        onOpenModel2D();
        activateEvidenceLayer(layer, { setResultTab, dispatchLayers: dispatchEditorLayers, revealResultOverlay });
      }),
      onWorkspaceCommand('open-view-settings', () => openModel2DSurface('view')),
      /* Los lanzadores de Influencia previos se conservan, pero ahora llevan a
         la pestaña residente: la línea se lee junto a N/V/M, sin drawer. */
      onWorkspaceCommand('open-dense-results', ({ view: requestedView, trigger }) => {
        if (requestedView === 'influence') {
          setResultTab('influence');
          openModel2DSurface('results', trigger);
          return;
        }
        setDenseView(requestedView);
        openModel2DSurface('dense', trigger);
      }),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [analysis, bom.status, closeSurface, comparison.status, datasheet.status, design.open, doctor.status, onOpenModel2D, onToolChange, openSurface, openModel2DSurface, project.id, results.open, revealResultOverlay, setResultTab]);

  useEffect(() => {
    setModelDoctorAcknowledgedIds(new Set());
    pendingModelDoctorNotificationIdRef.current = null;
    setPendingModelDoctorNotification(null);
    (['generator', 'dense', 'datasheet', 'bom', 'comparison', 'doctor', 'palette', 'design'] as const).forEach((surface) => closeSurface(surface));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Apply the durable tool after the project-change reset has cleared transients.
  useEffect(() => {
    if (tool === 'design') openSurface('design');
    else if (tool !== undefined) closeSurface('design');
  }, [tool, projectId, openSurface, closeSurface]);

  /**
    * Al terminar una corrida válida el resultado se publica EN EL LIENZO, no en
    * una superficie que lo tape.
    *
    * Antes se abría Resultados sola. En K0 esa superficie es una hoja inferior:
    * el modelo recién resuelto quedaba escondido detrás del panel justo en el
    * momento en que había algo que mirar sobre él. Ahora la corrida enciende la
    * capa de evidencia —el momento, que es la lectura de gobierno de una barra
    * a flexión— y el modelo se queda a la vista con su diagrama encima. El
    * Centro analítico sigue a un toque en la barra superior, cuando se pide.
    */
  useEffect(() => {
    if (analysis?.success && analysis !== reportedAnalysisRef.current) {
      activateEvidenceLayer('moment', { setResultTab, dispatchLayers: dispatchEditorLayers, revealResultOverlay });
    }
    reportedAnalysisRef.current = analysis;
  }, [analysis, revealResultOverlay, setResultTab]);

  // Abrir Resultados no debe dejar al lado una ficha de edición completa.
  // La transición se produce una vez por apertura: si después la persona
  // elige editar, esa decisión explícita no se vuelve a sobrescribir.
  useEffect(() => {
    if (results.open && !resultsWereOpenRef.current && detail.open) {
      setPreference('inspectorCompact', true);
    }
    resultsWereOpenRef.current = results.open;
  }, [detail.open, results.open, setPreference]);

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

    let current = true;
    void import('../model-doctor/modelDoctorDiagnostics').then(({ buildModelDoctorReport }) => {
      if (!current || pendingModelDoctorNotificationIdRef.current !== request.id) return;
      const report = buildModelDoctorReport(project);
      if (report.total > 0) {
        emitWorkspaceCommand('show-toast', {
          message: t('modelDoctor.toastTitle'),
          description: t('modelDoctor.toastDescription'),
          tone: 'warning',
        });
      }
      if (pendingModelDoctorNotificationIdRef.current === request.id) {
        pendingModelDoctorNotificationIdRef.current = null;
        setPendingModelDoctorNotification(null);
      }
    });
    return () => { current = false; };
  }, [analysis, isAnalyzing, pendingModelDoctorNotification, project, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (datasheet.status === 'active' || bom.status === 'active' || comparison.status === 'active' || doctor.status === 'active') return;
      event.preventDefault();
      toggleSurface('palette', document.activeElement instanceof HTMLElement ? document.activeElement : null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bom.status, comparison.status, datasheet.status, doctor.status, toggleSurface]);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Y drive the same undo/redo the history buttons use
  // (G-01 · CRI-103) — but never with focus in a text field, the Datasheet
  // grid, or any modal surface with its own editing history: the worst case is
  // silently undoing a model operation while the user meant to undo a cell.
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

  useEffect(() => {
    const viewport = window.visualViewport;
    const shell = shellRef.current;
    if (!viewport || !shell) return undefined;
    const syncViewport = () => {
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      shell.style.setProperty('--sc-visual-viewport-height', `${viewport.height}px`);
      shell.style.setProperty('--sc-visual-viewport-top', `${viewport.offsetTop}px`);
      shell.style.setProperty('--sc-visual-viewport-bottom', `${bottom}px`);
    };
    syncViewport();
    viewport.addEventListener('resize', syncViewport);
    viewport.addEventListener('scroll', syncViewport);
    return () => {
      viewport.removeEventListener('resize', syncViewport);
      viewport.removeEventListener('scroll', syncViewport);
    };
  }, [shellRef]);

  const setResultsOpen = useCallback((open: boolean, trigger?: HTMLElement | null) => {
    if (open) {
      closeSurface('design');
      openModel2DSurface('results', trigger);
    }
    else {
      closeSurface('results');
      setDataSurfaceStateEpoch((epoch) => epoch + 1);
      // En K0 Utilidades sigue siendo un lanzador persistente mientras la hoja
      // se cierra. Es el respaldo correcto cuando el cierre viene del propio
      // panel y el disparador original ya no está montado — nunca cuando el
      // bróker sí pudo devolver el foco al botón que abrió Resultados.
      focusStableLauncherIfUnclaimed('.utility-more-button');
    }
  }, [closeSurface, openModel2DSurface]);
  const setDesignOpen = useCallback((open: boolean, trigger?: HTMLElement | null) => {
    if (open) {
      closeSurface('results');
      openModel2DSurface('design', trigger);
    } else closeSurface('design');
  }, [closeSurface, openModel2DSurface]);
  const openDetail = useCallback((trigger?: HTMLElement | null) => {
    onOpenModel2D();
    setPreference('inspectorCollapsed', false);
    setPreference('inspectorCompact', false);
    openSurface('detail', trigger);
  }, [onOpenModel2D, openSurface, setPreference]);
  const closeDetail = useCallback(() => {
    closeSurface('detail');
    setPreference('inspectorCollapsed', true);
    setPreference('inspectorCompact', false);
  }, [closeSurface, setPreference]);
  const setDatasheetOpen = useCallback((open: boolean) => {
    if (open) openModel2DSurface('datasheet');
    else { closeSurface('datasheet'); setDataSurfaceStateEpoch((epoch) => epoch + 1); }
  }, [closeSurface, openModel2DSurface]);
  const setDoctorOpen = useCallback((open: boolean) => {
    if (open) openModel2DSurface('doctor');
    else { closeSurface('doctor'); setDataSurfaceStateEpoch((epoch) => epoch + 1); }
  }, [closeSurface, openModel2DSurface]);
  const setBomOpen = useCallback((open: boolean) => {
    if (open) openModel2DSurface('bom');
    else {
      closeSurface('bom');
      setDataSurfaceStateEpoch((epoch) => epoch + 1);
      // Los items de Exportar/Utilidades se desmontan al abrir la superficie:
      // ahí el bróker no tiene a dónde devolver el foco y este lanzador
      // persistente es el respaldo de la composición vigente.
      focusStableLauncherIfUnclaimed('.topbar-export-trigger, .utility-more-button');
    }
  }, [closeSurface, openModel2DSurface]);
  const setComparisonOpen = useCallback((open: boolean) => {
    if (open) openModel2DSurface('comparison');
    else closeSurface('comparison');
  }, [closeSurface, openModel2DSurface]);
  const setDenseOpen = useCallback((open: boolean) => {
    if (open) openModel2DSurface('dense');
    else { closeSurface('dense'); setDataSurfaceStateEpoch((epoch) => epoch + 1); }
  }, [closeSurface, openModel2DSurface]);
  const markDenseReady = useCallback((ready: boolean) => markSurfaceReady('dense', ready), [markSurfaceReady]);
  const markDatasheetReady = useCallback((ready: boolean) => markSurfaceReady('datasheet', ready), [markSurfaceReady]);
  const markBomReady = useCallback((ready: boolean) => markSurfaceReady('bom', ready), [markSurfaceReady]);
  const markComparisonReady = useCallback((ready = true) => markSurfaceReady('comparison', ready), [markSurfaceReady]);
  const markDoctorReady = useCallback((ready: boolean) => markSurfaceReady('doctor', ready), [markSurfaceReady]);
  // "Localizar" degrada a `peek`, nunca cierra (CRI-102 / D-11): mismo mecanismo
  // para Datasheet, BOM y Doctor, porque es el mismo hueco en las tres superficies.
  const peekDatasheet = useCallback(() => setSurfaceExtent('datasheet', 'peek'), [setSurfaceExtent]);
  const restoreDatasheet = useCallback(() => setSurfaceExtent('datasheet', 'default'), [setSurfaceExtent]);
  const peekBom = useCallback(() => setSurfaceExtent('bom', 'peek'), [setSurfaceExtent]);
  const restoreBom = useCallback(() => setSurfaceExtent('bom', 'default'), [setSurfaceExtent]);
  const peekComparison = useCallback(() => setSurfaceExtent('comparison', 'peek'), [setSurfaceExtent]);
  const restoreComparison = useCallback(() => setSurfaceExtent('comparison', 'default'), [setSurfaceExtent]);
  const peekDoctor = useCallback(() => setSurfaceExtent('doctor', 'peek'), [setSurfaceExtent]);
  const restoreDoctor = useCallback(() => setSurfaceExtent('doctor', 'default'), [setSurfaceExtent]);
  const nativeWorkspaceContent = activeWorkspace === 'space3d'
    ? renderWorkspaceSlot(space3dContent, { onOpenModel2D })
    : activeWorkspace === 'fem'
      ? renderWorkspaceSlot(femContent, { onOpenModel2D })
      : undefined;

  return <DataSurfaceRetainedStateProvider resetVersion={dataSurfaceStateEpoch}><AppShellLayout
    ref={shellRef}
    projectId={projectId}
    skipLabel={t('shell.skipToCanvas')}
    shellClass={shellClass}
    inspectorCollapsed={!isModel2D || !inspectorShowsColumn}
    inspectorCompact={isModel2D && detail.open && layout.inspectorCompact}
    inspectorWidth={layout.inspectorWidth}
    fullCanvas={layout.fullCanvas}
    topbar={<WorkspaceTopBar
      projectName={project.name}
      storageState={!storageIssue ? 'ready' : storageIssue === 'recovered' ? 'recovered' : 'issue'}
      storageMessage={storageMessage}
      analysisState={isAnalyzing
        ? 'running'
        // Sin corrida todavía es `ready`; una corrida que falló es `failed`.
        // Colapsar las dos en `ready` anunciaba «Listo para analizar» encima de
        // un análisis que no salió.
        : analysis
          ? (analysis.success ? 'resolved' : 'failed')
          : 'ready'}
      resultsOpen={results.open}
      designOpen={design.open}
      canUndo={canUndo}
      canRedo={canRedo}
      labels={{
        solverName: activeWorkspace === 'space3d'
          ? language === 'en' ? '3D model · Experimental' : 'Modelo 3D · Experimental'
          : activeWorkspace === 'fem'
            ? 'FEM · ' + (language === 'en' ? 'Planned' : 'Planeado')
            : SOLVER_2D.name,
        project: t('topbar.currentProject'),
        home: t('navigation.home'),
        editProject: t('project.name'),
        saveProject: t('topbar.saveProject'),
        cancel: t('topbar.cancelProject'),
        storageReady: t('storage.local'),
        storageRecovered: t('storage.recoveredShort'),
        // `storageIssue` no es sólo «no pude guardar»: `ProjectProvider` lo usa
        // también para una recuperación desde el respaldo, una carga fallida,
        // un conflicto de revisión y una biblioteca degradada. Rotularlos todos
        // «Error al guardar» informa de la operación equivocada —una
        // recuperación con éxito se leía como un fallo de guardado—, y el
        // catálogo ya tiene la palabra corta de cada caso.
        storageIssue: storageIssue === 'recovered' ? t('storage.recoveredShort')
          : storageIssue === 'load-failed' ? t('storage.loadFailedShort')
          : storageIssue === 'conflict' ? t('storage.conflictShort')
          : storageIssue === 'repository-degraded' ? t('storage.repositoryShort')
          : t('storage.failedShort'),
        analysisReady: t('analysis.statusReady'),
        analysisRunning: t('analysis.running'),
        analysisResolved: t('analysis.statusResolved'),
        analysisFailed: t('analysis.statusError'),
        undo: t('history.undo'),
        redo: t('history.redo'),
        analyze: t('analysis.run'),
        results: t('results.outputs'),
        design: language === 'en' ? 'Design' : 'Diseño',
        calculationExperience: t('inspector.calculationExperience'),
        model3d: language === 'en' ? '3D' : '3D',
        model2d: language === 'en' ? '2D' : '2D',
        actions: t('toolbar.primary'),
      }}
      onOpenHome={onOpenHome}
      onRenameProject={renameProject}
      onUndo={undo}
      onRedo={redo}
      onAnalyze={() => {
        onOpenModel2D();
        emitWorkspaceCommand('analysis-requested');
        analyze();
      }}
      // ALTERNA. `openSurface` sobre una superficie ya activa sólo renueva su
      // activación, así que el botón no podía apagar lo que anunciaba encendido
      // con `aria-pressed`. Se usa el mismo comando que el riel de la consola,
      // que además devuelve el foco a quien lo pulsó.
      onOpenResults={(trigger) => emitWorkspaceCommand('toggle-results', { trigger })}
      onOpenDesign={(trigger) => emitWorkspaceCommand('toggle-design', { trigger })}
      onOpenCalculationExperience={(trigger) => openModel2DSurface('analysisSetup', trigger)}
      onOpenSpace3D={isModel2D ? onOpenSpace3D : onOpenModel2D}
      space3DActive={activeWorkspace === 'space3d'}
      returnTo2D={!isModel2D}
      contextActive={isModel2D}
      utilities={<WorkspaceUtilities onOpenInspector={(trigger) => {
        // La utilidad abre una consulta contextual: en móvil empieza compacta
        // y el tirador del Inspector permite crecerla sólo si hace falta.
        setPreference('inspectorDetent', 'compact');
        openDetail(trigger);
      }} onOpenUnitsEditor={(trigger) => openModel2DSurface('view', trigger)}
        activeWorkspace={activeWorkspace}
        onOpenModel2D={onOpenModel2D}
        onOpenSpace3D={onOpenSpace3D}
        onOpenFem={onOpenFem}
      />}
    />}
    console={isModel2D ? <Console
      layoutActions={{
        inspectorCollapsed: !inspectorOpen,
        fullCanvas: layout.fullCanvas,
        onToggleInspector: (trigger) => {
          if (layout.fullCanvas) setPreference('fullCanvas', false);
          if (detail.open) closeDetail();
          else if (analysisSetup.open) closeSurface('analysisSetup');
          else if (view.open) closeSurface('view');
          else openDetail(trigger);
        },
        onToggleFullCanvas: () => {
          if (!layout.fullCanvas) {
            onOpenModel2D();
            closeSurface('detail');
            closeSurface('analysisSetup');
            closeSurface('view');
            closeSurface('results');
            closeSurface('design');
          } else if (!layout.inspectorCollapsed) {
            // Results stays non-resident even leaving full-canvas (CRI-100);
            // only the inspector, which the user had open, comes back.
            openDetail();
          }
          togglePreference('fullCanvas');
        },
      }}
    /> : null}
    workspace={isModel2D ? <>
      {project.settings.calculationMode === 'classroom' ? <ClassroomGuide className="classroom-workspace-journey" project={project} analysis={analysis} onChooseTool={setActiveTool} onAnalyze={() => {
        onOpenModel2D();
        emitWorkspaceCommand('analysis-requested');
        analyze();
      }} /> : null}
      <Model2DSurfaceContext value={{ layers: editorLayers, dispatchLayers: dispatchEditorLayers, onRequestInspector: () => openDetail() }}>
        <LazySurface><Model2DTool /></LazySurface>
      </Model2DSurfaceContext>
      {broker.isRetained('results') ? <ResultsPanel
        presentation={results.presentation as 'dock' | 'inset' | 'sheet'}
        status={results.status}
        onOpenChange={setResultsOpen}
      /> : null}
      {broker.isRetained('design') ? <DesignSurfaceContext value={{
        open: design.status === 'active',
        presentation: design.presentation as 'dock' | 'drawer' | 'fullscreen',
        status: design.status,
        onOpenChange: (open) => {
          setDesignOpen(open);
          if (!open) onToolChange?.('model2d');
        },
      }}><LazySurface><DesignTool /></LazySurface></DesignSurfaceContext> : null}
      <ToastNotification />
      {broker.isRetained('palette') ? <LazySurface><LazyCommandPalette
        open={palette.status === 'active'}
        onClose={() => closeSurface('palette')}
        dispatchLayers={dispatchEditorLayers}
        presentation={palette.presentation as 'overlay' | 'sheet'}
      /></LazySurface> : null}
      {localAssistantOpen ? <LazySurface><LazyLocalCommandAssistant
        open
        onClose={() => {
          setLocalAssistantOpen(false);
          const trigger = localAssistantTriggerRef.current;
          localAssistantTriggerRef.current = null;
          if (trigger?.isConnected) window.requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
        }}
      /></LazySurface> : null}
      {/* Invocada, nunca residente: sólo existe en el árbol mientras el broker
          la retiene, y desaparece al cerrarse (CRI-101). */}
      {broker.isRetained('dense') ? <LazySurface pending={<span className="sr-only" role="status">{t('results.denseLoading')}</span>}><LazyDenseResults
        open={dense.status === 'active'}
        view={denseView}
        onViewChange={setDenseView}
        onOpenChange={setDenseOpen}
        presentation={dense.presentation as 'drawer' | 'fullscreen'}
        onSurfaceReady={markDenseReady}
      /></LazySurface> : null}
      {broker.isRetained('datasheet') ? <LazySurface><LazyDatasheet
        open={datasheet.status === 'active'}
        onOpenChange={setDatasheetOpen}
        presentation={datasheet.presentation as 'drawer' | 'fullscreen'}
        onSurfaceReady={markDatasheetReady}
        extent={datasheet.extent}
        onPeek={peekDatasheet}
        onRestore={restoreDatasheet}
      /></LazySurface> : null}
      {broker.isRetained('bom') ? <LazySurface><LazyStructuralBom
        open={bom.status === 'active'}
        onOpenChange={setBomOpen}
        presentation={bom.presentation as 'drawer' | 'fullscreen'}
        onSurfaceReady={markBomReady}
        extent={bom.extent}
        onPeek={peekBom}
        onRestore={restoreBom}
      /></LazySurface> : null}
      {broker.isRetained('comparison') ? <LazySurface><LazyRevisionComparison
        open={comparison.status === 'active'}
        onOpenChange={setComparisonOpen}
        presentation={comparison.presentation as 'drawer' | 'fullscreen'}
        onSurfaceReady={markComparisonReady}
        extent={comparison.extent}
        onPeek={peekComparison}
        onRestore={restoreComparison}
        baseline={revisionBaseline}
        onBaselineChange={setRevisionBaseline}
      /></LazySurface> : null}
      {broker.isRetained('doctor') ? <LazySurface pending={<span className="sr-only" role="status">{t('modelDoctor.loading')}</span>}><LazyModelDoctor
        open={doctor.status === 'active'}
        onOpenChange={setDoctorOpen}
        onSurfaceReady={markDoctorReady}
        presentation={doctor.presentation as 'drawer' | 'fullscreen'}
        acknowledgedIds={modelDoctorAcknowledgedIds}
        onAcknowledgedIdsChange={setModelDoctorAcknowledgedIds}
        extent={doctor.extent}
        onPeek={peekDoctor}
        onRestore={restoreDoctor}
      /></LazySurface> : null}
    </> : <section
      className="native-workspace-mode"
      data-workspace-mode={activeWorkspace}
      aria-label={activeWorkspace === 'space3d'
        ? language === 'en' ? '3D model' : 'Modelo 3D'
        : language === 'en' ? 'Finite elements' : 'Elementos finitos'}
    >
      {nativeWorkspaceContent}
    </section>}
    inspector={isModel2D ? <div className="workspace-surfaces" data-workspace-right-slot>
      {broker.isRetained('detail') ? <Inspector surface="detail" className={detail.presentation === 'sheet' && detail.status === 'active' ? 'mobile-open' : ''} desktopWidth={layout.inspectorWidth} presentation={detail.presentation as 'dock' | 'inset' | 'sheet'} status={detail.status} onClose={closeDetail} compact={detail.presentation !== 'sheet' && layout.inspectorCompact} onExpand={() => setPreference('inspectorCompact', false)} onDesktopWidthChange={(width) => setPreference('inspectorWidth', width)} mobileDetent={layout.inspectorDetent} onMobileDetentChange={(detent) => setPreference('inspectorDetent', detent)} onMobileDetentCycle={cycleInspectorDetent} /> : null}
      {broker.isRetained('analysisSetup') ? <Inspector surface="analysisSetup" className={analysisSetup.presentation === 'sheet' && analysisSetup.status === 'active' ? 'mobile-open' : ''} presentation={analysisSetup.presentation as 'dock' | 'inset' | 'sheet'} status={analysisSetup.status} onClose={() => closeSurface('analysisSetup')} mobileDetent={layout.inspectorDetent} onMobileDetentChange={(detent) => setPreference('inspectorDetent', detent)} onMobileDetentCycle={cycleInspectorDetent} activeTool={activeTool} onActiveToolChange={setActiveTool} /> : null}
      {broker.isRetained('view') ? <Inspector surface="view" className={view.presentation === 'sheet' && view.status === 'active' ? 'mobile-open' : ''} presentation={view.presentation as 'dock' | 'inset' | 'sheet'} status={view.status} onClose={() => closeSurface('view')} mobileDetent={layout.inspectorDetent} onMobileDetentChange={(detent) => setPreference('inspectorDetent', detent)} onMobileDetentCycle={cycleInspectorDetent} /> : null}
    </div> : null}
    floatingActions={undefined}
    instrument={isModel2D ? <Instrument /> : undefined}
  /></DataSurfaceRetainedStateProvider>;
};

type WorkspaceSurfaceProps = WorkspaceShellProps & {
  activeWorkspace: WorkspaceId;
  onOpenModel2D: () => void;
  onOpenSpace3D: () => void;
  onOpenFem: () => void;
};

const WorkspaceSurface = (props: WorkspaceSurfaceProps) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const layoutController = useWorkspaceLayoutPreferences();
  const { shellClass } = useShellComposition();
  // Results is never resident, in any class (CRI-100): state and reliability
  // already live in the TopBar and evidence is a canvas layer, so the panel only
  // opens on request now — it no longer starts open by default.
  const initialOpen = useMemo<SurfaceId[]>(() => {
    if (props.activeWorkspace !== 'model2d') return [];
    if (layoutController.preferences.fullCanvas) return [];
    const surfaces: SurfaceId[] = [];
    if (!layoutController.preferences.inspectorCollapsed) surfaces.push('detail');
    return surfaces;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SurfacePresentationProvider shellClass={shellClass} initialOpen={initialOpen} backgroundRef={shellRef}>
    <WorkspaceBrokerContent {...props} shellRef={shellRef} layoutController={layoutController} />
  </SurfacePresentationProvider>;
};

export const WorkspaceShell = (props: WorkspaceShellProps) => {
  const [localWorkspace, setActiveWorkspace] = useState<WorkspaceId>('model2d');
  const activeWorkspace: WorkspaceId = props.tool === undefined ? localWorkspace : props.tool === 'design' ? 'model2d' : props.tool;
  useEffect(() => setActiveWorkspace('model2d'), [props.projectId]);
  const onToolChange = props.onToolChange;
  const onOpenModel2D = useCallback(() => {
    if (onToolChange) onToolChange('model2d');
    else setActiveWorkspace('model2d');
  }, [onToolChange]);
  const onOpenSpace3D = useCallback(() => {
    if (onToolChange) onToolChange(activeWorkspace === 'space3d' ? 'model2d' : 'space3d');
    else setActiveWorkspace((current) => current === 'space3d' ? 'model2d' : 'space3d');
  }, [activeWorkspace, onToolChange]);
  const onOpenFem = useCallback(() => {
    if (onToolChange) onToolChange(activeWorkspace === 'fem' ? 'model2d' : 'fem');
    else setActiveWorkspace((current) => current === 'fem' ? 'model2d' : 'fem');
  }, [activeWorkspace, onToolChange]);

  return <ShellCompositionProvider>
    <WorkspaceSurface
      {...props}
      activeWorkspace={activeWorkspace}
      onOpenModel2D={onOpenModel2D}
      onOpenSpace3D={onOpenSpace3D}
      onOpenFem={onOpenFem}
    />
  </ShellCompositionProvider>;
};

export default WorkspaceShell;
