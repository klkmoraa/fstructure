import { Suspense, useCallback, useEffect } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import './styles.css';
import './design-system/material.css';
import { ProjectProvider, useProject } from './store/ProjectContext';
import { ClassroomSessionProvider } from './store/ClassroomSessionContext';
import WorkspaceShell from './features/workspace/WorkspaceShell';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';
import { FemTool, Space3DTool } from './features/workspace/toolSurfaces';
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

  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    {route.surface === 'welcome'
      ? <WelcomeScreen onOpenWorkspace={() => openTool('model2d')} />
      : <WorkspaceShell
          projectId={project.id}
          tool={route.tool}
          onToolChange={openTool}
          space3dContent={<Suspense fallback={<div className="workspace-loading" role="status">Cargando módulo…</div>}>
            <Space3DTool />
          </Suspense>}
          femContent={<Suspense fallback={<div className="workspace-loading" role="status">Cargando módulo…</div>}><FemTool /></Suspense>}
          onOpenHome={() => navigate({ surface: 'welcome', projectId: project.id, tool: 'model2d' })}
        />}
  </ClassroomSessionProvider>;
};

const App = () => <LazyMotion features={loadMotionFeatures} strict>
  <MotionConfig reducedMotion="user">
    <ProjectProvider unified><FStructureSurface /></ProjectProvider>
  </MotionConfig>
</LazyMotion>;

export default App;
