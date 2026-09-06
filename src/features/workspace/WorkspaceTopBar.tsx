import { ChartNoAxesCombined, Check, CloudOff, Play, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Solver2DMark } from '../../design-system/brand';

/**
 * Recuperar el respaldo con éxito no es un fallo de guardado.
 *
 * Con dos estados, `recovered` caía en `issue` y la barra lo pintaba en rojo
 * con el icono de «sin nube» sobre la palabra «Recuperado»: el icono decía una
 * cosa y el texto la contraria. `Instrument` ya excluye `recovered` de su
 * predicado de error; aquí no lo hacía.
 */
export type WorkspaceStorageState = 'ready' | 'recovered' | 'issue';
/**
 * Un análisis que terminó MAL no es un modelo que no se ha corrido. Sin
 * `failed`, un `analysis.success === false` caía en `ready` y la barra decía
 * «Listo para analizar» encima de una corrida que falló: el estado más
 * importante quedaba escondido detrás del más inocuo.
 */
export type WorkspaceAnalysisState = 'ready' | 'running' | 'resolved' | 'failed';

export interface WorkspaceTopBarLabels {
  solverName: string;
  project: string;
  home: string;
  editProject: string;
  saveProject: string;
  cancel: string;
  storageReady: string;
  storageRecovered: string;
  storageIssue: string;
  analysisReady: string;
  analysisRunning: string;
  analysisResolved: string;
  analysisFailed: string;
  undo: string;
  redo: string;
  analyze: string;
  results: string;
  actions: string;
}

export interface WorkspaceTopBarProps {
  projectName: string;
  storageState: WorkspaceStorageState;
  storageMessage?: string | null;
  analysisState: WorkspaceAnalysisState;
  resultsOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  labels: WorkspaceTopBarLabels;
  onOpenHome: () => void;
  onRenameProject: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAnalyze: () => void;
  /** Alterna Resultados. Recibe el disparador para que el foco vuelva a él. */
  onOpenResults: (trigger: HTMLElement | null) => void;
}

/**
 * Barra superior persistente del canvas 2D.
 *
 * Mantiene a la vista el contexto del proyecto, la salud del guardado y el
 * estado de la última corrida. Las acciones rápidas son botones reales —no
 * affordances que sólo aparecen al pasar el puntero— para que el mismo recorrido
 * funcione con teclado, touch y lector de pantalla.
 */
