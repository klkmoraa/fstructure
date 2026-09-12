import { lazy, useCallback, useEffect, useState, Suspense } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import './styles.css';
import './design-system/material.css';
import { ProjectProvider, useProject } from './store/ProjectContext';
import { ClassroomSessionProvider } from './store/ClassroomSessionContext';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';

let WorkspaceShell = lazy(() => import('./features/workspace/WorkspaceShell'));

if (import.meta.env.MODE === 'test') {
  const testModule = await import('./features/workspace/WorkspaceShell');
  WorkspaceShell = testModule.default as unknown as typeof WorkspaceShell;
}

type AppSurface = 'welcome' | 'workspace2d';

const loadMotionFeatures = () => import('./design-system/motionFeatures')
  .then(({ default: features }) => features);

const readSurface = (): AppSurface => new URLSearchParams(window.location.search).get('surface') === 'workspace2d'
  ? 'workspace2d'
  : 'welcome';

const FStructureSurface = () => {
  const { project, analysis } = useProject();
  const [surface, setSurface] = useState<AppSurface>(readSurface);

  const navigate = useCallback((next: AppSurface, replace = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set('surface', next);
    url.hash = next === 'welcome' ? 'fusion-top' : 'fusion-flow';
    window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
    setSurface(next);
  }, []);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('surface')) navigate('welcome', true);
    const onPopState = () => setSurface(readSurface());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [navigate]);

  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    {surface === 'workspace2d'
      ? <Suspense fallback={<div className="workspace-loading" role="status" aria-live="polite" />}><WorkspaceShell projectId={project.id} onOpenHome={() => navigate('welcome')} /></Suspense>
      : <WelcomeScreen onOpenWorkspace={() => navigate('workspace2d')} />}
  </ClassroomSessionProvider>;
};

/** Standalone 2D product composition. */
const App = () => <LazyMotion features={loadMotionFeatures} strict>
  <MotionConfig reducedMotion="user">
    <ProjectProvider><FStructureSurface /></ProjectProvider>
  </MotionConfig>
</LazyMotion>;

export default App;
