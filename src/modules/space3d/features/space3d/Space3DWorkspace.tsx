/**
 * Superficie Space 3D, con la gramática de ETABS/SAP2000.
 *
 * Composición: una cinta de comandos arriba (Definir, Dibujar, Asignar,
 * Mostrar, Vista), el explorador del modelo a la izquierda, el lienzo —una
 * vista o dos, planta y 3D— como protagonista, y el inspector a la derecha con
 * la selección, las asignaciones y el análisis. En el shell compacto el
 * inspector vive en la hoja y el explorador se retira.
 *
 * El flujo es el de un programa de cálculo: se define la rejilla, se dibuja o
 * se genera, se selecciona (clic, Ctrl/Mayús, ventana) y se asigna; después se
 * analiza y se leen diagramas, deformada, reacciones y modos.
 *
 * El módulo trae su propio `Space3DProjectProvider`: es la superficie completa
 * y lo único que la aplicación necesita cargar de forma diferida.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown, CircleStop, Grid3x3, Layers, Minus, Play, Plus, Redo2, Tag, Trash2, Undo2, Weight, X,
} from 'lucide-react';
import { NodeGlyph, SupportGlyph } from '../../../../design-system/icons/structural';
import { Space3DProjectProvider, useSpace3DProject, type Space3DSelection } from '../../space3d/store/Space3DProjectContext';
// Space 3D contributes content to the canonical shell; it does not carry a
// second component library or token set.
import { Dialog, Popover } from '../../../../design-system/components/overlays';
import { Space3DCanvas, type Space3DCanvasDraft, type Space3DCanvasPick, type Space3DPickModifiers, type Space3DViewportFactory } from '../../space3d/view/Space3DCanvas';
import { buildSpace3DSceneModel, space3DResultNoiseFloor, SPACE3D_SCOPE_3D, type Space3DResultMode } from '../../space3d/view/sceneModel';
import { SPACE3D_DEFAULT_LAYERS, type Space3DLayerVisibility, type Space3DWindowPick } from '../../space3d/view/threeViewport';
import type { Space3DViewPreset } from '../../space3d/view/cameraModel';
import { resolveSpace3DGrid, space3DGridPointsAt, SPACE3D_GRID_TOLERANCE } from '../../space3d/model/grid';
import { Space3DEntityEditor, type Space3DEditorTarget } from './Space3DEntityEditor';
import { Space3DResultsPanel, type Space3DResultsTab } from './Space3DResultsPanel';
import { Space3DModelOutline } from './Space3DModelOutline';
import { Space3DAnalysisModeSelect } from './Space3DAnalysisModeSelect';
import { Space3DGenerativeModal } from './Space3DGenerativeModal';
import { Space3DSelectionHUD } from './Space3DSelectionHUD';
import { Space3DResultsLegend } from './Space3DResultsLegend';
import { Space3DGuide } from './Space3DGuide';
import { SPACE3D_DISPLAY_MODES, Space3DRibbon, type Space3DAssignKind } from './Space3DRibbon';
import { Space3DDock } from './Space3DDock';
import { space3DResultStats } from './space3dResultStats';
import { Space3DExplorer } from './Space3DExplorer';
import { Space3DAssignPanel } from './Space3DAssignPanel';
import { Space3DMemberDiagrams } from './Space3DMemberDiagrams';
import { Space3DModesPanel, type Space3DBucklingResult, type Space3DModalResult } from './Space3DModesPanel';
import { deriveSpace3DGuide, type Space3DGuideAction } from './space3dRoute';
import { Space3DModeBar, type Space3DModelingTool, type Space3DSupportChoice } from './Space3DModeBar';
import {
  buildSpace3DMember, buildSpace3DNode, findSpace3DNodeAt, snapToWorkPlane, space3DBaseNodeIds, space3DLoadCommand,
  space3DMemberExists, space3DMemberToPointCommand, space3DPlaneAxisForView, space3DSupportCommand, space3DTopNodeIds,
  type Space3DLoadDirection, type Space3DMemberTemplate, type Space3DPlaneAxis,
} from './space3dModeling';
import {
  EMPTY_SPACE3D_SELECTION, applySpace3DPick, applySpace3DWindow, pruneSpace3DSelection, space3DAssignSectionCommand,
  space3DDeleteSelectionCommand, space3DSelectionSize, type Space3DSelectionSet,
} from './space3dAssign';
import { resolveSpace3DView, space3DViewOptions, space3DViewWorkPlane, type Space3DViewId } from './space3dViews';
import { SPACE3D_SUPPORT_LABEL_KEYS } from './space3dSupportKind';
import { analyzeSpace3DInfluence } from '../../space3d/engine/analysisModes';
import type { Space3DResponseSpectrumResult } from '../../space3d/engine/responseSpectrum';
import { Space3DAnalysisCancelledError } from '../../space3d/runtime/workerClient';
import { Space3DSpectrumPanel, Space3DStoryPanel } from './Space3DStoryResponse';
import type { Space3DAnalysisMode } from './space3dWorkspaceModel';
import { isCatalogReady, loadCatalog, translate, type Language, type TranslationKey } from '../../i18n/catalogs';
import { formatSpace3DNumber } from './space3dNumberFormat';
import type { Space3DCommand } from '../../space3d/data/commands';
import type { Space3DProjectV1, Space3DVector } from '../../space3d/model/types';
import type { Space3DStorageLike } from '../../space3d/data/storage';
import type { Space3DWorkerClient } from '../../space3d/runtime/workerClient';
import { ShellContribution, ShellStatusChip, useShellInspector, type ShellStatusTone } from '../../../../features/workspace/ShellToolSlots';
import './space3d.css';

// Los diálogos de «Definir» y la plantilla de edificio sólo se usan a demanda:
// se cargan al abrirlos y no pesan en la primera pintura de la mesa.
const Space3DBuildingDialog = lazy(() => import('./Space3DDefineDialogs').then((module) => ({ default: module.Space3DBuildingDialog })));
const Space3DGridDialog = lazy(() => import('./Space3DDefineDialogs').then((module) => ({ default: module.Space3DGridDialog })));
const Space3DLoadsDialog = lazy(() => import('./Space3DDefineDialogs').then((module) => ({ default: module.Space3DLoadsDialog })));
const Space3DSectionsDialog = lazy(() => import('./Space3DDefineDialogs').then((module) => ({ default: module.Space3DSectionsDialog })));
const Space3DDynamicsDialog = lazy(() => import('./Space3DDynamicsDialog').then((module) => ({ default: module.Space3DDynamicsDialog })));

type PendingReplace =
  | { readonly kind: 'example' }
  | { readonly kind: 'blank' }
  | { readonly kind: 'generated'; readonly project: Space3DProjectV1 };

type InspectorPanel = 'model' | 'analysis';

const VIEW_LABEL_KEYS: Record<Space3DViewPreset, TranslationKey> = {
  front: 'space3d.viewFront',
  top: 'space3d.viewTop',
  side: 'space3d.viewSide',
  isometric: 'space3d.viewIsometric',
};

const ANALYSIS_MODE_LABEL_KEYS: Record<Space3DAnalysisMode, TranslationKey> = {
  linear: 'space3d.analysisModeLinear',
  pdelta: 'space3d.analysisModePDelta',
  modal: 'space3d.analysisModeModal',
  buckling: 'space3d.analysisModeBuckling',
  influence: 'space3d.analysisModeInfluence',
  spectrum: 'space3d.analysisModeSpectrum',
};

function EmbeddedInspector({ embedded, expanded, children }: { embedded: boolean; expanded: boolean; children: ReactNode }) {
  return embedded ? <ShellContribution slot="inspector">{children}</ShellContribution>
    : <div className="space3d-sheet" data-expanded={expanded || undefined}>{children}</div>;
}

interface Space3DWorkspaceProps {
  readonly canonicalProject?: Space3DProjectV1;
  readonly onProjectChange?: (project: Space3DProjectV1) => void;
  readonly language: Language;
  /** Render the 3D surface inside the global workbench shell. */
  readonly embedded?: boolean;
  readonly storage?: Space3DStorageLike | null;
  readonly client?: Space3DWorkerClient;
  readonly createViewport?: Space3DViewportFactory;
  /**
   * Entrada elegida en la bienvenida del Solver 3D. Se aplica una vez, con las
   * mismas acciones del arranque vacío: el ejemplo pide confirmación si ya hay
   * un modelo que perder.
   */
  readonly startIntent?: 'generate' | 'example' | 'first-node';
}

const ERROR_KEYS: Record<string, TranslationKey> = {
  'duplicate-id': 'space3d.error.duplicateId',
  'empty-id': 'space3d.error.emptyId',
  'missing-entity': 'space3d.error.missingEntity',
  'node-in-use': 'space3d.error.nodeInUse',
  'self-referential': 'space3d.error.selfReferential',
  'invalid-value': 'space3d.error.invalidValue',
  'limit-exceeded': 'space3d.error.limitExceeded',
  'invalid-result': 'space3d.error.invalidResult',
  'case-in-use': 'space3d.loads.caseInUse',
  'malformed-json': 'space3d.error.malformedJson',
  'analysis-space': 'space3d.error.analysisSpace',
  'schema-version': 'space3d.error.schemaVersion',
  'unknown-field': 'space3d.error.unknownField',
  'invalid-model': 'space3d.error.invalidModel',
  'analysis-failed': 'space3d.error.analysisFailed',
};

/** Códigos de issue del solver traducidos para el aviso de la superficie. */
const ANALYSIS_ISSUE_KEYS: Record<string, TranslationKey> = {
  mechanism: 'space3d.error.mechanism',
  'no-free-dof': 'space3d.error.noFreeDof',
  'empty-model': 'space3d.error.emptyModel',
  'unknown-target': 'space3d.error.unknownTarget',
  'non-finite-solution': 'space3d.error.analysisFailed',
  'unsupported-member-type': 'space3d.error.unsupportedMemberType',
  'unsupported-semantics': 'space3d.error.analysisFailed',
  'constraint-conflict': 'space3d.error.constraintConflict',
  'missing-reference': 'space3d.error.missingEntity',
  'invalid-property': 'space3d.error.invalidValue',
  'invalid-coordinate': 'space3d.error.invalidValue',
  'degenerate-length': 'space3d.error.invalidValue',
  'degenerate-orientation': 'space3d.error.invalidValue',
  'missing-case': 'space3d.error.missingEntity',
  'duplicate-id': 'space3d.error.duplicateId',
  'limit-exceeded': 'space3d.error.limitExceeded',
  'memory-budget': 'space3d.error.limitExceeded',
};

const STATE_KEYS: Record<string, TranslationKey> = {
  idle: 'space3d.stateIdle',
  running: 'space3d.stateRunning',
  ready: 'space3d.stateReady',
  stale: 'space3d.stateStale',
  failed: 'space3d.stateFailed',
  cancelled: 'space3d.stateCancelled',
};

