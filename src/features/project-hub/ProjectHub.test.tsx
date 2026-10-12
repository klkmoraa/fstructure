// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createBlankProject, createDefaultProject } from '../../data/defaultProject';
import { createUnifiedProjectBundle } from '../../shared/project/unifiedProjectBundle';
import { InMemoryProjectRepository } from '../../storage/projectRepository';
import { InMemoryUnifiedBundleRepository } from '../../storage/unifiedBundleRepository';
import { ProjectProvider } from '../../store/ProjectContext';
import { ProjectHub } from './ProjectHub';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

it('lets the user keep a chosen draft and delete the other selected drafts with one confirmation', async () => {
  const mirror = new InMemoryProjectRepository();
  const bundles = new InMemoryUnifiedBundleRepository();
  for (const [id, name] of [['a', 'Viga A'], ['b', 'Viga B'], ['c', 'Viga C']]) {
    const project = { ...createDefaultProject(), id, name };
    await mirror.saveProject(project);
    await bundles.saveBundle(createUnifiedProjectBundle(project, id), 0);
  }
  const empty = createBlankProject();
  await bundles.saveBundle(createUnifiedProjectBundle(empty, 'empty'), 0);
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ProjectProvider><ProjectHub repository={mirror} bundleRepository={bundles} onOpen={() => undefined} /></ProjectProvider>);
  await user.click(await screen.findByRole('button', { name: /Borradores/ }));
  expect(screen.queryByRole('checkbox', { name: 'Seleccionar Proyecto sin título' })).toBeNull();
  expect(await bundles.openBundle(empty.id)).not.toBeNull();
  await user.click(screen.getByRole('button', { name: 'Guardar Viga A' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardar Viga A' })).toBeNull());
  await user.click(screen.getByRole('checkbox', { name: 'Seleccionar Viga B' }));
  await user.click(screen.getByRole('checkbox', { name: 'Seleccionar Viga C' }));
  await user.click(screen.getByRole('button', { name: 'Eliminar seleccionados (2)' }));
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Seleccionar Viga B' })).toBeNull());
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(await bundles.openBundle('b')).toBeNull();
  expect(await mirror.openProject('b')).toBeNull();
  expect((await bundles.openBundle('a'))?.libraryState).toBe('saved');
  await user.click(screen.getByRole('button', { name: /Guardados/ }));
  expect(await screen.findByText('Viga A')).toBeTruthy();
});
