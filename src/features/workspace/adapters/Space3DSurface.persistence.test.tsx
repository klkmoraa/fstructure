// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { ProjectProvider } from '../../../store/ProjectContext';
import { useProjectModel } from '../../../store/ProjectModelContext';
import { useSharedToolState } from '../../../store/SharedToolState';
import { createDefaultProject } from '../../../data/defaultProject';
import { createUnifiedProjectBundle } from '../../../shared/project/unifiedProjectBundle';
import { IndexedDbUnifiedBundleRepository } from '../../../storage/unifiedBundleRepository';
import type { UnifiedProjectSession } from '../../../storage/unifiedProjectSession';
import { buildPlanar2DToSpace3DHandoff } from '../../../integrations/planar2dToSpace3d';
import { parseSpace3DDraft } from '../../../modules/space3d/space3d/data/codec';
import { translate } from '../../../modules/space3d/i18n/catalogs';
import { ShellToolSlotsProvider, ShellSlotHost } from '../ShellToolSlots';
import { linkSpace3DToShell } from './space3dShellBridge';
import Space3DSurface from './Space3DSurface';

// Only WebGL is unavailable in jsdom; model commands, React providers and IndexedDB are real.
vi.mock('../../../modules/space3d/space3d/view/threeViewport', async (original) => ({
  ...await original<typeof import('../../../modules/space3d/space3d/view/threeViewport')>(),
  createSpace3DViewport: () => { throw new Error('WebGL unavailable'); },
}));
const t = (key: Parameters<typeof translate>[1]) => translate('es', key);
let session: UnifiedProjectSession;
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); localStorage.clear(); window.history.replaceState(null, '', '/?project=A&tool=space3d'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Harness() {
  const model = useProjectModel();
  session = useSharedToolState()!.session!;
  const [visible, setVisible] = useState(true);
  return <ShellToolSlotsProvider mobile={false}>
    <header data-testid="persistent-shell">Shell</header>
    <output aria-label="Open project">{model.project.id}</output>
    <p data-testid="storage-notice">{model.storageMessage}</p>
    <button onClick={() => { void model.openUnifiedProject!('B'); }}>Open B</button>
    <button onClick={() => setVisible((value) => !value)}>Switch tool</button>
    <ShellSlotHost slot="controls" /><ShellSlotHost slot="action" /><ShellSlotHost slot="status" /><ShellSlotHost slot="inspector" />
    {visible ? <Space3DSurface /> : <p>Other tool</p>}
  </ShellToolSlotsProvider>;
}
async function seed(id: string, x: number, stale = false) {
  const repo = new IndexedDbUnifiedBundleRepository();
  const project = { ...createDefaultProject(), id };
  const candidate = buildPlanar2DToSpace3DHandoff(project).candidateModel;
  const model = { ...candidate, nodes: candidate.nodes.map((node, i) => i ? node : { ...node, x }) };
  const bundle = createUnifiedProjectBundle(project, `${id}-current`);
  bundle.space3d = linkSpace3DToShell(id, stale ? `${id}-old` : `${id}-current`, model);
  await repo.saveBundle(bundle, 0);
  return { repo, project, model };
}
async function start() {
  render(<StrictMode><ProjectProvider unified><Harness /></ProjectProvider></StrictMode>);
  await screen.findByRole('button', { name: t('space3d.newNode') });
  // Settle the pre-existing 2D compatibility autosave before counting 3D writes.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 320)); });
}
async function addNode() {
  await userEvent.click(screen.getByRole('button', { name: t('space3d.newNode') }));
  await userEvent.click(screen.getByRole('button', { name: t('space3d.saveNode') }));
}
const storedModel = (model: unknown) => parseSpace3DDraft(JSON.stringify(model));

it('changes project identity inside 3D without carrying A state or history into B', async () => {
  const a = await seed('A', 17);
  const b = await seed('B', 29);
  await start();
  const shell = screen.getByTestId('persistent-shell');
  await userEvent.click(screen.getByRole('button', { name: 'Open B' }));
  await waitFor(() => expect(screen.getByLabelText('Open project').textContent).toBe('B'));
  await addNode();
  await act(() => session.open('B'));
  const savedB = (await b.repo.openBundle('B'))!;
  expect(storedModel(savedB.bundle.space3d!.model).nodes).toEqual([
    ...b.model.nodes, expect.objectContaining({ id: `N${b.model.nodes.length + 1}` }),
  ]);
  expect(savedB.bundle.space3d!.sourceVersion).toBe('B-current');
  expect(storedModel((await a.repo.openBundle('A'))!.bundle.space3d!.model)).toEqual(a.model);
  expect(screen.getByTestId('persistent-shell')).toBe(shell);
});

it('reopens the pending 3D edit and never queues the older committed branch over it', async () => {
  const { repo, model } = await seed('A', 17);
  await start();
  const before = (await repo.openBundle('A'))!.revision;
  const originalSave = session.repository.saveBundle.bind(session.repository);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.spyOn(session.repository, 'saveBundle').mockImplementationOnce(async (...args) => { await gate; return originalSave(...args); });
  await addNode();
  await userEvent.click(screen.getByRole('button', { name: 'Switch tool' }));
  await userEvent.click(screen.getByRole('button', { name: 'Switch tool' }));
  // The real model summary reflects the unsaved node before the transaction can finish.
  const displayedCount = screen.getByRole('button', { name: new RegExp(`^${t('space3d.nodes')}`) }).textContent;
  await act(async () => { release(); await session.open('A'); });
  expect(displayedCount).toBe(`${t('space3d.nodes')}${model.nodes.length + 1}`);
  const after = (await repo.openBundle('A'))!;
  expect(storedModel(after.bundle.space3d!.model).nodes).toHaveLength(model.nodes.length + 1);
  expect(after.revision).toBe(before + 1);
});

it('abre aislado: sin rama 3D no deriva el modelo del 2D ni lo menciona', async () => {
  const repo = new IndexedDbUnifiedBundleRepository();
  const project = { ...createDefaultProject(), id: 'A' };
  await repo.saveBundle(createUnifiedProjectBundle(project, 'A-current'), 0);
  await start();
  expect(project.nodes.length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: new RegExp(`^${t('space3d.nodes')}`) }).textContent).toBe(`${t('space3d.nodes')}0`);
  expect(screen.queryByText(/2D/)).toBeNull();
  expect(screen.queryByRole('button', { name: t('space3d.rederive') })).toBeNull();
  await addNode();
  await act(() => session.open('A'));
  const saved = (await repo.openBundle('A'))!.bundle.space3d!;
  expect(storedModel(saved.model).nodes).toHaveLength(1);
  expect(saved.sourceModel2D).toBeUndefined();
});
