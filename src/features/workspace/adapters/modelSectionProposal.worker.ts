/// <reference lib="webworker" />
import { runModelSectionProposal, type ModelProposalRequest } from './modelSectionProposalTask';
self.onmessage = (event: MessageEvent<ModelProposalRequest>) => {
  try {
    runModelSectionProposal(event.data, (step) => self.postMessage(step));
  } catch (error) {
    self.postMessage({ kind: 'failed', reason: error instanceof Error ? error.message : 'No se pudo proponer para el modelo.', trials: 0 });
  }
};
export {};
