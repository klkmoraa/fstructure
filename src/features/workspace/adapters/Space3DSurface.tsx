import { useMemo } from 'react';
import { useProjectModel } from '../../../store/ProjectModelContext';
import { buildPlanar2DToSpace3DHandoff } from '../../../integrations/planar2dToSpace3d';
import Space3DWorkspace from '../../../modules/space3d/features/space3d/Space3DWorkspace';

export default function Space3DSurface() {
  const { project } = useProjectModel();
  const handoff = useMemo(() => buildPlanar2DToSpace3DHandoff(project), [project]);
  return <Space3DWorkspace language={project.settings.language} embedded handoff={handoff} />;
}
