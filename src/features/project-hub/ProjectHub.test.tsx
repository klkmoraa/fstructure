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
  await user.click(await screen.findByRole('button', { name: 'Guardar Viga A' }));
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

const seed = async (entries: [string, string, 'saved' | 'draft'][]) => {
  const mirror = new InMemoryProjectRepository();
  const bundles = new InMemoryUnifiedBundleRepository();
  for (const [id, name, state] of entries) {
    const project = { ...createDefaultProject(), id, name };
    await mirror.saveProject(project);
    await bundles.saveBundle(createUnifiedProjectBundle(project, id), 0);
    await bundles.setLibraryState([id], state);
  }
  return { mirror, bundles };
};

it('distingue primer uso, cero coincidencias y error', async () => {
  const empty = await seed([]);
  render(<ProjectProvider><ProjectHub repository={empty.mirror} bundleRepository={empty.bundles} onOpen={() => undefined} /></ProjectProvider>);
  expect(await screen.findByText(/Todavía no hay proyectos guardados/)).toBeTruthy();
  expect(screen.queryByText('Ningún proyecto coincide con el filtro.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
  cleanup();

  const broken = new InMemoryProjectRepository();
  vi.spyOn(broken, 'listLibrary').mockRejectedValue(new Error('IndexedDB no disponible'));
  render(<ProjectProvider><ProjectHub repository={broken} bundleRepository={empty.bundles} onOpen={() => undefined} /></ProjectProvider>);
  expect((await screen.findByRole('alert')).textContent).toMatch(/No pudimos abrir tus proyectos/);
  // Un error no se presenta como biblioteca vacía.
  expect(screen.queryByText(/Todavía no hay proyectos guardados/)).toBeNull();
});

it('sin coincidencias ofrece «Limpiar filtros», que restaura la lista y la búsqueda con un toque', async () => {
  const { mirror, bundles } = await seed([['a', 'Viga A', 'saved'], ['b', 'Marco B', 'draft']]);
  const user = userEvent.setup();
  const onClearFilter = vi.fn();
  const view = render(<ProjectProvider><ProjectHub repository={mirror} bundleRepository={bundles} filter="zzz" onClearFilter={onClearFilter} onOpen={() => undefined} /></ProjectProvider>);
  expect(await screen.findByText('Ningún proyecto coincide con el filtro.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(onClearFilter).toHaveBeenCalledTimes(1);
  view.rerender(<ProjectProvider><ProjectHub repository={mirror} bundleRepository={bundles} filter="" onClearFilter={onClearFilter} onOpen={() => undefined} /></ProjectProvider>);
  // Vuelve a «Todos»: la lista completa, con el borrador incluido.
  expect(await screen.findByText('Viga A')).toBeTruthy();
  expect(screen.getByText('Marco B')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Todos/ }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();

  // Un tipo sin coincidencias también es un filtro: no hay «Individuales».
  await user.click(screen.getByRole('button', { name: 'Individuales' }));
  expect(screen.getByText('Ningún proyecto coincide con el filtro.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(screen.getByText('Viga A')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Todo' }).getAttribute('aria-pressed')).toBe('true');
});

it('en Recientes, sin guardados no habla de filtros', async () => {
  const { mirror, bundles } = await seed([['b', 'Marco B', 'draft']]);
  render(<ProjectProvider><ProjectHub variant="recent" limit={4} repository={mirror} bundleRepository={bundles} onOpen={() => undefined} /></ProjectProvider>);
  expect(await screen.findByText(/Todavía no hay proyectos guardados/)).toBeTruthy();
  expect(screen.queryByText('Ningún proyecto coincide con el filtro.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
});
