import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectModel } from '../types';
import { analysisSignature } from './projectSignature';
import type { ParametricParameter, ParametricStudyResult } from './parametricStudy';
import { handleParametricEnvelope } from '../runtime/workerHandlers';
import { startWorkerRequest, type WorkerRequestExecution } from '../runtime/workerExecution';
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
  const executionRef = useRef<WorkerRequestExecution | null>(null);
  const requestRef = useRef(0);
  const signature = useMemo(() => analysisSignature(project), [project]);
  const projectRef = useRef(project);
  const combinationRef = useRef(combinationId);
  projectRef.current = project;
  combinationRef.current = combinationId;

  const cancel = useCallback(() => {
    requestRef.current += 1;
    executionRef.current?.cancel();
    executionRef.current = null;
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
    const request: WorkerRequestEnvelope<'parametric', ParametricWorkerPayload> = {
      protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'parametric', requestId, payload,
    };
    const execution = startWorkerRequest({
      createWorker: () => new Worker(new URL('../workers/parametric.worker.ts', import.meta.url), { type: 'module' }),
      request,
      isExpectedResponse: (response: WorkerResponseEnvelope<'parametric', ParametricWorkerResult>) => response.requestId === requestId,
      onResponse: accept,
      runFallback: () => handleParametricEnvelope(request),
      onFallbackError: (error) => {
        if (requestRef.current !== requestId) return;
        setError(error instanceof Error ? error.message : 'No se pudo completar el estudio paramétrico.');
        setBusy(false);
      },
    });
    executionRef.current = execution;
    execution.start();
  }, [cancel]);

  return { study, busy, error, run, clear };
};
