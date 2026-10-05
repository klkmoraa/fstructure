import { describe, expect, it } from 'vitest';

import { axialCantilever, bendingCantilever, torsionCantilever } from './fixtures';
import { analyzeSpace3DProject } from './solver';

/**
 * Verificación del elemento de pórtico de seis GDL contra solución cerrada.
 *
 * Los fixtures son voladizos alineados con el eje global X y referencia de
 * orientación `[0, 1, 0]`, de modo que la triada local coincide con la global y
 * las fórmulas de manual aplican sin transformar ejes. Se comprueban los seis
 * grados de libertad: axial, flexión en ambos planos con sus rotaciones de
 * punta, y torsión.
 */

const L = 2;
const E = 200_000_000;
const G = 80_000_000;
const A = 0.01;
const Iy = 3e-5;
const Iz = 8e-5;
const J = 2e-5;
const P = 10;
const T = 10;

const freeEnd = (project: Parameters<typeof analyzeSpace3DProject>[0]) => {
  const result = analyzeSpace3DProject(project, 'CO1');
  expect(result.success, result.issues.map((issue) => `${issue.code}:${issue.field}`).join(', ')).toBe(true);
  const node = result.nodeResults.find((item) => item.nodeId === 'J');
  expect(node, 'el extremo libre debe aparecer en los resultados').toBeDefined();
  return { node: node!, result };
};

const relativeError = (value: number, exact: number) => Math.abs(value - exact) / Math.abs(exact);

describe('voladizo de seis GDL contra solución cerrada', () => {
  it('axial: ux = P·L / (E·A)', () => {
    const { node } = freeEnd(axialCantilever({}));
    expect(relativeError(node.displacement.ux, P * L / (E * A))).toBeLessThan(1e-9);
    expect(node.displacement.uy).toBeCloseTo(0, 12);
    expect(node.displacement.rz).toBeCloseTo(0, 12);
  });

  it('flexión en el plano XY: uy = P·L³/(3·E·Iz) y rz = P·L²/(2·E·Iz)', () => {
    const { node } = freeEnd(bendingCantilever({ axis: 'y' }));
    expect(relativeError(node.displacement.uy, P * L ** 3 / (3 * E * Iz))).toBeLessThan(1e-9);
    expect(relativeError(Math.abs(node.displacement.rz), P * L ** 2 / (2 * E * Iz))).toBeLessThan(1e-9);
    // Una carga en Y no debe acoplarse con el plano XZ ni con la torsión.
    expect(node.displacement.uz).toBeCloseTo(0, 12);
    expect(node.displacement.rx).toBeCloseTo(0, 12);
  });

  it('flexión en el plano XZ: uz = P·L³/(3·E·Iy) y ry = P·L²/(2·E·Iy)', () => {
    const { node } = freeEnd(bendingCantilever({ axis: 'z' }));
    expect(relativeError(node.displacement.uz, P * L ** 3 / (3 * E * Iy))).toBeLessThan(1e-9);
    expect(relativeError(Math.abs(node.displacement.ry), P * L ** 2 / (2 * E * Iy))).toBeLessThan(1e-9);
    expect(node.displacement.uy).toBeCloseTo(0, 12);
    expect(node.displacement.rx).toBeCloseTo(0, 12);
  });

  it('torsión: rx = T·L / (G·J)', () => {
    const { node } = freeEnd(torsionCantilever({}));
    expect(relativeError(node.displacement.rx, T * L / (G * J))).toBeLessThan(1e-9);
    expect(node.displacement.uy).toBeCloseTo(0, 12);
    expect(node.displacement.uz).toBeCloseTo(0, 12);
  });

  it('distingue los dos ejes de flexión por su inercia', () => {
    // Iz > Iy, así que la misma carga flecta más en el plano débil.
    const weak = freeEnd(bendingCantilever({ axis: 'z' })).node.displacement.uz;
    const strong = freeEnd(bendingCantilever({ axis: 'y' })).node.displacement.uy;
    expect(relativeError(weak / strong, Iz / Iy)).toBeLessThan(1e-9);
  });

  it('cierra el equilibrio en los cuatro casos', () => {
    for (const project of [axialCantilever({}), bendingCantilever({ axis: 'y' }), bendingCantilever({ axis: 'z' }), torsionCantilever({})]) {
      const { result } = freeEnd(project);
      expect(result.diagnostics.equilibrium.normalized).toBeLessThanOrEqual(1e-8);
    }
  });
});
