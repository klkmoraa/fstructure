import { resolveReinforcementProposalMessage } from './reinforcementProposalCompute';
import type { ReinforcementProposalRequest } from './reinforcementProposalTypes';

self.addEventListener('message', (event: MessageEvent<ReinforcementProposalRequest>) => {
  self.postMessage(resolveReinforcementProposalMessage(event.data));
});
