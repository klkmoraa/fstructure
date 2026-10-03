import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { withConcreteFrame, type ConcreteFrameSpec } from '../../../data/concreteFrame';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { DesignWorkbench } from '../../design/workbench/DesignWorkbench';
import { browserWorkbenchStorage, createProjectWorkbenchStorage, WorkbenchStorageContext } from '../../design/workbench/workbenchStorage';
import { ProjectModelContext } from '../../../store/ProjectModelContext';
import { useSharedToolState } from '../../../store/SharedToolState';

/**
 * Modo Diseño de FStructure: los borradores del taller se guardan en la rama
 * `design` del bundle del proyecto abierto (la misma de siempre, así nada
 * guardado se pierde); sin sesión de proyecto, en el navegador.
 *
 * El taller recibe el Modelo 2D del proyecto ya traducido a su contrato
 * (`model2dDesignSource`), y «Abrir el Modelo 2D» vuelve al modo Modelo.
 */
export default function DesignSurface({ onOpenModel }: { onOpenModel?: () => void }) {
  const projectModel = useContext(ProjectModelContext);
  const project = projectModel?.project ?? null;
  const updateProject = projectModel?.updateProject;
  // Un solo cambio del historial: «Deshacer» en Modelo devuelve el modelo anterior.
  const createModel = useCallback((spec: ConcreteFrameSpec) => updateProject?.((current) => withConcreteFrame(current, spec)), [updateProject]);
  const session = useSharedToolState()?.session ?? null;
  const latestProject = useRef(project);
  useEffect(() => { latestProject.current = project; }, [project]);
  const projectId = project?.id ?? null;
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
    <DesignWorkbench key={projectId ?? 'local'} projectName={project?.name} modelSource={modelSource} {...(onOpenModel ? { onOpenModel } : {})}
      {...(updateProject ? { onCreateModel: createModel } : {})} />
  </WorkbenchStorageContext.Provider>;
}
