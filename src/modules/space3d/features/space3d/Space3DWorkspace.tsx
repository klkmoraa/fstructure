/**
 * Superficie Space 3D.
 *
 * Composición: carril de herramientas a la izquierda, lienzo como protagonista
 * y un panel con la ruta del cálculo, el esquema del modelo y el análisis. En
 * el shell compacto el panel vive en la hoja del inspector y el lienzo muestra
 * sólo el siguiente paso.
 *
 * El módulo trae su propio `Space3DProjectProvider`: es la superficie completa
 * y lo único que la aplicación necesita cargar de forma diferida.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CircleStop, Grid3x3, Layers, Minus, Play, Plus, Redo2, Spline, Tag, Undo2, Weight,
} from 'lucide-react';
import { NodeGlyph, SupportGlyph } from '../../../../design-system/icons/structural';
import { Space3DProjectProvider, useSpace3DProject, type Space3DSelection } from '../../space3d/store/Space3DProjectContext';
import {
  space3DMatchesPlanarHandoff,
  unresolvedSpace3DBridgeNotes,
  type Planar2DToSpace3DHandoffV1,
  type Space3DBridgeNote,
} from '../../integrations/planar2dToSpace3d';
import { loadSpace3DProject } from '../../space3d/data/storage';
// Space 3D contributes content to the canonical 2D shell; it does not carry a
// second component library or token set. The relative path intentionally exits
// the module boundary and uses the only production design system.
import { Dialog, Popover } from '../../../../design-system/components/overlays';
import { Space3DCanvas, type Space3DCanvasDraft, type Space3DCanvasPick, type Space3DViewportFactory } from '../../space3d/view/Space3DCanvas';
import { buildSpace3DSceneModel, type Space3DResultMode } from '../../space3d/view/sceneModel';
import { SPACE3D_DEFAULT_LAYERS, type Space3DLayerVisibility } from '../../space3d/view/threeViewport';
import type { Space3DViewPreset } from '../../space3d/view/cameraModel';
import { Space3DEntityEditor, type Space3DEditorTarget } from './Space3DEntityEditor';
import { Space3DResultsPanel, type Space3DResultsTab } from './Space3DResultsPanel';
import { Space3DConsoleTools, type Space3DActiveTool } from './Space3DToolRail';
import { Space3DModelOutline } from './Space3DModelOutline';
import { Space3DAnalysisModeSelect } from './Space3DAnalysisModeSelect';
import { Space3DGenerativeModal } from './Space3DGenerativeModal';
import { Space3DSelectionHUD } from './Space3DSelectionHUD';
import { Space3DResultsLegend } from './Space3DResultsLegend';
import { Space3DGuide } from './Space3DGuide';
import { deriveSpace3DGuide, type Space3DGuideAction } from './space3dRoute';
import { Space3DModeBar, type Space3DModelingTool, type Space3DSupportChoice } from './Space3DModeBar';
import {
  buildSpace3DMember, buildSpace3DNode, findSpace3DNodeAt, snapToWorkPlane, space3DBaseNodeIds, space3DLoadCommand,
  space3DMemberExists, space3DMemberToPointCommand, space3DPlaneAxisForView, space3DSupportCommand, space3DTopNodeIds,
  type Space3DLoadDirection, type Space3DMemberTemplate, type Space3DPlaneAxis,
} from './space3dModeling';
import { SPACE3D_SUPPORT_LABEL_KEYS } from './space3dSupportKind';
import {
  analyzeSpace3DBuckling,
  analyzeSpace3DInfluence,
  analyzeSpace3DModal,
  analyzeSpace3DPDelta,
} from '../../space3d/engine/analysisModes';
import type { Space3DAnalysisMode } from './space3dWorkspaceModel';
import { translate, type Language, type TranslationKey } from '../../i18n/catalogs';
import { formatSpace3DNumber } from './space3dNumberFormat';
import type { Space3DCommand } from '../../space3d/data/commands';
import type { Space3DProjectV1, Space3DVector } from '../../space3d/model/types';
import type { Space3DStorageLike } from '../../space3d/data/storage';
import type { Space3DWorkerClient } from '../../space3d/runtime/workerClient';
import { ShellContribution, useShellInspector } from '../../../../features/workspace/ShellToolSlots';
import { useSharedToolState } from '../../../../store/SharedToolState';
import './space3d.css';

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
};

function EmbeddedInspector({ embedded, expanded, children }: { embedded: boolean; expanded: boolean; children: ReactNode }) {
  return embedded ? <ShellContribution slot="inspector">{children}</ShellContribution>
    : <div className="space3d-sheet" data-expanded={expanded || undefined}>{children}</div>;
}

export interface Space3DWorkspaceProps {
  readonly canonicalProject?: Space3DProjectV1;
  readonly onProjectChange?: (project: Space3DProjectV1) => void;
  /** Explicit source acceptance, completed before replacing tool-owned geometry. */
  readonly onRederive?: () => Promise<void> | void;
  readonly language: Language;
  /** Render the 3D surface inside the global workbench shell. */
  readonly embedded?: boolean;
  readonly onOpenHome?: () => void;
  readonly onOpen2D?: () => void;
  readonly storage?: Space3DStorageLike | null;
  readonly client?: Space3DWorkerClient;
  readonly createViewport?: Space3DViewportFactory;
  /** Propuesta inmutable preparada fuera de ambos dominios antes de abrir 3D. */
  readonly handoff?: Planar2DToSpace3DHandoffV1 | null;
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
  'missing-reference': 'space3d.error.missingEntity',
  'invalid-property': 'space3d.error.invalidValue',
  'invalid-coordinate': 'space3d.error.invalidValue',
  'degenerate-length': 'space3d.error.invalidValue',
  'degenerate-orientation': 'space3d.error.invalidValue',
  'missing-case': 'space3d.error.missingEntity',
  'duplicate-id': 'space3d.error.duplicateId',
  'limit-exceeded': 'space3d.error.limitExceeded',
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

