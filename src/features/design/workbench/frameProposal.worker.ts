/// <reference lib="webworker" />
import { proposeFrameSections } from './frameProposal';
import type { BayDraft, FrameDraft, StoryDraft } from './frameModel';
import type { DesignCodeId } from '../../../design/elements/codes';
self.onmessage = (event: MessageEvent<{ code: DesignCodeId; draft: FrameDraft; bays: BayDraft[]; stories: StoryDraft[] }>) => {
  const { code, draft, bays, stories } = event.data;
  try {
    for (const step of proposeFrameSections(code, draft, bays, stories)) self.postMessage(step);
  } catch (error) {
    self.postMessage({ kind: 'failed', reason: error instanceof Error ? error.message : 'No se pudo proponer.', trials: 0 });
  }
};
export {};
