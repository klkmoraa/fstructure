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
