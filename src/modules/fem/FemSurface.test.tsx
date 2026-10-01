// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { ShellSlotHost, ShellToolSlotsProvider } from '../../features/workspace/ShellToolSlots';
import { IndexedDbUnifiedBundleRepository } from '../../storage/unifiedBundleRepository';
import { FemSurface, readStoredFemStudy } from './FemSurface';
import { analyzeFemDocument, createTri3PatchFixture } from './public';
import type { JsonValue } from '../../shared/project/unifiedProjectBundle';

const gmsh = `$MeshFormat\n4.1 0 8\n$EndMeshFormat\n$Nodes\n1 3 1 3\n2 1 0 3\n1\n2\n3\n0 0 0 1 0 0 0 1 0\n$EndNodes\n$Elements\n1 1 1 1\n2 1 2 1\n1 1 2 3\n$EndElements\n`;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});
afterEach(cleanup);

it('recupera el documento aunque el resultado guardado esté incompleto o pertenezca a otro estudio', () => {
  const document = createTri3PatchFixture();
  const analysis = analyzeFemDocument(document);
  const study = (result: unknown) => JSON.parse(JSON.stringify({ document, analysis: result })) as JsonValue;
  expect(readStoredFemStudy([study({ success: true })])).toEqual({ document, analysis: null });
  expect(readStoredFemStudy([study({ ...analysis, documentId: 'otro-estudio' })])).toEqual({ document, analysis: null });
  expect(readStoredFemStudy([study(analysis)])).toEqual({ document, analysis });
});

const renderSurface = () => {
  const project = createDefaultProject();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  render(<ProjectProvider unified><ShellToolSlotsProvider mobile={false}>
    <ShellSlotHost slot="action" />
    <ShellSlotHost slot="status" />
    <ShellSlotHost slot="inspector" />
    <FemSurface />
  </ShellToolSlotsProvider></ProjectProvider>);
  return project;
};

it('imports Gmsh into the unified project and restores the FEM study after remount', async () => {
  const user = userEvent.setup();
  const project = renderSurface();
  await screen.findByRole('heading', { name: 'Elementos finitos' });

  await user.upload(screen.getByLabelText('Importar Gmsh 4.1'), new File([gmsh], 'mesh.msh', { type: 'text/plain' }));
  expect((await screen.findAllByText(/Gmsh 4\.1 importado: 3 nodos · 1 elementos/)).length).toBeGreaterThan(0);
  const repository = new IndexedDbUnifiedBundleRepository();
  await waitFor(async () => expect((await repository.openBundle(project.id))?.bundle.fem).toHaveLength(1));
  const importedStudy = (await repository.openBundle(project.id))?.bundle.fem[0];
  expect(importedStudy).toMatchObject({ document: { id: 'gmsh-import' } });
  expect((importedStudy as unknown as { document: { nodes: readonly { id: string }[] } }).document.nodes[0]).toMatchObject({ id: '1' });

  await user.click(screen.getByRole('button', { name: 'Analizar FEM' }));
  await screen.findByTestId('fem-analysis-result');
  await waitFor(async () => expect((await repository.openBundle(project.id))?.bundle.fem[0]).toMatchObject({ analysis: { success: false } }));

  cleanup();
  render(<ProjectProvider unified><ShellToolSlotsProvider mobile={false}>
    <ShellSlotHost slot="action" /><ShellSlotHost slot="status" /><ShellSlotHost slot="inspector" />
    <FemSurface />
  </ShellToolSlotsProvider></ProjectProvider>);
  expect(await screen.findByText('3 nodos · 1 elementos')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Exportar FEM JSON' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Exportar VTK' })).toBeTruthy();
});

it('exposes local JSON and VTK export actions without requiring a remote service', async () => {
  const user = userEvent.setup();
  renderSurface();
  await screen.findByRole('heading', { name: 'Elementos finitos' });

  await user.click(screen.getByRole('button', { name: 'Exportar FEM JSON' }));
  expect(screen.getByRole('button', { name: 'Exportar FEM JSON' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Exportar VTK' }));
  expect(screen.getByRole('button', { name: 'Exportar VTK' })).toBeTruthy();
});

it('permite consultar la malla y los campos del análisis del estudio actual', async () => {
  const user = userEvent.setup();
  renderSurface();
  await screen.findByRole('heading', { name: 'Elementos finitos' });
  await user.click(screen.getByRole('tab', { name: 'Malla' }));
  expect(screen.getByRole('img', { name: /Malla de/ })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Analizar FEM' }));
  const results = await screen.findByRole('tabpanel', { name: 'Resultados' });
  const stresses = within(results).getByRole('table', { name: /Tensiones por elemento/ });
  expect(within(stresses).getByRole('cell', { name: 'E1' })).toBeTruthy();
  const displacements = within(results).getByRole('table', { name: /Desplazamientos por nudo/ });
  expect(within(displacements).getByRole('cell', { name: '2' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Resultados' }).getAttribute('aria-selected')).toBe('true');
});

it('una importación inválida conserva el estudio y sus resultados consultables', async () => {
  const user = userEvent.setup();
  const project = renderSurface();
  await screen.findByRole('heading', { name: 'Elementos finitos' });
  await user.click(screen.getByRole('button', { name: 'Analizar FEM' }));
  await screen.findByTestId('fem-analysis-result');
  const repository = new IndexedDbUnifiedBundleRepository();
  await waitFor(async () => expect((await repository.openBundle(project.id))?.bundle.fem[0]).toMatchObject({ analysis: { success: true } }));
  await user.upload(screen.getByLabelText('Importar Gmsh 4.1'), new File(['invalid mesh'], 'invalid.msh', { type: 'text/plain' }));
  expect((await screen.findAllByText(/No se pudo importar/)).length).toBeGreaterThan(0);
  expect((await repository.openBundle(project.id))?.bundle.fem[0]).toMatchObject({ document: { id: 'fem-tri3-patch' }, analysis: { success: true } });
  expect(screen.getByRole('table', { name: /Tensiones por elemento/ })).toBeTruthy();
});
