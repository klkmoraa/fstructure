import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectModel } from '../types';
import type { BucklingResult } from './buckling';
import type { ModalResult } from './modal';
import { analysisSignature } from './projectSignature';
import { handleStudiesEnvelope } from '../runtime/workerHandlers';
import { startWorkerRequest, type WorkerRequestExecution } from '../runtime/workerExecution';
import { WORKER_PROTOCOL_VERSION, type StudiesWorkerPayload, type StudiesWorkerResult, type StudyKind, type WorkerRequestEnvelope, type WorkerResponseEnvelope } from '../runtime/workerProtocol';

export interface ModelStudiesState {
  buckling: BucklingResult | null; modal: ModalResult | null; busy: StudyKind | null; error: { kind: StudyKind; message: string } | null;
  run: (kind: StudyKind, options?: { modes?: number }) => void;
}

/** Estudios opcionales con worker por petición e invalidación por modelo/carga. */
export const useModelStudies = (project: ProjectModel, combinationId?: string | null): ModelStudiesState => {
  const [buckling, setBuckling] = useState<BucklingResult | null>(null);
  const [modal, setModal] = useState<ModalResult | null>(null);
  const [busy, setBusy] = useState<StudyKind | null>(null);
  const [error, setError] = useState<{ kind: StudyKind; message: string } | null>(null);
  const executionRef = useRef<WorkerRequestExecution | null>(null); const request = useRef(0);
  const signature = useMemo(() => analysisSignature(project), [project]);
  const projectRef = useRef(project); const combinationRef = useRef(combinationId); projectRef.current = project; combinationRef.current = combinationId;
  const cancel = useCallback(() => { request.current += 1; executionRef.current?.cancel(); executionRef.current = null; }, []);
  useEffect(() => { cancel(); setBuckling(null); setModal(null); setBusy(null); setError(null); return cancel; }, [cancel, signature]);
  useEffect(() => { cancel(); setBuckling(null); setBusy(null); setError(null); }, [cancel, combinationId]);
  const run = useCallback((kind: StudyKind, options?: { modes?: number }) => {
    cancel(); const id = request.current; const payload: StudiesWorkerPayload = { kind, project: projectRef.current, combinationId: combinationRef.current ?? null, modes: options?.modes ?? 3 };
    setBusy(kind); setError(null);
    const accept = (response: WorkerResponseEnvelope<'studies', StudiesWorkerResult>) => {
      if (request.current !== id) return;
      if (response.type === 'success') { if (response.result.kind === 'buckling') setBuckling(response.result.result); else setModal(response.result.result); }
      else setError({ kind, message: response.error.message });
      setBusy(null);
    };
    const envelope: WorkerRequestEnvelope<'studies', StudiesWorkerPayload> = { protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'studies', requestId: id, payload };
    const execution = startWorkerRequest({
      createWorker: () => new Worker(new URL('../workers/studies.worker.ts', import.meta.url), { type: 'module' }),
      request: envelope,
      isExpectedResponse: (response: WorkerResponseEnvelope<'studies', StudiesWorkerResult>) => response.requestId === id,
      onResponse: accept,
      runFallback: () => handleStudiesEnvelope(envelope),
      onFallbackError: (error) => {
        if (request.current !== id) return;
        setError({ kind, message: error instanceof Error ? error.message : 'No se pudo completar el estudio del modelo.' });
        setBusy(null);
      },
    });
    executionRef.current = execution;
    execution.start();
  }, [cancel]);
  return { buckling, modal, busy, error, run };
};
