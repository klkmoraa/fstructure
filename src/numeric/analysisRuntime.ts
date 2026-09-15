import type { AnalysisJobRequest, AnalysisQuality } from '../shared/contracts';
import { assessAnalysisAdmission } from './admission';

export const ANALYSIS_WORKER_PROTOCOL_VERSION = 1 as const;

export type AnalysisPhase = 'admission' | 'assembly' | 'factorization' | 'solve' | 'quality' | 'complete';

export interface AnalysisProgressEvent {
  readonly phase: AnalysisPhase;
  readonly completed: number;
  readonly total: number;
}

export interface AnalysisWorkerRunRequest<TPayload> {
  readonly protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  readonly type: 'run';
  readonly request: AnalysisJobRequest<TPayload>;
}

interface AnalysisWorkerIdentity {
  readonly protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION;
  readonly jobId: string;
  readonly sourceVersion: string;
  readonly targetId: string;
}

export type AnalysisWorkerResponse<TResult> =
  | (AnalysisWorkerIdentity & { readonly type: 'progress' } & AnalysisProgressEvent)
  | (AnalysisWorkerIdentity & {
    readonly type: 'success';
    readonly result: TResult;
    readonly quality: AnalysisQuality;
  })
  | (AnalysisWorkerIdentity & {
    readonly type: 'error';
    readonly code: string;
    readonly message: string;
  });

export interface AnalysisWorkerEvent {
  readonly data?: unknown;
  readonly message?: string;
}

export interface AnalysisWorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(type: string, listener: (event: AnalysisWorkerEvent) => void): void;
  removeEventListener(type: string, listener: (event: AnalysisWorkerEvent) => void): void;
}

export interface CompletedAnalysisJob<TResult> {
  readonly jobId: string;
  readonly sourceVersion: string;
  readonly targetId: string;
  readonly result: TResult;
  readonly quality: AnalysisQuality;
}

export interface AnalysisRunCallbacks<TResult> {
  readonly onProgress?: (event: AnalysisProgressEvent) => void;
  readonly onSoftDeadline?: (request: AnalysisJobRequest<unknown>) => void;
  readonly onPublish?: (result: CompletedAnalysisJob<TResult>) => void;
}

export class AnalysisAdmissionError extends Error {
  readonly estimatedBytes: number;
  readonly availableBytes: number;

  constructor(estimatedBytes: number, availableBytes: number) {
    super(`Analysis requires an estimated ${estimatedBytes} bytes; the device budget is ${availableBytes} bytes.`);
    this.name = 'AnalysisAdmissionError';
    this.estimatedBytes = estimatedBytes;
    this.availableBytes = availableBytes;
  }
}

export class AnalysisJobCancelledError extends Error {
  constructor() {
    super('Analysis job was cancelled.');
    this.name = 'AnalysisJobCancelledError';
  }
}

export class AnalysisJobStaleError extends Error {
  constructor() {
    super('Analysis result belongs to an obsolete source version.');
    this.name = 'AnalysisJobStaleError';
  }
}

export class AnalysisWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'AnalysisWorkerError';
    this.code = code;
  }
}

interface ActiveJob<TResult> {
  readonly request: AnalysisJobRequest<unknown>;
  readonly worker: AnalysisWorkerLike;
  readonly callbacks: AnalysisRunCallbacks<TResult>;
  readonly resolve: (result: CompletedAnalysisJob<TResult>) => void;
  readonly reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
  readonly detach: () => void;
}

export interface AdaptiveAnalysisJobRuntimeOptions<TPayload> {
  readonly createWorker: () => AnalysisWorkerLike;
  readonly validatePayload?: (payload: TPayload) => void;
  readonly estimateBytes: (payload: TPayload) => number;
  readonly currentSourceVersion: (targetId: string) => string | undefined;
}

const isFiniteAnalysisQuality = (quality: unknown): quality is AnalysisQuality => {
  if (typeof quality !== 'object' || quality === null) return false;
  const candidate = quality as Partial<AnalysisQuality>;
  return [candidate.conditionEstimate, candidate.linearResidual, candidate.equilibriumResidual]
    .every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    && ['stable', 'limited', 'unreliable', 'failed'].includes(String(candidate.level));
};

