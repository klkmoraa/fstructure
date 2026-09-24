import { Suspense, useCallback, useEffect } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import './styles.css';
import './design-system/material.css';
import { ProjectProvider, useProject } from './store/ProjectContext';
import { ClassroomSessionProvider } from './store/ClassroomSessionContext';
import WorkspaceShell from './features/workspace/WorkspaceShell';
import ToolShell from './features/workspace/ToolShell';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';
import { Model2DWelcome } from './features/welcome/Model2DWelcome';
import { TOOL_HOMES } from './features/workspace/toolHomes';
import { toolRegistry } from './features/workspace/toolRegistry';
import { rememberLastTool } from './features/welcome/lastTool';
import { useProjectNavigation } from './shared/navigation/useProjectNavigation';
import type { ToolId } from './shared/contracts';

const loadMotionFeatures = () => import('./design-system/motionFeatures')
  .then(({ default: features }) => features);

const FStructureSurface = () => {
  const { project, analysis, replaceProject, openUnifiedProject } = useProject();
  const { route, navigate } = useProjectNavigation(project.id);
  const openTool = useCallback((tool: ToolId) => {
    navigate({ surface: 'workspace', projectId: route.projectId, tool });
  }, [navigate, route.projectId]);
  /* Inicio de FusionStructure → bienvenida de la herramienta → mesa. El logo
     de una mesa vuelve a la bienvenida de SU herramienta; desde ahí se vuelve
     a FusionStructure. */
  const openToolHome = useCallback((tool: ToolId) => {
    navigate({ surface: 'tool-home', projectId: route.projectId, tool });
  }, [navigate, route.projectId]);
  const openSuite = useCallback(() => {
    navigate({ surface: 'welcome', projectId: route.projectId, tool: route.tool });
  }, [navigate, route.projectId, route.tool]);
  const openCurrentToolHome = useCallback(() => openToolHome(route.tool), [openToolHome, route.tool]);
  const openCurrentWorkspace = useCallback(() => openTool(route.tool), [openTool, route.tool]);

  useEffect(() => {
    if (route.surface === 'workspace') rememberLastTool(route.tool);
  }, [route.surface, route.tool]);

  /* Desde la bienvenida, la mesa se abre casi siempre: su código se descarga en
     segundo plano para que «Continuar» no espere a la red (en móvil eran segundos). */
  useEffect(() => {
    if (route.surface !== 'tool-home') return;
    const preload = () => { void toolRegistry.find((tool) => tool.id === route.tool)?.load().catch(() => undefined); };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(preload, 600);
    return () => window.clearTimeout(handle);
  }, [route.surface, route.tool]);

  useEffect(() => {
    if (route.projectId === project.id) return;
    let cancelled = false;
    const resolveProject = async () => {
      try {
        if (openUnifiedProject) {
          if (await openUnifiedProject(route.projectId, () => !cancelled)) return;
          if (!cancelled) navigate({ ...route, projectId: project.id }, 'replace');
          return;
        }
        const { getProjectRepository } = await import('./storage/projectRepository');
        const record = await getProjectRepository().openProject(route.projectId);
        if (cancelled) return;
        if (record) {
          replaceProject(record.project, undefined, record.revision);
          return;
        }
      } catch {
        // Missing/unavailable local storage must not relabel the active model.
      }
      if (!cancelled) navigate({ ...route, projectId: project.id }, 'replace');
    };
    void resolveProject();
    return () => { cancelled = true; };
  }, [route, project.id, replaceProject, openUnifiedProject, navigate]);

  const ToolHomeView = route.tool === 'model2d' ? null : TOOL_HOMES[route.tool];
  /* Cada herramienta monta SU shell. La `key` garantiza que abrir otra
     herramienta desmonte la anterior por completo: ningún atajo, superficie,
     historial de interfaz ni estado de render sobrevive al cambio. */
  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    {route.surface === 'welcome'
      ? <WelcomeScreen onOpenToolHome={openToolHome} onResume={openTool} />
      : route.surface === 'tool-home'
        ? ToolHomeView
          ? <Suspense key={route.tool} fallback={<div className="workspace-loading" role="status">Cargando herramienta…</div>}><ToolHomeView onOpenWorkspace={openCurrentWorkspace} onOpenSuite={openSuite} /></Suspense>
          : <Model2DWelcome key="model2d" onOpenWorkspace={openCurrentWorkspace} onOpenSuite={openSuite} />
        : route.tool === 'model2d'
          ? <WorkspaceShell key="model2d" projectId={project.id} onOpenHome={openCurrentToolHome} />
          : <ToolShell key={route.tool} tool={route.tool} projectId={project.id} onOpenHome={openCurrentToolHome} />}
  </ClassroomSessionProvider>;
};

const App = () => <LazyMotion features={loadMotionFeatures} strict>
  <MotionConfig reducedMotion="user">
    <ProjectProvider unified><FStructureSurface /></ProjectProvider>
  </MotionConfig>
</LazyMotion>;

export default App;
