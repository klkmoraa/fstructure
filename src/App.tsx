import './styles.css';
import './design-system/material.css';
import { ProjectProvider, useProject } from './store/ProjectContext';
import { ClassroomSessionProvider } from './store/ClassroomSessionContext';
import WorkspaceShell from './features/workspace/WorkspaceShell';

const FStructureSurface = () => {
  const { project, analysis } = useProject();
  return <ClassroomSessionProvider projectId={project.id} analysisAvailable={analysis?.success === true}>
    <WorkspaceShell projectId={project.id} onOpenHome={() => { window.location.hash = '#home'; }} />
  </ClassroomSessionProvider>;
};

/** Standalone 2D product composition. */
const App = () => <ProjectProvider><FStructureSurface /></ProjectProvider>;

export default App;
