import { reinforcementAlternatives } from '../../../design/elements/reinforcementAlternatives';
import type { ReinforcementAlternativesRequest } from '../../../design/elements/reinforcementAlternatives';

self.addEventListener('message', (event: MessageEvent<ReinforcementAlternativesRequest>) => {
  self.postMessage(reinforcementAlternatives(event.data));
});
