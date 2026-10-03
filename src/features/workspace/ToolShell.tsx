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
import { DesignModeTool, FemTool, Space3DModeTool } from './toolSurfaces';
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

/** Modos de FStructure que monta este shell: el 3D y el Diseño (el 2D tiene el suyo). */
export type ShellMesaMode = Exclude<MesaMode, 'model'>;

/** Lo que monta el shell: una herramienta aislada o un modo de la mesa de FStructure. */
type SurfaceProps = {
  variant: IsolatedToolId | ShellMesaMode;
  projectId: string;
  onOpenHome: () => void;
  /** Interruptor 2D | 3D | Diseño de la mesa. */
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
  if (variant === 'design') {
    return <LazySurface><DesignModeTool {...(onModeChange ? { onOpenModel: () => onModeChange('model'), onOpenSpace3D: () => onModeChange('3d') } : {})} /></LazySurface>;
  }
  return variant === '3d' ? <Space3DModeTool /> : <FemTool />;
};

const ToolSurface = ({ variant, projectId, onOpenHome, onModeChange }: SurfaceProps) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const { shellClass } = useShellComposition();
  const { t, language } = useI18n();
  const { project, storageIssue, storageMessage, renameProject } = useProject();
  const design = variant === 'design';
  const mesa = variant === 'design' || variant === '3d';
  // Los modos 3D y Diseño son FStructure: misma identidad, misma marca y su propia guía.
  const tool: ToolId = mesa ? 'model2d' : 'fem';
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
        {...(mesa ? { helpTopic: design ? 'design' as const : 'space3d' as const } : {})}
        modeSwitch={mesa && onModeChange ? <MesaModeSwitch mode={variant} onChange={onModeChange} language={language} /> : undefined}
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
      workspace={<section className="native-workspace-mode" data-workspace-mode={variant === '3d' ? 'space3d' : variant}
        aria-label={design ? (language === 'es' ? `${name} · Diseño` : `${name} · Design`) : variant === '3d' ? `${name} · 3D` : name}>
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
 * Shell de una herramienta aislada (FEM).
 *
 * No monta nada del Modelo 2D: ni su consola, ni sus utilidades, ni sus atajos
 * de teclado, ni su bróker de superficies. La marca de la barra vuelve al Inicio,
 * que es el único lugar donde se elige otra herramienta.
 */
const ToolShell = ({ tool, ...props }: ToolShellProps) => <ShellCompositionProvider>
  <ToolSurface variant={tool} {...props} />
</ShellCompositionProvider>;

/**
 * Modos 3D y Diseño de FStructure: la misma mesa que el modo 2D, con el modelo
 * espacial o el taller de concreto en lugar del lienzo plano. Comparten
 * proyecto, guardado, barra y marca; el interruptor 2D | 3D | Diseño cambia de
 * modo sin cambiar de mesa.
 */
export const MesaModeShell = ({ mode, ...props }: Omit<SurfaceProps, 'variant'> & { mode: ShellMesaMode }) => <ShellCompositionProvider>
  <ToolSurface variant={mode} {...props} />
</ShellCompositionProvider>;

export default ToolShell;
