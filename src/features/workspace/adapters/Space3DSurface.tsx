import { useCallback, useMemo, useRef, useState } from 'react';
import { useProjectModel } from '../../../store/ProjectModelContext';
import { buildPlanar2DToSpace3DHandoff } from '../../../integrations/planar2dToSpace3d';
import Space3DWorkspace from '../../../modules/space3d/features/space3d/Space3DWorkspace';
import { useSharedToolState } from '../../../store/SharedToolState';
import { parseSpace3DDraft } from '../../../modules/space3d/space3d/data/codec';
import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';
import { ShellContribution } from '../ShellToolSlots';
import { linkSpace3DToShell } from './space3dShellBridge';
import type { ProjectModel } from '../../../types';
import type { UnifiedProjectSession } from '../../../storage/unifiedProjectSession';

// Embedded legacy provider receives a non-persistent storage boundary. The session owns writes.
const embeddedStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

export default function Space3DSurface() {
  const { project } = useProjectModel();
  const session = useSharedToolState()?.session;
  return <ProjectSpace3D key={project.id} project={project} session={session} />;
}

function ProjectSpace3D({ project, session }: { project: ProjectModel; session?: UnifiedProjectSession | null }) {
  const [failure, setFailure] = useState<string | null>(null);
  const handoff = useMemo(() => buildPlanar2DToSpace3DHandoff(project), [project]);
  const [branch] = useState(() => session?.currentBundle(project.id)?.space3d ?? null);
  const [sourceVersion, setSourceVersion] = useState(() => branch?.sourceVersion ?? session?.currentBundle(project.id)?.manifest.sourceVersion ?? crypto.randomUUID());
  const lineage = useRef(sourceVersion);
  const stale = Boolean(branch && sourceVersion !== session?.currentBundle(project.id)?.manifest.sourceVersion);
  const canonicalProject = useMemo(() => branch ? parseSpace3DDraft(JSON.stringify(branch.model)) : undefined, [branch]);
  const save = useCallback((model: Space3DProjectV1) => {
    if (!session) { setFailure('Almacenamiento unificado no disponible; cambios 3D sólo en memoria.'); return; }
    // The session publishes failures to the persistent shell, even after this adapter unmounts.
    void session.saveSpace3D(project, linkSpace3DToShell(project.id, lineage.current, model)).catch(() => undefined);
  }, [session, project]);
  const rederive = useCallback(async () => {
    if (!session) return;
    let source = session.currentBundle(project.id);
    // An explicit re-derive may beat the 2D debounce; establish its exact source version first.
    if (!source || JSON.stringify(source.model2d) !== JSON.stringify(project)) {
      source = (await session.save2D(project)).bundle;
    }
    lineage.current = source.manifest.sourceVersion;
    setSourceVersion(lineage.current);
  }, [session, project]);
  return <>
    {stale ? <ShellContribution slot="inspector"><p role="status">El modelo 2D cambió desde esta derivación. La rama 3D conserva su versión de origen; revisa las diferencias antes de sincronizar.</p></ShellContribution> : null}
    {failure ? <ShellContribution slot="status"><span role="status">{failure}</span></ShellContribution> : null}
    <Space3DWorkspace language={project.settings.language} embedded handoff={handoff} storage={embeddedStorage}
      canonicalProject={canonicalProject} onProjectChange={save} onRederive={rederive} />
  </>;
}
