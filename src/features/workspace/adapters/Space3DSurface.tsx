import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProjectModel } from '../../../store/ProjectModelContext';
import Space3DWorkspace from '../../../modules/space3d/features/space3d/Space3DWorkspace';
import { useSharedToolState } from '../../../store/SharedToolState';
import { parseSpace3DDraft } from '../../../modules/space3d/space3d/data/codec';
import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';
import { createBlankSpace3DProject } from '../../../modules/space3d/space3d/model/defaultProject';
import { ShellContribution } from '../ShellToolSlots';
import { linkSpace3DToShell } from './space3dShellBridge';
import { peekToolIntent, takeToolIntent } from '../toolIntent';
import type { ProjectModel } from '../../../types';
import type { UnifiedProjectSession } from '../../../storage/unifiedProjectSession';

// Embedded legacy provider receives a non-persistent storage boundary. The session owns writes.
const embeddedStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

/**
 * Solver 3D aislado.
 *
 * El modelo espacial es trabajo propio de esta herramienta: no se deriva del
 * Modelo 2D ni muestra avisos sobre él. Se guarda en la rama `space3d` del
 * proyecto y, si no existe, la herramienta abre vacía con su propio arranque.
 */
export default function Space3DSurface() {
  const { project } = useProjectModel();
  const session = useSharedToolState()?.session;
  return <ProjectSpace3D key={project.id} project={project} session={session} />;
}

function ProjectSpace3D({ project, session }: { project: ProjectModel; session?: UnifiedProjectSession | null }) {
  const [failure, setFailure] = useState<string | null>(null);
  // Se lee sin consumir durante el render (StrictMode lo repite) y se consume al montar.
  const [startIntent] = useState(() => peekToolIntent('space3d')?.kind);
  useEffect(() => { takeToolIntent('space3d'); }, []);
  const [branch] = useState(() => session?.currentBundle(project.id)?.space3d ?? null);
  const [sourceVersion] = useState(() => branch?.sourceVersion ?? crypto.randomUUID());
  const canonicalProject = useMemo(() => branch ? parseSpace3DDraft(JSON.stringify(branch.model)) : createBlankSpace3DProject(), [branch]);
  const save = useCallback((model: Space3DProjectV1) => {
    if (!session) { setFailure('Almacenamiento no disponible; los cambios 3D viven sólo en memoria.'); return; }
    // The session publishes failures to the persistent shell, even after this adapter unmounts.
    void session.saveSpace3D(project, linkSpace3DToShell(project.id, sourceVersion, model)).catch(() => undefined);
  }, [session, project, sourceVersion]);
  return <>
    {failure ? <ShellContribution slot="status"><span role="status">{failure}</span></ShellContribution> : null}
    <Space3DWorkspace language={project.settings.language} embedded storage={embeddedStorage}
      canonicalProject={canonicalProject} onProjectChange={save} startIntent={startIntent} />
  </>;
}
