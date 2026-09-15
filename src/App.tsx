import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import './styles.css';
import './design-system/material.css';
import { ProjectProvider, useProject } from './store/ProjectContext';
import { ClassroomSessionProvider } from './store/ClassroomSessionContext';
import WorkspaceShell from './features/workspace/WorkspaceShell';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';
import { FemSurface } from './modules/fem/FemSurface';
import { buildPlanar2DToSpace3DHandoff } from './integrations/planar2dToSpace3d';

const Space3DWorkspace = lazy(() => import('./modules/space3d/features/space3d/Space3DWorkspace'));
type AppSurface = 'welcome' | 'workspace2d';
const LEGACY_WORKSPACE_SURFACES = new Set(['design', 'workspace3d', 'fem']);

const loadMotionFeatures = () => import('./design-system/motionFeatures')
  .then(({ default: features }) => features);

const readSurface = (): AppSurface => {
  const value = new URLSearchParams(window.location.search).get('surface');
  if (value === 'workspace2d' || LEGACY_WORKSPACE_SURFACES.has(value ?? '')) return 'workspace2d';
  return 'welcome';
};

const canonicalizeSurfaceUrl = (surface: AppSurface): void => {
  const url = new URL(window.location.href);
  if (url.searchParams.get('surface') === surface && !url.hash) return;
  url.searchParams.set('surface', surface);
  url.hash = '';
  window.history.replaceState(null, '', url);
};

const FStructureSurface = () => {
  const { project, analysis } = useProject();
  const [surface, setSurface] = useState<AppSurface>(readSurface);
  const surfaceRef = useRef(surface);
  const navigate = useCallback((next: AppSurface) => {
    if (surfaceRef.current === next) return;
    const url = new URL(window.location.href);
    url.searchParams.set('surface', next);
    url.hash = '';
    window.history.pushState(null, '', url);
    surfaceRef.current = next;
    setSurface(next);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const next = readSurface();
      canonicalizeSurfaceUrl(next);
      surfaceRef.current = next;
      setSurface(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handoff = useMemo(() => buildPlanar2DToSpace3DHandoff(project), [project]);

  useEffect(() => {
    const canonicalSurface = readSurface();
    canonicalizeSurfaceUrl(canonicalSurface);
  }, []);

  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    {surface === 'welcome'
      ? <WelcomeScreen onOpenWorkspace={() => navigate('workspace2d')} />
      : <WorkspaceShell
          projectId={project.id}
          space3dContent={<Suspense fallback={<div className="workspace-loading" role="status">Cargando módulo…</div>}>
            <Space3DWorkspace
              language={project.settings.language}
              embedded
              handoff={handoff}
            />
          </Suspense>}
          femContent={<FemSurface />}
          onOpenHome={() => navigate('welcome')}
        />}
  </ClassroomSessionProvider>;
};

const App = () => <LazyMotion features={loadMotionFeatures} strict>
  <MotionConfig reducedMotion="user">
    <ProjectProvider><FStructureSurface /></ProjectProvider>
  </MotionConfig>
</LazyMotion>;

export default App;
