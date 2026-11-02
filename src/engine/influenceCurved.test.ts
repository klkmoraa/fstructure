import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { withModelStart } from '../data/modelStarts';
import { memberCurveLength } from '../graphics/memberCurve';
import { buildInfluenceLine, evaluateInfluenceLine } from './influence';

/**
 * Arco biarticulado del inicio rápido (claro 10 m, flecha 3 m). La línea de
 * influencia se mide sobre el arco: la cuerda (10 m) dejaba la carga y el corte
 * en otro sitio del que leen los diagramas.
 */
const project = withModelStart(createBlankProject(), 'arch');
const arch = project.members[0]!;
const [left, right] = project.nodes;
const length = memberCurveLength(arch, left!, right!);

/**
 * Referencia independiente del solver: método de las fuerzas para el arco
 * circular biarticulado con carga unitaria en la clave (Euler–Bernoulli con
 * deformación axial). Con φ desde la clave: y = R cos φ − (R − f),
 * |x| = R sen φ, ds = R dφ, M₀ = ½(c/2 − |x|), N₀ = −½ sen φ, M₁ = −y, N₁ = −cos φ.
 */
const crownMomentByForces = () => {
  const span = 10, rise = 3, radius = (span ** 2 / 4 + rise ** 2) / (2 * rise);
  const half = Math.asin(span / 2 / radius);
  const EI = arch.E * arch.I, EA = arch.E * arch.A;
  const simpson = (f: (phi: number) => number, n = 2000) => {
    const h = half / n;
    let sum = f(0) + f(half);
    for (let k = 1; k < n; k += 1) sum += (k % 2 ? 4 : 2) * f(k * h);
    return 2 * sum * h / 3; // las dos mitades
  };
  const y = (phi: number) => radius * Math.cos(phi) - (radius - rise);
  const m0 = (phi: number) => 0.5 * (span / 2 - radius * Math.sin(phi));
  const numerator = simpson((phi) => m0(phi) * y(phi) * radius / EI - 0.5 * Math.sin(phi) * Math.cos(phi) * radius / EA);
  const denominator = simpson((phi) => y(phi) ** 2 * radius / EI + Math.cos(phi) ** 2 * radius / EA);
  return span / 4 - rise * numerator / denominator;
};

describe('línea de influencia sobre un arco', () => {
  it('recorre la longitud del arco y coincide con el método de las fuerzas en la clave', { timeout: 60_000 }, () => {
    const line = buildInfluenceLine(project, ['A1'], { memberId: 'A1', x: length / 2, quantity: 'M' });
    expect(length).toBeGreaterThan(12);
    expect(line.path.length).toBeCloseTo(length, 10);
    expect(line.target.x).toBeCloseTo(length / 2, 10);
    expect(line.fit.accepted).toBe(true);

    const at = (position: number) => evaluateInfluenceLine(line, position)!;
    // Una carga sobre una articulación no flexiona el arco.
    expect(at(0)).toBeCloseTo(0, 6);
    expect(at(length)).toBeCloseTo(0, 6);
    // El momento en la clave es simétrico sólo si el corte está en la clave del arco.
    for (const fraction of [0.15, 0.3, 0.42]) {
      expect(at(fraction * length)).toBeCloseTo(at((1 - fraction) * length), 5);
    }
    const reference = crownMomentByForces();
    // La malla interna de cuerdas (≤ 2.8°) deja ~0.15 % de diferencia.
    expect(Math.abs(at(length / 2) - reference) / Math.abs(reference)).toBeLessThan(3e-3);
    // M es continuo: los cortes del ajuste dentro del arco no son saltos.
    expect(line.jumps).toEqual([]);
  });

  it('el cortante en la clave salta la carga unitaria entera, y sólo ahí', { timeout: 60_000 }, () => {
    const line = buildInfluenceLine(project, ['A1'], { memberId: 'A1', x: length / 2, quantity: 'V' });
    // En la clave la tangente es horizontal: la carga vertical es toda transversal.
    expect(line.jumps).toHaveLength(1);
    expect(line.jumps[0]!.position).toBeCloseTo(length / 2, 8);
    expect(Math.abs(line.jumps[0]!.delta)).toBeCloseTo(1, 4);
  });
});