const STATE_TONES: Record<string, string> = {
  idle: 'neutral', running: 'loading', ready: 'ok', stale: 'warn', failed: 'error', cancelled: 'neutral',
};

/** El mismo estado, en los tonos del chip de la barra superior. */
const SHELL_TONES: Record<string, ShellStatusTone> = {
  idle: 'neutral', running: 'running', ready: 'ok', stale: 'warn', failed: 'error', cancelled: 'neutral',
};

/**
 * Límites del multiplicador manual sobre la escala automática de la deformada
 * y de los diagramas. Seis duplicaciones separan lo apenas visible de lo que
 * ya no cabe en pantalla.
 */
const SCALE_FACTOR_MIN = 1 / 64;
const SCALE_FACTOR_MAX = 64;

const LAYER_TOGGLES: readonly { id: 'grid' | 'supports' | 'loads'; key: TranslationKey; icon: ReactNode }[] = [
  { id: 'grid', key: 'space3d.layerGrid', icon: <Grid3x3 size={16} aria-hidden="true" /> },
  { id: 'supports', key: 'space3d.layerSupports', icon: <SupportGlyph size={17} /> },
  { id: 'loads', key: 'space3d.layerLoads', icon: <Weight size={16} aria-hidden="true" /> },
];

/** Misma política numérica que el resto del producto. */
const number = (value: number): string => formatSpace3DNumber(value);

type Space3DStudyState = 'idle' | 'running' | 'ready' | 'failed';

interface Space3DStudyFeedback {
  readonly mode: Space3DAnalysisMode;
  readonly success: boolean;
  readonly detail: string;
}

/** Las etiquetas de identificador ayudan en modelos pequeños y tapan en uno grande. */
const LABELS_BY_DEFAULT_LIMIT = 30;

interface WorkspaceBodyProps extends Pick<Space3DWorkspaceProps,
  'language' | 'embedded' | 'createViewport' | 'onProjectChange' | 'startIntent'> {}

