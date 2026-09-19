// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ProjectProvider, useProject } from './ProjectContext';
import { IndexedDbUnifiedBundleRepository } from '../storage/unifiedBundleRepository';
import { createDefaultProject } from '../data/defaultProject';
import { createUnifiedProjectBundle } from '../shared/project/unifiedProjectBundle';
import { PROJECT_STORAGE_KEY, PROJECT_BACKUP_KEY, PROJECT_RECOVERY_KEY } from '../data/projectStorage';
import { useSharedToolState } from './SharedToolState';

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); localStorage.clear(); window.history.replaceState(null, '', '/'); });
afterEach(cleanup);
function Probe() {
  const { project, renameProject, replaceProject, storageMessage } = useProject();
  return <><output>{project.name}</output><button onClick={() => renameProject('Edited canonical')}>Edit</button>
    <button onClick={() => replaceProject({ ...project, name: 'Stale mirror' }, undefined, 1)}>Open mirror</button><p>{storageMessage}</p></>;
}
it('hydrates canonical project, autosaves into its bundle and preserves every legacy byte', async () => {
  const project = createDefaultProject();
  const repo = new IndexedDbUnifiedBundleRepository();
  const bundle = createUnifiedProjectBundle({ ...project, name: 'Canonical' }, 'v1');
  bundle.design = { note: 'retain' }; bundle.fem = [{ note: 'retain' }];
  await repo.saveBundle(bundle, 0);
  const raw = '  ' + JSON.stringify(project, null, 2) + '\n';
  localStorage.setItem(PROJECT_STORAGE_KEY, raw);
  localStorage.setItem(PROJECT_BACKUP_KEY, raw);
  localStorage.setItem(PROJECT_RECOVERY_KEY, 'original recovery bytes');
  render(<ProjectProvider unified><Probe /></ProjectProvider>);
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Canonical'));
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await waitFor(async () => expect((await repo.openBundle(project.id))?.bundle.model2d.name).toBe('Edited canonical'));
  expect((await repo.openBundle(project.id))?.bundle.design).toEqual({ note: 'retain' });
  expect((await repo.openBundle(project.id))?.bundle.fem).toEqual([{ note: 'retain' }]);
  expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(raw);
  expect(localStorage.getItem(PROJECT_BACKUP_KEY)).toBe(raw);
  expect(localStorage.getItem(PROJECT_RECOVERY_KEY)).toBe('original recovery bytes');
  await userEvent.click(screen.getByRole('button', { name: 'Open mirror' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Edited canonical'));
});

it('surfaces a cross-client conflict and preserves the remote canonical and rejected recovery', async () => {
  const project = createDefaultProject();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  const repo = new IndexedDbUnifiedBundleRepository();
  render(<ProjectProvider unified><Probe /></ProjectProvider>);
  await screen.findByRole('button', { name: 'Edit' });
  await waitFor(async () => expect((await repo.openBundle(project.id))?.revision).toBe(2));
  const remote = (await repo.openBundle(project.id))!;
  remote.bundle.model2d.name = 'Remote wins';
  await repo.saveBundle(remote.bundle, remote.revision);
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(await screen.findByText(/rejected edit is available in recovery/)).toBeTruthy();
  expect((await repo.openBundle(project.id))?.bundle.model2d.name).toBe('Remote wins');
  expect((await repo.snapshot()).recoveries.at(-1)?.bundle?.model2d.name).toBe('Edited canonical');
});

it('shows corrupt canonical record diagnostics without changing original source bytes', async () => {
  const project = createDefaultProject();
  const raw = JSON.stringify(project);
  localStorage.setItem(PROJECT_STORAGE_KEY, raw);
  const repo = new IndexedDbUnifiedBundleRepository();
  const record = await repo.saveBundle(createUnifiedProjectBundle(project, 'v1'), 0);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('structureCo.unified-bundles', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('bundles', 'readwrite');
      tx.objectStore('bundles').put({ ...record, checksum: 'corrupt' });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
  render(<ProjectProvider unified><Probe /></ProjectProvider>);
  expect(await screen.findByText(/integrity failure/)).toBeTruthy();
  expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(raw);
  expect((await repo.snapshot()).integrityDiagnostics).toHaveLength(1);
});

it('publishes a solver snapshot and shared selection without allowing 3D selection to edit 2D', async () => {
  const project = createDefaultProject();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  function SnapshotProbe() {
    const model = useProject();
    const shared = useSharedToolState()!;
    return <>
      <button onClick={() => model.setSelection({ kind: 'node', id: 'N1' })}>Select 2D</button>
      <button onClick={() => shared.publish3DSelection([{ projectId: model.project.id, tool: 'space3d', kind: 'member', id: 'M2' }])}>Select 3D</button>
      <button onClick={model.analyze}>Solve</button>
      <button onClick={() => model.updateProject((draft) => ({ ...draft, nodes: draft.nodes.map((node) => ({ ...node, x: node.x * 2 })) }))}>Change source</button>
      <output aria-label="Shared 2D">{shared.selection2d[0]?.id}</output>
      <output aria-label="Shared 3D">{shared.selection3d[0]?.id}</output>
      <output aria-label="Snapshot">{shared.snapshot?.sourceVersion ?? 'none'}</output>
    </>;
  }
  render(<ProjectProvider unified><SnapshotProbe /></ProjectProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Select 2D' }));
  await userEvent.click(screen.getByRole('button', { name: 'Select 3D' }));
  expect(screen.getByLabelText('Shared 2D').textContent).toBe('N1');
  expect(screen.getByLabelText('Shared 3D').textContent).toBe('M2');
  await userEvent.click(screen.getByRole('button', { name: 'Solve' }));
  await waitFor(() => expect(screen.getByLabelText('Snapshot').textContent).not.toBe('none'));
  await userEvent.click(screen.getByRole('button', { name: 'Change source' }));
  expect(screen.getByLabelText('Snapshot').textContent).toBe('none');
});
