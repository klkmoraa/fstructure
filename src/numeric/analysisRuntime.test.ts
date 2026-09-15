import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AnalysisJobRequest, AnalysisQuality } from '../shared/contracts';
import {
  ANALYSIS_WORKER_PROTOCOL_VERSION,
  AdaptiveAnalysisJobRuntime,
  AnalysisJobCancelledError,
  AnalysisJobStaleError,
  type AnalysisWorkerLike,
  type AnalysisWorkerResponse,
} from './analysisRuntime';

interface Payload { readonly estimatedBytes: number }

const stableQuality: AnalysisQuality = {
  conditionEstimate: 12,
  linearResidual: 1e-14,
  equilibriumResidual: 2e-13,
  level: 'stable',
};

const request = (jobId: string, sourceVersion = 'source-v1'): AnalysisJobRequest<Payload> => ({
  jobId,
  tool: 'space3d',
  sourceVersion,
  targetId: 'model-a',
  budget: { maxEstimatedBytes: 1_000, softDeadlineMs: 30_000 },
  payload: { estimatedBytes: 400 },
});

class WorkerHarness implements AnalysisWorkerLike {
  readonly listeners = new Map<string, Set<(event: { data?: unknown; message?: string }) => void>>();
  readonly posted: unknown[] = [];
  terminated = false;

  postMessage(message: unknown): void { this.posted.push(message); }
  terminate(): void { this.terminated = true; }
  addEventListener(type: string, listener: (event: { data?: unknown; message?: string }) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: { data?: unknown; message?: string }) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  emit(message: AnalysisWorkerResponse<number>): void {
    for (const listener of this.listeners.get('message') ?? []) listener({ data: message });
  }
}

const response = (
  type: 'progress' | 'success',
  overrides: Partial<AnalysisWorkerResponse<number>> = {},
): AnalysisWorkerResponse<number> => ({
  protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
  type,
  jobId: 'job-1',
  sourceVersion: 'source-v1',
  targetId: 'model-a',
  ...(type === 'progress'
    ? { phase: 'factorization', completed: 2, total: 4 }
    : { result: 42, quality: stableQuality }),
  ...overrides,
} as AnalysisWorkerResponse<number>);

afterEach(() => vi.useRealTimers());

describe('adaptive analysis job runtime', () => {
  it('admits before creating the worker, reports phases and warns without cancelling at the soft deadline', async () => {
    vi.useFakeTimers();
    const deniedFactory = vi.fn(() => new WorkerHarness());
    const denied = new AdaptiveAnalysisJobRuntime<Payload, number>({
      createWorker: deniedFactory,
      estimateBytes: (payload) => payload.estimatedBytes,
      currentSourceVersion: () => 'source-v1',
    });
    const deniedRequest = { ...request('denied'), payload: { estimatedBytes: 1_001 } };
    await expect(denied.run(deniedRequest)).rejects.toMatchObject({ name: 'AnalysisAdmissionError' });
    expect(deniedFactory).not.toHaveBeenCalled();

    const worker = new WorkerHarness();
    const phases: string[] = [];
    let warnings = 0;
    const runtime = new AdaptiveAnalysisJobRuntime<Payload, number>({
      createWorker: () => worker,
      estimateBytes: (payload) => payload.estimatedBytes,
      currentSourceVersion: () => 'source-v1',
    });
    const pending = runtime.run(request('job-1'), {
      onProgress: (event) => phases.push(event.phase),
      onSoftDeadline: () => { warnings += 1; },
    });
    worker.emit(response('progress'));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(warnings).toBe(1);
    expect(worker.terminated).toBe(false);
    worker.emit(response('success'));

    await expect(pending).resolves.toMatchObject({ result: 42, quality: stableQuality });
    expect(phases).toEqual(['admission', 'factorization', 'complete']);
    expect(worker.terminated).toBe(true);
    expect(worker.listeners.get('message')?.size ?? 0).toBe(0);
  });

  it('cancels by terminating the worker and never publishes a late result', async () => {
    const worker = new WorkerHarness();
    const published: number[] = [];
    const runtime = new AdaptiveAnalysisJobRuntime<Payload, number>({
      createWorker: () => worker,
      estimateBytes: (payload) => payload.estimatedBytes,
      currentSourceVersion: () => 'source-v1',
    });
    const pending = runtime.run(request('job-1'), { onPublish: ({ result }) => published.push(result) });
    runtime.cancel();
    worker.emit(response('success'));

    await expect(pending).rejects.toBeInstanceOf(AnalysisJobCancelledError);
    expect(worker.terminated).toBe(true);
    expect(published).toEqual([]);
  });

  it('discards a successful response when its source version is no longer current', async () => {
    const worker = new WorkerHarness();
    let version = 'source-v1';
    const published: number[] = [];
    const runtime = new AdaptiveAnalysisJobRuntime<Payload, number>({
      createWorker: () => worker,
      estimateBytes: (payload) => payload.estimatedBytes,
      currentSourceVersion: () => version,
    });
    const pending = runtime.run(request('job-1'), { onPublish: ({ result }) => published.push(result) });
    version = 'source-v2';
    worker.emit(response('success'));

    await expect(pending).rejects.toBeInstanceOf(AnalysisJobStaleError);
    expect(published).toEqual([]);
    expect(worker.terminated).toBe(true);
  });
});
