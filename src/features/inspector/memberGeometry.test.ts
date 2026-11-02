import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { withModelStart } from '../../data/modelStarts';
import { memberGeometrySummary } from './memberGeometry';

describe('longitud de la barra en el Inspector', () => {
  it('una barra recta mide su recta y no trae datos de arco', () => {
    const summary = memberGeometrySummary({}, { x: 0, y: 0 }, { x: 3, y: 4 });
    expect(summary.length).toBeCloseTo(5, 12);
    expect(summary.arc).toBeUndefined();
  });

  it('un semicírculo de claro 2 mide π, con cuerda 2 y radio 1', () => {
    const summary = memberGeometrySummary({ curve: { kind: 'circular-arc', bulge: 1 } }, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(summary.length).toBeCloseTo(Math.PI, 12);
    expect(summary.arc).toEqual({ chord: 2, radius: expect.closeTo(1, 12) });
    expect(summary.angleDeg).toBe(0);
  });

  it('el arco del inicio rápido (claro 10, flecha 3) mide R·θ, no la cuerda', () => {
    const project = withModelStart(createBlankProject(), 'arch');
    const [i, j] = project.nodes;
    const summary = memberGeometrySummary(project.members[0]!, i, j);
    // R = (c²/4 + f²)/(2f) = 34/6; θ = 2·asin(5/R).
    const radius = (25 + 9) / 6;
    expect(summary.arc?.radius).toBeCloseTo(radius, 12);
    expect(summary.length).toBeCloseTo(radius * 2 * Math.asin(5 / radius), 10);
    expect(summary.length).toBeGreaterThan(summary.arc!.chord + 2);
  });
});
