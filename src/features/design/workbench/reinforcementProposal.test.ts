import { afterEach, describe, expect, it, vi } from 'vitest';
import { startReinforcementProposal, type ReinforcementProposalMessage, type ReinforcementProposalRequest } from './reinforcementProposal';
import { SECTION_DEFAULTS } from './concreteStudioModel';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<ReinforcementProposalMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown;
  terminated = false;
  constructor() { FakeWorker.instances.push(this); }
  postMessage(message: unknown) { this.posted = message; }
  terminate() { this.terminated = true; }
  reply(data: ReinforcementProposalMessage) { this.onmessage?.({ data } as MessageEvent<ReinforcementProposalMessage>); }
}

afterEach(() => { vi.unstubAllGlobals(); FakeWorker.instances = []; });

describe('reinforcement proposal worker contract', () => {
  it('sends a serializable snapshot and only applies field patches from current responses', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const request: ReinforcementProposalRequest = { kind: 'column', requestId: 4, code: 'ntc-2023', snapshot: { axial: '900', momentX: '80' } };
    const onResult = vi.fn();
    startReinforcementProposal(request, onResult);
    expect(FakeWorker.instances[0]?.posted).toEqual(request);
    FakeWorker.instances[0]?.reply({ kind: 'proposed', requestId: 4, fields: { bar: '19.1', barsWidth: '4', width: '90' } });
    expect(onResult).toHaveBeenCalledWith({ kind: 'proposed', requestId: 4, fields: { bar: '19.1', barsWidth: '4' } });
  });

  it('ignores a pending response after cancellation', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onResult = vi.fn();
    const cancel = startReinforcementProposal({ kind: 'section', requestId: 9, snapshot: { shape: 'rectangle' }, diametersMm: [16, 20] }, onResult);
    cancel();
    FakeWorker.instances[0]?.reply({ kind: 'proposed', requestId: 9, fields: { bar: '20', barCount: '8' } });
    expect(onResult).not.toHaveBeenCalled();
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
  });

  it('runs the existing proposer when workers are unavailable', async () => {
    vi.stubGlobal('Worker', undefined);
    const onResult = vi.fn();
    startReinforcementProposal({ kind: 'section', requestId: 2, snapshot: SECTION_DEFAULTS }, onResult);
    await vi.waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(onResult.mock.calls[0]?.[0]).toMatchObject({ kind: 'proposed', requestId: 2, fields: expect.objectContaining({ bar: expect.any(String), barCount: expect.any(String), tieSpacing: expect.any(String) }) });
  });
});
