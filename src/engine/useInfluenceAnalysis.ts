import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AxleTrainEnvelope,
  type InfluenceLine,
} from './influence';
import { analysisSignature } from './projectSignature';
import type { ProjectModel } from '../types';
import { handleInfluenceEnvelope } from '../runtime/workerHandlers';
import { startWorkerRequest, type WorkerRequestExecution } from '../runtime/workerExecution';
import {
  WORKER_PROTOCOL_VERSION,
  type InfluenceAnalysisInput as ProtocolInfluenceAnalysisInput,
  type InfluenceWorkerPayload,
  type InfluenceWorkerResult,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
} from '../runtime/workerProtocol';

export type InfluenceAnalysisInput = ProtocolInfluenceAnalysisInput;

export interface InfluenceAnalysisOutput {
  line: InfluenceLine;
  axleTrain: AxleTrainEnvelope | null;
}

export const useInfluenceAnalysis = (project: ProjectModel) => {
  const [result, setResult] = useState<InfluenceAnalysisOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const executionRef = useRef<WorkerRequestExecution | null>(null);
  const requestRef = useRef(0);
  // An influence line stays exact while only presentation settings change.
  const signature = useMemo(() => analysisSignature(project), [project]);
  const projectRef = useRef(project);
  projectRef.current = project;

  const cancelPending = useCallback(() => {
    requestRef.current += 1;
    executionRef.current?.cancel();
    executionRef.current = null;
  }, []);

  const clear = useCallback(() => {
    cancelPending();
    setResult(null);
    setBusy(false);
    setError(null);
  }, [cancelPending]);

  useEffect(() => {
    setResult(null);
    setBusy(false);
    setError(null);
    return cancelPending;
  }, [cancelPending, signature]);

  const run = useCallback((input: InfluenceAnalysisInput) => {
    cancelPending();
    const requestId = requestRef.current;
    const project = projectRef.current;
    const immutableInput: InfluenceAnalysisInput = {
      ...input,
      pathMemberIds: [...input.pathMemberIds],
      target: { ...input.target },
      train: input.train
        ? {
            impactFactor: input.train.impactFactor,
            axles: input.train.axles.map((axle) => ({ ...axle })),
          }
        : null,
    };
    setBusy(true);
    setError(null);
    setResult(null);

    const request: WorkerRequestEnvelope<'influence', InfluenceWorkerPayload> = {
      protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'influence', requestId,
      payload: { project, input: immutableInput },
    };
    const accept = (response: WorkerResponseEnvelope<'influence', InfluenceWorkerResult>) => {
      if (requestRef.current !== requestId) return;
      if (response.type === 'success') setResult(response.result);
      else setError(response.error.message);
      setBusy(false);
    };
    const execution = startWorkerRequest({
      createWorker: () => new Worker(new URL('../workers/influence.worker.ts', import.meta.url), { type: 'module' }),
      request,
      isExpectedResponse: (response: WorkerResponseEnvelope<'influence', InfluenceWorkerResult>) => response.requestId === requestId,
      onResponse: accept,
      runFallback: () => handleInfluenceEnvelope(request),
      onFallbackError: (error) => {
        if (requestRef.current !== requestId) return;
        setError(error instanceof Error ? error.message : 'No se pudo calcular la línea de influencia.');
        setBusy(false);
      },
    });
    executionRef.current = execution;
    execution.start();
  }, [cancelPending]);

  return {
    line: result?.line ?? null,
    axleTrain: result?.axleTrain ?? null,
    busy,
    error,
    run,
    clear,
  };
};
