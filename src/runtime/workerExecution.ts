/**
 * A silent worker has no browser error event, so every one-shot structural
 * analysis gets a bounded watchdog. Sixty seconds leaves room for large
 * interactive models while ensuring the UI can recover from a stuck worker.
 */
export const WORKER_SILENCE_WATCHDOG_MS = 60_000;

export interface WorkerRequestExecution {
  start: () => void;
  cancel: () => void;
}

interface WorkerRequestOptions<Request, Response> {
  createWorker: () => Worker;
  request: Request;
  isExpectedResponse: (response: Response) => boolean;
  onResponse: (response: Response) => void;
  runFallback: () => Response | Promise<Response>;
  onFallbackError: (error: unknown) => void;
  onCancelled?: () => void;
  watchdogMs?: number;
}

/**
 * Runs one request in a disposable worker. Once the worker fails or goes
 * silent, it is detached and terminated before the existing fallback starts;
 * later events therefore cannot race the fallback result.
 */
export const startWorkerRequest = <Request, Response>(options: WorkerRequestOptions<Request, Response>): WorkerRequestExecution => {
  let worker: Worker | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let state: 'pending' | 'fallback' | 'finished' | 'cancelled' = 'pending';

  const releaseWorker = () => {
    if (watchdog !== null) {
      clearTimeout(watchdog);
      watchdog = null;
    }
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    worker = null;
  };

  const startFallback = () => {
    if (state !== 'pending') return;
    state = 'fallback';
    releaseWorker();
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      if (state !== 'fallback') return;
      Promise.resolve()
        .then(options.runFallback)
        .then((response) => {
          if (state !== 'fallback') return;
          state = 'finished';
          options.onResponse(response);
        })
        .catch((error: unknown) => {
          if (state !== 'fallback') return;
          state = 'finished';
          options.onFallbackError(error);
        });
    }, 0);
  };

  const finishFromWorker = (response: Response) => {
    if (state !== 'pending') return;
    let expected = false;
    try {
      expected = options.isExpectedResponse(response);
    } catch {
      // A malformed message is not a result. The watchdog remains armed.
    }
    if (!expected) return;
    state = 'finished';
    releaseWorker();
    options.onResponse(response);
  };

  return {
    start: () => {
      if (state !== 'pending') return;
      try {
        worker = options.createWorker();
        worker.onmessage = (event: MessageEvent<Response>) => finishFromWorker(event.data);
        worker.onerror = startFallback;
        worker.onmessageerror = startFallback;
        watchdog = setTimeout(startFallback, options.watchdogMs ?? WORKER_SILENCE_WATCHDOG_MS);
        worker.postMessage(options.request);
      } catch {
        startFallback();
      }
    },
    cancel: () => {
      if (state === 'cancelled' || state === 'finished') return;
      state = 'cancelled';
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      releaseWorker();
      options.onCancelled?.();
    },
  };
};
