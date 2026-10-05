import { describe, expect, it } from 'vitest';
import { generateSpace3DBuilding } from '../engine/buildingTemplate';
import { handleSpace3DWorkerRequest, SPACE3D_PROTOCOL_VERSION } from './protocol';

describe('Space3D worker studies', () => {
  it('runs modal and response-spectrum studies through the same serializable envelope', () => {
    const project = generateSpace3DBuilding({ xSpacings: [6], zSpacings: [5], storyHeights: [3.5, 3] });
    const modal = handleSpace3DWorkerRequest(structuredClone({ protocolVersion: SPACE3D_PROTOCOL_VERSION, type: 'study', requestId: 3, project, study: { kind: 'modal', modes: 4 } }));
    expect(modal).toMatchObject({ type: 'study-success', requestId: 3, outcome: { kind: 'modal', result: { success: true } } });
    const spectrum = handleSpace3DWorkerRequest({ protocolVersion: SPACE3D_PROTOCOL_VERSION, type: 'study', requestId: 4, project, study: { kind: 'response-spectrum', caseId: 'EZ' } });
    expect(spectrum.type).toBe('study-success');
    // Lo que vuelve del worker tiene que sobrevivir a structuredClone.
    expect(() => structuredClone(spectrum)).not.toThrow();
    const unknown = handleSpace3DWorkerRequest({ protocolVersion: SPACE3D_PROTOCOL_VERSION, type: 'nada', requestId: 5 });
    expect(unknown).toMatchObject({ type: 'error', code: 'UNSUPPORTED_REQUEST' });
  });
});