export class AdaptiveAnalysisJobRuntime<TPayload, TResult> {
  private readonly options: AdaptiveAnalysisJobRuntimeOptions<TPayload>;
  private active: ActiveJob<TResult> | null = null;
  private disposed = false;
  private lifecycleVersion = 0;

  constructor(options: AdaptiveAnalysisJobRuntimeOptions<TPayload>) {
    this.options = options;
  }

  run(
    request: AnalysisJobRequest<TPayload>,
    callbacks: AnalysisRunCallbacks<TResult> = {},
  ): Promise<CompletedAnalysisJob<TResult>> {
    if (this.disposed) return Promise.reject(new AnalysisJobCancelledError());
    let estimatedBytes: number;
    try {
      this.options.validatePayload?.(request.payload);
      estimatedBytes = this.options.estimateBytes(request.payload);
    } catch (cause) {
      return Promise.reject(cause instanceof Error ? cause : new Error('Analysis payload validation failed.'));
    }
    const admission = assessAnalysisAdmission(estimatedBytes, request.budget);
    if (!admission.accepted) {
      return Promise.reject(new AnalysisAdmissionError(admission.estimatedBytes, admission.availableBytes));
    }
    let currentSourceVersion: string | undefined;
    try {
      currentSourceVersion = this.options.currentSourceVersion(request.targetId);
    } catch (cause) {
      return Promise.reject(new AnalysisWorkerError(
        'SOURCE_VERSION_FAILURE',
        cause instanceof Error ? cause.message : 'Current source version could not be read.',
      ));
    }
    if (currentSourceVersion !== request.sourceVersion) {
      return Promise.reject(new AnalysisJobStaleError());
    }

    const lifecycleVersion = ++this.lifecycleVersion;
    this.cancelActive();
    let worker: AnalysisWorkerLike;
    try {
      worker = this.options.createWorker();
    } catch (cause) {
      return Promise.reject(new AnalysisWorkerError(
        'WORKER_SETUP_FAILED',
        cause instanceof Error ? cause.message : 'Numerical worker could not be created.',
      ));
    }
    if (this.disposed || lifecycleVersion !== this.lifecycleVersion) {
      this.safely(() => worker.terminate());
      return Promise.reject(new AnalysisJobCancelledError());
    }

    return new Promise<CompletedAnalysisJob<TResult>>((resolve, reject) => {
      let owned: ActiveJob<TResult>;
      const onMessage = (event: AnalysisWorkerEvent) => {
        if (this.active !== owned) return;
        this.receive(event.data, request.jobId);
      };
      const onError = (event: AnalysisWorkerEvent) => {
        if (this.active !== owned) return;
        this.finishWithError(new AnalysisWorkerError('WORKER_FAILURE', event.message ?? 'Numerical worker failed.'));
      };
      const onMessageError = (event: AnalysisWorkerEvent) => {
        if (this.active !== owned) return;
        this.finishWithError(new AnalysisWorkerError('MESSAGE_ERROR', event.message ?? 'Numerical worker message could not be cloned.'));
      };
      const detach = () => {
        this.safely(() => worker.removeEventListener('message', onMessage));
        this.safely(() => worker.removeEventListener('error', onError));
        this.safely(() => worker.removeEventListener('messageerror', onMessageError));
      };
      owned = {
        request,
        worker,
        callbacks,
        resolve,
        reject,
        timer: null,
        detach,
      };
      const stillOwned = () => this.active === owned
        && lifecycleVersion === this.lifecycleVersion
        && !this.disposed;
      this.active = owned;
      try {
        worker.addEventListener('message', onMessage);
        if (!stillOwned()) return;
        worker.addEventListener('error', onError);
        if (!stillOwned()) return;
        worker.addEventListener('messageerror', onMessageError);
        if (!stillOwned()) return;
        owned.timer = setTimeout(() => {
          if (this.active === owned) {
            this.notify(() => callbacks.onSoftDeadline?.(request));
          }
        }, Math.max(0, request.budget.softDeadlineMs));
        this.notify(() => callbacks.onProgress?.({ phase: 'admission', completed: 1, total: 1 }));
        if (!stillOwned()) return;
        const envelope: AnalysisWorkerRunRequest<TPayload> = {
          protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION,
          type: 'run',
          request,
        };
        worker.postMessage(envelope);
      } catch (cause) {
        if (this.active === owned) {
          this.takeActive();
          reject(new AnalysisWorkerError(
            'WORKER_SETUP_FAILED',
            cause instanceof Error ? cause.message : 'Numerical worker setup failed.',
          ));
        }
      }
    });
  }

