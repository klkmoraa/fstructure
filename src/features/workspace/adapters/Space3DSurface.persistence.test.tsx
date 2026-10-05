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
import { createSpace3DPortalExample } from '../../../modules/space3d/space3d/model/defaultProject';
import { parseSpace3DDraft } from '../../../modules/space3d/space3d/data/codec';
import { translate } from '../../../modules/space3d/i18n/catalogs';
import { ShellToolSlotsProvider, ShellSlotHost } from '../ShellToolSlots';
import { linkSpace3DToShell } from './space3dShellBridge';
import Space3DSurface from './Space3DSurface';
import { setToolIntent } from '../toolIntent';
import { withSpace3dSections } from '../../../integrations/space3dSections';
import { space3dFromModel2d } from '../../../integrations/model2dSpace3d';
import { createConcreteFrameProject } from '../../../data/defaultProject';

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
  const candidate = createSpace3DPortalExample();
  const model = { ...candidate, id: `space3d:${id}`, nodes: candidate.nodes.map((node, i) => i ? node : { ...node, x }) };
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

it('abre aislado: sin rama 3D no deriva el modelo del 2D; traerlo es una acción explícita', async () => {
  const repo = new IndexedDbUnifiedBundleRepository();
  const project = { ...createDefaultProject(), id: 'A' };
  await repo.saveBundle(createUnifiedProjectBundle(project, 'A-current'), 0);
  await start();
  expect(project.nodes.length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: new RegExp(`^${t('space3d.nodes')}`) }).textContent).toBe(`${t('space3d.nodes')}0`);
  // La única mención del 2D es el botón «Traer del 2D».
  expect(screen.getAllByText(/2D/).every((element) => element.closest('button')?.getAttribute('aria-label') === 'Traer el Modelo 2D al 3D')).toBe(true);
  expect(screen.queryByRole('button', { name: /derivar/i })).toBeNull();
  await addNode();
  await act(() => session.open('A'));
  const saved = (await repo.openBundle('A'))!.bundle.space3d!;
  expect(storedModel(saved.model).nodes).toHaveLength(1);
  expect(saved.sourceModel2D).toBeUndefined();
});

it('«Traer del 2D» reemplaza el 3D con confirmación, se guarda en la rama 3D y se deshace', async () => {
  const { repo, model } = await seed('A', 17);
  await start();
  const two = { ...createDefaultProject() };
  await userEvent.click(screen.getByRole('button', { name: 'Traer el Modelo 2D al 3D' }));
  const frames = screen.getByRole('textbox', { name: 'Pórticos' });
  await userEvent.clear(frames);
  await userEvent.type(frames, '2');
  await userEvent.click(screen.getByRole('button', { name: 'Traer al 3D' }));
  // Había un modelo 3D: se pide confirmación antes de reemplazarlo.
  await userEvent.click(await screen.findByRole('button', { name: t('space3d.confirmReplaceConfirm') }));
  const count = () => screen.getByRole('button', { name: new RegExp(`^${t('space3d.nodes')}`) }).textContent;
  await waitFor(() => expect(count()).toBe(`${t('space3d.nodes')}${two.nodes.length * 2}`));
  await act(() => session.open('A'));
  const saved = (await repo.openBundle('A'))!.bundle;
  expect(storedModel(saved.space3d!.model).nodes).toHaveLength(two.nodes.length * 2);
  expect(storedModel(saved.space3d!.model).id).toBe('space3d:A');
  // El Modelo 2D no cambia.
  expect(saved.model2d.nodes).toHaveLength(two.nodes.length);
  await userEvent.click(screen.getByRole('button', { name: t('space3d.undo') }));
  await waitFor(() => expect(count()).toBe(`${t('space3d.nodes')}${model.nodes.length}`));
});


it('aplica las secciones del Diseño como un paso deshacible, guarda y reabre sin perder el original', async () => {
  const repo = new IndexedDbUnifiedBundleRepository();
  const project = { ...createConcreteFrameProject(), id: 'A' };
  const model = { ...space3dFromModel2d(project, { frames: 1, spacingM: 0 }).model!, id: 'space3d:A' };
  const bundle = createUnifiedProjectBundle(project, 'A-current');
  bundle.space3d = linkSpace3DToShell('A', 'A-current', model);
  await repo.saveBundle(bundle, 0);
  setToolIntent({ tool: 'space3d', kind: 'view', view: '3d', sections: { beam: {width:35,height:55}, column: {width:45,height:45}, sourceModel: JSON.stringify(storedModel(model)) } });
  await start();
  await act(() => session.open('A'));
  expect(storedModel((await repo.openBundle('A'))!.bundle.space3d!.model)).toEqual(storedModel(withSpace3dSections(model, {beam:{widthMm:350,heightMm:550},column:{widthMm:450,heightMm:450}})));
  await userEvent.click(screen.getByRole('button', {name:'Switch tool'}));
  await userEvent.click(screen.getByRole('button', {name:'Switch tool'}));
  await userEvent.click(screen.getByRole('button', {name:t('space3d.undo')}));
  await act(() => session.open('A'));
  expect(storedModel((await repo.openBundle('A'))!.bundle.space3d!.model)).toEqual(model);
  await userEvent.click(screen.getByRole('button', {name:'Switch tool'}));
  await userEvent.click(screen.getByRole('button', {name:'Switch tool'}));
  await act(() => session.open('A'));
  expect(storedModel((await repo.openBundle('A'))!.bundle.space3d!.model)).toEqual(model);
  await userEvent.click(screen.getByRole('button', {name:t('space3d.redo')}));
  await act(() => session.open('A'));
  expect(storedModel((await repo.openBundle('A'))!.bundle.space3d!.model)).toEqual(storedModel(withSpace3dSections(model, {beam:{widthMm:350,heightMm:550},column:{widthMm:450,heightMm:450}})));
});
