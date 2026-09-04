import './styles.css';
import { ProjectProvider, useProject } from './store/ProjectContext';
import WorkspaceShell from './features/workspace/WorkspaceShell';

const FStructureSurface = () => {
  const { project } = useProject();
  return (
    <WorkspaceShell
      projectId={project.id}
      onOpenHome={() => { window.location.hash = '#home'; }}
      onOpenSpace3D={() => { window.location.assign('https://github.com/klkmoraa/fusionstructure-space3d'); }}
    />
  );
};

/** Standalone 2D product composition. 3D is reached through an external link. */
const App = () => <ProjectProvider><FStructureSurface /></ProjectProvider>;

export default App;
