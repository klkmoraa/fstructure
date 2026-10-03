import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { withConcreteFrame, type ConcreteFrameSpec } from '../../../data/concreteFrame';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { parseSpace3DDraft } from '../../../modules/space3d/space3d/data/codec';
import { space3dDesignAxes } from '../../../integrations/space3dDesign';
import { peekToolIntent, setToolIntent, takeToolIntent } from '../toolIntent';
import { DesignWorkbench } from '../../design/workbench/DesignWorkbench';
import { browserWorkbenchStorage, createProjectWorkbenchStorage, WorkbenchStorageContext } from '../../design/workbench/workbenchStorage';
import { ProjectModelContext } from '../../../store/ProjectModelContext';
import { useSharedToolState } from '../../../store/SharedToolState';

/**
 * Modo Diseño de FStructure: los borradores del taller se guardan en la rama
 * `design` del bundle del proyecto abierto (la misma de siempre, así nada
 * guardado se pierde); sin sesión de proyecto, en el navegador.
 *
 * El taller recibe los modelos del proyecto ya traducidos a su contrato: el
 * Modelo 2D (`model2dDesignSource`) y los ejes del Modelo 3D guardado en la
 * rama `space3d` (puente `src/integrations/space3dDesign`). Al llegar desde el
 * modo 2D o 3D, Estructura diseña con ese modelo. «Editar» vuelve al modo.
 */
export default function DesignSurface({ onOpenModel, onOpenSpace3D }: { onOpenModel?: () => void; onOpenSpace3D?: () => void }) {
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
  // El modelo 3D se lee al entrar al modo (se edita en el modo 3D, que guarda en la sesión).
  const space3d = useMemo(() => {
    const branch = session && projectId ? session.currentBundle(projectId)?.space3d : null;
    if (!branch) return null;
    try { return parseSpace3DDraft(JSON.stringify(branch.model)); } catch { return null; }
  }, [session, projectId]);
  const modelAxes = useMemo(() => space3d && space3d.members.length ? space3dDesignAxes(space3d) : null, [space3d]);
  const [startSource] = useState(() => peekToolIntent('design')?.kind);
  // «Editar en 3D» desde un eje abre el modo 3D en el alzado de ese eje.
  const openSpace3D = useMemo(() => onOpenSpace3D ? (axisId?: string) => {
    const axis = axisId ? modelAxes?.axes.find((item) => item.id === axisId) : undefined;
    if (axis?.short) setToolIntent({ tool: 'space3d', kind: 'view', view: `elev-${axis.direction}:${axis.short}` });
    onOpenSpace3D();
  } : undefined, [onOpenSpace3D, modelAxes]);
  useEffect(() => { takeToolIntent('design'); }, []);
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
    <DesignWorkbench key={projectId ?? 'local'} projectName={project?.name} modelSource={modelSource} modelAxes={modelAxes}
      {...(startSource ? { startSource } : {})} {...(onOpenModel ? { onOpenModel } : {})} {...(openSpace3D ? { onOpenSpace3D: openSpace3D } : {})}
      {...(updateProject ? { onCreateModel: createModel } : {})} />
  </WorkbenchStorageContext.Provider>;
}