const BRIDGE_KEYS: Record<string, TranslationKey> = {
  'pending-shear-modulus': 'space3d.bridge.pendingShearModulus',
  'pending-weak-axis-inertia': 'space3d.bridge.pendingWeakAxisInertia',
  'pending-torsion-constant': 'space3d.bridge.pendingTorsionConstant',
  'out-of-plane-unrestrained': 'space3d.bridge.outOfPlaneUnrestrained',
  'truss-member-as-frame': 'space3d.bridge.trussMemberAsFrame',
  'dropped-member-release': 'space3d.bridge.droppedMemberRelease',
  'dropped-internal-hinge': 'space3d.bridge.droppedInternalHinge',
  'dropped-semi-rigid-connection': 'space3d.bridge.droppedSemiRigidConnection',
  'dropped-rigid-offset': 'space3d.bridge.droppedRigidOffset',
  'dropped-support-spring': 'space3d.bridge.droppedSupportSpring',
  'dropped-inclined-support': 'space3d.bridge.droppedInclinedSupport',
  'dropped-prescribed-support-motion': 'space3d.bridge.droppedPrescribedSupportMotion',
  'dropped-self-weight': 'space3d.bridge.droppedSelfWeight',
  'dropped-rigid-member': 'space3d.bridge.droppedRigidMember',
  'dropped-axial-behavior': 'space3d.bridge.droppedAxialBehavior',
  'dropped-timoshenko-theory': 'space3d.bridge.droppedTimoshenkoTheory',
  'dropped-shear-area': 'space3d.bridge.droppedShearArea',
  'dropped-member-load': 'space3d.bridge.droppedMemberLoad',
  'dropped-prescribed-displacement': 'space3d.bridge.droppedPrescribedDisplacement',
  'dropped-initial-effect': 'space3d.bridge.droppedInitialEffect',
  'dropped-node-link': 'space3d.bridge.droppedNodeLink',
  'dropped-multi-point-constraint': 'space3d.bridge.droppedMultiPointConstraint',
  'dropped-nodal-mass': 'space3d.bridge.droppedNodalMass',
  'dropped-generated-load-source': 'space3d.bridge.droppedGeneratedLoadSource',
  'dropped-moving-load-case': 'space3d.bridge.droppedMovingLoadCase',
};

/** Notas que el usuario resuelve escribiendo un valor, no reconociendolas. */
const BRIDGE_RESOLVABLE = new Set([
  'pending-shear-modulus', 'pending-weak-axis-inertia', 'pending-torsion-constant', 'out-of-plane-unrestrained',
]);

/**
 * Límites del multiplicador manual sobre la escala automática de la deformada.
 * Seis duplicaciones (2⁶ = 64) separan lo apenas visible de lo que ya no cabe
 * en pantalla; los botones se deshabilitan en el límite para decirlo.
 */
const SCALE_FACTOR_MIN = 1 / 64;
const SCALE_FACTOR_MAX = 64;

const LAYER_TOGGLES: readonly { id: keyof Space3DLayerVisibility; key: TranslationKey; icon: ReactNode }[] = [
  { id: 'grid', key: 'space3d.layerGrid', icon: <Grid3x3 size={16} aria-hidden="true" /> },
  { id: 'supports', key: 'space3d.layerSupports', icon: <SupportGlyph size={17} /> },
  { id: 'loads', key: 'space3d.layerLoads', icon: <Weight size={16} aria-hidden="true" /> },
  { id: 'labels', key: 'space3d.layerLabels', icon: <Tag size={16} aria-hidden="true" /> },
  { id: 'deformed', key: 'space3d.layerDeformed', icon: <Spline size={16} aria-hidden="true" /> },
];

const RESULT_MODES: readonly { mode: Space3DResultMode; key: TranslationKey; symbol?: string }[] = [
  { mode: 'model', key: 'space3d.resultModel' },
  { mode: 'deformed', key: 'space3d.resultDeformed' },
  { mode: 'axial', key: 'space3d.resultAxial', symbol: 'N' },
  { mode: 'shear', key: 'space3d.resultShear', symbol: 'V' },
  { mode: 'moment', key: 'space3d.resultMoment', symbol: 'M' },
  { mode: 'reactions', key: 'space3d.resultReactions', symbol: 'R' },
];

