import { Component, Suspense, useRef, type ErrorInfo, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import type { ToolId } from '../../shared/contracts';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { AppShellLayout } from './AppShellLayout';
import { WorkspaceTopBar } from './WorkspaceTopBar';
import { ShellCompositionProvider } from './ShellCompositionProvider';
import { useShellComposition } from './useShellComposition';
import { ShellInspectorHost, ShellInspectorTrigger, ShellSlotHost, ShellToolSlotsProvider } from './ShellToolSlots';
import { DesignTool, FemTool, Space3DTool } from './toolSurfaces';
import { LazySurface } from './LazySurface';
import { toolIdentity } from './toolCatalog';
import '../../design-system/components/ui.css';
import './phase1.css';
import './workspaceTopbar.css';
import './nativeWorkspaceMode.css';

/** Herramientas que viven fuera del Modelo 2D, cada una en su propia mesa. */
type IsolatedToolId = Exclude<ToolId, 'model2d'>;

type ToolShellProps = {
  tool: IsolatedToolId;
  projectId: string;
  onOpenHome: () => void;
};

const copy = {
  es: { loading: 'Cargando herramienta…', failed: 'Esta herramienta dejó de responder.', failedBody: 'Tu proyecto sigue guardado. Vuelve al inicio o recarga la herramienta; las demás no se ven afectadas.', retry: 'Recargar herramienta', home: 'Volver al inicio', panel: 'Panel' },
  en: { loading: 'Loading tool…', failed: 'This tool stopped responding.', failedBody: 'Your project is still saved. Go back home or reload the tool; the other tools are not affected.', retry: 'Reload tool', home: 'Back to home', panel: 'Panel' },
} as const;

type BoundaryProps = { children: ReactNode; fallback: (reset: () => void) => ReactNode };
type BoundaryState = { failed: boolean };

/**
 * Un fallo de render queda dentro de la herramienta que lo produjo: sin este
 * límite, un error de WebGL en 3D desmontaba la aplicación entera.
 */
class ToolErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[FStructure] herramienta', error, info.componentStack); }
  reset = () => this.setState({ failed: false });
  render() { return this.state.failed ? this.props.fallback(this.reset) : this.props.children; }
}

const ToolContent = ({ tool }: { tool: IsolatedToolId }) => {
  if (tool === 'design') return <LazySurface><DesignTool /></LazySurface>;
  return tool === 'space3d' ? <Space3DTool /> : <FemTool />;
};

const ToolSurface = ({ tool, projectId, onOpenHome }: ToolShellProps) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const { shellClass } = useShellComposition();
  const { t, language } = useI18n();
  const { project, storageIssue, storageMessage, renameProject } = useProject();
  const { theme, setTheme } = useWorkspaceUI();
  const identity = toolIdentity(tool);
  const text = copy[language];
  const name = identity.name[language];
  // Diseño lleva sus datos y resultados sobre su propio lienzo; no usa el inspector del shell.
  const hasInspector = tool !== 'design';

  return <ShellToolSlotsProvider tool={tool} mobile={shellClass === 'K0'}>
    <AppShellLayout
      ref={shellRef}
      projectId={projectId}
      skipLabel={t('shell.skipToCanvas')}
      shellClass={shellClass}
      inspectorCollapsed
      console={null}
      topbar={<WorkspaceTopBar
        tool={tool}
        contextActive={false}
        contextualControls={<div className="workspace-topbar__tool-group" data-workspace-group="tool">
          <ShellSlotHost slot="controls" />
          {hasInspector ? <ShellInspectorTrigger label={text.panel} /> : null}
        </div>}
        primaryAction={<ShellSlotHost slot="action" />}
        toolStatus={<ShellSlotHost slot="status" />}
        utilities={<button
          type="button"
          className="workspace-topbar__icon-button workspace-topbar__theme-button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
          title={t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
        >{theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}</button>}
        projectName={project.name}
        storageState={!storageIssue ? 'ready' : storageIssue === 'recovered' ? 'recovered' : 'issue'}
        storageMessage={storageMessage}
        analysisState="ready"
        resultsOpen={false}
        canUndo={false}
        canRedo={false}
        labels={{
          solverName: `${identity.code} · ${name}`,
          project: t('topbar.currentProject'),
          home: t('navigation.home'),
          editProject: t('project.name'),
          saveProject: t('topbar.saveProject'),
          cancel: t('topbar.cancelProject'),
          storageReady: t('storage.local'),
          storageRecovered: t('storage.recoveredShort'),
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
          calculationExperience: t('inspector.calculationExperience'),
          actions: t('toolbar.primary'),
        }}
        onOpenHome={onOpenHome}
        onRenameProject={renameProject}
        onUndo={() => undefined}
        onRedo={() => undefined}
        onAnalyze={() => undefined}
        onOpenResults={() => undefined}
      />}
      workspace={<section className="native-workspace-mode" data-workspace-mode={tool} aria-label={name}>
        <ToolErrorBoundary fallback={(reset) => <div className="tool-shell__failure" role="alert">
          <strong>{text.failed}</strong>
          <p>{text.failedBody}</p>
          <div>
            <button type="button" className="workspace-topbar__action-button is-primary" onClick={reset}>{text.retry}</button>
            <button type="button" className="workspace-topbar__action-button" onClick={onOpenHome}>{text.home}</button>
          </div>
        </div>}>
          <Suspense fallback={<div className="workspace-loading" role="status">{text.loading}</div>}>
            <ToolContent tool={tool} />
          </Suspense>
        </ToolErrorBoundary>
      </section>}
      inspector={hasInspector ? <ShellInspectorHost /> : null}
      floatingActions={<ShellSlotHost slot="mobile" />}
      instrument={<>
        {storageIssue ? <p className="shell-storage-notice" role="status">{storageMessage}</p> : null}
        <ShellSlotHost slot="statusbar" />
        <ShellSlotHost slot="dock" />
      </>}
    />
  </ShellToolSlotsProvider>;
};

/**
 * Shell de una herramienta aislada —Diseño, Modelo 3D o FEM—.
 *
 * No monta nada del Modelo 2D: ni su consola, ni sus utilidades, ni sus atajos
 * de teclado, ni su bróker de superficies. La marca de la barra vuelve al Inicio,
 * que es el único lugar donde se elige otra herramienta.
 */
const ToolShell = (props: ToolShellProps) => <ShellCompositionProvider>
  <ToolSurface {...props} />
</ShellCompositionProvider>;

export default ToolShell;
