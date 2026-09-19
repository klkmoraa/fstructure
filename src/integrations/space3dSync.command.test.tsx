// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../data/projectStorage';
import { ProjectProvider, useProjectModel } from '../store/ProjectContext';
import { buildPlanar2DToSpace3DHandoff } from './planar2dToSpace3d';
import { prepareSpace3DSyncReview } from './space3dSync';

const source = { ...createDefaultProject(), id: 'sync-history' };
const candidate = buildPlanar2DToSpace3DHandoff(source).candidateModel;
const edited = {
  ...candidate,
  nodes: candidate.nodes.map((node) => node.id === 'N2' ? { ...node, y: 2 } : node),
  members: candidate.members.map((member) => member.id === 'M1' ? { ...member, E: member.E + 100 } : member),
};
const staleReview = prepareSpace3DSyncReview(source, source, edited);
const approved = staleReview.patches.filter((patch) => patch.compatibility !== 'unsupported').map((patch) => patch.patchId);

function Harness() {
  const { project, executeApprovedSpace3DSync, updateProject, undo, redo } = useProjectModel();
  const [error, setError] = useState('none');
  const values = useMemo(() => ({
    y: project.nodes.find((node) => node.id === 'N2')?.y,
    E: project.members.find((member) => member.id === 'M1')?.E,
  }), [project]);
  return <>
    <output aria-label="values">{values.y}/{values.E}</output>
    <output aria-label="error">{error}</output>
    <button onClick={() => void executeApprovedSpace3DSync(staleReview, approved)}>Aplicar revisión</button>
    <button onClick={undo}>Deshacer</button>
    <button onClick={redo}>Rehacer</button>
    <button onClick={() => updateProject((draft) => ({ ...draft, nodes: draft.nodes.map((node) => node.id === 'N2' ? { ...node, y: 99 } : node) }))}>Divergir</button>
    <button onClick={() => { void executeApprovedSpace3DSync(staleReview, approved).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason))); }}>Aplicar obsoleto</button>
  </>;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(source));
});
afterEach(cleanup);

it('aplica el lote aprobado como un solo undo/redo y rechaza uno obsoleto sin parcialidad', async () => {
  const user = userEvent.setup();
  render(<ProjectProvider><Harness /></ProjectProvider>);
  const initialE = source.members.find((member) => member.id === 'M1')!.E;

  await user.click(screen.getByRole('button', { name: 'Aplicar revisión' }));
  expect(screen.getByLabelText('values').textContent).toBe(`2/${initialE + 100}`);
  await user.click(screen.getByRole('button', { name: 'Deshacer' }));
  expect(screen.getByLabelText('values').textContent).toBe(`0/${initialE}`);
  await user.click(screen.getByRole('button', { name: 'Rehacer' }));
  expect(screen.getByLabelText('values').textContent).toBe(`2/${initialE + 100}`);

  await user.click(screen.getByRole('button', { name: 'Deshacer' }));
  await user.click(screen.getByRole('button', { name: 'Divergir' }));
  await user.click(screen.getByRole('button', { name: 'Aplicar obsoleto' }));
  expect(screen.getByLabelText('error').textContent).toMatch(/precondición/i);
  expect(screen.getByLabelText('values').textContent).toBe(`99/${initialE}`);
});
