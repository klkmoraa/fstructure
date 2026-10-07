import { useCallback, useEffect } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import './styles.css';
import './design-system/material.css';
import { ProjectProvider, useProject } from './store/ProjectContext';
import { ClassroomSessionProvider } from './store/ClassroomSessionContext';
import WorkspaceShell from './features/workspace/WorkspaceShell';
import { MesaModeShell } from './features/workspace/ToolShell';
import { runMesaTransition } from './features/workspace/mesaTransition';
import { peekToolIntent, setToolIntent } from './features/workspace/toolIntent';
import { preloadMesaMode } from './features/workspace/toolSurfaces';
import { HomePage } from './features/welcome/HomePage';
import { toolRegistry } from './features/workspace/toolRegistry';
import { useI18n } from './i18n/useI18n';
import { useProjectNavigation } from './shared/navigation/useProjectNavigation';
import type { MesaMode } from './shared/navigation/projectUrl';

const loadMotionFeatures = () => import('./design-system/motionFeatures')
  .then(({ default: features }) => features);

const FStructureSurface = () => {
  const { project, analysis, replaceProject, openUnifiedProject } = useProject();
  const { route, navigate } = useProjectNavigation(project.id);
  const { language } = useI18n();
  useEffect(() => {
    document.title = route.surface === 'welcome' ? 'FStructure · FusionStructure'
      : `${project.name} · FStructure`;
  }, [route.surface, project.name, language]);
  /* Una sola portada (la Home) y la mesa. El logo de la mesa vuelve a la Home. */
  const openHome = useCallback(() => {
    navigate({ surface: 'welcome', projectId: route.projectId, tool: 'model2d' });
  }, [navigate, route.projectId]);
  const openWorkspace = useCallback((mode: MesaMode = 'model') => {
    navigate(mode === 'model'
      ? { surface: 'workspace', projectId: route.projectId, tool: 'model2d' }
      : { surface: 'workspace', projectId: route.projectId, tool: 'model2d', mode });
  }, [navigate, route.projectId]);
  /* 2D, 3D y Diseño son la misma mesa de FStructure: el modo vive en la URL
     (`mode=3d`, `mode=design`) para que recargar o compartir conserve dónde
     estabas, y el cambio se anima como un solo espacio que gira o se desliza. */
  const setMesaMode = useCallback((mode: MesaMode) => {
    const from = route.mode ?? 'model';
    // Diseño toma el modelo del modo del que llegas: el 2D o un eje del 3D.
    // Una intención más precisa (el diseño de una barra) ya puesta se respeta.
    if (mode === 'design' && from !== 'design' && !peekToolIntent('design')) setToolIntent({ tool: 'design', kind: from === '3d' ? 'model3d' : 'model' });
    runMesaTransition(from, mode, () => navigate(mode === 'model'
      ? { surface: 'workspace', projectId: route.projectId, tool: 'model2d' }
      : { surface: 'workspace', projectId: route.projectId, tool: 'model2d', mode }));
  }, [navigate, route.projectId, route.mode]);
  // Desde la Home, Diseño abre el taller en una viga suelta; el 3D, el modelo espacial.
  const openDesign = useCallback(() => { setToolIntent({ tool: 'design', kind: 'frame', element: 'beam' }); openWorkspace('design'); }, [openWorkspace]);
  const openSpace3D = useCallback(() => openWorkspace('3d'), [openWorkspace]);

  /* Desde la Home, la mesa se abre casi siempre: su código se descarga en
     segundo plano para que «Continuar» no espere a la red (en móvil eran segundos). */
  useEffect(() => {
    if (route.surface !== 'welcome') return;
    const preload = () => { void toolRegistry[0]?.load().catch(() => undefined); };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(preload, 600);
    return () => window.clearTimeout(handle);
  }, [route.surface]);

  /* En la mesa de FStructure, los otros dos modos se descargan cuando el
     navegador queda en reposo: el primer cambio de modo no espera a la red. */
  useEffect(() => {
    if (route.surface !== 'workspace' || route.tool !== 'model2d' || typeof window.requestIdleCallback !== 'function') return;
    const others = (['model', '3d', 'design'] as const).filter((mode) => mode !== (route.mode ?? 'model'));
    const handle = window.requestIdleCallback(() => { others.forEach((mode) => { void preloadMesaMode(mode); }); }, { timeout: 4000 });
    return () => window.cancelIdleCallback(handle);
  }, [route.surface, route.tool, route.mode]);

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

  /* La `key` garantiza que salir de la mesa desmonte todo lo suyo: ningún atajo,
     superficie, historial de interfaz ni estado de render sobrevive en la Home. */
  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    {route.surface === 'welcome'
      ? <HomePage key="home" onOpenWorkspace={() => openWorkspace()} onOpenSpace3D={openSpace3D} onOpenDesign={openDesign} />
      : route.mode === 'design' || route.mode === '3d'
        ? <MesaModeShell key="model2d-mesa" mode={route.mode} projectId={project.id} onOpenHome={openHome} onModeChange={setMesaMode} />
        : <WorkspaceShell key="model2d" projectId={project.id} onOpenHome={openHome} onModeChange={setMesaMode} />}
  </ClassroomSessionProvider>;
};

const App = () => <LazyMotion features={loadMotionFeatures} strict>
  <MotionConfig reducedMotion="user">
    <ProjectProvider unified><FStructureSurface /></ProjectProvider>
  </MotionConfig>
</LazyMotion>;

export default App;
