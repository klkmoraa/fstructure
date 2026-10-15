import { expect, it } from 'vitest';
import { createSingleWork } from '../../data/defaultProject';
import { createUnifiedProjectBundle } from '../../shared/project/unifiedProjectBundle';
import { InMemoryUnifiedBundleRepository } from '../../storage/unifiedBundleRepository';
import { UnifiedProjectSession } from '../../storage/unifiedProjectSession';
import { createProjectWorkbenchStorage } from '../design/workbench/workbenchStorage';
import { flushPendingWrites, registerPendingWrite } from './pendingWrites';

it('la copia lleva el cambio de Diseño aún en su espera de 600 ms', async () => {
  const repository = new InMemoryUnifiedBundleRepository();
  const project = createSingleWork('beam', 'Viga V-1');
  await repository.saveBundle(createUnifiedProjectBundle(project, 'v1'), 0);
  const session = new UnifiedProjectSession(repository);
  const opened = (await session.open(project.id))!;
  const storage = createProjectWorkbenchStorage(session.currentBundle(project.id)?.design, (document) => session.saveDesign(opened, document), 600);
  const unregister = registerPendingWrite(() => storage.flush());
  try {
    expect(storage.commitBatch!({ beam: { b: '35', h: '70' } }).accepted).toBe(true);
    expect(storage.saveState.pending).toBe(true);
    // Lo que hace «Convertir en proyecto completo» antes de copiar.
    await flushPendingWrites();
    const copy = await session.promoteToProject(project.id, 'Viga V-1 · proyecto', opened);
    expect((copy.bundle.design as { entries: Record<string, unknown> }).entries.beam).toEqual({ b: '35', h: '70' });
    expect(storage.saveState.pending).toBe(false);
  } finally {
    unregister();
    storage.dispose();
  }
});
