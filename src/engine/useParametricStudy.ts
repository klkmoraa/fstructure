import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectModel } from '../types';
import { analysisSignature } from './projectSignature';
import type { ParametricParameter, ParametricStudyResult } from './parametricStudy';
import { handleParametricEnvelope } from '../runtime/workerHandlers';
import {
  WORKER_PROTOCOL_VERSION,
  type ParametricWorkerPayload,
  type ParametricWorkerResult,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
} from '../runtime/workerProtocol';

export interface ParametricStudyOptions {
  memberId: string;
  parameter: ParametricParameter;
  factors: readonly number[];
}

export interface ParametricStudyState {
  study: ParametricStudyResult | null;
  busy: boolean;
  error: string | null;
  run: (options: ParametricStudyOptions) => void;
  clear: () => void;
}

/** Runs one bounded property sweep outside the render thread and invalidates it with the model. */
export const useParametricStudy = (project: ProjectModel, combinationId?: string | null): ParametricStudyState => {
  const [study, setStudy] = useState<ParametricStudyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  const signature = useMemo(() => analysisSignature(project), [project]);
  const projectRef = useRef(project);
  const combinationRef = useRef(combinationId);
  projectRef.current = project;
  combinationRef.current = combinationId;

  const cancel = useCallback(() => {
    requestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    cancel();
    setStudy(null);
    setBusy(false);
    setError(null);
  }, [cancel]);

  useEffect(() => {
    clear();
    return cancel;
  }, [cancel, clear, signature]);

  useEffect(() => {
    setStudy(null);
    setError(null);
    setBusy(false);
    cancel();
  }, [cancel, combinationId]);

  const run = useCallback((options: ParametricStudyOptions) => {
    cancel();
    const requestId = requestRef.current;
    const payload: ParametricWorkerPayload = {
      project: projectRef.current,
      combinationId: combinationRef.current || null,
      ...options,
    };
    setBusy(true);
    setError(null);
    const accept = (response: WorkerResponseEnvelope<'parametric', ParametricWorkerResult>) => {
      if (requestRef.current !== requestId) return;
      if (response.type === 'success') setStudy(response.result);
      else setError(response.error.message);
      setBusy(false);
    };
    const fallback = () => {
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null;
        accept(handleParametricEnvelope({
          protocolVersion: WORKER_PROTOCOL_VERSION,
          type: 'run',
          domain: 'parametric',
          requestId,
          payload,
        }));
      }, 0);
    };
    if (typeof Worker === 'undefined') {
      fallback();
      return;
    }
    try {
      const worker = new Worker(new URL('../workers/parametric.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      let settled = false;
      const fallbackOnce = () => {
        if (settled || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        fallback();
      };
      worker.onmessage = (event: MessageEvent<WorkerResponseEnvelope<'parametric', ParametricWorkerResult>>) => {
        if (settled || event.data.requestId !== requestId || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        accept(event.data);
      };
      worker.onerror = fallbackOnce;
      const envelope: WorkerRequestEnvelope<'parametric', ParametricWorkerPayload> = {
        protocolVersion: WORKER_PROTOCOL_VERSION,
        type: 'run',
        domain: 'parametric',
        requestId,
        payload,
      };
      worker.postMessage(envelope);
    } catch {
      fallback();
    }
  }, [cancel]);

  return { study, busy, error, run, clear };
};