export const WorkspaceTopBar = ({
  projectName,
  storageState,
  storageMessage,
  analysisState,
  resultsOpen,
  canUndo,
  canRedo,
  labels,
  onOpenHome,
  onRenameProject,
  onUndo,
  onRedo,
  onAnalyze,
  onOpenResults,
}: WorkspaceTopBarProps) => {
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const storageFailed = storageState === 'issue';
  const storageRecovered = storageState === 'recovered';
  const storageLabel = storageFailed
    ? labels.storageIssue
    : storageRecovered ? labels.storageRecovered : labels.storageReady;
  const analysisRunning = analysisState === 'running';
  const analysisFailed = analysisState === 'failed';
  const analysisLabel = analysisRunning
    ? labels.analysisRunning
    : analysisFailed
      ? labels.analysisFailed
      : analysisState === 'resolved'
      ? labels.analysisResolved
      : labels.analysisReady;
  const showStorageStatus = storageState !== 'ready';

  useEffect(() => {
    if (!projectEditorOpen) setDraftName(projectName);
  }, [projectEditorOpen, projectName]);

  useEffect(() => {
    if (projectEditorOpen) nameInputRef.current?.focus({ preventScroll: true });
  }, [projectEditorOpen]);

  const saveProjectName = () => {
    const nextName = draftName.trim();
    if (nextName) onRenameProject(nextName);
    setProjectEditorOpen(false);
  };

  return <header className="workspace-topbar" data-workspace-topbar>
    <div className="workspace-topbar__project-group" data-workspace-group="project">
      <button
        type="button"
        className="workspace-topbar__brand"
        onClick={onOpenHome}
        aria-label={labels.home}
        title={labels.home}
      >
        <Solver2DMark size={26} />
      </button>
      <button
        type="button"
        className="workspace-topbar__project"
        onClick={() => setProjectEditorOpen(true)}
        aria-label={labels.editProject + ': ' + projectName}
        title={labels.editProject}
        aria-expanded={projectEditorOpen}
      >
        <span className="workspace-topbar__project-copy">
          <span className="workspace-topbar__eyebrow">{labels.solverName}</span>
          <strong>{projectName}</strong>
        </span>
      </button>

      {projectEditorOpen ? <form className="workspace-topbar__project-editor" aria-label={labels.editProject} onSubmit={(event) => {
        event.preventDefault();
        saveProjectName();
      }}>
        <label>
          <span>{labels.editProject}</span>
          <input ref={nameInputRef} value={draftName} onChange={(event) => setDraftName(event.currentTarget.value)} />
        </label>
        <div className="workspace-topbar__project-editor-actions">
          <button type="button" onClick={() => setProjectEditorOpen(false)}>{labels.cancel}</button>
          <button type="submit" disabled={!draftName.trim()}>{labels.saveProject}</button>
        </div>
      </form> : null}

      <div className="workspace-topbar__status" aria-label={labels.project}>
        {showStorageStatus ?
        <span
          className={'workspace-topbar__status-chip' + (storageFailed ? ' is-error' : '') + (storageRecovered ? ' is-notice' : '')}
          role="status"
          data-storage-state={storageState}
          title={storageMessage ?? labels.storageReady}
        >
          {storageFailed
            ? <CloudOff size={15} aria-hidden="true" />
            : storageRecovered ? <RotateCcw size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          <span>
            <strong>{storageLabel}</strong>
            {storageMessage ? <small>{storageMessage}</small> : null}
          </span>
        </span> : null}
        <span
          className={'workspace-topbar__status-chip' + (analysisRunning ? ' is-running' : '') + (analysisFailed ? ' is-error' : '')}
          role="status"
          data-analysis-state={analysisState}
          title={analysisLabel}
        >
          {analysisRunning ? <Play size={15} fill="currentColor" aria-hidden="true" /> : <ChartNoAxesCombined size={15} aria-hidden="true" />}
          <span><strong>{analysisLabel}</strong></span>
        </span>
      </div>
    </div>

    <nav className="workspace-topbar__actions" aria-label={labels.actions}>
      <div className="workspace-topbar__model-group" data-workspace-group="model">
        <div className="workspace-topbar__history-group">
          <button type="button" className="workspace-topbar__icon-button" onClick={onUndo} disabled={!canUndo} aria-label={labels.undo} title={labels.undo}>
            <Undo2 size={17} aria-hidden="true" />
          </button>
          <button type="button" className="workspace-topbar__icon-button" onClick={onRedo} disabled={!canRedo} aria-label={labels.redo} title={labels.redo}>
            <Redo2 size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="workspace-topbar__results-group" data-workspace-group="results">
          <button type="button" className={'workspace-topbar__action-button' + (resultsOpen ? ' is-active' : '')} onClick={(event) => onOpenResults(event.currentTarget)} aria-label={labels.results} aria-pressed={resultsOpen}>
            <ChartNoAxesCombined size={17} aria-hidden="true" />
            <span>{labels.results}</span>
          </button>
        </div>
      </div>
      <div className="workspace-topbar__calculate-group" data-workspace-group="calculate">
        <button type="button" className="workspace-topbar__action-button is-primary" onClick={onAnalyze} disabled={analysisRunning} aria-label={analysisRunning ? labels.analysisRunning : labels.analyze}>
          <Play size={17} fill="currentColor" aria-hidden="true" />
          <span>{analysisRunning ? labels.analysisRunning : labels.analyze}</span>
        </button>
      </div>
    </nav>
  </header>;
};
