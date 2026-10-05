// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { handleAnalysisWorkerRequest, type AnalysisWorkerRequest } from '../../../engine/analysisWorkerProtocol';
import { steelTensionProject } from '../../../design/fixtures/steelTensionProject';
import { ModelSteelReview } from './ModelSteelReview';
import { analyzeSteelModel } from './modelSteelAnalysis';
vi.mock('../../../i18n/useI18n', () => ({ useI18n: () => ({ language: 'es' }) }));

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  postMessage(request: AnalysisWorkerRequest) {
    const clone = structuredClone(request);
    setTimeout(() => { if (!this.terminated) this.onmessage?.({ data: structuredClone(handleAnalysisWorkerRequest(clone)) } as MessageEvent); }, 0);
  }
  terminate() { this.terminated = true; }
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('abre la barra seleccionada, usa la combinación del modelo y vuelve a ella sin escribir datos', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const project = steelTensionProject(true), before = JSON.stringify(project), show = vi.fn();
  render(<ModelSteelReview project={project} focusMember="T1" onShowMembers={show} />);
  await waitFor(() => expect(screen.getByTestId('ntc-steel-design-card').dataset.status).toBe('incomplete'));
  expect((screen.getByLabelText('Barra de acero') as HTMLSelectElement).value).toBe('T1');
  fireEvent.click(screen.getByRole('button', { name: 'Ver en el Modelo' }));
  expect(show).toHaveBeenCalledWith(['T1']);
  expect(JSON.stringify(project)).toBe(before);
});

it('al cambiar de combinación descarta el cálculo anterior y muestra el bloqueo de procedencia', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const project = steelTensionProject();
  project.combinations.push({ id: 'S', name: 'Servicio', factors: { P: 1 } });
  render(<ModelSteelReview project={project} />);
  await waitFor(() => expect(screen.getByTestId('ntc-steel-design-card').dataset.status).toBe('incomplete'));
  fireEvent.change(screen.getByLabelText('Combinación del modelo'), { target: { value: 'S' } });
  expect(screen.queryByTestId('ntc-steel-design-card')).toBeNull();
  await waitFor(() => expect(screen.getByTestId('ntc-steel-design-card').dataset.status).toBe('unavailable'));
});

it('cancelar termina el worker y no devuelve un resultado caducado', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const controller = new AbortController();
  const pending = analyzeSteelModel(steelTensionProject(), 'U', controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});

it('guarda y reabre sólo la selección; recalcula la demanda del modelo vigente', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const { createProjectWorkbenchStorage, WorkbenchStorageContext } = await import('../../design/workbench/workbenchStorage');
  const persist = vi.fn();
  const storage = createProjectWorkbenchStorage(undefined, persist);
  const project = steelTensionProject();
  const view = render(<WorkbenchStorageContext.Provider value={storage}><ModelSteelReview project={project} focusMember="T1" /></WorkbenchStorageContext.Provider>);
  await waitFor(() => expect((screen.getByRole('button', { name: 'Guardar revisión de acero' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión de acero' }));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión de acero' }));
  storage.flush();
  const document = persist.mock.calls[0]![0];
  expect(document.schemaVersion).toBe(6);
  expect(document.entries['steel-memory']).toEqual([{ memberId: 'T1', combinationId: 'U', savedAt: expect.any(String) }]);
  view.unmount(); storage.dispose();
  const reopened = createProjectWorkbenchStorage(document, () => undefined);
  project.nodalLoads[0]!.fx = 200;
  render(<WorkbenchStorageContext.Provider value={reopened}><ModelSteelReview project={project} /></WorkbenchStorageContext.Provider>);
  fireEvent.click(screen.getByText(/Memoria de acero/));
  fireEvent.click(screen.getByRole('button', { name: /T1 ·/ }));
  await waitFor(() => expect(screen.getByTestId('ntc-steel-design-card').textContent).toContain('200'));
  expect((screen.getByLabelText('Barra de acero') as HTMLSelectElement).value).toBe('T1');
  reopened.dispose();
});

it('una referencia guardada ausente bloquea el PDF y nunca cambia a todas las barras', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const { createProjectWorkbenchStorage, WorkbenchStorageContext, WORKBENCH_DOCUMENT_KIND } = await import('../../design/workbench/workbenchStorage');
  const storage = createProjectWorkbenchStorage({ kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 6, entries: { 'steel-memory': [{ memberId: 'eliminada', combinationId: 'U', savedAt: '2026-10-04' }, { memberId: 'T1', combinationId: 'eliminada', savedAt: '2026-10-04' }] } }, () => undefined);
  render(<WorkbenchStorageContext.Provider value={storage}><ModelSteelReview project={steelTensionProject()} /></WorkbenchStorageContext.Provider>);
  fireEvent.click(screen.getByText(/Memoria de acero/));
  expect((screen.getByRole('button', { name: /T1 · eliminada/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /^eliminada ·/ }));
  expect(screen.getByRole('alert').textContent).toContain('ya no es');
  expect((screen.getByRole('button', { name: 'PDF de acero' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('Barra de acero') as HTMLSelectElement).value).toBe('eliminada');
  storage.dispose();
});
