import { describe, expect, it } from 'vitest';
import { availableSolver2dCorpus, resolveCorpusProject } from '../engine/solver2dCorpus';
import { handleParametricEnvelope } from './workerHandlers';
import { WORKER_PROTOCOL_VERSION } from './workerProtocol';

describe('worker paramétrico', () => {
  it('ejecuta el estudio a través del contrato de worker', () => {
    const fixture = availableSolver2dCorpus.find((item) => item.id === 'axial-bar');
    if (!fixture) throw new Error('No se encontró el fixture axial-bar.');
    const response = handleParametricEnvelope({
      protocolVersion: WORKER_PROTOCOL_VERSION,
      type: 'run',
      domain: 'parametric',
      requestId: 4,
      payload: { project: resolveCorpusProject(fixture), memberId: 'AB', parameter: 'E', factors: [1] },
    });

    expect(response.type).toBe('success');
    if (response.type === 'success') {
      expect(response.domain).toBe('parametric');
      expect(response.requestId).toBe(4);
      expect(response.result.variants).toHaveLength(1);
    }
  });

  it('devuelve error de dominio para una solicitud inválida', () => {
    const fixture = availableSolver2dCorpus.find((item) => item.id === 'axial-bar');
    if (!fixture) throw new Error('No se encontró el fixture axial-bar.');
    const response = handleParametricEnvelope({
      protocolVersion: WORKER_PROTOCOL_VERSION,
      type: 'run',
      domain: 'parametric',
      requestId: 5,
      payload: { project: resolveCorpusProject(fixture), memberId: 'missing', parameter: 'E', factors: [1] },
    });

    expect(response.type).toBe('error');
    if (response.type === 'error') expect(response.error.code).toBe('DOMAIN_ERROR');
  });
});
