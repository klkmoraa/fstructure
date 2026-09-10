/// <reference lib="webworker" />
import { handleParametricEnvelope } from '../runtime/workerHandlers';
import type { ParametricWorkerPayload, WorkerRequestEnvelope } from '../runtime/workerProtocol';

self.onmessage = (event: MessageEvent<WorkerRequestEnvelope<'parametric', ParametricWorkerPayload>>) => {
  self.postMessage(handleParametricEnvelope(event.data));
};
