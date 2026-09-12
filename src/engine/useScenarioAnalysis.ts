import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisScenario } from './envelope';
import { analysisSignature } from './projectSignature';
import type { ProjectModel } from '../types';
import { handleScenarioEnvelope } from '../runtime/workerHandlers';
import { startWorkerRequest, type WorkerRequestExecution } from '../runtime/workerExecution';
import { WORKER_PROTOCOL_VERSION, type WorkerRequestEnvelope, type WorkerResponseEnvelope } from '../runtime/workerProtocol';

export const useScenarioAnalysis = (project: ProjectModel) => {
  const [scenarios, setScenarios] = useState<AnalysisScenario[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const executionRef = useRef<WorkerRequestExecution | null>(null);
  const requestRef = useRef(0);
  // Scenarios stay valid while only presentation settings change, so the reset
  // is keyed on what the solver actually reads, not on project identity.
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
    setScenarios(null);
    setBusy(false);
    setError(null);
  }, [cancelPending]);

  useEffect(() => {
    setScenarios(null);
    setBusy(false);
    setError(null);
    return cancelPending;
  }, [cancelPending, signature]);

  const run = useCallback(() => {
    cancelPending();
    const requestId = requestRef.current;
    const project = projectRef.current;
    setBusy(true);
    setError(null);
    const request: WorkerRequestEnvelope<'scenarios', { project: ProjectModel }> = {
      protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'scenarios', requestId, payload: { project },
    };
    const accept = (response: WorkerResponseEnvelope<'scenarios', AnalysisScenario[]>) => {
      if (requestRef.current !== requestId) return;
      if (response.type === 'success') setScenarios(response.result);
      else setError(response.error.message);
      setBusy(false);
    };
    const execution = startWorkerRequest({
      createWorker: () => new Worker(new URL('../workers/scenarios.worker.ts', import.meta.url), { type: 'module' }),
      request,
      isExpectedResponse: (response: WorkerResponseEnvelope<'scenarios', AnalysisScenario[]>) => response.requestId === requestId,
      onResponse: accept,
      runFallback: () => handleScenarioEnvelope(request),
      onFallbackError: (error) => {
        if (requestRef.current !== requestId) return;
        setError(error instanceof Error ? error.message : 'No se pudieron comparar los escenarios.');
        setBusy(false);
      },
    });
    executionRef.current = execution;
    execution.start();
  }, [cancelPending]);

  return { scenarios, busy, error, run, clear };
};
