import { useCallback, useEffect, useState } from 'react';
import './styles.css';
import './design-system/material.css';
import { ProjectProvider, useProject } from './store/ProjectContext';
import { ClassroomSessionProvider } from './store/ClassroomSessionContext';
import WorkspaceShell from './features/workspace/WorkspaceShell';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';

type AppSurface = 'welcome' | 'workspace2d';

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
      ? <WorkspaceShell projectId={project.id} onOpenHome={() => navigate('welcome')} />
      : <WelcomeScreen onOpenWorkspace={() => navigate('workspace2d')} />}
  </ClassroomSessionProvider>;
};

/** Standalone 2D product composition. */
const App = () => <ProjectProvider><FStructureSurface /></ProjectProvider>;

export default App;
