import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { unavailableAnalysis } from '../engine/analysisFailure';
import { normalizeProject } from '../data/migrate';
import { loadProjectFromStorage } from '../data/projectStorage';
import { repairProjectTopology } from '../data/modelOperations';
import type { AnalysisResult, ProjectModel, Selection, Tool } from '../types';
import { ProjectModelContext, useProjectModel, type ProjectModelContextValue } from './ProjectModelContext';
import { ProjectAnalysisContext, useProjectAnalysis, type ProjectAnalysisContextValue, type InfluenceCanvasState } from './ProjectAnalysisContext';
import { WorkspaceUIContext, useWorkspaceUI, type WorkspaceUIContextValue, type ModeShapeCanvasState, type ResultCursor, type ResultTab } from './WorkspaceUIContext';
import type { PreparedTopologyRepair, ProjectCommand, ProjectCommandResult } from '../commands/projectCommand';
import type { PreparedStructureGeneration } from '../commands/structureGeneration';
import type { PreparedStructuralEdit } from '../data/structuralEditing';
import type { UnifiedProjectSession } from '../storage/unifiedProjectSession';
import { SharedToolStateProvider } from './SharedToolState';
import { useThemePreference } from './themePreference';
import { analysisWorkerRequest, createAnalysisWorker, runAnalysisWithTrace, runFallbackAnalysis, type AnalysisWorkerMessage } from './projectAnalysisRunner';
import { readLastOpenProject, useProjectPersistence, type ProjectStorageState } from './projectPersistence';

// oxlint-disable-next-line react/only-export-components
export { useProjectModel } from './ProjectModelContext';
// oxlint-disable-next-line react/only-export-components
export { useProjectAnalysis } from './ProjectAnalysisContext';
// oxlint-disable-next-line react/only-export-components
export { useWorkspaceUI } from './WorkspaceUIContext';
export type { ModeShapeCanvasState, ResultTab, ResultCursor } from './WorkspaceUIContext';
export type { InfluenceCanvasState } from './ProjectAnalysisContext';

interface HistoryEntry {
  project: ProjectModel;
  description: string;
  affectsAnalysis: boolean;
}