const WorkspaceBody = ({
  language, embedded = false, createViewport, onProjectChange, startIntent,
}: WorkspaceBodyProps) => {
  // El inglés se carga bajo demanda; al llegar, la versión cambia y la mesa se traduce.
  const [catalogVersion, setCatalogVersion] = useState(0);
  useEffect(() => {
    if (isCatalogReady(language)) return;
    let current = true;
    void loadCatalog(language).then(() => { if (current) setCatalogVersion((version) => version + 1); });
    return () => { current = false; };
  }, [language]);
  const t = useCallback(
    (key: TranslationKey, variables?: Record<string, string | number>) => translate(language, key, variables),
    // `catalogVersion` renueva `t` cuando llega un catálogo.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [language, catalogVersion],
  );

  const {
    project, analysis, analysisState, analysisTargetId, selectedEntity, canUndo, canRedo, lastError,
    execute, undo, redo, analyze, cancelAnalysis, select, importPortable, exportPortable, loadExample, resetToBlank,
    replaceProject, setAnalysisTargetId, runStudy, analysisSource,
  } = useSpace3DProject();
  const publishedProject = useRef(project);
  useEffect(() => {
    // Hydration (including StrictMode replay) and callback changes are not edits.
    if (publishedProject.current === project) return;
    publishedProject.current = project;
    onProjectChange?.(project);
  }, [project, onProjectChange]);

  const [layers, setLayers] = useState<Space3DLayerVisibility>(() => ({
    ...SPACE3D_DEFAULT_LAYERS,
    labels: project.members.length <= LABELS_BY_DEFAULT_LIMIT,
  }));
  const [layersOpen, setLayersOpen] = useState(false);
  const [panel, setPanel] = useState<InspectorPanel>('model');
  const [resultsTab, setResultsTab] = useState<Space3DResultsTab>('summary');
  const [editorTarget, setEditorTarget] = useState<Space3DEditorTarget | null>(null);
  /** El editor recibe el foco sólo cuando se abrió desde una lista o un botón, nunca desde el lienzo. */
  const [editorFocus, setEditorFocus] = useState(false);
  const [transfer, setTransfer] = useState<'import' | 'export' | null>(null);
  const [importText, setImportText] = useState('');
  /** Multiplicadores sobre las escalas automáticas; `null` deja la automática. */
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [diagramFactor, setDiagramFactor] = useState(1);
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null);
  // Sube cada vez que el proyecto ENTERO se sustituye o cambia la vista; el
  // lienzo reencuadra sólo entonces. Una edición normal conserva la cámara.
  const [viewFitToken, setViewFitToken] = useState(0);
  const refitView = () => setViewFitToken((token) => token + 1);
  const [viewId, setViewId] = useState<Space3DViewId>('3d');
  const [split, setSplit] = useState(false);
  // Como en 2D, el lienzo manda: el explorador nace abierto sólo si sobra ancho.
  const [explorerOpen, setExplorerOpen] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1600px)').matches
  ));
  const [animate, setAnimate] = useState(false);
  const [sheetExpanded, setLocalSheetExpanded] = useState(false);
  const shellInspector = useShellInspector();
  const setSheetExpanded = (value: boolean | ((current: boolean) => boolean)) => {
    setLocalSheetExpanded(value);
    if (embedded && shellInspector?.mobile && value !== false && document.activeElement instanceof HTMLElement) shellInspector.show(document.activeElement);
  };
  const [resultMode, setResultMode] = useState<Space3DResultMode>('model');
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);
  const [analysisMode, setAnalysisMode] = useState<Space3DAnalysisMode>('linear');
  const [studyState, setStudyState] = useState<Space3DStudyState>('idle');
  const [studyFeedback, setStudyFeedback] = useState<Space3DStudyFeedback | null>(null);
  const [modalResult, setModalResult] = useState<Space3DModalResult | null>(null);
  const [bucklingResult, setBucklingResult] = useState<Space3DBucklingResult | null>(null);
  const [shownMode, setShownMode] = useState<number | null>(null);
  const [generativeOpen, setGenerativeOpen] = useState(false);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [defineDialog, setDefineDialog] = useState<'grid' | 'sections' | 'loads' | 'dynamics' | null>(null);
  const [spectrumCaseChoice, setSpectrumCaseChoice] = useState<string | null>(null);
  const [spectrumResult, setSpectrumResult] = useState<Space3DResponseSpectrumResult | null>(null);
  const [assignKind, setAssignKind] = useState<Space3DAssignKind | null>(null);
  const [tool, setTool] = useState<Space3DModelingTool>('select');
  const [planeOffsets, setPlaneOffsets] = useState<Record<Space3DPlaneAxis, string>>({ x: '0', y: '0', z: '0' });
  const [planeStep, setPlaneStep] = useState(1);
  const [memberFrom, setMemberFrom] = useState<string | null>(null);
  const [memberTemplate, setMemberTemplate] = useState<Space3DMemberTemplate>(() => (
    project.members.length > 0 ? { kind: 'reference' } : { kind: 'catalog', sectionName: 'HEB 200' }
  ));
  const [supportChoice, setSupportChoice] = useState<Space3DSupportChoice>('fixed');
  const [loadDirection, setLoadDirection] = useState<Space3DLoadDirection>('down');
  const [loadMagnitude, setLoadMagnitude] = useState('10');
  const [loadCaseChoice, setLoadCaseChoice] = useState<string | null>(null);
  const [modeNotice, setModeNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  /** Selección múltiple; el store guarda la «primaria» que editan el HUD y el inspector. */
  const [selection, setSelection] = useState<Space3DSelectionSet>(EMPTY_SPACE3D_SELECTION);
  const hasContent = project.nodes.length > 0;
  const nodeCount = project.nodes.length;
  const effectiveScaleFactor = scaleFactor ?? 1;
  const currentAnalysis = analysisState === 'ready' && analysis?.success === true ? analysis : null;
  const spectrumCases = project.responseSpectrumCases ?? [];
  const spectrumCase = spectrumCases.find((item) => item.id === spectrumCaseChoice) ?? spectrumCases[0] ?? null;
  const envelopeShown = currentAnalysis?.targetKind === 'response-spectrum';

  // La selección no puede apuntar a lo que ya no existe (deshacer, borrar, importar).
  useEffect(() => {
    setSelection((current) => pruneSpace3DSelection(project, current));
  }, [project]);

  const grid = useMemo(() => resolveSpace3DGrid(project), [project]);
  const viewOptions = useMemo(() => space3DViewOptions(grid), [grid]);
  const view = resolveSpace3DView(viewOptions, viewId);
  const activeView = view.preset;
  const selectedIds = useMemo(() => ({ nodes: new Set(selection.nodes), members: new Set(selection.members) }), [selection]);

  const modeShape = useMemo(() => {
    if (shownMode === null) return null;
    if (modalResult?.success) return modalResult.modes[shownMode]?.shape ?? null;
    if (bucklingResult?.success) return bucklingResult.modes[shownMode]?.shape ?? null;
    return null;
  }, [bucklingResult, modalResult, shownMode]);
  // Un modo se enseña como deformada: no mezcla diagramas estáticos encima.
  const sceneResultMode: Space3DResultMode = modeShape ? 'model' : resultMode;

  const sceneInput = {
    project, analysis, analysisState, selection: selectedEntity, selectedIds, targetId: analysisTargetId,
    resultMode: sceneResultMode, diagramFactor, shape: modeShape,
  };
  const automatic = useMemo(() => buildSpace3DSceneModel({ ...sceneInput, scope: view.scope }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [analysis, analysisState, analysisTargetId, project, sceneResultMode, selectedEntity, selectedIds, view.scope, diagramFactor, modeShape]);
  const scene = useMemo(() => {
    if (scaleFactor === null || automatic.deformed === null) return automatic;
    return buildSpace3DSceneModel({ ...sceneInput, scope: view.scope, deformationScale: automatic.deformed.scale * scaleFactor });
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [automatic, scaleFactor]);
  const secondaryScene = useMemo(() => (split && view.scope.kind !== '3d'
    ? buildSpace3DSceneModel({ ...sceneInput, scope: SPACE3D_SCOPE_3D, ...(scene.deformed ? { deformationScale: scene.deformed.scale } : {}) })
    : null),
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  [split, view.scope.kind, scene]);
  const showDeformed = layers.deformed && (resultMode === 'deformed' || modeShape !== null);

  const submit = useCallback((command: Space3DCommand) => execute(command).ok, [execute]);

  /**
   * El análisis lineal pasa por el worker del store. Los estudios especializados
   * tienen runners de dominio propios; el modal y el pandeo publican sus modos
   * para dibujarlos, sin mezclarse con los resultados lineales del lienzo.
   */
  const runSelectedAnalysis = useCallback(async () => {
    setStudyFeedback(null);
    if (analysisMode === 'linear') {
      setStudyState('idle');
      // Los modos siguen en su lista, pero el lienzo vuelve a la estática.
      setShownMode(null);
      await analyze();
      return;
    }

    setStudyState('running');

    try {
      const modeLabel = t(ANALYSIS_MODE_LABEL_KEYS[analysisMode]);
      let success = false;
      let detail = '';
      // Los estudios corren en el worker: la mesa sigue respondiendo.
      if (analysisMode === 'pdelta') {
        const outcome = await runStudy({ kind: 'pdelta', targetId: analysisTargetId, maxIterations: 20 });
        const result = outcome.kind === 'pdelta' ? outcome.result : null;
        success = result?.success ?? false;
        detail = result && success
          ? `${t('space3d.studyCompleted', { mode: modeLabel })}: ${t('space3d.study.pdeltaDetail', { iterations: result.iterations, residual: number(result.residual) })}`
          : t('space3d.studyFailed', { mode: modeLabel, reason: result?.reason ?? '' });
      } else if (analysisMode === 'modal') {
        const outcome = await runStudy({ kind: 'modal', targetId: analysisTargetId, modes: Math.min(12, Math.max(1, project.nodes.length)) });
        const result = outcome.kind === 'modal' ? outcome.result : null;
        success = result?.success ?? false;
        setModalResult(result?.success ? result : null);
        setBucklingResult(null);
        setShownMode(result?.success ? 0 : null);
        detail = result && success
          ? `${t('space3d.studyCompleted', { mode: modeLabel })}: ${result.modes.length} modos, T₁ ${number(result.modes[0]?.period ?? Number.NaN)} s`
          : t('space3d.studyFailed', { mode: modeLabel, reason: result?.reason ?? '' });
      } else if (analysisMode === 'buckling') {
        const outcome = await runStudy({ kind: 'buckling', targetId: analysisTargetId, modes: 3 });
        const result = outcome.kind === 'buckling' ? outcome.result : null;
        success = result?.success ?? false;
        setBucklingResult(result?.success ? result : null);
        setModalResult(null);
        setShownMode(result?.success ? 0 : null);
        detail = result && success
          ? `${t('space3d.studyCompleted', { mode: modeLabel })}: factor crítico ${number(result.criticalLoadFactor ?? Number.NaN)}`
          : t('space3d.studyFailed', { mode: modeLabel, reason: result?.reason ?? '' });
      } else if (analysisMode === 'spectrum') {
        if (!spectrumCase) {
          setStudyState('idle');
          setDefineDialog('dynamics');
          return;
        }
        const outcome = await runStudy({ kind: 'response-spectrum', caseId: spectrumCase.id });
        const result = outcome.kind === 'response-spectrum' ? outcome.result : null;
        success = result?.success ?? false;
        setSpectrumResult(result?.success ? result : null);
        setShownMode(null);
        detail = result && success
          ? `${t('space3d.studyCompleted', { mode: modeLabel })}: ${t('space3d.spectrum.detail', { shear: number(result.baseShear), ratio: formatSpace3DNumber(result.cumulativeMassRatio * 100, { significantDigits: 3 }) })}`
          : t('space3d.studyFailed', { mode: modeLabel, reason: result?.reason ?? '' });
        if (success) setResultMode('moment');
      } else {
        const member = project.members.find((item) => item.id === selection.members[0]) ?? project.members[0];
        const start = member ? project.nodes.find((node) => node.id === member.i) : undefined;
        const finish = member ? project.nodes.find((node) => node.id === member.j) : undefined;
        const length = start && finish
          ? Math.hypot(finish.x - start.x, finish.y - start.y, finish.z - start.z)
          : 0;
        const result = analyzeSpace3DInfluence(project, {
          targetId: analysisTargetId,
          target: { kind: 'member', memberId: member?.id ?? '', position: length / 2, quantity: 'N', side: 'continuous' },
          positions: [0, length / 2, length],
          unitLoad: [0, -1, 0],
        });
        success = result.success;
        detail = success
          ? `${t('space3d.studyCompleted', { mode: modeLabel })}: ${result.points.length} posiciones, residuo máx. ${number(result.maxEquilibriumResidual)}`
          : t('space3d.studyFailed', { mode: modeLabel, reason: result.reason });
      }
      setStudyFeedback({ mode: analysisMode, success, detail });
      setStudyState(success ? 'ready' : 'failed');
      if (success && (analysisMode === 'modal' || analysisMode === 'buckling')) {
        setAnimate(true);
        setPanel('analysis');
      }
    } catch (error) {
      // Cancelar no es un fallo: la mesa vuelve a su estado sin aviso rojo.
      if (error instanceof Space3DAnalysisCancelledError) { setStudyState('idle'); return; }
      const modeLabel = t(ANALYSIS_MODE_LABEL_KEYS[analysisMode]);
      setStudyFeedback({
        mode: analysisMode,
        success: false,
        detail: t('space3d.studyFailed', {
          mode: modeLabel,
          reason: error instanceof Error ? error.message : String(error),
        }),
      });
      setStudyState('failed');
    }
  }, [analysisMode, analysisTargetId, analyze, project, runStudy, selection.members, spectrumCase, t]);

  // Un estudio sólo describe el proyecto y el objetivo con los que se ejecutó.
  useEffect(() => {
    setStudyState('idle');
    setStudyFeedback(null);
    setModalResult(null);
    setBucklingResult(null);
    setSpectrumResult(null);
    setShownMode(null);
  }, [analysisTargetId, project]);

  // El resultado listo no trae marca de tiempo propia: se anota aquí sólo para
  // mostrarla. No participa del cálculo ni se persiste con el proyecto.
  useEffect(() => {
    if (analysisState === 'ready') setLastAnalyzedAt(Date.now());
  }, [analysisState]);

  // Sin resultado vigente, ni diagramas ni animación.
  useEffect(() => {
    if (analysisState !== 'ready' && resultMode !== 'model') setResultMode('model');
  }, [analysisState, resultMode]);
  useEffect(() => {
    if (!scene.deformed) setAnimate(false);
  }, [scene.deformed]);

  const openEditor = useCallback((target: Space3DEditorTarget, focus: boolean) => {
    setEditorTarget(target);
    setEditorFocus(focus);
    setAssignKind(null);
    setPanel('model');
  }, []);

  /** Selección de un solo elemento (lista, HUD, leyenda): reemplaza la múltiple. */
  const selectEntity = useCallback((next: Space3DSelection | null, focus = false) => {
    select(next);
    setSelection(next && next.kind !== 'load'
      ? { nodes: next.kind === 'node' ? [next.id] : [], members: next.kind === 'member' ? [next.id] : [] }
      : EMPTY_SPACE3D_SELECTION);
    if (next) {
      openEditor({ kind: next.kind, id: next.id }, focus);
    } else {
      setEditorTarget(null);
      setSheetExpanded(false);
    }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditor, select]);

  /** Aplica una selección múltiple y deja como primaria la última elegida. */
  const applySelection = useCallback((next: Space3DSelectionSet, primary: Space3DSelection | null) => {
    setSelection(next);
    const size = space3DSelectionSize(next);
    const lead = primary && (primary.kind === 'node' ? next.nodes.includes(primary.id) : next.members.includes(primary.id))
      ? primary
      : next.members.length > 0 ? { kind: 'member' as const, id: next.members[next.members.length - 1] }
        : next.nodes.length > 0 ? { kind: 'node' as const, id: next.nodes[next.nodes.length - 1] } : null;
    select(lead);
    setSelectionNotice(null);
    if (size === 1 && lead) {
      if (!assignKind) openEditor({ kind: lead.kind, id: lead.id }, false);
    } else {
      setEditorTarget(null);
      if (size === 0) { setAssignKind(null); setSheetExpanded(false); }
    }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [assignKind, openEditor, select]);

  const onCanvasSelect = useCallback((pick: Space3DSelection | null, modifiers?: Space3DPickModifiers) => {
    applySelection(applySpace3DPick(selection, pick, modifiers?.additive ?? false), pick);
  }, [applySelection, selection]);

  const onWindowSelect = useCallback((pick: Space3DWindowPick, modifiers: Space3DPickModifiers) => {
    applySelection(applySpace3DWindow(selection, pick, modifiers.additive), null);
  }, [applySelection, selection]);

  const openNew = useCallback((kind: Space3DEditorTarget['kind'], initialNodeId?: string) => {
    select(null);
    setSelection(EMPTY_SPACE3D_SELECTION);
    openEditor(kind === 'load' ? { kind, id: null, initialNodeId } : { kind, id: null }, true);
    setSheetExpanded(true);
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditor, select]);

  const clearToolSelection = useCallback(() => {
    select(null);
    setSelection(EMPTY_SPACE3D_SELECTION);
    setEditorTarget(null);
    setAssignKind(null);
    setMemberFrom(null);
  }, [select]);

  /**
   * Cada herramienta de modelado es un modo: el siguiente toque en el lienzo
   * coloca, une, apoya o carga. «Nudo» abre además el formulario de
   * coordenadas, para quien prefiere escribirlas.
   */
  const enterTool = useCallback((next: Space3DModelingTool) => {
    setMemberFrom(null);
    setModeNotice(null);
    setTool(next);
    select(null);
    setSelection(EMPTY_SPACE3D_SELECTION);
    setAssignKind(null);
    if (next === 'node') openEditor({ kind: 'node', id: null }, false);
    else setEditorTarget((current) => (current && current.id === null ? null : current));
    // Sin geometría que encuadrar, la vista se abre a la zona de trabajo mínima.
    if ((next === 'node' || next === 'member') && nodeCount <= 1) setViewFitToken((token) => token + 1);
  }, [nodeCount, openEditor, select]);

  const selectedNodeId = selectedEntity?.kind === 'node' ? selectedEntity.id : null;

  /** Reemplaza directamente si no hay nada que perder; si lo hay, pide confirmación. */
  const requestReplace = (target: 'example' | 'blank') => {
    if (hasContent) {
      setPendingReplace({ kind: target });
      return;
    }
    if (target === 'example') loadExample(); else resetToBlank();
    refitView();
    setEditorTarget(null);
  };

  const startIntentApplied = useRef(false);
  useEffect(() => {
    if (!startIntent || startIntentApplied.current) return;
    startIntentApplied.current = true;
    if (startIntent === 'generate') setGenerativeOpen(true);
    else if (startIntent === 'first-node') enterTool('node');
    else requestReplace('example');
    // La intención se aplica una sola vez, al abrir la mesa.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [startIntent]);

  const requestGeneratedReplace = (generatedProject: Space3DProjectV1) => {
    setGenerativeOpen(false);
    setBuildingOpen(false);
    if (hasContent) {
      setPendingReplace({ kind: 'generated', project: generatedProject });
      return;
    }
    replaceProject(generatedProject);
    setViewId('3d');
    refitView();
    setEditorTarget(null);
    setLayers((current) => ({ ...current, labels: generatedProject.members.length <= LABELS_BY_DEFAULT_LIMIT }));
  };

  const confirmReplace = () => {
    if (!pendingReplace) return;
    if (pendingReplace.kind === 'example') loadExample();
    else if (pendingReplace.kind === 'blank') resetToBlank();
    else {
      replaceProject(pendingReplace.project);
      setLayers((current) => ({ ...current, labels: pendingReplace.project.members.length <= LABELS_BY_DEFAULT_LIMIT }));
    }
    setViewId('3d');
    refitView();
    setEditorTarget(null);
    setPendingReplace(null);
  };

  const remove = useCallback((target: Space3DEditorTarget) => {
    if (!target.id) return;
    const command: Space3DCommand = target.kind === 'node'
      ? { kind: 'delete-node', nodeId: target.id }
      : target.kind === 'member'
        ? { kind: 'delete-member', memberId: target.id }
        : { kind: 'delete-nodal-load', loadId: target.id };
    if (execute(command).ok) {
      select(null);
      setSelection(EMPTY_SPACE3D_SELECTION);
      setEditorTarget(null);
    }
  }, [execute, select]);

  /** Borra la selección múltiple en un solo paso de deshacer. */
  const removeSelection = useCallback(() => {
    if (space3DSelectionSize(selection) === 0) return;
    // Un nudo suelto que todavía sostiene barras se borra por la vía de siempre,
    // que explica por qué no puede irse.
    if (selection.members.length === 0 && selection.nodes.length === 1) {
      remove({ kind: 'node', id: selection.nodes[0] });
      return;
    }
    const { command, keptNodes } = space3DDeleteSelectionCommand(project, selection);
    if (!command) return;
    const count = space3DSelectionSize(selection) - keptNodes.length;
    if (execute(command).ok) {
      select(null);
      setEditorTarget(null);
      setSelection(keptNodes.length > 0 ? { nodes: keptNodes, members: [] } : EMPTY_SPACE3D_SELECTION);
      setSelectionNotice(keptNodes.length > 0
        ? `${t('space3d.selection.deleted', { count })} ${t('space3d.selection.keptNodes', { count: keptNodes.length })}`
        : t('space3d.selection.deleted', { count }));
    }
  }, [execute, project, remove, select, selection, t]);

  const selectAllInView = useCallback(() => {
    applySelection({
      nodes: scene.nodes.filter((node) => node.inScope !== false).map((node) => node.id),
      members: scene.members.filter((member) => member.inScope !== false).map((member) => member.id),
    }, null);
  }, [applySelection, scene]);

  const chooseResultMode = (mode: Space3DResultMode) => {
    setResultMode(mode);
    setShownMode(null);
    // Leer resultados es seleccionar: un toque ya no debe colocar ni cargar nada.
    if (mode !== 'model') { setPanel('analysis'); if (tool !== 'select') enterTool('select'); }
  };

  const changeView = useCallback((id: Space3DViewId) => {
    setViewId(id);
    refitView();
  }, []);

  const openAssign = useCallback((kind: Space3DAssignKind) => {
    setAssignKind(kind);
    setEditorTarget(null);
    setPanel('model');
    setSheetExpanded(true);
    if (tool !== 'select') { setTool('select'); setMemberFrom(null); }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Accesos rápidos por teclado para modelado fluido
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Otro componente ya consumió la tecla —un desplegable, la paleta de
      // comandos, un menú—: la superficie no vuelve a actuar sobre ella.
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      // Un control con foco es dueño de sus teclas: sin esto, Retroceso sobre el
      // botón Cancelar del editor borraba la selección. El lienzo (`role="img"`)
      // no cuenta como control.
      const isControl = Boolean(target?.closest?.(
        'button, a[href], [role="button"], [role="menuitem"], [role="option"], [role="tab"], '
        + '[role="checkbox"], [role="radio"], [role="switch"], [role="combobox"], [role="slider"], [role="spinbutton"]',
      ));
      if (generativeOpen || buildingOpen || defineDialog !== null || pendingReplace !== null || transfer !== null) return;

      if (event.key === 'Escape') {
        // En un campo, Escape es del campo: cerrar el editor desde ahí tiraba
        // el borrador que la persona estaba escribiendo.
        if (isInput) return;
        if (memberFrom) {
          setMemberFrom(null);
          event.preventDefault();
          return;
        }
        if (tool !== 'select') {
          enterTool('select');
          event.preventDefault();
          return;
        }
        if (editorTarget || selectedEntity || space3DSelectionSize(selection) > 0 || assignKind) {
          clearToolSelection();
          event.preventDefault();
          return;
        }
      }

      if (isInput || isControl || event.altKey) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectAllInView();
        return;
      }
      if (event.ctrlKey || event.metaKey) return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && (space3DSelectionSize(selection) > 0 || editorTarget?.id)) {
        event.preventDefault();
        if (space3DSelectionSize(selection) > 0) removeSelection();
        else if (editorTarget?.id) remove(editorTarget);
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'g') { event.preventDefault(); setGenerativeOpen(true); return; }
      if (key === 'v') { event.preventDefault(); enterTool('select'); clearToolSelection(); return; }
      if (key === 'n') { event.preventDefault(); enterTool('node'); return; }
      if (key === 'b') { event.preventDefault(); enterTool('member'); return; }
      if (key === 'a' && project.nodes.length > 0) { event.preventDefault(); enterTool('support'); return; }
      if (key === 'c' && project.nodes.length > 0) { event.preventDefault(); enterTool('load'); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assignKind, buildingOpen, clearToolSelection, defineDialog, editorTarget, enterTool, generativeOpen, memberFrom, pendingReplace, project.nodes.length, remove, removeSelection, selectAllInView, selectedEntity, selection, tool, transfer]);

  const running = analysisState === 'running';
  const runningAny = running || studyState === 'running';
  const analysisBlocked = runningAny;
  const errorMessage = lastError ? t(ERROR_KEYS[lastError] ?? 'space3d.error.generic') : null;
  const stateLabel = t(STATE_KEYS[analysisState]);

  const guide = useMemo(
    () => deriveSpace3DGuide(project, runningAny ? 'running' : analysisState),
    [analysisState, project, runningAny],
  );

  const exploring = guide.next === 'explore-results' && resultMode !== 'model';

  // En una planta o un alzado se dibuja en su plano; en 3D, en el elegido.
  const viewPlane = space3DViewWorkPlane(view);
  const planeAxis = viewPlane?.axis ?? space3DPlaneAxisForView(activeView);
  const parsedOffset = Number(planeOffsets[planeAxis].trim().replace(',', '.'));
  const planeOffset = viewPlane?.offset ?? (Number.isFinite(parsedOffset) ? parsedOffset : 0);
  const magnitudeValue = Number(loadMagnitude.trim().replace(',', '.'));
  const magnitudeInvalid = !Number.isFinite(magnitudeValue) || magnitudeValue <= 0;
  const loadCaseId = loadCaseChoice && project.loadCases.some((item) => item.id === loadCaseChoice)
    ? loadCaseChoice
    : project.loadCases.find((item) => item.id === analysisTargetId)?.id ?? project.loadCases[0]?.id ?? '';
  const baseNodeIds = useMemo(() => space3DBaseNodeIds(project), [project]);
  const topNodeIds = useMemo(() => space3DTopNodeIds(project), [project]);
  const coords = (point: Space3DVector) => `(${point.map((value) => formatSpace3DNumber(value, { significantDigits: 4 })).join(', ')}) ${t('space3d.unitLength')}`;
  const memberFromNode = memberFrom ? project.nodes.find((node) => node.id === memberFrom) ?? null : null;

  /** Ejecuta un comando del modo y deja escrito lo que pasó, bien o mal. */
  const run = (command: Space3DCommand, text: string): boolean => {
    const result = execute(command);
    setModeNotice(result.ok
      ? { text, tone: 'ok' }
      : { text: t(ERROR_KEYS[result.ok ? '' : result.code] ?? 'space3d.error.generic'), tone: 'error' });
    return result.ok;
  };

  const applySupports = (nodeIds: readonly string[]) => {
    const command = space3DSupportCommand(nodeIds, supportChoice);
    if (!command) return;
    run(command, t(nodeIds.length === 1 ? 'space3d.modeSupportAppliedOne' : 'space3d.modeSupportApplied', { count: nodeIds.length, kind: t(SPACE3D_SUPPORT_LABEL_KEYS[supportChoice]).toLowerCase() }));
  };

  const applyLoads = (nodeIds: readonly string[]) => {
    if (magnitudeInvalid) { setModeNotice({ text: t('space3d.modeLoadInvalid'), tone: 'error' }); return; }
    const command = space3DLoadCommand(project, nodeIds, loadCaseId, loadDirection, magnitudeValue);
    if (!command) return;
    run(command, t(nodeIds.length === 1 ? 'space3d.modeLoadAppliedOne' : 'space3d.modeLoadApplied', { magnitude: formatSpace3DNumber(magnitudeValue, { significantDigits: 4 }), count: nodeIds.length }));
  };

  const onDraftPick = ({ selection: picked, point }: Space3DCanvasPick) => {
    const clicked = picked?.kind === 'node' ? project.nodes.find((node) => node.id === picked.id) ?? null : null;
    if (tool === 'support') { if (clicked) applySupports([clicked.id]); return; }
    if (tool === 'load') { if (clicked) applyLoads([clicked.id]); return; }
    if (tool === 'node') {
      if (clicked || !point) return;
      if (findSpace3DNodeAt(project, point)) { setModeNotice({ text: t('space3d.modeNodeExists'), tone: 'error' }); return; }
      const node = buildSpace3DNode(project, point);
      run({ kind: 'add-node', node }, t('space3d.modeNodeAdded', { id: node.id, coords: coords(point) }));
      return;
    }
    if (tool !== 'member') return;
    if (!memberFromNode) {
      if (clicked) { setMemberFrom(clicked.id); setModeNotice({ text: t('space3d.modeMemberStarted', { id: clicked.id }), tone: 'ok' }); return; }
      if (!point) return;
      const existing = findSpace3DNodeAt(project, point);
      if (existing) { setMemberFrom(existing.id); setModeNotice({ text: t('space3d.modeMemberStarted', { id: existing.id }), tone: 'ok' }); return; }
      const node = buildSpace3DNode(project, point);
      if (run({ kind: 'add-node', node }, t('space3d.modeMemberStarted', { id: node.id }))) setMemberFrom(node.id);
      return;
    }
    if (clicked) {
      if (clicked.id === memberFromNode.id) { setMemberFrom(null); setModeNotice(null); return; }
      if (space3DMemberExists(project, memberFromNode.id, clicked.id)) { setModeNotice({ text: t('space3d.modeMemberExists'), tone: 'error' }); setMemberFrom(clicked.id); return; }
      const member = buildSpace3DMember(project, memberFromNode, clicked, memberTemplate);
      if (run({ kind: 'add-member', member }, t('space3d.modeMemberAdded', { id: member.id }))) setMemberFrom(clicked.id);
      return;
    }
    if (!point) return;
    const result = space3DMemberToPointCommand(project, memberFromNode, point, memberTemplate);
    if (!result) return;
    if (run(result.command, t('space3d.modeMemberAdded', { id: result.memberId }))) setMemberFrom(result.endNodeId);
  };

  /**
   * Ajuste de dibujo, como en ETABS: primero a una intersección de la rejilla
   * si el cursor está cerca, después a la cuadrícula del paso elegido.
   */
  const gridSnapPoints = useMemo(() => {
    if (!viewPlane && planeAxis !== 'y') return [];
    if (planeAxis === 'y') return space3DGridPointsAt(grid, planeOffset);
    const along = planeAxis === 'z' ? grid.xLines : grid.zLines;
    return along.flatMap((line) => grid.stories.map((story): [number, number, number] => (planeAxis === 'z'
      ? [line.coordinate, story.elevation, planeOffset]
      : [planeOffset, story.elevation, line.coordinate])));
  }, [grid, planeAxis, planeOffset, viewPlane]);
  const draftPlane = tool === 'node' || tool === 'member' ? { axis: planeAxis, offset: planeOffset, step: planeStep } : null;
  const canvasDraft = useMemo<Space3DCanvasDraft | null>(() => {
    if (tool === 'select') return null;
    const loadLabel = `${formatSpace3DNumber(Number.isFinite(magnitudeValue) ? magnitudeValue : 0, { significantDigits: 4 })} ${t('space3d.unitForce')}`;
    const snapTolerance = Math.max(planeStep * 0.3, SPACE3D_GRID_TOLERANCE);
    return {
      plane: draftPlane,
      from: memberFromNode ? [memberFromNode.x, memberFromNode.y, memberFromNode.z] : null,
      snap: (point) => {
        if (!draftPlane) return point;
        let best: [number, number, number] | null = null;
        let bestDistance = snapTolerance;
        for (const candidate of gridSnapPoints) {
          const distance = Math.hypot(candidate[0] - point[0], candidate[1] - point[1], candidate[2] - point[2]);
          if (distance <= bestDistance) { best = candidate; bestDistance = distance; }
        }
        return best ?? snapToWorkPlane(point, draftPlane);
      },
      describe: (point, nodeId) => {
        if (tool === 'support') return nodeId ? `${nodeId}: ${t(SPACE3D_SUPPORT_LABEL_KEYS[supportChoice])}` : '';
        if (tool === 'load') return nodeId ? `${nodeId}: ${loadLabel}` : '';
        return nodeId ? t('space3d.modeCursorNode', { id: nodeId, coords: coords(point) }) : coords(point);
      },
    };
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, planeAxis, planeOffset, planeStep, memberFromNode, supportChoice, magnitudeValue, t, gridSnapPoints]);

  const onGuideAction = (action: Space3DGuideAction) => {
    if (action === 'start') setBuildingOpen(true);
    else if (action === 'add-node') enterTool('node');
    else if (action === 'add-member') enterTool('member');
    else if (action === 'add-support') enterTool('support');
    else if (action === 'add-load') enterTool('load');
    else if (action === 'analyze' || action === 'reanalyze') void runSelectedAnalysis();
    else if (action === 'review-failure') { enterTool('select'); setPanel('analysis'); setSheetExpanded(true); }
    else if (action === 'explore-results') { enterTool('select'); setResultMode('moment'); setPanel('analysis'); }
  };

  const viewLabels = {
    front: t(VIEW_LABEL_KEYS.front), top: t(VIEW_LABEL_KEYS.top),
    side: t(VIEW_LABEL_KEYS.side), isometric: t(VIEW_LABEL_KEYS.isometric),
  };
  const viewName = (id: Space3DViewId) => {
    const option = resolveSpace3DView(viewOptions, id);
    return option.group === '3d' ? t('space3d.view.3d')
      : option.group === 'plan' ? t('space3d.view.plan', { name: option.name }) : t('space3d.view.elevation', { id: option.name });
  };
  const lastAnalysisLabel = lastAnalyzedAt === null ? null : t('space3d.lastAnalysis', {
    time: new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en', { hour: 'numeric', minute: '2-digit' }).format(lastAnalyzedAt),
  });

  const analyzeButton = (className: string) => <button
    type="button"
    className={className}
    onClick={() => { void runSelectedAnalysis(); }}
    disabled={analysisBlocked}
  >
    <Play size={17} aria-hidden="true" /><span>{runningAny ? t('space3d.analyzing') : t('space3d.analyze')}</span>
  </button>;

  const layersControl = <Popover
    label={t('space3d.layersButton')}
    open={layersOpen}
    onOpenChange={setLayersOpen}
    align="end"
    className="space3d-layers"
    trigger={<><Layers size={16} aria-hidden="true" /><span>{t('space3d.layersButton')}</span></>}
  >
    <p className="space3d-menu-heading">{t('space3d.layersHint')}</p>
    <ul className="space3d-layer-list">
      {LAYER_TOGGLES.map(({ id, key, icon }) => <li key={id}>
        <label className="space3d-layer-toggle">
          <input
            type="checkbox"
            checked={layers[id]}
            onChange={() => setLayers((current) => ({ ...current, [id]: !current[id] }))}
          />
          {icon}
          <span>{t(key)}</span>
        </label>
      </li>)}
      <li>
        <label className="space3d-layer-toggle">
          <input type="checkbox" checked={layers.labels} onChange={() => setLayers((current) => ({ ...current, labels: !current.labels }))} />
          <Tag size={16} aria-hidden="true" />
          <span>{t('space3d.layerLabels')}</span>
        </label>
      </li>
    </ul>
  </Popover>;

  const viewSelect = <label className="space3d-view-select">
    <span className="space3d-visually-hidden">{t('space3d.view.picker')}</span>
    <select value={view.id} onChange={(event) => changeView(event.target.value)}>
      {viewOptions.map((option) => <option key={option.id} value={option.id}>{viewName(option.id)}</option>)}
    </select>
  </label>;

  const ribbon = <Space3DRibbon
      t={t}
      file={{
        onNewBuilding: () => setBuildingOpen(true),
        onGenerator: () => setGenerativeOpen(true),
        onLoadExample: () => requestReplace('example'),
        onResetBlank: () => requestReplace('blank'),
        onImport: () => setTransfer('import'),
        onExport: () => setTransfer('export'),
      }}
      onDefine={setDefineDialog}
      selectedMembers={selection.members.length}
      selectedNodes={selection.nodes.length}
      onAssign={openAssign}
      resultsReady={analysisState === 'ready'}
      animate={animate}
      onAnimate={(value) => {
        setAnimate(value);
        if (value && resultMode !== 'deformed' && !modeShape) setResultMode('deformed');
      }}
      extruded={Boolean(layers.extruded)}
      onExtruded={(value) => setLayers((current) => ({ ...current, extruded: value }))}
      labels={layers.labels}
      onLabels={(value) => setLayers((current) => ({ ...current, labels: value }))}
      split={split}
      onSplit={setSplit}
      explorer={explorerOpen}
      onExplorer={setExplorerOpen}
    />;

  // Magnitudes arriba y al centro, como Axial · Cortante · Momento en 2D.
  // Sólo con resultados: antes no hay nada que elegir.
  const resultRail = hasContent && analysisState === 'ready' ? <nav className="space3d-result-rail" aria-label={t('space3d.resultBarLabel')}>
    <button type="button" aria-pressed={resultMode === 'model' && !modeShape} onClick={() => chooseResultMode('model')}>{t('space3d.display.model')}</button>
    {SPACE3D_DISPLAY_MODES.map(({ mode, short, key }) => <button
      key={mode}
      type="button"
      data-mode={mode}
      aria-pressed={resultMode === mode && !modeShape}
      aria-label={t(key)}
      title={t(key)}
      onClick={() => chooseResultMode(mode)}
    ><span className="space3d-result-rail-long" aria-hidden="true">{t(key)}</span><span className="space3d-result-rail-short" aria-hidden="true">{short}</span></button>)}
  </nav> : null;

  const dock = <Space3DDock
    t={t}
    tool={tool}
    onTool={(next) => { if (next === 'select') { enterTool('select'); clearToolSelection(); } else enterTool(next); }}
    hasNodes={project.nodes.length > 0}
    onGenerate={() => setGenerativeOpen(true)}
    explorer={explorerOpen}
    onExplorer={setExplorerOpen}
    split={split}
    onSplit={setSplit}
  />;

  const selectedMemberResult = currentAnalysis && selectedEntity?.kind === 'member'
    ? currentAnalysis.memberResults.find((item) => item.memberId === selectedEntity.id) ?? null
    : null;
  const noise = space3DResultNoiseFloor(currentAnalysis);

  const memberLoadsOf = (memberId: string) => project.memberLoads.filter((load) => load.memberId === memberId);
  const caseName = (id: string) => project.loadCases.find((item) => item.id === id)?.name ?? id;
  const describeMemberLoad = (load: Space3DProjectV1['memberLoads'][number]) => {
    if (load.type === 'distributed') {
      const q = Math.hypot(load.qxStart ?? 0, load.qyStart ?? 0, load.qzStart ?? 0);
      const q2 = Math.hypot(load.qxEnd ?? 0, load.qyEnd ?? 0, load.qzEnd ?? 0);
      const value = q === q2 ? formatSpace3DNumber(q, { significantDigits: 4 }) : `${formatSpace3DNumber(q, { significantDigits: 3 })}→${formatSpace3DNumber(q2, { significantDigits: 3 })}`;
      return t('space3d.memberLoads.distributed', { value, case: caseName(load.caseId) });
    }
    if (load.type === 'point') {
      return t('space3d.memberLoads.point', { value: formatSpace3DNumber(Math.hypot(load.px ?? 0, load.py ?? 0, load.pz ?? 0), { significantDigits: 4 }), position: formatSpace3DNumber(load.position ?? 0.5, { significantDigits: 3 }), case: caseName(load.caseId) });
    }
    return t('space3d.memberLoads.moment', { value: formatSpace3DNumber(Math.hypot(load.mx ?? 0, load.my ?? 0, (load.mz ?? 0) + (load.moment ?? 0)), { significantDigits: 4 }), position: formatSpace3DNumber(load.position ?? 0.5, { significantDigits: 3 }), case: caseName(load.caseId) });
  };

  const selectionSize = space3DSelectionSize(selection);

  const analysisSection = <div className="space3d-analysis" role="tabpanel" id="space3d-panel-analysis" aria-labelledby="space3d-tab-analysis">
    <section className="space3d-analysis-setup" aria-label={t('space3d.analysisSetup')}>
      <Space3DAnalysisModeSelect
        t={t}
        value={analysisMode}
        disabled={runningAny}
        onChange={(value) => {
          setAnalysisMode(value);
          setStudyState('idle');
          setStudyFeedback(null);
        }}
      />
      {analysisMode === 'spectrum' ? <label className="space3d-field space3d-target">
        <span className="space3d-field-label">{t('space3d.spectrum.caseLabel')}</span>
        {spectrumCases.length > 0 ? <select value={spectrumCase?.id ?? ''} onChange={(event) => setSpectrumCaseChoice(event.target.value)}>
          {spectrumCases.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.direction.toUpperCase()}</option>)}
        </select> : <button type="button" className="space3d-button" onClick={() => setDefineDialog('dynamics')}>{t('space3d.spectrum.define')}</button>}
      </label> : <label className="space3d-field space3d-target">
        <span className="space3d-field-label">{t('space3d.analysisCaseLabel')}</span>
        <select
          value={analysisTargetId}
          onChange={(event) => setAnalysisTargetId(event.target.value)}
        >
          {project.loadCases.length > 0 ? <optgroup label={t('space3d.loadCase')}>
            {project.loadCases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </optgroup> : null}
          {project.loadCombinations.length > 0 ? <optgroup label={t('space3d.loadCombination')}>
            {project.loadCombinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </optgroup> : null}
        </select>
      </label>}
      <div className="space3d-analysis-run">
        {analyzeButton('space3d-button')}
        {runningAny ? <button type="button" className="space3d-button" onClick={cancelAnalysis}>
          <CircleStop size={16} aria-hidden="true" />{t('space3d.cancelAnalysis')}
        </button> : null}
      </div>
      <p className="space3d-analysis-state">
        <span className={`space3d-state space3d-state--${STATE_TONES[analysisState]}`} data-testid="space3d-analysis-state-label">{stateLabel}</span>
        {lastAnalysisLabel ? <span>{lastAnalysisLabel}</span> : null}
      </p>
      {currentAnalysis && analysisSource && analysisSource.kind !== 'linear'
        ? <p className="space3d-source-chip" data-kind={analysisSource.kind}>{t(analysisSource.kind === 'pdelta' ? 'space3d.source.pdelta' : 'space3d.source.spectrum', { id: analysisSource.id })}</p>
        : null}
    </section>

    {studyState === 'running' ? <p className="space3d-notice" role="status" data-testid="space3d-study-status">
      {t('space3d.studyRunning')}
    </p> : null}
    {studyFeedback ? <div
      className={`space3d-notice space3d-study-feedback ${studyFeedback.success ? 'space3d-notice--ok' : 'space3d-notice--error'}`}
      role="status"
      data-testid="space3d-study-status"
    >
      <strong>{studyFeedback.detail}</strong>
      {studyFeedback.mode === 'linear' ? null : <small>{t(studyFeedback.mode === 'pdelta' || studyFeedback.mode === 'spectrum' ? 'space3d.studyShownOnCanvas' : 'space3d.studyLinearPreserved')}</small>}
    </div> : null}

    <Space3DModesPanel t={t} modal={modalResult} buckling={bucklingResult} shown={shownMode} onShow={(index) => { setShownMode(index); setAnimate(index !== null); }} />
    {spectrumResult && envelopeShown ? <Space3DSpectrumPanel t={t} result={spectrumResult} /> : null}
    {currentAnalysis?.stories ? <Space3DStoryPanel
      t={t}
      stories={currentAnalysis.stories}
      envelope={envelopeShown}
      displacementScale={currentAnalysis.nodeResults.reduce((peak, node) => Math.max(peak, Math.abs(node.displacement.ux), Math.abs(node.displacement.uy), Math.abs(node.displacement.uz)), 0)}
      forceNoise={space3DResultNoiseFloor(currentAnalysis)}
    /> : null}

    {/* El motivo del fallo se publica junto a la acción que lo provocó. */}
    {analysisState === 'failed' && analysis && analysis.issues.length > 0
      ? <div className="space3d-notice space3d-notice--error" role="alert">
        <strong>{t('space3d.analysisIssues')}</strong>
        <ul className="space3d-issue-line">
          {analysis.issues.slice(0, 4).map((issue, index) => <li key={`${issue.code}-${issue.entityId}-${index}`} data-diagnostic-code={issue.code}>
            {t(ANALYSIS_ISSUE_KEYS[issue.code] ?? 'space3d.error.generic')}{issue.entityId ? ` · ${issue.entityId}` : ''}{issue.field ? ` (${issue.field})` : ''}
          </li>)}
        </ul>
      </div>
      : null}
    {currentAnalysis?.diagnostics.autoRestrainedDofCount ? <p className="space3d-field-hint">
      {t('space3d.status.autoRestrained', { count: currentAnalysis.diagnostics.autoRestrainedDofCount })}
    </p> : null}

    <Space3DResultsPanel
      analysis={analysis}
      analysisState={analysisState}
      tab={resultsTab}
      onTabChange={setResultsTab}
      deformationScale={scene.deformed?.scale ?? null}
      maxDisplacement={scene.deformed?.maxDisplacement ?? null}
      t={t}
      onSelectNode={(id) => selectEntity({ kind: 'node', id }, true)}
      onSelectMember={(id) => selectEntity({ kind: 'member', id }, true)}
    />
  </div>;

  const selectionSummary = <section className="space3d-selection-panel" aria-label={t('space3d.selection.title')}>
    <header>
      <h3>{t('space3d.selection.title')}</h3>
      <p>{t('space3d.selection.summary', { nodes: selection.nodes.length, members: selection.members.length })}</p>
    </header>
    <p className="space3d-field-hint">{t('space3d.selection.assignHeading')}</p>
    <div className="space3d-selection-actions">
      <button type="button" className="space3d-button" disabled={selection.members.length === 0} onClick={() => openAssign('section')}>{t('space3d.assign.section')}</button>
      <button type="button" className="space3d-button" disabled={selection.members.length === 0} onClick={() => openAssign('releases')}>{t('space3d.assign.releases')}</button>
      <button type="button" className="space3d-button" disabled={selection.members.length === 0} onClick={() => openAssign('member-load')}>{t('space3d.assign.memberLoad')}</button>
      <button type="button" className="space3d-button" disabled={selection.nodes.length === 0} onClick={() => openAssign('nodal-load')}>{t('space3d.assign.nodalLoad')}</button>
      <button type="button" className="space3d-button" disabled={selection.nodes.length === 0} onClick={() => openAssign('support')}>{t('space3d.assign.support')}</button>
      <button type="button" className="space3d-button" disabled={selection.members.length === 0} onClick={() => openAssign('type')}>{t('space3d.assign.type')}</button>
      <button type="button" className="space3d-button" disabled={selection.nodes.length === 0} onClick={() => openAssign('diaphragm')}>{t('space3d.assign.diaphragm')}</button>
    </div>
    <footer className="space3d-editor-actions">
      <button type="button" className="space3d-button space3d-button--danger" onClick={removeSelection}><Trash2 size={16} aria-hidden="true" />{t('space3d.selection.delete')}</button>
      <button type="button" className="space3d-button" onClick={clearToolSelection}><X size={16} aria-hidden="true" />{t('space3d.selection.clear')}</button>
    </footer>
  </section>;

  const memberDetail = editorTarget?.kind === 'member' && editorTarget.id ? <>
    <section className="space3d-member-loads" aria-label={t('space3d.memberLoads.title')}>
      <h4>{t('space3d.memberLoads.title')}</h4>
      {memberLoadsOf(editorTarget.id).length === 0 ? <p className="space3d-field-hint">{t('space3d.memberLoads.none')}</p>
        : <ul>
          {memberLoadsOf(editorTarget.id).map((load) => <li key={load.id}>
            <code>{load.id}</code>
            <span>{describeMemberLoad(load)}</span>
            <button type="button" className="space3d-tool" aria-label={t('space3d.memberLoads.delete', { id: load.id })} title={t('space3d.memberLoads.delete', { id: load.id })}
              onClick={() => submit({ kind: 'delete-member-load', loadId: load.id })}><Trash2 size={14} aria-hidden="true" /></button>
          </li>)}
        </ul>}
    </section>
    {selectedMemberResult ? <Space3DMemberDiagrams t={t} result={selectedMemberResult} noise={noise} />
      : <p className="space3d-field-hint">{t('space3d.detail.needsAnalysis')}</p>}
  </> : null;

  const modelSection = <div className="space3d-model" role="tabpanel" id="space3d-panel-model" aria-labelledby="space3d-tab-model">
    {selectionNotice ? <p className="space3d-notice space3d-notice--ok" role="status">{selectionNotice}</p> : null}
    {assignKind
      ? <Space3DAssignPanel
        key={assignKind}
        t={t}
        kind={assignKind}
        project={project}
        selection={selection}
        defaultCaseId={loadCaseId}
        onSubmit={submit}
        onClose={() => setAssignKind(null)}
      />
      : editorTarget
        ? <>
          <Space3DEntityEditor
            project={project}
            target={editorTarget}
            t={t}
            onSubmit={submit}
            onCancel={() => { setEditorTarget(null); select(null); setSelection(EMPTY_SPACE3D_SELECTION); }}
            onDelete={remove}
            focusOnOpen={editorFocus}
          />
          {memberDetail}
        </>
        : selectionSize > 1
          ? selectionSummary
          : <Space3DModelOutline
            project={project}
            selection={selectedEntity}
            t={t}
            onSelect={(next) => selectEntity(next, true)}
            onAddNode={() => openNew('node')}
            onAddMember={() => openNew('member')}
            onAddLoad={() => openNew('load', selectedNodeId ?? undefined)}
            canAddMember={project.nodes.length >= 2}
            canAddLoad={project.nodes.length > 0}
          />}
  </div>;

  const canvasCopy = {
    label: t('space3d.canvasLabel'),
    fallbackTitle: t('space3d.webglTitle'),
    fallbackBody: t('space3d.webglBody'),
    retry: t('space3d.retry'),
    summaryTitle: t('space3d.canvasSummary'),
    cameraLabel: t('space3d.cameraLabel'),
    nodes: t('space3d.nodes'),
    members: t('space3d.members'),
    supports: t('space3d.supports'),
    loads: t('space3d.loads'),
  };
  // Con esfuerzos o reacciones en pantalla las flechas de carga estorban: se
  // retiran mientras se leen resultados, como hace ETABS.
  const canvasLayers = useMemo(() => ({
    ...layers,
    deformed: showDeformed,
    loads: layers.loads && (resultMode === 'model' || resultMode === 'deformed') && !modeShape,
  }), [layers, modeShape, resultMode, showDeformed]);
  const scaleControl = scene.deformed && (resultMode === 'deformed' || modeShape) ? <div className="space3d-scale" role="group" aria-label={t('space3d.layerDeformed')}>
    <span role="status" aria-live="polite">
      {t('space3d.deformationScale', { scale: formatSpace3DNumber(scene.deformed.scale, { significantDigits: 4 }) })}
      <span data-testid="space3d-deformation-scale" className="space3d-visually-hidden">{scene.deformed.scale}</span>
    </span>
    <button type="button" className="space3d-tool" title={t('space3d.scaleHalve')} aria-label={t('space3d.scaleHalve')}
      disabled={effectiveScaleFactor <= SCALE_FACTOR_MIN}
      onClick={() => setScaleFactor((current) => Math.max(SCALE_FACTOR_MIN, (current ?? 1) / 2))}>
      <Minus size={15} aria-hidden="true" />
    </button>
    <button type="button" className="space3d-tool" title={t('space3d.scaleDouble')} aria-label={t('space3d.scaleDouble')}
      disabled={effectiveScaleFactor >= SCALE_FACTOR_MAX}
      onClick={() => setScaleFactor((current) => Math.min(SCALE_FACTOR_MAX, (current ?? 1) * 2))}>
      <Plus size={15} aria-hidden="true" />
    </button>
    <button type="button" className="space3d-tool space3d-tool--text" disabled={scaleFactor === null}
      onClick={() => setScaleFactor(null)}>{t('space3d.scaleAuto')}</button>
  </div> : scene.diagram ? <div className="space3d-scale" role="group" aria-label={t('space3d.display.results')}>
    <span>{t('space3d.display.diagramScale', { factor: formatSpace3DNumber(diagramFactor, { significantDigits: 3 }) })}</span>
    <button type="button" className="space3d-tool" title={t('space3d.display.diagramSmaller')} aria-label={t('space3d.display.diagramSmaller')}
      disabled={diagramFactor <= 1 / 8} onClick={() => setDiagramFactor((value) => value / 2)}><Minus size={15} aria-hidden="true" /></button>
    <button type="button" className="space3d-tool" title={t('space3d.display.diagramBigger')} aria-label={t('space3d.display.diagramBigger')}
      disabled={diagramFactor >= 8} onClick={() => setDiagramFactor((value) => value * 2)}><Plus size={15} aria-hidden="true" /></button>
  </div> : null;

  const toolLabel = t(tool === 'node' ? 'space3d.node' : tool === 'member' ? 'space3d.member'
    : tool === 'support' ? 'space3d.toolSupport' : tool === 'load' ? 'space3d.load' : 'space3d.toolSelect');
  // Franja de estado con la voz de la de 2D: lectura del modelo a la izquierda,
  // herramienta, unidades y estado del cálculo a la derecha.
  const statusBar = <footer className="space3d-status" aria-label={t('space3d.title')}>
    <span className="space3d-status-counts" title={t('space3d.canvasSummary')}>
      <span><b>{project.nodes.length}</b> N</span>
      <span><b>{project.members.length}</b> B</span>
      <span><b>{project.nodalLoads.length + project.memberLoads.length}</b> C</span>
    </span>
    <span className="space3d-status-case">{t('space3d.statusCase', { id: analysisTargetId })}</span>
    <span className="space3d-status-view">{viewName(view.id)}</span>
    {selectionSize > 0 ? <span className="space3d-status-selection">{t('space3d.status.selection', { count: selectionSize })}</span> : null}
    <span className="space3d-status-help">{view.scope.kind === '3d' ? t('space3d.interactionHelp') : t('space3d.selection.none')}</span>
    <span className="space3d-status-tool">{toolLabel}</span>
    <span className="space3d-status-units">{t('space3d.statusUnits')}</span>
    {lastAnalysisLabel ? <span className="space3d-status-last">{lastAnalysisLabel}</span> : null}
    <span className={`space3d-state space3d-state--${STATE_TONES[analysisState]}`}>{stateLabel}</span>
  </footer>;

  const phoneDock = embedded && Boolean(shellInspector?.mobile);

  // Banda de resultados al pie del lienzo, como el «Centro analítico» de 2D: el
  // dato que gobierna y un acceso al panel con las tablas.
  const bandHeadline = (() => {
    if (!currentAnalysis) return null;
    if (spectrumResult && envelopeShown) return t('space3d.band.spectrum', { value: formatSpace3DNumber(spectrumResult.baseShear, { significantDigits: 4 }), axis: spectrumResult.direction.toUpperCase() });
    // Con un diagrama en pantalla, la banda dice su valor gobernante (como «M gobernante» en 2D).
    const shown = SPACE3D_DISPLAY_MODES.find((item) => item.mode === resultMode);
    if (shown && resultMode !== 'deformed' && !modeShape) {
      const stats = space3DResultStats(resultMode, currentAnalysis, t);
      if (stats && stats.criticalId) {
        const governing = Math.abs(stats.min) > Math.abs(stats.max) ? stats.min : stats.max;
        return t('space3d.band.governing', { name: t(shown.key), value: formatSpace3DNumber(governing, { significantDigits: 4 }), unit: stats.unit, id: stats.criticalId });
      }
    }
    let peak = 0;
    let peakNode = '';
    let vertical = 0;
    for (const node of currentAnalysis.nodeResults) {
      const value = Math.hypot(node.displacement.ux, node.displacement.uy, node.displacement.uz);
      if (value > peak) { peak = value; peakNode = node.nodeId; }
      vertical += node.reaction.uy;
    }
    const parts = [t('space3d.band.displacement', { value: formatSpace3DNumber(peak * 1000, { significantDigits: 4 }), id: peakNode })];
    if (Math.abs(vertical) > noise) parts.push(t('space3d.band.reaction', { value: formatSpace3DNumber(vertical, { significantDigits: 4 }) }));
    return parts.join(' · ');
  })();
  const openResults = (element: HTMLElement) => {
    setPanel('analysis');
    if (embedded && shellInspector) shellInspector.reveal(element);
    else setSheetExpanded(true);
  };
  const resultsBand = bandHeadline ? <section className="space3d-results-band" aria-label={t('space3d.band.label')}>
    <div className="space3d-results-band-copy">
      <span className="space3d-results-band-label">{t('space3d.band.label')}</span>
      <strong>{bandHeadline}</strong>
    </div>
    <button type="button" className="space3d-results-band-open" onClick={(event) => openResults(event.currentTarget)}>
      {t('space3d.band.open')}<ChevronDown size={15} aria-hidden="true" />
    </button>
  </section> : null;

  return <div className="space3d-screen" data-space3d-layout="workbench" data-embedded={embedded || undefined}>
    {embedded ? <>
      <ShellContribution slot="controls">
        <button type="button" className="workspace-topbar__icon-button" onClick={undo} disabled={!canUndo} aria-label={t('space3d.undo')} title={t('space3d.undo')}><Undo2 size={17} aria-hidden="true" /></button>
        <button type="button" className="workspace-topbar__icon-button" onClick={redo} disabled={!canRedo} aria-label={t('space3d.redo')} title={t('space3d.redo')}><Redo2 size={17} aria-hidden="true" /></button>
      </ShellContribution>
      <ShellContribution slot="action">{analyzeButton('workspace-topbar__action-button is-primary')}</ShellContribution>
      <ShellContribution slot="status"><ShellStatusChip tone={SHELL_TONES[analysisState] ?? 'neutral'} label={stateLabel} badge={t('space3d.badge')} /></ShellContribution>
    </> : <header className="space3d-localbar">
      <strong className="space3d-localbar-title">{project.name}</strong>
      <span className="space3d-badge">{t('space3d.badge')}</span>
      <div className="space3d-localbar-actions">
        <button type="button" className="space3d-tool" onClick={undo} disabled={!canUndo} aria-label={t('space3d.undo')} title={t('space3d.undo')}><Undo2 size={16} aria-hidden="true" /></button>
        <button type="button" className="space3d-tool" onClick={redo} disabled={!canRedo} aria-label={t('space3d.redo')} title={t('space3d.redo')}><Redo2 size={16} aria-hidden="true" /></button>
        {analyzeButton('space3d-button space3d-button--primary')}
      </div>
    </header>}

    {errorMessage ? <div className="space3d-diagnostics">
      <p className="space3d-notice space3d-notice--error" role="alert">{errorMessage}</p>
    </div> : null}

    <div className="space3d-layout" data-explorer={explorerOpen || undefined} data-split={split || undefined}>
      {explorerOpen ? <Space3DExplorer
        t={t}
        project={project}
        grid={grid}
        viewId={view.id}
        onView={changeView}
        analysisTargetId={analysisTargetId}
        onTarget={setAnalysisTargetId}
        onSelectMembers={(ids) => applySelection({ nodes: [], members: [...ids] }, null)}
        onEditGrid={() => setDefineDialog('grid')}
        onEditLoads={() => setDefineDialog('loads')}
        onEditDynamics={() => setDefineDialog('dynamics')}
        onSelectNodes={(ids) => applySelection({ nodes: [...ids], members: [] }, null)}
      /> : null}

      <div className="space3d-stages">
        <section className="space3d-stage" aria-label={t('space3d.canvasLabel')}>
          {tool !== 'select' ? <div className="space3d-stage-modebar">
            <Space3DModeBar
              t={t}
              tool={tool}
              onExit={() => enterTool('select')}
              notice={modeNotice?.text ?? null}
              noticeTone={modeNotice?.tone}
              planeAxis={planeAxis}
              planeOffset={viewPlane ? String(viewPlane.offset) : planeOffsets[planeAxis]}
              onPlaneOffsetChange={(value) => setPlaneOffsets((current) => ({ ...current, [planeAxis]: value }))}
              planeStep={planeStep}
              onPlaneStepChange={setPlaneStep}
              memberFromId={memberFrom}
              onFinishMember={() => { setMemberFrom(null); setModeNotice(null); }}
              memberTemplate={memberTemplate}
              onMemberTemplateChange={setMemberTemplate}
              referenceMemberId={project.members[0]?.id ?? null}
              supportChoice={supportChoice}
              onSupportChoiceChange={setSupportChoice}
              baseCount={baseNodeIds.length}
              onSupportBase={() => applySupports(baseNodeIds)}
              loadDirection={loadDirection}
              onLoadDirectionChange={setLoadDirection}
              loadMagnitude={loadMagnitude}
              onLoadMagnitudeChange={setLoadMagnitude}
              loadMagnitudeInvalid={magnitudeInvalid}
              loadCases={project.loadCases}
              loadCaseId={loadCaseId}
              onLoadCaseChange={setLoadCaseChoice}
              topCount={topNodeIds.length}
              onLoadTop={() => applyLoads(topNodeIds)}
            />
          </div> : null}
          <Space3DCanvas
            model={scene}
            layers={canvasLayers}
            onSelect={onCanvasSelect}
            onWindowSelect={onWindowSelect}
            windowSelect={view.scope.kind !== '3d'}
            animate={animate && showDeformed}
            draft={canvasDraft}
            onDraftPick={onDraftPick}
            createViewport={createViewport}
            viewLabels={viewLabels}
            activeView={activeView}
            refitToken={viewFitToken}
            zoomInLabel={t('space3d.zoomIn')}
            zoomOutLabel={t('space3d.zoomOut')}
            resetLabel={t('space3d.resetView')}
            viewSelectLabel={t('space3d.viewSelect')}
            fullscreenEnterLabel={t('space3d.fullscreenEnter')}
            fullscreenExitLabel={t('space3d.fullscreenExit')}
            onViewChange={() => changeView('3d')}
            leadingControls={ribbon}
            centerControls={resultRail}
            trailingControls={<>{viewSelect}{layersControl}</>}
            copy={canvasCopy}
          />

          {!hasContent && tool === 'select' ? <div className="space3d-empty-stage">
            <div className="space3d-empty-card">
              <h2>{t('space3d.emptyCanvasTitle')}</h2>
              <p>{t('space3d.emptyCanvasBody')}</p>
              <div className="space3d-empty-options">
                <button type="button" className="space3d-empty-option space3d-empty-option--primary" onClick={() => setBuildingOpen(true)}>
                  <span className="space3d-empty-option-title">{t('space3d.building.title')}</span>
                  <span className="space3d-empty-option-hint">{t('space3d.building.description')}</span>
                </button>
                <button type="button" className="space3d-empty-option" onClick={() => setGenerativeOpen(true)}>
                  <span className="space3d-empty-option-title">{t('space3d.emptyGenerate')}</span>
                  <span className="space3d-empty-option-hint">{t('space3d.emptyGenerateHint')}</span>
                </button>
                <button type="button" className="space3d-empty-option" onClick={() => requestReplace('example')}>
                  <span className="space3d-empty-option-title">{t('space3d.emptyExample')}</span>
                  <span className="space3d-empty-option-hint">{t('space3d.emptyExampleHint')}</span>
                </button>
                <button type="button" className="space3d-empty-option" onClick={() => enterTool('node')}>
                  <span className="space3d-empty-option-title"><NodeGlyph size={16} />{t('space3d.emptyNode')}</span>
                  <span className="space3d-empty-option-hint">{t('space3d.emptyNodeHint')}</span>
                </button>
              </div>
            </div>
          </div> : tool !== 'select' ? null : <div className="space3d-stage-guide">
            <Space3DGuide compact guide={guide} t={t} analysisLabel={stateLabel} onAction={onGuideAction} actionDone={exploring} />
          </div>}

          {/* La hoja sólo tapa el lienzo en el layout compacto; en escritorio es una
              columna fija al lado. Por eso la ocultación la decide el CSS. */}
          <div className="space3d-bottom-stack" data-sheet-expanded={sheetExpanded || undefined}>
            {selectedEntity && selectionSize <= 1 ? (
              <Space3DSelectionHUD
                selection={selectedEntity}
                project={project}
                analysis={currentAnalysis}
                onDeselect={() => clearToolSelection()}
                onOpenEditor={() => {
                  openEditor({ kind: selectedEntity.kind, id: selectedEntity.id }, true);
                  setSheetExpanded(true);
                }}
                onDelete={() => {
                  const target = editorTarget?.id ? editorTarget : { kind: selectedEntity.kind, id: selectedEntity.id };
                  remove(target);
                }}
                onStartConnectMember={(nodeId) => { enterTool('member'); setMemberFrom(nodeId); }}
                onAddLoadToNode={(nodeId) => openNew('load', nodeId)}
                t={t}
              />
            ) : null}
            {resultMode !== 'model' && !modeShape ? (
              <Space3DResultsLegend
                resultMode={resultMode}
                analysis={currentAnalysis}
                project={project}
                onSelectCritical={(kind, id) => selectEntity({ kind, id })}
                t={t}
              />
            ) : null}
          </div>

          {scaleControl ? <div className="space3d-stage-scale">{scaleControl}</div> : null}
        </section>

        {secondaryScene ? <section className="space3d-stage space3d-stage--secondary" aria-label={t('space3d.view.secondary')}>
          <Space3DCanvas
            model={secondaryScene}
            layers={canvasLayers}
            onSelect={onCanvasSelect}
            onWindowSelect={onWindowSelect}
            animate={animate && showDeformed}
            createViewport={createViewport}
            viewLabels={viewLabels}
            activeView="isometric"
            refitToken={viewFitToken}
            zoomInLabel={t('space3d.zoomIn')}
            zoomOutLabel={t('space3d.zoomOut')}
            resetLabel={t('space3d.resetView')}
            viewSelectLabel={t('space3d.viewSelect')}
            fullscreenEnterLabel={t('space3d.fullscreenEnter')}
            fullscreenExitLabel={t('space3d.fullscreenExit')}
            leadingControls={<span className="space3d-view-chip">{t('space3d.view.3d')}</span>}
            copy={canvasCopy}
          />
        </section> : null}
        {/* En un teléfono el dock baja al pie del shell, como el de 2D. */}
        {phoneDock ? <ShellContribution slot="dock">{dock}</ShellContribution> : dock}
      </div>
      {resultsBand}
    </div>

    <EmbeddedInspector embedded={embedded} expanded={sheetExpanded}>
      <div className="space3d-inspector">
        {/* Con resultados, la ruta ya se recorrió: basta una línea y el panel es para los números. */}
        <Space3DGuide
          compact={guide.next === 'explore-results' || guide.next === 'running'}
          guide={guide}
          t={t}
          analysisLabel={stateLabel}
          onAction={onGuideAction}
          actionDone={exploring}
        />
        <div className="space3d-tabs" role="tablist" aria-label={t('space3d.inspectorTabs')}>
          <button type="button" role="tab" id="space3d-tab-model" className="space3d-tab" aria-controls="space3d-panel-model"
            aria-selected={panel === 'model'} tabIndex={panel === 'model' ? 0 : -1} onClick={() => setPanel('model')}>
            {selectionSize > 1 ? t('space3d.selection.title') : t('space3d.inspectorModel')}
          </button>
          <button type="button" role="tab" id="space3d-tab-analysis" className="space3d-tab" aria-controls="space3d-panel-analysis"
            aria-selected={panel === 'analysis'} tabIndex={panel === 'analysis' ? 0 : -1} onClick={() => setPanel('analysis')}>
            {t('space3d.inspectorAnalysis')}
            <span className={`space3d-tab-dot space3d-tab-dot--${STATE_TONES[analysisState]}`} aria-hidden="true" />
          </button>
        </div>
        {panel === 'model' ? modelSection : analysisSection}
      </div>
    </EmbeddedInspector>

    <Dialog
      open={transfer !== null}
      onOpenChange={(open) => { if (!open) { setTransfer(null); setImportText(''); } }}
      title={transfer === 'import' ? t('space3d.import') : t('space3d.export')}
      closeLabel={t('space3d.importCancel')}
      footer={<>
        <button type="button" className="space3d-button" onClick={() => { setTransfer(null); setImportText(''); }}>{t('space3d.importCancel')}</button>
        {transfer === 'import' ? <button
          type="button"
          className="space3d-button space3d-button--primary"
          disabled={importText.trim() === ''}
          onClick={() => {
            if (importPortable(importText).ok) {
              setViewId('3d');
              refitView();
              setTransfer(null);
              setImportText('');
              setEditorTarget(null);
            }
          }}
        >{t('space3d.importConfirm')}</button> : null}
      </>}
    >
      <label className="space3d-field space3d-transfer">
        <span className="space3d-field-label">{transfer === 'import' ? t('space3d.transferImportLabel') : t('space3d.transferExportLabel')}</span>
        <textarea
          rows={10}
          spellCheck={false}
          readOnly={transfer === 'export'}
          placeholder={transfer === 'import' ? t('space3d.importPlaceholder') : undefined}
          value={transfer === 'export' ? exportPortable() : importText}
          onChange={(event) => setImportText(event.target.value)}
        />
      </label>
      {transfer === 'import' && errorMessage ? <p className="space3d-notice space3d-notice--error" role="alert">{errorMessage}</p> : null}
    </Dialog>

    <Dialog
      open={pendingReplace !== null}
      onOpenChange={(open) => { if (!open) setPendingReplace(null); }}
      title={pendingReplace?.kind === 'example'
        ? t('space3d.confirmReplaceTitleExample')
        : pendingReplace?.kind === 'generated'
          ? t('space3d.confirmReplaceTitleGenerated')
          : t('space3d.confirmReplaceTitleBlank')}
      description={pendingReplace?.kind === 'example'
        ? t('space3d.confirmReplaceBodyExample')
        : pendingReplace?.kind === 'generated'
          ? t('space3d.confirmReplaceBodyGenerated')
          : t('space3d.confirmReplaceBodyBlank')}
      footer={<>
        <button type="button" className="space3d-button" onClick={() => setPendingReplace(null)}>
          {t('space3d.confirmReplaceCancel')}
        </button>
        <button type="button" className="space3d-button space3d-button--primary" onClick={confirmReplace}>
          {t('space3d.confirmReplaceConfirm')}
        </button>
      </>}
    >{null}</Dialog>

    <Space3DGenerativeModal
      open={generativeOpen}
      onClose={() => setGenerativeOpen(false)}
      onApply={requestGeneratedReplace}
      t={t}
    />
    <Suspense fallback={null}>
      {buildingOpen ? <Space3DBuildingDialog open onOpenChange={setBuildingOpen} t={t} onCreate={requestGeneratedReplace} /> : null}
      {defineDialog === 'grid' ? <Space3DGridDialog open onOpenChange={(open) => setDefineDialog(open ? 'grid' : null)} t={t} grid={grid} onSubmit={submit} /> : null}
      {defineDialog === 'loads' ? <Space3DLoadsDialog open onOpenChange={(open) => setDefineDialog(open ? 'loads' : null)} t={t} project={project} onSubmit={submit} /> : null}
      {defineDialog === 'dynamics' ? <Space3DDynamicsDialog
        open
        onOpenChange={(open) => setDefineDialog(open ? 'dynamics' : null)}
        t={t}
        project={project}
        onSubmit={submit}
        onSelectNodes={(ids) => { applySelection({ nodes: [...ids], members: [] }, null); setDefineDialog(null); }}
      /> : null}
      {defineDialog === 'sections' ? <Space3DSectionsDialog
        open
        onOpenChange={(open) => setDefineDialog(open ? 'sections' : null)}
        t={t}
        selectedMembers={selection.members.length}
        onAssign={(name) => {
          const command = space3DAssignSectionCommand(selection.members, name);
          if (command && submit(command)) setSelectionNotice(t('space3d.assign.done', { count: selection.members.length }));
        }}
      /> : null}
    </Suspense>

    {embedded ? <ShellContribution slot="statusbar">{statusBar}</ShellContribution> : statusBar}
    <span data-testid="space3d-analysis-state" className="space3d-visually-hidden">{analysisState}</span>
    <span data-testid="space3d-deformed-visible" className="space3d-visually-hidden">{String(scene.deformed !== null)}</span>
  </div>;
};

/** Monta el store del modelo 3D con el proyecto guardado de la herramienta o uno en blanco. */
const Space3DWorkspace = ({ storage, client, canonicalProject, ...rest }: Space3DWorkspaceProps) => (
  <Space3DProjectProvider storage={storage} client={client} initialProject={canonicalProject}>
    <WorkspaceBody {...rest} />
  </Space3DProjectProvider>
);

export default Space3DWorkspace;
