import { expect, it } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { buildPlanar2DToSpace3DHandoff } from '../../../integrations/planar2dToSpace3d';
import { UnifiedProjectSession } from '../../../storage/unifiedProjectSession';
import { InMemoryUnifiedBundleRepository } from '../../../storage/unifiedBundleRepository';
import { linkSpace3DToShell } from './space3dShellBridge';

it('persists a standalone import under its explicit shell project without mutating the imported model', async () => {
  const project = createDefaultProject();
  const model = { ...buildPlanar2DToSpace3DHandoff(project).candidateModel, id: 'standalone-import' };
  const session = new UnifiedProjectSession(new InMemoryUnifiedBundleRepository());
  const saved = await session.saveSpace3D(project, linkSpace3DToShell(project.id, 'v1', model));
  expect(saved.bundle.space3d?.model).toMatchObject({ id: `space3d:${project.id}`, nodes: model.nodes });
  expect(model.id).toBe('standalone-import');
  expect(saved.bundle.model2d.nodes).toEqual(project.nodes);
});