export const ProjectProvider = ({ children, unified = false }: { children: ReactNode; unified?: boolean }) => {
  const [initial] = useState(() => loadProjectFromStorage(unified
    ? { getItem: (key) => localStorage.getItem(key), setItem: () => undefined }
    : localStorage));
  const unifiedSessionRef = useRef<UnifiedProjectSession | null>(null);
  const [unifiedReady, setUnifiedReady] = useState(!unified);
  const [project, setProject] = useState<ProjectModel>(initial.project);
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [analysis, setAnalysisState] = useState<AnalysisResult | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selection, setSelectionState] = useState<Selection>(null);
  const [theme, setTheme] = useThemePreference();
  const [resultTab, setResultTab] = useState<ResultTab>('moment');
  const [selectedCombinationId, setSelectedCombinationIdState] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [learningFocus, setLearningFocus] = useState<{ nodeIds: string[]; memberIds: string[] } | null>(null);
  const [resultCursor, setResultCursor] = useState<ResultCursor | null>(null);
  const [modeShapeState, setModeShapeState] = useState<ModeShapeCanvasState | null>(null);
  const [influenceCanvasState, setInfluenceCanvasState] = useState<InfluenceCanvasState | null>(null);
  const [transactionActive, setTransactionActive] = useState(false);
  const [persistenceRevision, setPersistenceRevision] = useState(0);
  const [storageState, setStorageState] = useState<ProjectStorageState>(() => ({
    issue: initial.recoveredFromBackup ? 'recovered' : initial.recoveryMessage ? 'load-failed' : null,
    message: initial.recoveryMessage ?? null,
  }));
  const projectRef = useRef(project);
  const selectionRef = useRef(selection);
  const analysisRef = useRef(analysis);
  const transactionStartRef = useRef<ProjectModel | null>(null);
  const transactionDescriptionRef = useRef('Editar proyecto');
  const analysisTimerRef = useRef<number | null>(null);
  const analysisRevisionRef = useRef(0);
  const analysisWorkerRef = useRef<Worker | null>(null);

  const setAnalysis = useCallback((result: AnalysisResult | null) => {
    setAnalysisState(result);
  }, []);

  useEffect(() => {
    if (!unified) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void import('../storage/unifiedProjectSession').then(async ({ createUnifiedProjectSession }) => {
      if (!active) return;
      const session = unifiedSessionRef.current ??= createUnifiedProjectSession();
      unsubscribe = session.subscribeStatus(() => { if (active) setStorageState(session.status); });
      const urlId = new URLSearchParams(window.location.search).get('project');
      const canonical = await session.initialize(localStorage, projectRef.current, urlId ?? projectRef.current.id, urlId ? undefined : readLastOpenProject());
      if (!active) return;
      projectRef.current = canonical;
      setProject(canonical);
      setStorageState(session.status);
      setUnifiedReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      setStorageState({ issue: 'load-failed', message: error instanceof Error ? error.message : String(error) });
      setUnifiedReady(true);
    });
    return () => { active = false; unsubscribe?.(); };
  }, [unified]);

  const setSelection = useCallback((next: Selection) => {
    selectionRef.current = next;
    setSelectionState(next);
  }, []);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  useEffect(() => { analysisRef.current = analysis; }, [analysis]);

  const { repositoryRevisionRef, repositoryBlockedProjectIdRef } = useProjectPersistence({
    unified, unifiedReady, project, projectRef, unifiedSessionRef, persistenceRevision, transactionActive, setStorageState,
  });

  const invalidateAnalysis = useCallback(() => {
    analysisRevisionRef.current += 1;
    if (analysisTimerRef.current !== null) {
      window.clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    analysisWorkerRef.current?.terminate();
    analysisWorkerRef.current = null;
    setIsAnalyzing(false);
    setAnalysis(null);
    setResultCursor(null);
    setInfluenceCanvasState(null);
    setModeShapeState(null);
  }, []);

  /** Publishes a model change without assigning history or analysis semantics. */
  const publishProject = useCallback((next: ProjectModel) => {
    projectRef.current = next;
    setProject(next);
  }, []);

  /** Publishes a model change whose new state makes any current result stale. */
  const publishAnalysisAffectingProject = useCallback((next: ProjectModel) => {
    invalidateAnalysis();
    publishProject(next);
  }, [invalidateAnalysis, publishProject]);

  /** Stores one bounded undo checkpoint and discards its redo branch. */
  const recordHistory = useCallback((previous: ProjectModel, description: string, affectsAnalysis: boolean) => {
    setPast((history) => [...history.slice(-49), { project: previous, description, affectsAnalysis }]);
    setFuture([]);
  }, []);

  /** The shared implementation for the two explicitly reversible edit routes. */
  const commitReversibleProjectChange = useCallback((
    previous: ProjectModel,
    next: ProjectModel,
    description: string,
    affectsAnalysis = true,
  ) => {
    recordHistory(previous, description, affectsAnalysis);
    if (affectsAnalysis) publishAnalysisAffectingProject(next);
    else publishProject(next);
  }, [publishAnalysisAffectingProject, publishProject, recordHistory]);

  useEffect(() => () => {
    if (analysisTimerRef.current !== null) window.clearTimeout(analysisTimerRef.current);
    analysisWorkerRef.current?.terminate();
  }, []);

  const analyze = useCallback(() => {
    if (analysisTimerRef.current !== null) window.clearTimeout(analysisTimerRef.current);
    analysisWorkerRef.current?.terminate();
    analysisWorkerRef.current = null;
    const currentProject = projectRef.current;
    const source = structuredClone(currentProject);
    const topologyRepair = repairProjectTopology(source);
    const topologyRepairCount = topologyRepair.mergedNodes.length + topologyRepair.splitMembers.length;
    if (topologyRepairCount > 0) {
      setPast((history) => [...history.slice(-49), { project: currentProject, description: 'Reparar topología', affectsAnalysis: true }]);
      setFuture([]);
      projectRef.current = source;
      setProject(source);
      setPersistenceRevision((revision) => revision + 1);
      const selected = selectionRef.current;
      if (selected?.kind === 'node') {
        const merge = topologyRepair.mergedNodes.find((item) => item.removedNodeId === selected.id);
        if (merge) setSelection({ kind: 'node', id: merge.keptNodeId });
      }
    }
    const requestRevision = analysisRevisionRef.current + 1;
    analysisRevisionRef.current = requestRevision;
    setIsAnalyzing(true);
    const complete = (nextResult: AnalysisResult) => {
      if (analysisRevisionRef.current !== requestRevision) return;
      const next = topologyRepairCount > 0 ? {
        ...nextResult,
        issues: [{
          id: 'topology-auto-repair',
          severity: 'info' as const,
          title: 'Topología conectada automáticamente',
          message: `Se ${topologyRepair.mergedNodes.length === 1 ? 'unió 1 par de nodos' : `unieron ${topologyRepair.mergedNodes.length} pares de nodos`} y se ${topologyRepair.splitMembers.length === 1 ? 'dividió 1 miembro' : `dividieron ${topologyRepair.splitMembers.length} miembros`} para que los apoyos y cruces coincidentes participen en el análisis.`,
          suggestedFix: 'Revisa la geometría reparada; puedes deshacerla desde el historial si la coincidencia era intencional.',
        }, ...nextResult.issues],
      } : nextResult;
      setAnalysis(next);
      setIsAnalyzing(false);
      if (!next.success) setResultTab('issues');
      else if (selectionRef.current?.kind !== 'member' && next.memberResults.length) {
        // La barra crítica es la de mayor momento; en una armadura, la de mayor axial.
        const moment = (member: typeof next.memberResults[number]) => Math.max(Math.abs(member.maxMoment), Math.abs(member.minMoment));
        const axial = (member: typeof next.memberResults[number]) => Math.max(Math.abs(member.maxAxial), Math.abs(member.minAxial));
        const governing = next.memberResults.some((member) => moment(member) > 1e-9) ? moment : axial;
        const critical = next.memberResults.reduce((best, current) => governing(current) > governing(best) ? current : best);
        setSelection({ kind: 'member', id: critical.memberId });
      }
    };
    // A run that never produced numbers still has to reach the user: leaving
    // `isAnalyzing` set would freeze the UI on "analysing" with no explanation.
    const fail = (message: string) => complete(unavailableAnalysis(message));
    const runFallback = () => {
      analysisTimerRef.current = window.setTimeout(() => {
        analysisTimerRef.current = null;
        // Interactive edits never need the education trace up front — the
        // "Aprender" tab and PDF export fetch it on demand (AG-013).
        void runFallbackAnalysis(source, selectedCombinationId, false)
          .then(complete)
          .catch((error: unknown) => fail(error instanceof Error ? error.message : 'No se pudo completar el análisis estructural.'));
      }, 0);
    };
    if (typeof Worker === 'undefined') {
      runFallback();
      return;
    }
    try {
      const worker = createAnalysisWorker();
      analysisWorkerRef.current = worker;
      let settled = false;
      const fallbackOnce = () => {
        if (settled || analysisRevisionRef.current !== requestRevision) return;
        settled = true;
        worker.terminate();
        if (analysisWorkerRef.current === worker) analysisWorkerRef.current = null;
        runFallback();
      };
      worker.onmessage = (event: MessageEvent<AnalysisWorkerMessage>) => {
        if (settled || event.data.requestId !== requestRevision) return;
        settled = true;
        worker.terminate();
        if (analysisWorkerRef.current === worker) analysisWorkerRef.current = null;
        // `analysis-error` is a decision taken by the same pure function the
        // fallback would call, so recomputing it on the main thread would only
        // block the UI to reach the identical failure and hide its message.
        if (event.data.type === 'success' || event.data.type === 'analysis-result') complete(event.data.result);
        else fail(event.data.type === 'error' ? event.data.error.message : event.data.message);
      };
      worker.onerror = fallbackOnce;
      worker.postMessage(analysisWorkerRequest(source, selectedCombinationId, requestRevision, false));
    } catch {
      runFallback();
    }
  }, [selectedCombinationId, setSelection]);

  const ensureEducationTrace = useCallback(async (): Promise<AnalysisResult | null> => {
    const target = analysisRef.current;
    if (!target || !target.success || target.educationTrace) return target;
    try {
      const withTrace = await runAnalysisWithTrace(projectRef.current, selectedCombinationId);
      // The project (or a fresh `analyze()` run) may have moved on while this
      // was in flight; only splice the trace onto the exact result it was
      // requested for, never onto whatever is current now.
      if (analysisRef.current !== target || !withTrace.educationTrace) return null;
      const merged = { ...target, educationTrace: withTrace.educationTrace };
      analysisRef.current = merged;
      setAnalysis(merged);
      return merged;
    } catch {
      return null;
    }
  }, [selectedCombinationId]);

  const setSelectedCombinationId = useCallback((id: string) => {
    if (id === selectedCombinationId) return;
    invalidateAnalysis();
    setSelectedCombinationIdState(id);
  }, [invalidateAnalysis, selectedCombinationId]);

  const renameProject = useCallback((name: string) => {
    const current = projectRef.current;
    if (name === current.name) return;
    const next = { ...current, name };
    publishProject(next);
  }, [publishProject]);

  const updateProject = useCallback((updater: (project: ProjectModel) => ProjectModel, analyzeAfter = false) => {
    const current = projectRef.current;
    const next = updater(structuredClone(current));
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    commitReversibleProjectChange(current, next, 'Editar proyecto');
    if (analyzeAfter) {
      // `invalidateAnalysis` above already bumped the revision; publishing this
      // run without re-checking it would let a result from an older model land
      // on top of a newer edit.
      const requestRevision = analysisRevisionRef.current;
      window.setTimeout(() => {
        void runFallbackAnalysis(next, selectedCombinationId, false)
          .then((result) => { if (analysisRevisionRef.current === requestRevision) setAnalysis(result); })
          .catch((error: unknown) => {
            if (analysisRevisionRef.current !== requestRevision) return;
            setAnalysis(unavailableAnalysis(error instanceof Error ? error.message : 'No se pudo completar el análisis estructural.'));
          });
      }, 0);
    }
  }, [commitReversibleProjectChange, selectedCombinationId]);

  const executeProjectCommand = useCallback(async (command: ProjectCommand): Promise<ProjectCommandResult | undefined> => {
    const { applyProjectPatch, compileProjectCommand } = await import('../commands/projectCommand');
    const current = projectRef.current;
    const compiled = compileProjectCommand(current, command);
    const next = applyProjectPatch(current, compiled.forward);
    if (JSON.stringify(next) === JSON.stringify(current)) return compiled.result;
    commitReversibleProjectChange(current, next, command.description);
    return compiled.result;
  }, [commitReversibleProjectChange]);

  const executePreparedTopologyRepair = useCallback(async (prepared: PreparedTopologyRepair) => {
    const { applyPreparedTopologyRepair, projectCommandSnapshot } = await import('../commands/projectCommand');
    const current = projectRef.current;
    const next = applyPreparedTopologyRepair(current, prepared);
    if (projectCommandSnapshot(next) === projectCommandSnapshot(current)) {
      return { applied: false, report: prepared.report };
    }
    commitReversibleProjectChange(current, next, prepared.command.description);
    return { applied: true, report: prepared.report };
  }, [commitReversibleProjectChange]);

  const executePreparedStructuralEdit = useCallback(async (prepared: PreparedStructuralEdit) => {
    const { applyPreparedStructuralEdit, structuralEditSnapshot } = await import('../data/structuralEditing');
    const current = projectRef.current;
    const next = applyPreparedStructuralEdit(current, prepared);
    if (structuralEditSnapshot(next) === structuralEditSnapshot(current)) return { applied: false };
    commitReversibleProjectChange(current, next, prepared.description);
    return { applied: true };
  }, [commitReversibleProjectChange]);

  /**
   * Confirma una generación revisada. Todo el lote entra por
   * `commitReversibleProjectChange`, así que la geometría completa —decenas de
   * nodos y miembros— ocupa un solo punto de historial y un solo undo, y el
   * resultado vigente se invalida una vez, no una vez por entidad creada.
   */
  const executePreparedStructureGeneration = useCallback(async (prepared: PreparedStructureGeneration) => {
    const { applyPreparedStructureGeneration } = await import('../commands/structureGeneration');
    const { projectCommandSnapshot } = await import('../commands/projectCommand');
    const current = projectRef.current;
    const next = applyPreparedStructureGeneration(current, prepared);
    const created = { nodeIds: prepared.createdNodeIds, memberIds: prepared.createdMemberIds };
    if (projectCommandSnapshot(next) === projectCommandSnapshot(current)) return { applied: false, ...created };
    commitReversibleProjectChange(current, next, prepared.description);
    return { applied: true, ...created };
  }, [commitReversibleProjectChange]);

  const updateProjectView = useCallback((updater: (project: ProjectModel) => ProjectModel) => {
    const current = projectRef.current;
    const next = updater(structuredClone(current));
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    publishProject(next);
  }, [publishProject]);

  const updateProjectAnalysisSettings = useCallback((updater: (settings: Pick<ProjectModel['settings'], 'analysisMode' | 'pDeltaConfig'>) => Pick<ProjectModel['settings'], 'analysisMode' | 'pDeltaConfig'>) => {
    const current = projectRef.current;
    const analysisSettings = {
      analysisMode: current.settings.analysisMode,
      pDeltaConfig: current.settings.pDeltaConfig,
    };
    const nextAnalysisSettings = updater(structuredClone(analysisSettings));
    const next = {
      ...current,
      settings: { ...current.settings, ...nextAnalysisSettings },
    };
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    publishAnalysisAffectingProject(next);
  }, [publishAnalysisAffectingProject]);

  const beginProjectTransaction = useCallback((description = 'Editar proyecto') => {
    if (transactionStartRef.current) return;
    transactionStartRef.current = structuredClone(projectRef.current);
    transactionDescriptionRef.current = description;
    setTransactionActive(true);
  }, []);

  const updateProjectTransient = useCallback((updater: (project: ProjectModel) => ProjectModel) => {
    const current = projectRef.current;
    const next = updater(structuredClone(current));
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    publishAnalysisAffectingProject(next);
  }, [publishAnalysisAffectingProject]);

  const moveNodeTransient = useCallback((nodeId: string, point: { x: number; y: number }) => {
    const current = projectRef.current;
    const index = current.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return;
    const node = current.nodes[index];
    if (node.x === point.x && node.y === point.y) return;
    const nodes = current.nodes.slice();
    nodes[index] = { ...node, x: point.x, y: point.y };
    const next = { ...current, nodes };
    publishAnalysisAffectingProject(next);
  }, [publishAnalysisAffectingProject]);

  const commitProjectTransaction = useCallback(() => {
    const start = transactionStartRef.current;
    transactionStartRef.current = null;
    if (start && JSON.stringify(start) !== JSON.stringify(projectRef.current)) {
      recordHistory(start, transactionDescriptionRef.current, true);
    }
    setTransactionActive(false);
    setPersistenceRevision((revision) => revision + 1);
  }, [recordHistory]);

  const cancelProjectTransaction = useCallback(() => {
    const start = transactionStartRef.current;
    transactionStartRef.current = null;
    if (start) {
      publishAnalysisAffectingProject(start);
    }
    setTransactionActive(false);
    setPersistenceRevision((revision) => revision + 1);
  }, [publishAnalysisAffectingProject]);

  const replaceProject = useCallback((next: ProjectModel, restoredAnalysis?: AnalysisResult, repositoryRevision?: number) => {
    const apply = (candidate: ProjectModel) => {
      const normalized = normalizeProject(candidate);
      setPast((history) => [...history.slice(-49), { project, description: 'Abrir proyecto', affectsAnalysis: true }]);
      setFuture([]);
      setProject(normalized);
      projectRef.current = normalized;
      repositoryRevisionRef.current = repositoryRevision === undefined ? null : { projectId: normalized.id, revision: repositoryRevision };
      if (repositoryRevision !== undefined) repositoryBlockedProjectIdRef.current = null;
      invalidateAnalysis();
      if (restoredAnalysis) {
        setAnalysis(restoredAnalysis);
        setResultTab(restoredAnalysis.success ? 'summary' : 'issues');
      }
      setActiveTool('select');
      setSelectedCombinationIdState((current) => normalized.combinations.some((item) => item.id === current) ? current : '');
      setSelection(null);
      setResultCursor(null);
    };
    const session = unifiedSessionRef.current;
    if (unified && repositoryRevision !== undefined && session) {
      void session.open(next.id).then((canonical) => {
        apply(canonical ?? next);
        setStorageState(session.status);
      }).catch(() => setStorageState(session.status));
    } else apply(next);
  }, [unified, invalidateAnalysis, project, setSelection]);

  const openUnifiedProject = useCallback(async (id: string, isCurrent: () => boolean = () => true) => {
    const session = unifiedSessionRef.current;
    if (!session) return false;
    try {
      const canonical = await session.open(id);
      if (!canonical) return false;
      if (!isCurrent()) return false;
      replaceProject(canonical);
      setStorageState(session.status);
      return true;
    } catch {
      setStorageState(session.status);
      return false;
    }
  }, [replaceProject]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture((items) => [{ project, description: previous.description, affectsAnalysis: previous.affectsAnalysis }, ...items].slice(0, 50));
    setPast(past.slice(0, -1));
    setProject(previous.project);
    projectRef.current = previous.project;
    if (previous.affectsAnalysis) invalidateAnalysis();
    setSelection(null);
  }, [invalidateAnalysis, past, project, setSelection]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const entry = future[0];
    setPast((history) => [...history.slice(-49), { project, description: entry.description, affectsAnalysis: entry.affectsAnalysis }]);
    setFuture(future.slice(1));
    // History entries are already-valid in-memory snapshots. Re-normalizing
    // here can add optional keys with `undefined` and makes redo differ from
    // the exact state that was originally published and previewed.
    setProject(entry.project);
    projectRef.current = entry.project;
    if (entry.affectsAnalysis) invalidateAnalysis();
    setSelection(null);
  }, [future, invalidateAnalysis, project, setSelection]);

  const modelValue = useMemo<ProjectModelContextValue>(() => ({
    openUnifiedProject: unified ? openUnifiedProject : undefined,
    project,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    storageIssue: storageState.issue,
    storageMessage: storageState.message,
    renameProject, executeProjectCommand, executePreparedTopologyRepair, executePreparedStructuralEdit, executePreparedStructureGeneration, updateProject, updateProjectView, updateProjectAnalysisSettings, beginProjectTransaction, updateProjectTransient,
    moveNodeTransient, commitProjectTransaction, cancelProjectTransaction, replaceProject, undo, redo,
  }), [unified, openUnifiedProject, project, past.length, future.length, storageState.issue, storageState.message, renameProject, executeProjectCommand, executePreparedTopologyRepair, executePreparedStructuralEdit, executePreparedStructureGeneration, updateProject, updateProjectView, updateProjectAnalysisSettings, beginProjectTransaction, updateProjectTransient, moveNodeTransient, commitProjectTransaction, cancelProjectTransaction, replaceProject, undo, redo]);

  const analysisValue = useMemo<ProjectAnalysisContextValue>(() => ({
    analysis, isAnalyzing, selectedCombinationId, learningFocus, influenceCanvasState,
    setSelectedCombinationId, setLearningFocus, setInfluenceCanvasState, analyze, clearAnalysis: invalidateAnalysis,
    ensureEducationTrace,
  }), [analysis, isAnalyzing, selectedCombinationId, learningFocus, influenceCanvasState, setSelectedCombinationId, analyze, invalidateAnalysis, ensureEducationTrace]);

  const uiValue = useMemo<WorkspaceUIContextValue>(() => ({
    activeTool, selection, theme, resultTab, resultCursor, modeShapeState,
    setActiveTool, setSelection, setTheme, setResultTab, setResultCursor, setModeShapeState,
  }), [activeTool, selection, theme, resultTab, resultCursor, modeShapeState, setSelection]);

  return (
    <ProjectModelContext.Provider value={modelValue}>
      <ProjectAnalysisContext.Provider value={analysisValue}>
        <WorkspaceUIContext.Provider value={uiValue}>
          <SharedToolStateProvider session={unifiedSessionRef.current}>
            {unifiedReady ? children : <div role="status">Abriendo proyecto local…</div>}
          </SharedToolStateProvider>
        </WorkspaceUIContext.Provider>
      </ProjectAnalysisContext.Provider>
    </ProjectModelContext.Provider>
  );
};

/**
 * Back-compat facade combining the three focused contexts into the original shape.
 * Prefer {@link useProjectModel}, {@link useProjectAnalysis} or {@link useWorkspaceUI} in new code:
 * this subscribes to all three and re-renders on any change to any of them.
 */
// oxlint-disable-next-line react/only-export-components
export const useProject = () => {
  const model = useProjectModel();
  const analysis = useProjectAnalysis();
  const ui = useWorkspaceUI();
  return useMemo(() => ({ ...model, ...analysis, ...ui }), [model, analysis, ui]);
};
