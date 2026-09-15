/// <reference lib="webworker" />
import { handleDesignEnvelope } from '../runtime/workerHandlers';
import type { ConcreteBeamDesignWorkerPayload, WorkerRequestEnvelope } from '../runtime/workerProtocol';

self.onmessage = (event: MessageEvent<WorkerRequestEnvelope<'design', ConcreteBeamDesignWorkerPayload>>) => {
  self.postMessage(handleDesignEnvelope(event.data));
};

export {};
