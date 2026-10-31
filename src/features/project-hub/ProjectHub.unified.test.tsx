// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { createSpace3DPortalExample } from '../../modules/space3d/space3d/model/defaultProject';
import { createUnifiedProjectBundle, type JsonValue, type UnifiedProjectBundleV1 } from '../../shared/project/unifiedProjectBundle';
import { InMemoryProjectRepository } from '../../storage/projectRepository';
import { BundleConflictError, IndexedDbUnifiedBundleRepository } from '../../storage/unifiedBundleRepository';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import type { ProjectModel } from '../../types';
import { ProjectHub } from './ProjectHub';

/*
 * La Home real: la mesa unificada (sesión sobre IndexedDB) con el Hub dentro.
 * Renombrar, duplicar y restaurar tienen que llegar al bundle canónico, que es
 * lo que el autoguardado y la apertura leen después.
 */
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); });

const fullBundle = (project: ProjectModel): UnifiedProjectBundleV1 => {
  const bundle = createUnifiedProjectBundle(project, 'v1');
  bundle.space3d = {
    sourceProjectId: project.id, sourceVersion: 'v1',
    model: JSON.parse(JSON.stringify({ ...createSpace3DPortalExample(), id: `space3d:${project.id}` })) as JsonValue,
  };
  bundle.design = { kind: 'fstructure-design-workbench', schemaVersion: 8, entries: { element: 'beam', code: 'ntc-2023', beam: { b: '30', h: '60', fc: '25' } } };
  bundle.fem = [{ document: { id: 'estudio-1' }, nodes: 3 }];
  return bundle;
};

const Home = ({ mirror }: { mirror: InMemoryProjectRepository }) => {
  const { project, replaceProject } = useProject();
  return <><output aria-label="mesa">{project.name}</output>
    <ProjectHub repository={mirror} onOpen={(record) => replaceProject(record.project, undefined, record.revision)} /></>;
};

const seed = async () => {
  const repo = new IndexedDbUnifiedBundleRepository();
  const open = { ...createDefaultProject(), name: 'Abierto' };
  const other = { ...createDefaultProject(), name: 'Otro' };
  for (const project of [open, other]) {
    await repo.saveBundle(fullBundle(project), 0);
    await repo.setLibraryState([project.id], 'saved');
  }
  window.history.replaceState(null, '', `/?project=${open.id}`);
  return { repo, open, other, mirror: new InMemoryProjectRepository() };
};

const menu = async (user: ReturnType<typeof userEvent.setup>, name: string, action: string) => {
  await user.click(await screen.findByRole('button', { name: `Más acciones para ${name}` }));
  await user.click(screen.getByRole('button', { name: `${action} ${name}` }));
};

it('renombrar llega al bundle y sobrevive al autoguardado, abierto o no', async () => {
  const { repo, open, other, mirror } = await seed();
  const user = userEvent.setup();
  render(<ProjectProvider unified><Home mirror={mirror} /></ProjectProvider>);
  await waitFor(() => expect(screen.getByLabelText('mesa').textContent).toBe('Abierto'));

  await menu(user, 'Otro', 'Renombrar');
  await user.clear(screen.getByLabelText('Nuevo nombre del proyecto'));
  await user.type(screen.getByLabelText('Nuevo nombre del proyecto'), 'Otro renombrado');
  await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
  expect(await screen.findByText('Otro renombrado')).toBeTruthy();
  expect((await repo.openBundle(other.id))?.bundle.model2d.name).toBe('Otro renombrado');

  await menu(user, 'Abierto', 'Renombrar');
  await user.clear(screen.getByLabelText('Nuevo nombre del proyecto'));
  await user.type(screen.getByLabelText('Nuevo nombre del proyecto'), 'Abierto renombrado');
  await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
  await waitFor(async () => expect((await repo.openBundle(open.id))?.bundle.model2d.name).toBe('Abierto renombrado'));
  expect(screen.getByLabelText('mesa').textContent).toBe('Abierto renombrado');

  // Después de otro ciclo de autoguardado ninguno de los dos vuelve al nombre viejo.
  await new Promise((resolve) => window.setTimeout(resolve, 400));
  expect((await repo.openBundle(open.id))?.bundle.model2d.name).toBe('Abierto renombrado');
  expect((await repo.openBundle(other.id))?.bundle.model2d.name).toBe('Otro renombrado');
  expect((await repo.openBundle(open.id))?.bundle.fem).toHaveLength(1);
  expect((await repo.snapshot()).recoveries).toHaveLength(0);
});

it('duplicar copia el bundle entero con id nuevo', async () => {
  const { repo, other, mirror } = await seed();
  const user = userEvent.setup();
  render(<ProjectProvider unified><Home mirror={mirror} /></ProjectProvider>);
  await menu(user, 'Otro', 'Duplicar');
  expect(await screen.findByText('Copia de Otro')).toBeTruthy();
  const copy = (await repo.snapshot()).bundles.find((record) => record.bundle.model2d.name === 'Copia de Otro')!;
  expect(copy.id).not.toBe(other.id);
  expect(copy.bundle.space3d?.sourceProjectId).toBe(copy.id);
  expect(copy.bundle.design).toEqual(fullBundle(other).design);
  expect(copy.bundle.fem).toEqual(fullBundle(other).fem);
  expect(copy.libraryState).toBe('saved');
});

it('una recuperación de conflicto del bundle se lista, se restaura y sobrevive al siguiente autoguardado', async () => {
  const { repo, open, mirror } = await seed();
  const stale = fullBundle({ ...open, name: 'Edición rechazada' });
  await expect(repo.saveBundle(stale, 0)).rejects.toBeInstanceOf(BundleConflictError);
  const user = userEvent.setup();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ProjectProvider unified><Home mirror={mirror} /></ProjectProvider>);
  await waitFor(() => expect(screen.getByLabelText('mesa').textContent).toBe('Abierto'));

  const recoveries = await screen.findByRole('heading', { name: 'Copias recuperables (1)' });
  const card = recoveries.closest('details')!;
  expect(within(card).getByText(/Edición rechazada/)).toBeTruthy();
  await user.click(within(card).getByRole('button', { name: /Usar edición recuperada/ }));

  // La mesa reabre la versión restaurada desde el bundle…
  await waitFor(() => expect(screen.getByLabelText('mesa').textContent).toBe('Edición rechazada'));
  // …y su autoguardado ya no la pisa con la versión anterior.
  await new Promise((resolve) => window.setTimeout(resolve, 400));
  const after = (await repo.openBundle(open.id))!;
  expect(after.bundle.model2d.name).toBe('Edición rechazada');
  expect(after.bundle.space3d).not.toBeNull();
  const left = (await repo.snapshot()).recoveries;
  // La restaurada se consumió; la que reemplazó quedó como respaldo.
  expect(left.map((item) => [item.reason, item.bundle?.model2d.name])).toEqual([['manual', 'Abierto']]);
  expect((await mirror.openProject(open.id))?.name).toBe('Edición rechazada');
});
