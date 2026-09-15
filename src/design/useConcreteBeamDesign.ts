import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analysisSignature } from '../engine/projectSignature';
import { handleDesignEnvelope } from '../runtime/workerHandlers';
import {
  WORKER_PROTOCOL_VERSION,
  type ConcreteBeamDesignWorkerPayload,
  type ConcreteBeamDesignWorkerResult,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
} from '../runtime/workerProtocol';
import type { ReinforcedConcreteBeamAssignment, ProjectModel } from '../types';
import type { ConcreteBeamDesignOutcome } from './concrete/types';

const cloneAssignment = (assignment: ReinforcedConcreteBeamAssignment): ReinforcedConcreteBeamAssignment => ({
  ...assignment,
  preferredLongitudinalDiametersMm: [...assignment.preferredLongitudinalDiametersMm],
  preferredStirrupDiametersMm: [...assignment.preferredStirrupDiametersMm],
});

/** Result validity includes analysis inputs, selected combinations and every persisted design input. */
export const concreteBeamDesignSignature = (project: ProjectModel, assignment: ReinforcedConcreteBeamAssignment | null | undefined): string =>
  JSON.stringify([analysisSignature(project), assignment ?? null]);

export const useConcreteBeamDesign = (
  project: ProjectModel,
  assignment: ReinforcedConcreteBeamAssignment | null | undefined,
) => {
  const [outcome, setOutcome] = useState<ConcreteBeamDesignOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  const signature = useMemo(() => concreteBeamDesignSignature(project, assignment), [project, assignment]);
  const projectRef = useRef(project);
  const assignmentRef = useRef(assignment);
  projectRef.current = project;
  assignmentRef.current = assignment;

  const cancelPending = useCallback(() => {
    requestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    cancelPending();
    setOutcome(null);
    setBusy(false);
    setError(null);
  }, [cancelPending]);

  useEffect(() => {
    setOutcome(null);
    setBusy(false);
    setError(null);
    return cancelPending;
  }, [cancelPending, signature]);

  const run = useCallback(() => {
    cancelPending();
    const currentAssignment = assignmentRef.current;
    if (!currentAssignment) {
      setOutcome(null);
      setBusy(false);
      setError('Selecciona o crea una asignación de diseño para la viga.');
      return;
    }
    const requestId = requestRef.current;
    const payload: ConcreteBeamDesignWorkerPayload = {
      project: projectRef.current,
      memberId: currentAssignment.memberId,
      assignment: cloneAssignment(currentAssignment),
    };
    setOutcome(null);
    setBusy(true);
    setError(null);
    const accept = (response: WorkerResponseEnvelope<'design', ConcreteBeamDesignWorkerResult>) => {
      if (requestRef.current !== requestId) return;
      if (response.type === 'success') setOutcome(response.result);
      else setError(response.error.message);
      setBusy(false);
    };
    const fallback = () => {
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null;
        if (requestRef.current === requestId) accept(handleDesignEnvelope({
          protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'design', requestId, payload,
        }));
      }, 0);
    };
    if (typeof Worker === 'undefined') {
      fallback();
      return;
    }
    try {
      const worker = new Worker(new URL('../workers/design.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      let settled = false;
      const fallbackOnce = () => {
        if (settled || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        fallback();
      };
      worker.onmessage = (event: MessageEvent<WorkerResponseEnvelope<'design', ConcreteBeamDesignWorkerResult>>) => {
        if (settled || event.data.requestId !== requestId || requestRef.current !== requestId) return;
        settled = true;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        accept(event.data);
      };
      worker.onerror = fallbackOnce;
      const request: WorkerRequestEnvelope<'design', ConcreteBeamDesignWorkerPayload> = {
        protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'design', requestId, payload,
      };
      worker.postMessage(request);
    } catch {
      fallback();
    }
  }, [cancelPending]);

  return { outcome, busy, error, run, clear };
};
