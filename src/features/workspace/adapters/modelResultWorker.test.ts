import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../../data/defaultProject';
import { model2dResultProviderWithWorker } from './modelResultWorker';

class DeferredWorker {
  static readonly instances: DeferredWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  posted: unknown;
  constructor() { DeferredWorker.instances.push(this); }
  postMessage(value: unknown) { this.posted = value; }
  terminate() { this.terminated = true; }
  reply(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
}

afterEach(() => { vi.unstubAllGlobals(); DeferredWorker.instances.length = 0; });

describe('proveedor de resultados en worker', () => {
  it('cancela y termina el worker al abortar, y rechaza una respuesta de revisión vencida', async () => {
    vi.stubGlobal('Worker', DeferredWorker);
    let currentRevision: string | null = 'revision-1';
    const provider = model2dResultProviderWithWorker(createBlankProject(), () => currentRevision);
    const request = { memberId: 'M1', targetId: 'LC1', xM: 0, side: 'right' as const };
    const controller = new AbortController();
    const canceled = provider.member(request, controller.signal);
    const worker = DeferredWorker.instances.at(-1)!;
    controller.abort();
    await expect(canceled).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);

    const stale = provider.member(request, new AbortController().signal);
    const staleWorker = DeferredWorker.instances.at(-1)!;
    currentRevision = 'revision-2';
    staleWorker.reply({ requestId: (staleWorker.posted as { requestId: number }).requestId, revision: provider.inventory.revision, result: {} });
    await expect(stale).rejects.toThrow(/cambió/);
    expect(staleWorker.terminated).toBe(true);
  });

  it('limita a seis solicitudes concurrentes y recupera cupo al cancelar', async () => {
    vi.stubGlobal('Worker', DeferredWorker);
    const provider = model2dResultProviderWithWorker(createBlankProject());
    const controllers = Array.from({ length: 6 }, () => new AbortController());
    const requests = controllers.map((controller) => provider.member({ memberId: 'M1', targetId: 'LC1', xM: 0, side: 'right' }, controller.signal).catch((error) => error));
    await expect(provider.member({ memberId: 'M1', targetId: 'LC1', xM: 0, side: 'right' }, new AbortController().signal)).rejects.toThrow(/seis/);
    controllers.forEach((controller) => controller.abort());
    await Promise.all(requests);
    const next = provider.member({ memberId: 'M1', targetId: 'LC1', xM: 0, side: 'right' }, new AbortController().signal);
    const worker = DeferredWorker.instances.at(-1)!;
    worker.reply({ requestId: (worker.posted as { requestId: number }).requestId, revision: provider.inventory.revision, result: { version: 1 } });
    await expect(next).resolves.toMatchObject({ version: 1 });
  });
});
