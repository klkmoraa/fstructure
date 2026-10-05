import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { analysisSignature } from './projectSignature';

describe('analysisSignature', () => {
  it('mantiene la firma cuando sólo cambian las asignaciones de diseño', () => {
    const project = createDefaultProject();
    const withDesign = structuredClone(project);
    withDesign.designAssignments = [{
      id: 'DESIGN-M2',
      memberId: 'M2',
      kind: 'reinforced-concrete-beam',
      standardId: 'ntc-cdmx-2023-concrete',
      ultimateCombinationId: 'NTC-CDMX-2023-ORD',
      serviceCombinationId: 'COMB1',
      coverMm: 40,
      longitudinalSteelYieldMpa: 420,
      stirrupSteelYieldMpa: 420,
      preferredLongitudinalDiametersMm: [12, 16, 20, 25, 32],
      preferredStirrupDiametersMm: [8, 10, 12],
      stirrupLegs: 2,
    }];

    expect(analysisSignature(withDesign)).toBe(analysisSignature(project));
  });

  it('cambia la firma cuando cambia una propiedad estructural del miembro', () => {
    const project = createDefaultProject();
    const structurallyChanged = structuredClone(project);
    structurallyChanged.members[0].E += 1;

    expect(analysisSignature(structurallyChanged)).not.toBe(analysisSignature(project));
  });
});
