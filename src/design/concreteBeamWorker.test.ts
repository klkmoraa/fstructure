import { describe, expect, it } from 'vitest';
import { createHibbelerStyleDiagramPractice } from '../data/defaultProject';
import { handleDesignEnvelope } from '../runtime/workerHandlers';
import { WORKER_PROTOCOL_VERSION, type ConcreteBeamDesignWorkerPayload } from '../runtime/workerProtocol';
import type { ReinforcedConcreteBeamAssignment } from '../types';

const assignment = (): ReinforcedConcreteBeamAssignment => ({
  id: 'DESIGN-AB',
  memberId: 'AB',
  kind: 'reinforced-concrete-beam',
  standardId: 'ntc-cdmx-2023-concrete',
  ultimateCombinationId: 'ULS',
  serviceCombinationId: 'SLS',
  coverMm: 40,
  longitudinalSteelYieldMpa: 420,
  stirrupSteelYieldMpa: 420,
  preferredLongitudinalDiametersMm: [12, 16, 20, 25, 32],
  preferredStirrupDiametersMm: [8, 10, 12],
  stirrupLegs: 2,
});

const payload = (): ConcreteBeamDesignWorkerPayload => {
  const project = createHibbelerStyleDiagramPractice();
  project.members = project.members.map((member) => member.id === 'AB' ? {
    ...member,
    materialId: 'concrete-28mpa', materialOrigin: 'catalog', sectionId: 'rect-concrete-300x500', sectionOrigin: 'catalog',
    E: 24_870_062.324, A: 0.15, I: 0.003125,
  } : member);
  project.combinations = [
    { id: 'SLS', name: 'NTC SLS', factors: { LC1: 1 }, stateLimit: 'service', jurisdiction: 'Ciudad de México', edition: '2023', sourceUrl: 'https://example.test/ntc-cdmx-2023' },
    { id: 'ULS', name: 'NTC ULS', factors: { LC1: 1.4 }, stateLimit: 'ultimate', jurisdiction: 'Ciudad de México', edition: '2023', sourceUrl: 'https://example.test/ntc-cdmx-2023' },
  ];
  return { project, memberId: 'AB', assignment: assignment() };
};

describe('concrete beam worker adapter', () => {
  it('runs exact ULS/SLS solver diagrams then submits a catalog-backed NTC input', () => {
    const response = handleDesignEnvelope({ protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'design', requestId: 7, payload: payload() });
    expect(response).toMatchObject({ type: 'success', domain: 'design', requestId: 7 });
    if (response.type !== 'success') throw new Error(response.error.message);
    expect(response.result.status).toBe('available');
    if (response.result.status !== 'available') throw new Error('expected available outcome');
    expect(response.result.binding).toMatchObject({ memberId: 'AB', ultimateCombinationId: 'ULS', serviceCombinationId: 'SLS' });
    expect(response.result.service.concretePropertyBasis).toBe('ntc-table-2.2.1-class-1a-basalt');
    expect(response.result.flexure.positive.demandKnm).toBeGreaterThan(0);
  });

  it('rejects protocol mismatch and assignment/member mismatches without inventing a demand', () => {
    const badProtocol = handleDesignEnvelope({ protocolVersion: 0 as 1, type: 'run', domain: 'design', requestId: 8, payload: payload() });
    expect(badProtocol).toMatchObject({ type: 'error', error: { code: 'PROTOCOL_MISMATCH' } });

    const invalid = payload();
    invalid.assignment.memberId = 'OTHER';
    const response = handleDesignEnvelope({ protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'design', requestId: 9, payload: invalid });
    expect(response).toMatchObject({ type: 'error', error: { code: 'DOMAIN_ERROR' } });
  });
});
