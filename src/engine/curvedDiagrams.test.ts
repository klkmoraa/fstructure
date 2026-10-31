import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { generateStructure } from '../data/generators/structureGenerators';
import { circularMemberGeometry, curveTangentAt } from '../graphics/memberCurve';
import { evaluatePolynomial } from './diagram';
import { analyzeProject } from './solver';

/**
 * Arco apoyado (articulación y rodillo) con carga vertical w por longitud de arco.
 * Sin empuje horizontal, el corte a la distancia s lleva la vertical R − w·s:
 * N = −(R − w·s)·sen φ y V = (R − w·s)·cos φ, con φ la tangente del arco.
 */
const solvedArch = (rise: number) => {
  const p = createBlankProject();
  const g = generateStructure({ kind: 'circular-arch', span: 10, rise, segments: 24, properties: { kind: 'explicit', E: 25e6, A: 0.15, I: 0.003125 } });
  p.nodes = structuredClone([...g.nodes]); p.members = structuredClone([...g.members]);
  p.nodes[0].support = { type: 'pin' }; p.nodes[1].support = { type: 'roller', angleDeg: 90 };
  p.memberLoads = [{ id: 'q', memberId: p.members[0].id, caseId: p.loadCases[0].id, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -20, qyEnd: -20 }];
  p.loadCases.forEach((loadCase) => { loadCase.selfWeightFactor = 0; });
  const result = analyzeProject(p);
  const arc = circularMemberGeometry(p.members[0], p.nodes[0], p.nodes[1])!;
  return { result, member: result.memberResults[0], arc, w: 20 };
};

describe('curved member diagrams follow the arc tangent', () => {
  it.each([2.5, 5])('matches the closed-form N and V of a simply supported arch, rise %g m', (rise) => {
    const { result, member, arc, w } = solvedArch(rise);
    expect(result.success).toBe(true);
    const R = w * arc.length / 2;
    let worst = 0, jump = 0;
    member.diagramSegments.forEach((segment, index) => {
      const s = segment.x0, tangent = curveTangentAt(arc, s / arc.length);
      const vertical = R - w * s;
      worst = Math.max(worst, Math.abs(segment.shear[0] - vertical * tangent.x), Math.abs(segment.axial[0] + vertical * tangent.y));
      const previous = member.diagramSegments[index - 1];
      if (previous) jump = Math.max(jump, Math.abs(evaluatePolynomial(previous.shear, previous.x1 - previous.x0) - segment.shear[0]));
    });
    expect(worst / R).toBeLessThan(5e-3);
    // Sin dientes de sierra: entre tramos internos el cortante no salta.
    expect(jump / R).toBeLessThan(2e-3);
    expect(member.localEndForces[1]).toBeCloseTo(R * curveTangentAt(arc, 0).x, 1);
  });
  it('reports the extremes of the whole arch, not of its first internal chord', () => {
    const { member, arc, w } = solvedArch(2.5);
    const label = (quantity: 'shear' | 'moment', kind: 'maximum' | 'minimum') => member.criticalPoints
      .filter((point) => point.quantity === quantity && point.kind === kind).sort((a, b) => a.x - b.x)[0];
    expect(member.criticalPoints.filter((point) => point.kind === 'maximum' && point.quantity === 'moment')).toHaveLength(1);
    expect(label('moment', 'maximum').x).toBeCloseTo(arc.length / 2, 1);
    expect(label('moment', 'maximum').value).toBeCloseTo(member.maxMoment, 9);
    expect(label('shear', 'minimum').value).toBeCloseTo(-label('shear', 'maximum').value, 1);
    expect(member.maxShear).toBeGreaterThan(0.5 * w * arc.length / 2 * curveTangentAt(arc, 0).x);
  });
});
