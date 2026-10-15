/// <reference lib="webworker" />
import { designFromDraft } from './frameCalculation';
import type { FrameDesignRequest } from './frameDesignClient';

/** Diseña el pórtico rápido fuera del hilo principal; el resultado es datos (sin funciones) y cruza por copia. */
self.onmessage = (event: MessageEvent<FrameDesignRequest>) => {
  const { requestId, code, draft, bays, stories } = event.data;
  try {
    self.postMessage({ requestId, outcome: designFromDraft(code, draft, bays, stories) });
  } catch (error) {
    self.postMessage({ requestId, outcome: { ok: false, errors: [error instanceof Error ? error.message : 'No se pudo diseñar el pórtico.'] } });
  }
};

export {};
