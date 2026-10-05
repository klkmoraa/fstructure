import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { model2dDesignSource } from '../../../integrations/model2dDesign';
import { DesignWorkbench } from '../../design/workbench/DesignWorkbench';
import { browserWorkbenchStorage, createProjectWorkbenchStorage, WorkbenchStorageContext } from '../../design/workbench/workbenchStorage';
import { ProjectModelContext } from '../../../store/ProjectModelContext';
import { useSharedToolState } from '../../../store/SharedToolState';
import { peekToolIntent, takeToolIntent } from '../toolIntent';
import { useToolNavigation } from '../toolNavigation';

/**
 * Superficie Diseño: los borradores del taller se guardan en la rama `design`
 * del bundle del proyecto abierto; sin sesión de proyecto, en el navegador.
 *
 * Como frontera de la app, también traduce el Modelo 2D del proyecto con el
 * puente declarado (`src/integrations/model2dDesign`) y se lo entrega al taller
 * como un contrato de Diseño: el taller nunca importa ni lee el modelo.
 */
export default function DesignSurface() {
  const project = useContext(ProjectModelContext)?.project ?? null;
  const session = useSharedToolState()?.session ?? null;
  const latestProject = useRef(project);
  const [intent] = useState(() => peekToolIntent('design'));
  useEffect(() => { takeToolIntent('design'); }, []);
  useEffect(() => { latestProject.current = project; }, [project]);
  const projectId = project?.id ?? null;
  const openTool = useToolNavigation();
  const modelSource = useMemo(() => project ? model2dDesignSource(project) : null, [project]);
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
    <DesignWorkbench key={projectId ?? 'local'} startElement={intent?.element} startCode={intent?.code} startSource={intent?.source} projectName={project?.name}
      modelSource={modelSource} onOpenModel={openTool ? () => openTool('model2d') : undefined} />
  </WorkbenchStorageContext.Provider>;
}
