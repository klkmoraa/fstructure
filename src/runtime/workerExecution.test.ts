import { afterEach, describe, expect, test, vi } from 'vitest';
import { WORKER_SILENCE_WATCHDOG_MS, startWorkerRequest } from './workerExecution';

class SilentWorker {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;

  postMessage = vi.fn();

  terminate = vi.fn(() => {
    this.terminated = true;
  });

  emitMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  emitError() {
    this.onerror?.({} as ErrorEvent);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('startWorkerRequest', () => {
  test('uses a worker response once and releases its watchdog and worker', () => {
    vi.useFakeTimers();
    const worker = new SilentWorker();
    const responses: string[] = [];

    startWorkerRequest({
      createWorker: () => worker as unknown as Worker,
      request: 'request',
      isExpectedResponse: () => true,
      onResponse: (response) => responses.push(response),
      runFallback: () => 'fallback',
      onFallbackError: () => undefined,
    }).start();

    worker.emitMessage('worker-result');

    expect(responses).toEqual(['worker-result']);
    expect(worker.terminate).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(WORKER_SILENCE_WATCHDOG_MS);
    expect(responses).toEqual(['worker-result']);
  });

  test('switches to the existing fallback after a worker error', async () => {
    vi.useFakeTimers();
    const worker = new SilentWorker();
    const responses: string[] = [];

    startWorkerRequest({
      createWorker: () => worker as unknown as Worker,
      request: 'request',
      isExpectedResponse: () => true,
      onResponse: (response) => responses.push(response),
      runFallback: () => 'fallback',
      onFallbackError: () => undefined,
    }).start();

    worker.emitError();
    await vi.advanceTimersByTimeAsync(0);

    expect(responses).toEqual(['fallback']);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  test('terminates a silent worker at the watchdog and recovers through fallback', async () => {
    vi.useFakeTimers();
    const worker = new SilentWorker();
    const responses: string[] = [];

    startWorkerRequest({
      createWorker: () => worker as unknown as Worker,
      request: 'request',
      isExpectedResponse: () => true,
      onResponse: (response) => responses.push(response),
      runFallback: () => 'fallback',
      onFallbackError: () => undefined,
    }).start();

    await vi.advanceTimersByTimeAsync(WORKER_SILENCE_WATCHDOG_MS);
    await vi.runAllTimersAsync();

    expect(responses).toEqual(['fallback']);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  test('ignores a late worker response after the fallback has started', async () => {
    vi.useFakeTimers();
    const worker = new SilentWorker();
    const responses: string[] = [];

    startWorkerRequest({
      createWorker: () => worker as unknown as Worker,
      request: 'request',
      isExpectedResponse: () => true,
      onResponse: (response) => responses.push(response),
      runFallback: () => 'fallback',
      onFallbackError: () => undefined,
    }).start();

    vi.advanceTimersByTime(WORKER_SILENCE_WATCHDOG_MS);
    worker.emitMessage('late-worker-result');
    await vi.runAllTimersAsync();

    expect(responses).toEqual(['fallback']);
  });

  test('accepts only one terminal worker event', () => {
    vi.useFakeTimers();
    const worker = new SilentWorker();
    const responses: string[] = [];

    startWorkerRequest({
      createWorker: () => worker as unknown as Worker,
      request: 'request',
      isExpectedResponse: () => true,
      onResponse: (response) => responses.push(response),
      runFallback: () => 'fallback',
      onFallbackError: () => undefined,
    }).start();

    worker.emitMessage('first');
    worker.emitMessage('second');
    worker.emitError();

    expect(responses).toEqual(['first']);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