  cancel(): void {
    this.lifecycleVersion += 1;
    this.cancelActive();
  }

  private cancelActive(): void {
    const active = this.takeActive();
    active?.reject(new AnalysisJobCancelledError());
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
  }

  private receive(raw: unknown, expectedJobId: string): void {
    const active = this.active;
    if (!active || active.request.jobId !== expectedJobId || typeof raw !== 'object' || raw === null) return;
    const response = raw as Partial<AnalysisWorkerResponse<TResult>>;
    if (response.protocolVersion !== ANALYSIS_WORKER_PROTOCOL_VERSION) {
      this.finishWithError(new AnalysisWorkerError('PROTOCOL_MISMATCH', 'Numerical worker protocol does not match the app.'));
      return;
    }
    if (response.jobId !== active.request.jobId
      || response.sourceVersion !== active.request.sourceVersion
      || response.targetId !== active.request.targetId) return;
    if (response.type === 'progress') {
      this.notify(() => active.callbacks.onProgress?.({
        phase: response.phase as AnalysisPhase,
        completed: Number(response.completed),
        total: Number(response.total),
      }));
      return;
    }
    if (response.type === 'error') {
      this.finishWithError(new AnalysisWorkerError(String(response.code), String(response.message)));
      return;
    }
    if (response.type !== 'success') return;
    if (!isFiniteAnalysisQuality(response.quality)) {
      this.finishWithError(new AnalysisWorkerError('INVALID_QUALITY', 'Numerical worker returned non-finite or invalid quality metrics.'));
      return;
    }
    let currentSourceVersion: string | undefined;
    try {
      currentSourceVersion = this.options.currentSourceVersion(active.request.targetId);
    } catch (cause) {
      if (this.active === active) {
        this.finishWithError(new AnalysisWorkerError(
          'SOURCE_VERSION_FAILURE',
          cause instanceof Error ? cause.message : 'Current source version could not be read.',
        ));
      }
      return;
    }
    if (this.active !== active) return;
    if (currentSourceVersion !== active.request.sourceVersion) {
      this.finishWithError(new AnalysisJobStaleError());
      return;
    }
    const completed: CompletedAnalysisJob<TResult> = {
      jobId: active.request.jobId,
      sourceVersion: active.request.sourceVersion,
      targetId: active.request.targetId,
      result: response.result as TResult,
      quality: response.quality,
    };
    const finished = this.takeActive();
    if (!finished) return;
    this.notify(() => finished.callbacks.onProgress?.({ phase: 'complete', completed: 1, total: 1 }));
    this.notify(() => finished.callbacks.onPublish?.(completed));
    finished.resolve(completed);
  }

  private finishWithError(error: Error): void {
    const active = this.takeActive();
    active?.reject(error);
  }

  private takeActive(): ActiveJob<TResult> | null {
    const active = this.active;
    this.active = null;
    if (!active) return null;
    const timerToClear = active.timer;
    if (timerToClear !== null) this.safely(() => clearTimeout(timerToClear));
    this.safely(active.detach);
    this.safely(() => active.worker.terminate());
    return active;
  }

  private safely(action: () => void): void {
    try { action(); } catch { /* lifecycle cleanup is best-effort and must continue */ }
  }

  private notify(action: () => void): void {
    this.safely(action);
  }
}
