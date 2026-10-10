import { afterEach, describe, expect, it, vi } from 'vitest';
import { reinforcementAlternatives } from '../../../design/elements/reinforcementAlternatives';
import { startReinforcementAlternatives, type ReinforcementAlternativesRequest, type ReinforcementAlternativesResponse } from './reinforcementAlternativesClient';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<ReinforcementAlternativesResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown;
  terminated = false;
  constructor() { FakeWorker.instances.push(this); }
  postMessage(request: unknown) { this.posted = request; }
  terminate() { this.terminated = true; }
  reply(response: ReinforcementAlternativesResponse) { this.onmessage?.({ data: response } as MessageEvent<ReinforcementAlternativesResponse>); }
}
afterEach(() => { vi.unstubAllGlobals(); FakeWorker.instances = []; });

describe('reinforcement alternatives worker', () => {
  it('cancels and ignores results when edits invalidate the serialized request', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const request: ReinforcementAlternativesRequest = { kind: 'flexure', requestId: 12, objective: 'available-bars', availableDiametersMm: [16], input: { code: 'ntc-2023', widthMm: 300, heightMm: 550, coverMm: 35, fcMpa: 25, fyMpa: 420, stirrupDiameterMm: 9.5, aggregateMm: 19, momentKnM: 180, top: { count: 2, diameterMm: 16 }, bottom: { count: 3, diameterMm: 19.1 } } };
    const onResult = vi.fn();
    const cancel = startReinforcementAlternatives(request, onResult);
    expect(FakeWorker.instances[0]?.posted).toEqual(request);
    cancel();
    FakeWorker.instances[0]?.reply(reinforcementAlternatives(request));
    expect(onResult).not.toHaveBeenCalled();
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
  });
});
