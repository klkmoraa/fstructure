import { describe, expect, it } from 'vitest';
import type { ModelDemandSnapshot } from '../../../design/elements/modelResultSnapshot';
import { linkedPieceTransfer } from './linkedPieceTransfer';

const snapshot = (kind: 'model2d' | 'model3d', member: ModelDemandSnapshot['member']): ModelDemandSnapshot => ({
  version: 1, source: { kind, projectId: 'project-1', revision: 'r1', memberId: member.id, ...(kind === 'model3d' ? { axisId: 'x:0' } : {}) },
  target: { id: kind === 'model2d' ? 'SERV' : 'LC1', label: 'SERV', kind: 'combination', factors: [{ caseId: 'D', factor: 1 }, { caseId: 'L', factor: 1 }] },
  station: { xM: 1, side: 'right', lengthM: 3 }, units: 'kN-m',
  axes: { convention: 'ejes locales originales', localBasis: [[0, 1, 0], [0, 0, 1], [1, 0, 0]] },
  actions: { nKn: -200, vyKn: 5, vzKn: 10, torsionKnm: 4, myKnm: -20, mzKnm: 10 }, member,
});
const column: ModelDemandSnapshot['member'] = { id: 'C1', label: 'Columna C1', family: 'column', levelId: 'L1', axisIds: ['x:0', 'z:0'], lengthM: 3,
  section: { shape: 'rectangular', widthMm: 300, depthMm: 500, fcMpa: 25, materialLabel: 'Concreto 25 MPa' }, start: [0, 0, 0], end: [0, 3, 0] };
const beam: ModelDemandSnapshot['member'] = { ...column, id: 'B1', family: 'beam' };

describe('linkedPieceTransfer', () => {
  it('convierte N de tensión positiva a Pu de compresión positiva y respeta ejes 3D no cuadrados', () => {
    const transfer = linkedPieceTransfer(snapshot('model3d', column), 'column');
    expect(transfer.fields).toMatchObject({ axial: '200', momentX: '10', momentY: '-20', shearX: '10', shearY: '5', width: '30', depth: '50', fc: '254.93' });
    expect(transfer.origin.snapshot.actions).toMatchObject({ myKnm: -20, mzKnm: 10, vyKn: 5, vzKn: 10 });
    expect(transfer.origin.snapshot.axes.localBasis).toHaveLength(3);
  });
  it('copia estado, target y estación 2D sin combinar casos', () => {
    const demand = snapshot('model2d', column);
    const source = { ...demand, actions: { ...demand.actions, nKn: 12, vyKn: -7, mzKnm: 31 } };
    const transfer = linkedPieceTransfer(source, 'column');
    expect(transfer.fields.axial).toBe('-12');
    expect(transfer.fields).toMatchObject({ shearY: '-7', momentX: '31' });
    expect(transfer.origin.snapshot.target.factors).toEqual([{ caseId: 'D', factor: 1 }, { caseId: 'L', factor: 1 }]);
    expect(transfer.origin.snapshot.station).toEqual({ xM: 1, side: 'right', lengthM: 3 });
  });
  it('sólo crea flexión enlazada para viga rectangular sólida', () => {
    const transfer = linkedPieceTransfer(snapshot('model2d', beam), 'flexure');
    expect(transfer.fields).toMatchObject({ width: '30', height: '50', fc: '254.93', moment: '10' });
    expect(() => linkedPieceTransfer(snapshot('model3d', { ...beam, section: { ...beam.section, shape: 'other' } }), 'flexure')).toThrow(/vigas rectangulares/);
  });
});
