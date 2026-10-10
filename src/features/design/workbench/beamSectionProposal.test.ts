import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_BEAM_DETAILS } from './beamDetailDraft';
import { BEAM_DEFAULTS, DEFAULT_SPANS } from './beamModel';
import { startBeamSectionProposal, type BeamSectionProposalReply } from './beamSectionProposal';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<BeamSectionProposalReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown;
  terminated = false;
  constructor() { FakeWorker.instances.push(this); }
  postMessage(data: unknown) { this.posted = data; }
  terminate() { this.terminated = true; }
  reply(data: BeamSectionProposalReply) { this.onmessage?.({ data } as MessageEvent<BeamSectionProposalReply>); }
}
afterEach(() => { vi.unstubAllGlobals(); FakeWorker.instances = []; });

describe('worker de geometría de viga', () => {
  it('envía el borrador, claros y detalle íntegros y descarta respuesta tras cancelar', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const draft = { ...BEAM_DEFAULTS, width: '25', height: '50', bottomCount: '4' };
    const spans = [{ ...DEFAULT_SPANS[0]!, length: '7.25' }];
    const details = { ...EMPTY_BEAM_DETAILS, loads: [{ id: 'q1', span: '1', kind: 'distributed' as const, category: 'dead' as const, start: '1', end: '6', startValue: '1000', endValue: '1000' }] };
    const result = vi.fn();
    const cancel = startBeamSectionProposal({ requestId: 8, code: 'ntc-2023', draft, spans, details }, result);
    expect(FakeWorker.instances[0]?.posted).toEqual({ requestId: 8, code: 'ntc-2023', draft, spans, details });
    cancel();
    FakeWorker.instances[0]?.reply({ requestId: 8, proposal: { width: '30', height: '60' } });
    expect(result).not.toHaveBeenCalled();
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
  });
});
