import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectModel } from '../types';
import type { NumericCertificate } from './certificate';
import { analysisSignature } from './projectSignature';
import { handleCertificateEnvelope } from '../runtime/workerHandlers';
import { startWorkerRequest, type WorkerRequestExecution } from '../runtime/workerExecution';
import {
  WORKER_PROTOCOL_VERSION,
  type CertificateWorkerPayload,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
} from '../runtime/workerProtocol';

/**
 * Ejecuta el certificado sólo a petición. Un worker por solicitud mantiene las
 * cuatro resoluciones extra fuera del hilo que dibuja el lienzo; jsdom conserva
 * el mismo contrato mediante el manejador síncrono diferido.
 */
export const useNumericCertificate = (project: ProjectModel, combinationId?: string | null) => {
  const [certificate, setCertificate] = useState<NumericCertificate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const executionRef = useRef<WorkerRequestExecution | null>(null);
  const requestRef = useRef(0);
  const signature = useMemo(() => analysisSignature(project), [project]);
  const projectRef = useRef(project);
  const combinationRef = useRef(combinationId);
  projectRef.current = project;
  combinationRef.current = combinationId;

  const cancelPending = useCallback(() => {
    requestRef.current += 1;
    executionRef.current?.cancel();
    executionRef.current = null;
  }, []);

  useEffect(() => {
    cancelPending();
    setCertificate(null);
    setBusy(false);
    setError(null);
    return cancelPending;
  }, [cancelPending, signature]);

  useEffect(() => {
    cancelPending();
    setCertificate(null);
    setBusy(false);
    setError(null);
  }, [cancelPending, combinationId]);

  const run = useCallback(() => {
    cancelPending();
    const requestId = requestRef.current;
    const payload: CertificateWorkerPayload = {
      project: projectRef.current,
      combinationId: combinationRef.current ?? null,
    };
    setBusy(true);
    setError(null);
    const accept = (response: WorkerResponseEnvelope<'certificate', NumericCertificate>) => {
      if (requestRef.current !== requestId) return;
      if (response.type === 'success') setCertificate(response.result);
      else setError(response.error.message);
      setBusy(false);
    };
    const request: WorkerRequestEnvelope<'certificate', CertificateWorkerPayload> = {
      protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'certificate', requestId, payload,
    };
    const execution = startWorkerRequest({
      createWorker: () => new Worker(new URL('../workers/certificate.worker.ts', import.meta.url), { type: 'module' }),
      request,
      isExpectedResponse: (response: WorkerResponseEnvelope<'certificate', NumericCertificate>) => response.requestId === requestId,
      onResponse: accept,
      runFallback: () => handleCertificateEnvelope(request),
      onFallbackError: (error) => {
        if (requestRef.current !== requestId) return;
        setError(error instanceof Error ? error.message : 'No se pudo emitir el certificado numérico.');
        setBusy(false);
      },
    });
    executionRef.current = execution;
    execution.start();
  }, [cancelPending]);

  return { certificate, busy, error, run };
};
