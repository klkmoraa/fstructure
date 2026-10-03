import { Component, Suspense, useRef, type ErrorInfo, type ReactNode } from 'react';
import type { ToolId } from '../../shared/contracts';
import type { MesaMode } from '../../shared/navigation/projectUrl';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import { AppShellLayout } from './AppShellLayout';
import { WorkspaceTopBar } from './WorkspaceTopBar';
import { ShellCompositionProvider } from './ShellCompositionProvider';
import { useShellComposition } from './useShellComposition';
import { ShellInspectorHost, ShellInspectorTrigger, ShellSlotHost, ShellToolSlotsProvider } from './ShellToolSlots';
import { DesignModeTool, FemTool, Space3DTool } from './toolSurfaces';
import { MesaModeSwitch } from './MesaModeSwitch';
import { LazySurface } from './LazySurface';
import { toolIdentity } from './toolCatalog';
import { ThemeToggleButton } from './ThemeToggleButton';
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

/** Lo que monta el shell: una herramienta aislada o el modo Diseño de FStructure. */
type SurfaceProps = {
  variant: IsolatedToolId | 'design';
  projectId: string;
  onOpenHome: () => void;
  /** Sólo en Diseño: vuelve al modo Modelo de la misma mesa. */
  onModeChange?: (mode: MesaMode) => void;
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

const ToolContent = ({ variant, onModeChange }: Pick<SurfaceProps, 'variant' | 'onModeChange'>) => {
  if (variant === 'design') return <LazySurface><DesignModeTool {...(onModeChange ? { onOpenModel: () => onModeChange('model') } : {})} /></LazySurface>;
  return variant === 'space3d' ? <Space3DTool /> : <FemTool />;
};

const ToolSurface = ({ variant, projectId, onOpenHome, onModeChange }: SurfaceProps) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const { shellClass } = useShellComposition();
  const { t, language } = useI18n();
  const { project, storageIssue, storageMessage, renameProject } = useProject();
  const design = variant === 'design';
  // El modo Diseño es FStructure: misma identidad, misma marca y la guía de diseño.
  const tool: ToolId = design ? 'model2d' : variant;
  const identity = toolIdentity(tool);
  const text = copy[language];
  const name = identity.name[language];
  // Diseño lleva sus datos y resultados sobre su propio lienzo; no usa el inspector del shell.
  const hasInspector = !design;

  return <ShellToolSlotsProvider tool={variant} mobile={shellClass === 'K0'}>
    <AppShellLayout
      ref={shellRef}
      projectId={projectId}
      skipLabel={t('shell.skipToCanvas')}
      shellClass={shellClass}
      inspectorCollapsed
      console={null}
      topbar={<WorkspaceTopBar
        language={language}
        tool={tool}
        {...(design ? { helpTopic: 'design' as const } : {})}
        modeSwitch={design && onModeChange ? <MesaModeSwitch mode="design" onChange={onModeChange} language={language} /> : undefined}
        contextActive={false}
        contextualControls={<div className="workspace-topbar__tool-group" data-workspace-group="tool">
          <ShellSlotHost slot="controls" />
          {hasInspector ? <ShellInspectorTrigger label={text.panel} /> : null}
        </div>}
        primaryAction={<ShellSlotHost slot="action" />}
        toolStatus={<ShellSlotHost slot="status" />}
        themeControl={<ThemeToggleButton />}
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
      workspace={<section className="native-workspace-mode" data-workspace-mode={variant} aria-label={design ? (language === 'es' ? `${name} · Diseño` : `${name} · Design`) : name}>
        <ToolErrorBoundary fallback={(reset) => <div className="tool-shell__failure" role="alert">
          <strong>{text.failed}</strong>
          <p>{text.failedBody}</p>
          <div>
            <button type="button" className="workspace-topbar__action-button is-primary" onClick={reset}>{text.retry}</button>
            <button type="button" className="workspace-topbar__action-button" onClick={onOpenHome}>{text.home}</button>
          </div>
        </div>}>
          <Suspense fallback={<div className="workspace-loading" role="status">{text.loading}</div>}>
            <ToolContent variant={variant} {...(onModeChange ? { onModeChange } : {})} />
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
 * Shell de una herramienta aislada —Modelo 3D o FEM—.
 *
 * No monta nada del Modelo 2D: ni su consola, ni sus utilidades, ni sus atajos
 * de teclado, ni su bróker de superficies. La marca de la barra vuelve al Inicio,
 * que es el único lugar donde se elige otra herramienta.
 */
const ToolShell = ({ tool, ...props }: ToolShellProps) => <ShellCompositionProvider>
  <ToolSurface variant={tool} {...props} />
</ShellCompositionProvider>;

/**
 * Modo Diseño de FStructure: la misma mesa que el Modelo 2D, con el taller de
 * concreto en lugar del lienzo. Comparte proyecto, guardado y análisis; el
 * interruptor Modelo | Diseño de la barra vuelve al dibujo.
 */
export const DesignModeShell = (props: Omit<SurfaceProps, 'variant'>) => <ShellCompositionProvider>
  <ToolSurface variant="design" {...props} />
</ShellCompositionProvider>;

export default ToolShell;