/** Misma política numérica que el resto del producto. */
const number = (value: number): string => formatSpace3DNumber(value);

type Space3DStudyState = 'idle' | 'running' | 'ready' | 'failed';

interface Space3DStudyFeedback {
  readonly mode: Space3DAnalysisMode;
  readonly success: boolean;
  readonly detail: string;
}

interface WorkspaceBodyProps extends Pick<Space3DWorkspaceProps,
  'language' | 'embedded' | 'onOpenHome' | 'onOpen2D' | 'createViewport' | 'handoff' | 'onProjectChange' | 'onRederive'> {
  readonly bridgeNotes: readonly Space3DBridgeNote[];
  readonly derived: Space3DProjectV1 | null;
}

const WorkspaceBody = ({
  language, embedded = false, createViewport, handoff, bridgeNotes, derived, onProjectChange, onRederive,
}: WorkspaceBodyProps) => {
  const t = useCallback(
    (key: TranslationKey, variables?: Record<string, string | number>) => translate(language, key, variables),
    [language],
  );

  const {
    project, analysis, analysisState, analysisTargetId, selectedEntity, canUndo, canRedo, lastError,
    execute, undo, redo, analyze, cancelAnalysis, select, importPortable, exportPortable, loadExample, resetToBlank,
    replaceProject, setAnalysisTargetId,
  } = useSpace3DProject();
  const shared = useSharedToolState();
  const publishSelection = shared?.publish3DSelection;
  const publishedProject = useRef(project);
  useEffect(() => {
    // Hydration (including StrictMode replay) and callback changes are not edits.
    if (publishedProject.current === project) return;
    publishedProject.current = project;
    onProjectChange?.(project);
  }, [project, onProjectChange]);
  useEffect(() => {
    if (!embedded || !handoff || !publishSelection) return;
    publishSelection(selectedEntity && (selectedEntity.kind === 'node' || selectedEntity.kind === 'member')
      ? [{ projectId: handoff.source.projectId, tool: 'space3d', kind: selectedEntity.kind, id: selectedEntity.id }] : []);
  }, [embedded, handoff, publishSelection, selectedEntity]);

  const [layers, setLayers] = useState<Space3DLayerVisibility>(SPACE3D_DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [panel, setPanel] = useState<InspectorPanel>('model');
  const [resultsTab, setResultsTab] = useState<Space3DResultsTab>('summary');
  const [editorTarget, setEditorTarget] = useState<Space3DEditorTarget | null>(null);
  /** El editor recibe el foco sólo cuando se abrió desde una lista o un botón, nunca desde el lienzo. */
  const [editorFocus, setEditorFocus] = useState(false);
  const [transfer, setTransfer] = useState<'import' | 'export' | null>(null);
  const [importText, setImportText] = useState('');
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * Multiplicador sobre la escala automatica de la deformada. `null` deja que
   * la escena la calcule para ocupar una fraccion fija del modelo.
   */
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  /**
   * "Cargar ejemplo" y "Proyecto vacío" reemplazan el modelo entero. Son
   * recuperables con Deshacer, pero se confirma antes de actuar salvo que no
   * haya nada que perder.
   */
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null);
  // Sube cada vez que el proyecto ENTERO se sustituye; el lienzo reencuadra sólo
  // entonces. Una edición normal conserva la cámara de la persona.
  const [viewFitToken, setViewFitToken] = useState(0);
  const refitView = () => setViewFitToken((token) => token + 1);
  const [activeView, setActiveView] = useState<Space3DViewPreset>('isometric');
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
  const [generativeOpen, setGenerativeOpen] = useState(false);
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
  const hasContent = project.nodes.length > 0;
  const nodeCount = project.nodes.length;
  const effectiveScaleFactor = scaleFactor ?? 1;
  const currentAnalysis = analysisState === 'ready' && analysis?.success === true ? analysis : null;

  const automatic = useMemo(() => buildSpace3DSceneModel({
    project, analysis, analysisState, selection: selectedEntity, targetId: analysisTargetId, resultMode,
  }), [analysis, analysisState, analysisTargetId, project, resultMode, selectedEntity]);

  const scene = useMemo(() => {
    if (scaleFactor === null || automatic.deformed === null) return automatic;
    return buildSpace3DSceneModel({
      project,
      analysis,
      analysisState,
      selection: selectedEntity,
      targetId: analysisTargetId,
      resultMode,
      deformationScale: automatic.deformed.scale * scaleFactor,
    });
  }, [analysis, analysisState, analysisTargetId, automatic, project, resultMode, scaleFactor, selectedEntity]);

  const submit = useCallback((command: Space3DCommand) => execute(command).ok, [execute]);

  /**
   * El análisis lineal pasa por el worker del store. Los estudios especializados
   * tienen runners de dominio propios y sólo publican un diagnóstico local:
   * todavía no se mezclan con la capa de resultados lineales del lienzo.
   */
  const runSelectedAnalysis = useCallback(async () => {
    setStudyFeedback(null);
    if (analysisMode === 'linear') {
      setStudyState('idle');
      await analyze();
      return;
    }

    setStudyState('running');
    // Da al navegador un ciclo para pintar el estado «en curso» antes del
    // runner síncrono, sin inventar una progresión que el motor no publica.
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });

    try {
      const modeLabel = t(ANALYSIS_MODE_LABEL_KEYS[analysisMode]);
      let success = false;
      let detail = '';
      if (analysisMode === 'pdelta') {
        const result = analyzeSpace3DPDelta(project, analysisTargetId, { maxIterations: 20 });
        success = result.success;
        detail = success
          ? `${t('space3d.studyCompleted', { mode: modeLabel })}: ${result.iterations} iteraciones, residuo ${number(result.residual)}`
          : t('space3d.studyFailed', { mode: modeLabel, reason: result.reason });
      } else if (analysisMode === 'modal') {
        const result = analyzeSpace3DModal(project, { targetId: analysisTargetId, modes: 3 });
        success = result.success;
        detail = success
          ? `${t('space3d.studyCompleted', { mode: modeLabel })}: ${result.modes.length} modos, f₁ ${number(result.modes[0]?.frequency ?? Number.NaN)} Hz`
          : t('space3d.studyFailed', { mode: modeLabel, reason: result.reason });
      } else if (analysisMode === 'buckling') {
        const result = analyzeSpace3DBuckling(project, analysisTargetId, { modes: 1 });
        success = result.success;
        detail = success
          ? `${t('space3d.studyCompleted', { mode: modeLabel })}: factor crítico ${number(result.criticalLoadFactor ?? Number.NaN)}`
          : t('space3d.studyFailed', { mode: modeLabel, reason: result.reason });
      } else {
        const member = project.members[0];
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
    } catch (error) {
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
  }, [analysisMode, analysisTargetId, analyze, project, t]);

  // Un estudio sólo describe el proyecto y el objetivo con los que se ejecutó.
  useEffect(() => {
    setStudyState('idle');
    setStudyFeedback(null);
  }, [analysisTargetId, project]);

  // El resultado listo no trae marca de tiempo propia: se anota aquí sólo para
  // mostrarla. No participa del cálculo ni se persiste con el proyecto.
  useEffect(() => {
    if (analysisState === 'ready') setLastAnalyzedAt(Date.now());
  }, [analysisState]);

  const openEditor = useCallback((target: Space3DEditorTarget, focus: boolean) => {
    setEditorTarget(target);
    setEditorFocus(focus);
    setPanel('model');
  }, []);

  const selectEntity = useCallback((selection: Space3DSelection | null, focus = false) => {
    select(selection);
    if (selection) {
      openEditor({ kind: selection.kind, id: selection.id }, focus);
    } else {
      setEditorTarget(null);
      setSheetExpanded(false);
    }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditor, select]);

  const openNew = useCallback((kind: Space3DEditorTarget['kind'], initialNodeId?: string) => {
    select(null);
    openEditor(kind === 'load' ? { kind, id: null, initialNodeId } : { kind, id: null }, true);
    setSheetExpanded(true);
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditor, select]);

  const clearToolSelection = useCallback(() => {
    select(null);
    setEditorTarget(null);
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
    if (next === 'node') openEditor({ kind: 'node', id: null }, false);
    else setEditorTarget((current) => (current && current.id === null ? null : current));
    // Sin geometría que encuadrar, la vista se abre a la zona de trabajo mínima.
    if ((next === 'node' || next === 'member') && nodeCount <= 1) setViewFitToken((token) => token + 1);
  }, [nodeCount, openEditor, select]);

  const selectedNodeId = selectedEntity?.kind === 'node' ? selectedEntity.id : null;

  const activeTool: Space3DActiveTool = tool;

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

  const requestGeneratedReplace = (generatedProject: Space3DProjectV1) => {
    if (hasContent) {
      setPendingReplace({ kind: 'generated', project: generatedProject });
      setGenerativeOpen(false);
      return;
    }
    replaceProject(generatedProject);
    refitView();
    setGenerativeOpen(false);
    setEditorTarget(null);
  };

  const confirmReplace = () => {
    if (!pendingReplace) return;
    if (pendingReplace.kind === 'example') loadExample();
    else if (pendingReplace.kind === 'blank') resetToBlank();
    else replaceProject(pendingReplace.project);
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
      setEditorTarget(null);
    }
  }, [execute, select]);

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
      if (generativeOpen || pendingReplace !== null || transfer !== null) return;

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
        if (editorTarget || selectedEntity) {
          clearToolSelection();
          event.preventDefault();
          return;
        }
      }

      if (isInput || isControl || event.ctrlKey || event.metaKey || event.altKey) return;

      const entityToDelete = editorTarget?.id ? editorTarget : selectedEntity ? { kind: selectedEntity.kind, id: selectedEntity.id } : null;
      if ((event.key === 'Delete' || event.key === 'Backspace') && entityToDelete?.id) {
        event.preventDefault();
        remove(entityToDelete);
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
  }, [clearToolSelection, editorTarget, enterTool, generativeOpen, memberFrom, pendingReplace, project.nodes.length, remove, selectedEntity, tool, transfer]);

  // El puente solo bloquea lo que no pudo mapear con autoridad. En cuanto el
  // usuario completa un numero o reconoce una diferencia, deja de bloquear.
  const pendingNotes = useMemo(
    () => unresolvedSpace3DBridgeNotes(bridgeNotes, project, acknowledged),
    [acknowledged, bridgeNotes, project],
  );
  const acknowledgeable = useMemo(
    () => [...new Set(pendingNotes.filter((item) => !BRIDGE_RESOLVABLE.has(item.code)).map((item) => item.code))],
    [pendingNotes],
  );
  const nextBridgeRequirement = pendingNotes[0] ?? null;
  /**
   * El puente nunca rellena campos ni reconoce una diferencia por su cuenta.
   * Esta acción sólo lleva al formulario de la entidad que el propio puente
   * marcó, para que la persona decida el dato y lo guarde explícitamente.
   */
  const completeBridgeRequirement = (item: Space3DBridgeNote) => {
    const target = item.entityKind === 'project'
      ? project.nodes[0] ? { kind: 'node' as const, id: project.nodes[0].id } : null
      : item.entityKind === 'member'
        ? project.members.some((member) => member.id === item.entityId) ? { kind: 'member' as const, id: item.entityId } : null
        : item.entityKind === 'node'
          ? project.nodes.some((node) => node.id === item.entityId) ? { kind: 'node' as const, id: item.entityId } : null
          : project.nodalLoads.some((load) => load.id === item.entityId) ? { kind: 'load' as const, id: item.entityId } : null;
    if (!target) return;
    selectEntity(target, true);
    setSheetExpanded(true);
  };
  const diverged = handoff !== undefined && handoff !== null && derived !== null
    && !space3DMatchesPlanarHandoff(project, handoff);

  const running = analysisState === 'running';
  const runningAny = running || studyState === 'running';
  const analysisBlocked = runningAny || pendingNotes.length > 0;
  const errorMessage = lastError ? t(ERROR_KEYS[lastError] ?? 'space3d.error.generic') : null;
  const stateLabel = t(STATE_KEYS[analysisState]);
  const bridgeRequirementText = nextBridgeRequirement ? t(BRIDGE_KEYS[nextBridgeRequirement.code] ?? 'space3d.error.generic') : null;

  const guide = useMemo(
    () => deriveSpace3DGuide(project, runningAny ? 'running' : analysisState, pendingNotes.length),
    [analysisState, pendingNotes.length, project, runningAny],
  );

  const exploring = guide.next === 'explore-results' && resultMode !== 'model';

  const planeAxis = space3DPlaneAxisForView(activeView);
  const parsedOffset = Number(planeOffsets[planeAxis].trim().replace(',', '.'));
  const planeOffset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
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

  const onDraftPick = ({ selection, point }: Space3DCanvasPick) => {
    const clicked = selection?.kind === 'node' ? project.nodes.find((node) => node.id === selection.id) ?? null : null;
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

  const draftPlane = tool === 'node' || tool === 'member' ? { axis: planeAxis, offset: planeOffset, step: planeStep } : null;
  const canvasDraft = useMemo<Space3DCanvasDraft | null>(() => {
    if (tool === 'select') return null;
    const loadLabel = `${formatSpace3DNumber(Number.isFinite(magnitudeValue) ? magnitudeValue : 0, { significantDigits: 4 })} ${t('space3d.unitForce')}`;
    return {
      plane: draftPlane,
      from: memberFromNode ? [memberFromNode.x, memberFromNode.y, memberFromNode.z] : null,
      snap: (point) => (draftPlane ? snapToWorkPlane(point, draftPlane) : point),
      describe: (point, nodeId) => {
        if (tool === 'support') return nodeId ? `${nodeId}: ${t(SPACE3D_SUPPORT_LABEL_KEYS[supportChoice])}` : '';
        if (tool === 'load') return nodeId ? `${nodeId}: ${loadLabel}` : '';
        return nodeId ? t('space3d.modeCursorNode', { id: nodeId, coords: coords(point) }) : coords(point);
      },
    };
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, planeAxis, planeOffset, planeStep, memberFromNode, supportChoice, magnitudeValue, t]);

  const onGuideAction = (action: Space3DGuideAction) => {
    if (action === 'start') setGenerativeOpen(true);
    else if (action === 'add-node') enterTool('node');
    else if (action === 'add-member') enterTool('member');
    else if (action === 'add-support') enterTool('support');
    else if (action === 'add-load') enterTool('load');
    else if (action === 'resolve-bridge' && nextBridgeRequirement) completeBridgeRequirement(nextBridgeRequirement);
    else if (action === 'analyze' || action === 'reanalyze') void runSelectedAnalysis();
    else if (action === 'review-failure') { enterTool('select'); setPanel('analysis'); setSheetExpanded(true); }
    else if (action === 'explore-results') { enterTool('select'); setResultMode('deformed'); setPanel('analysis'); }
  };

  const viewLabels = {
    front: t(VIEW_LABEL_KEYS.front), top: t(VIEW_LABEL_KEYS.top),
    side: t(VIEW_LABEL_KEYS.side), isometric: t(VIEW_LABEL_KEYS.isometric),
  };
  const lastAnalysisLabel = lastAnalyzedAt === null ? null : t('space3d.lastAnalysis', {
    time: new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en', { hour: 'numeric', minute: '2-digit' }).format(lastAnalyzedAt),
  });

  const analyzeButton = (className: string) => <button
    type="button"
    className={className}
    onClick={() => { void runSelectedAnalysis(); }}
    disabled={analysisBlocked}
    title={pendingNotes.length > 0 ? t('space3d.bridgeBlocked', { count: pendingNotes.length }) : undefined}
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
    </ul>
  </Popover>;

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
      <label className="space3d-field space3d-target">
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
      </label>
      <div className="space3d-analysis-run">
        {analyzeButton('space3d-button')}
        {running ? <button type="button" className="space3d-button" onClick={cancelAnalysis}>
          <CircleStop size={16} aria-hidden="true" />{t('space3d.cancelAnalysis')}
        </button> : null}
      </div>
      <p className="space3d-analysis-state">
        <span className={`space3d-state space3d-state--${STATE_TONES[analysisState]}`} data-testid="space3d-analysis-state-label">{stateLabel}</span>
        {lastAnalysisLabel ? <span>{lastAnalysisLabel}</span> : null}
      </p>
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
      {studyFeedback.mode === 'linear' ? null : <small>{t('space3d.studyLinearPreserved')}</small>}
    </div> : null}

    {/* El motivo del fallo se publica junto a la acción que lo provocó: quien
        pulsa «Analizar» tiene que ver por qué no salió sin ir a buscarlo. */}
    {analysisState === 'failed' && analysis && analysis.issues.length > 0
      ? <div className="space3d-notice space3d-notice--error" role="alert">
        <strong>{t('space3d.analysisIssues')}</strong>
        <ul className="space3d-issue-line">
          {analysis.issues.slice(0, 4).map((issue, index) => <li key={`${issue.code}-${issue.entityId}-${index}`} data-diagnostic-code={issue.code}>
            {t(ANALYSIS_ISSUE_KEYS[issue.code] ?? 'space3d.error.generic')}
          </li>)}
        </ul>
      </div>
      : null}

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

  const modelSection = <div className="space3d-model" role="tabpanel" id="space3d-panel-model" aria-labelledby="space3d-tab-model">
    {editorTarget
      ? <Space3DEntityEditor
        project={project}
        target={editorTarget}
        t={t}
        onSubmit={submit}
        onCancel={() => { setEditorTarget(null); select(null); }}
        onDelete={remove}
        focusOnOpen={editorFocus}
      />
      : <Space3DModelOutline
        project={project}
        selection={selectedEntity}
        t={t}
        onSelect={(selection) => selectEntity(selection, true)}
        onAddNode={() => openNew('node')}
        onAddMember={() => openNew('member')}
        onAddLoad={() => openNew('load', selectedNodeId ?? undefined)}
        canAddMember={project.nodes.length >= 2}
        canAddLoad={project.nodes.length > 0}
      />}
  </div>;

  return <div className="space3d-screen" data-space3d-layout="workbench" data-embedded={embedded || undefined}>
    {embedded ? <>
      <ShellContribution slot="controls">
        <button type="button" className="workspace-topbar__icon-button" onClick={undo} disabled={!canUndo} aria-label={t('space3d.undo')} title={t('space3d.undo')}><Undo2 size={17} aria-hidden="true" /></button>
        <button type="button" className="workspace-topbar__icon-button" onClick={redo} disabled={!canRedo} aria-label={t('space3d.redo')} title={t('space3d.redo')}><Redo2 size={17} aria-hidden="true" /></button>
      </ShellContribution>
      <ShellContribution slot="action">{analyzeButton('workspace-topbar__action-button is-primary')}</ShellContribution>
      <ShellContribution slot="status"><span role="status">{stateLabel} ({t('space3d.badge')})</span></ShellContribution>
    </> : <header className="space3d-localbar">
      <strong className="space3d-localbar-title">{project.name}</strong>
      <span className="space3d-badge">{t('space3d.badge')}</span>
      <div className="space3d-localbar-actions">
        <button type="button" className="space3d-tool" onClick={undo} disabled={!canUndo} aria-label={t('space3d.undo')} title={t('space3d.undo')}><Undo2 size={16} aria-hidden="true" /></button>
        <button type="button" className="space3d-tool" onClick={redo} disabled={!canRedo} aria-label={t('space3d.redo')} title={t('space3d.redo')}><Redo2 size={16} aria-hidden="true" /></button>
        {analyzeButton('space3d-button space3d-button--primary')}
      </div>
    </header>}

    {(handoff && (pendingNotes.length > 0 || diverged)) || errorMessage ? <div className="space3d-diagnostics">
      {handoff && (pendingNotes.length > 0 || diverged) ? <section className="space3d-bridge" aria-label={t('space3d.bridgeTitle')}>
        <header>
          <strong>{t('space3d.sourceProject', { name: handoff.candidateModel.name })}</strong>
          {diverged ? <span className="space3d-state space3d-state--warn">{t('space3d.bridgeDiverged')}</span> : null}
          {diverged && derived
            ? <button type="button" className="space3d-button" title={t('space3d.rederiveWarning')} onClick={() => {
              // A failed canonical source save is reported by the shared session; keep this geometry.
              void Promise.resolve().then(() => onRederive?.()).then(() => { replaceProject(derived); refitView(); }).catch(() => undefined);
            }}>
              {t('space3d.rederive')}
            </button>
            : null}
        </header>
        {pendingNotes.length > 0 ? <>
          <p className="space3d-bridge-body" role="status">{t('space3d.bridgeBody')}</p>
          <ul className="space3d-issues">
            {[...new Map(pendingNotes.map((item) => [item.code, item])).values()].map((item) => <li key={item.code} data-diagnostic-code={item.code}>
              <span className="space3d-issue-copy" id={`space3d-bridge-${item.code}`}>{t(BRIDGE_KEYS[item.code] ?? 'space3d.error.generic')}</span>
              <em>{pendingNotes.filter((other) => other.code === item.code).map((other) => other.entityId).filter(Boolean).join(' ')}</em>
              {BRIDGE_RESOLVABLE.has(item.code)
                ? <button
                  type="button"
                  className="space3d-button space3d-button--ghost space3d-bridge-complete"
                  onClick={() => completeBridgeRequirement(item)}
                  aria-describedby={`space3d-bridge-${item.code}`}
                >{t('space3d.bridgeCompleteNow')}</button>
                : null}
            </li>)}
          </ul>
          {acknowledgeable.length > 0
            ? <button
              type="button"
              className="space3d-button"
              onClick={() => setAcknowledged((current) => new Set([...current, ...acknowledgeable]))}
            >{t('space3d.bridgeAcknowledge')}</button>
            : null}
        </> : null}
      </section> : null}
      {errorMessage ? <p className="space3d-notice space3d-notice--error" role="alert">{errorMessage}</p> : null}
    </div> : null}

    <div className="space3d-layout">
      <Space3DConsoleTools
        t={t}
        activeTool={activeTool}
        onSelectTool={() => { enterTool('select'); clearToolSelection(); }}
        onNewNode={() => enterTool('node')}
        onNewMember={() => enterTool('member')}
        onNewLoad={() => enterTool('load')}
        onEditSupport={() => enterTool('support')}
        onOpenGenerative={() => setGenerativeOpen(true)}
        canNewMember
        canNewLoad={project.nodes.length > 0}
        canEditSupport={project.nodes.length > 0}
        file={{
          onLoadExample: () => requestReplace('example'),
          onResetBlank: () => requestReplace('blank'),
          onImport: () => setTransfer('import'),
          onExport: () => setTransfer('export'),
        }}
      />

      <section className="space3d-stage" aria-label={t('space3d.canvasLabel')}>
        {tool !== 'select' ? <div className="space3d-stage-modebar">
          <Space3DModeBar
            t={t}
            tool={tool}
            onExit={() => enterTool('select')}
            notice={modeNotice?.text ?? null}
            noticeTone={modeNotice?.tone}
            planeAxis={planeAxis}
            planeOffset={planeOffsets[planeAxis]}
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
          layers={{ ...layers, deformed: layers.deformed && resultMode === 'deformed' }}
          onSelect={(selection) => selectEntity(selection)}
          draft={canvasDraft}
          onDraftPick={onDraftPick}
          createViewport={createViewport}
          viewLabels={viewLabels}
          activeView={activeView}
          onViewChange={setActiveView}
          refitToken={viewFitToken}
          zoomInLabel={t('space3d.zoomIn')}
          zoomOutLabel={t('space3d.zoomOut')}
          resetLabel={t('space3d.resetView')}
          viewSelectLabel={t('space3d.viewSelect')}
          fullscreenEnterLabel={t('space3d.fullscreenEnter')}
          fullscreenExitLabel={t('space3d.fullscreenExit')}
          trailingControls={layersControl}
          copy={{
            label: t('space3d.canvasLabel'),
            fallbackTitle: t('space3d.webglTitle'),
            fallbackBody: t('space3d.webglBody'),
            retry: t('space3d.retry'),
            summaryTitle: t('space3d.canvasSummary'),
            nodes: t('space3d.nodes'),
            members: t('space3d.members'),
            supports: t('space3d.supports'),
            loads: t('space3d.loads'),
          }}
        />

        {!hasContent && tool === 'select' ? <div className="space3d-empty-stage">
          <div className="space3d-empty-card">
            <h2>{t('space3d.emptyCanvasTitle')}</h2>
            <p>{t('space3d.emptyCanvasBody')}</p>
            <div className="space3d-empty-options">
              <button type="button" className="space3d-empty-option space3d-empty-option--primary" onClick={() => setGenerativeOpen(true)}>
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
          <Space3DGuide compact guide={guide} t={t} analysisLabel={stateLabel} bridgeRequirement={bridgeRequirementText} onAction={onGuideAction} actionDone={exploring} />
        </div>}

        {/* La hoja sólo tapa el lienzo en el layout compacto; en escritorio es una
            columna fija al lado. Por eso la ocultación la decide el CSS por
            breakpoint, no esta condición. */}
        <div className="space3d-bottom-stack" data-sheet-expanded={sheetExpanded || undefined}>
          {selectedEntity ? (
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
          {resultMode !== 'model' ? (
            <Space3DResultsLegend
              resultMode={resultMode}
              analysis={currentAnalysis}
              project={project}
              onSelectCritical={(kind, id) => selectEntity({ kind, id })}
              t={t}
            />
          ) : null}
        </div>

        {hasContent ? <div className="space3d-stage-footer">
          <nav className="space3d-result-bar" aria-label={t('space3d.resultBarLabel')}>
            {RESULT_MODES.map(({ mode, key, symbol }) => {
              const blocked = mode !== 'model' && analysisState !== 'ready';
              return <button
                key={mode}
                type="button"
                aria-pressed={resultMode === mode}
                disabled={blocked}
                title={blocked ? t('space3d.resultNeedsAnalysis') : undefined}
                onClick={() => {
                  setResultMode(mode);
                  // Leer resultados es seleccionar: un toque ya no debe colocar ni cargar nada.
                  if (mode !== 'model') { setPanel('analysis'); if (tool !== 'select') enterTool('select'); }
                }}
              >{t(key)}{symbol ? <small aria-hidden="true">{symbol}</small> : null}</button>;
            })}
          </nav>
          {scene.deformed && resultMode === 'deformed' ? <div className="space3d-scale" role="group" aria-label={t('space3d.layerDeformed')}>
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
          </div> : null}
        </div> : null}
      </section>

      <EmbeddedInspector embedded={embedded} expanded={sheetExpanded}>
        <div className="space3d-inspector">
          <Space3DGuide guide={guide} t={t} analysisLabel={stateLabel} bridgeRequirement={bridgeRequirementText} onAction={onGuideAction} actionDone={exploring} />
          <div className="space3d-tabs" role="tablist" aria-label={t('space3d.inspectorTabs')}>
            <button type="button" role="tab" id="space3d-tab-model" className="space3d-tab" aria-controls="space3d-panel-model"
              aria-selected={panel === 'model'} tabIndex={panel === 'model' ? 0 : -1} onClick={() => setPanel('model')}>
              {t('space3d.inspectorModel')}
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
    </div>

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

    <footer className="space3d-status" aria-label={t('space3d.title')}>
      <span className={`space3d-state space3d-state--${STATE_TONES[analysisState]}`}>{stateLabel}</span>
      <span>{t('space3d.statusCase', { id: analysisTargetId })}</span>
      {handoff && pendingNotes.length === 0 && !diverged ? <span>{t('space3d.statusSource', { name: handoff.candidateModel.name })}</span> : null}
      {lastAnalysisLabel ? <span className="space3d-status-last">{lastAnalysisLabel}</span> : null}
      <span className="space3d-status-help">{t('space3d.interactionHelp')}</span>
      <span className="space3d-status-units">{t('space3d.statusUnits')}</span>
      <span data-testid="space3d-analysis-state" className="space3d-visually-hidden">{analysisState}</span>
      <span data-testid="space3d-deformed-visible" className="space3d-visually-hidden">{String(scene.deformed !== null)}</span>
    </footer>
  </div>;
};

/**
 * Resolucion del proyecto inicial.
 *
 * Con un proyecto 2D de origen se reabre el modelo espacial ya asociado a el si
 * sigue correspondiendole; solo cuando no existe se deriva uno nuevo. Asi,
 * volver al 2D y entrar otra vez no duplica nada ni descarta el trabajo 3D.
 */
const Space3DWorkspace = ({ storage, client, handoff, canonicalProject, ...rest }: Space3DWorkspaceProps) => {
  const namespace = handoff ? `src:${handoff.source.projectId}` : undefined;
  const initialProject = useMemo(() => {
    if (canonicalProject) return canonicalProject;
    if (!handoff) return undefined;
    const stored = loadSpace3DProject(storage ?? undefined, namespace);
    return stored && stored.id === handoff.candidateModel.id ? stored : handoff.candidateModel;
    // El proyecto inicial se resuelve una vez por origen; despues manda el store.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalProject, handoff, namespace]);

  return (
    <Space3DProjectProvider key={namespace} storage={storage} client={client} namespace={namespace} initialProject={initialProject}>
      <WorkspaceBody
        {...rest}
        handoff={handoff}
        bridgeNotes={handoff?.lossReport.entries ?? []}
        derived={handoff?.candidateModel ?? null}
      />
    </Space3DProjectProvider>
  );
};

export default Space3DWorkspace;
