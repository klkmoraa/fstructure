import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DesignWorkbench } from '../../design/workbench/DesignWorkbench';
import { browserWorkbenchStorage, createProjectWorkbenchStorage, WorkbenchStorageContext } from '../../design/workbench/workbenchStorage';
import { ProjectModelContext } from '../../../store/ProjectModelContext';
import { useSharedToolState } from '../../../store/SharedToolState';
import { peekToolIntent, takeToolIntent } from '../toolIntent';

/**
 * Superficie Diseño: los borradores del taller se guardan en la rama `design`
 * del bundle del proyecto abierto; sin sesión de proyecto, en el navegador.
 */
export default function DesignSurface() {
  const project = useContext(ProjectModelContext)?.project ?? null;
  const session = useSharedToolState()?.session ?? null;
  const latestProject = useRef(project);
  const [intent] = useState(() => peekToolIntent('design'));
  useEffect(() => { takeToolIntent('design'); }, []);
  useEffect(() => { latestProject.current = project; }, [project]);
  const projectId = project?.id ?? null;
  const storage = useMemo(() => {
    if (!session || !projectId) return null;
    return createProjectWorkbenchStorage(session.currentBundle(projectId)?.design, (document) => {
      const current = latestProject.current;
      // El estado de guardado del proyecto (barra de estado) informa cualquier fallo.
      if (current) void session.saveDesign(current, document).catch(() => undefined);
    });
  }, [session, projectId]);
  useEffect(() => () => storage?.dispose(), [storage]);
  return <WorkbenchStorageContext.Provider value={storage ?? browserWorkbenchStorage}>
    <DesignWorkbench key={projectId ?? 'local'} startElement={intent?.element} startCode={intent?.code} />
  </WorkbenchStorageContext.Provider>;
}
