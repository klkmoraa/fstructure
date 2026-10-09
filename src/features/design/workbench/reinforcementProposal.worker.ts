import { resolveReinforcementProposal, type ReinforcementProposalRequest } from './reinforcementProposal';

self.addEventListener('message', (event: MessageEvent<ReinforcementProposalRequest>) => {
  self.postMessage(resolveReinforcementProposal(event.data));
});
