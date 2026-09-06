import './styles.css';
import './design-system/material.css';
import { ProjectProvider, useProject } from './store/ProjectContext';
import WorkspaceShell from './features/workspace/WorkspaceShell';

const FStructureSurface = () => {
  const { project } = useProject();
  return <WorkspaceShell projectId={project.id} onOpenHome={() => { window.location.hash = '#home'; }} />;
};

/** Standalone 2D product composition. */
const App = () => <ProjectProvider><FStructureSurface /></ProjectProvider>;

export default App;
