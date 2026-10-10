import { resolveBeamSectionProposal } from './beamSectionProposal';
import type { BeamSectionProposalRequest } from './beamSectionProposal';

self.addEventListener('message', (event: MessageEvent<BeamSectionProposalRequest>) => {
  self.postMessage(resolveBeamSectionProposal(event.data));
});
