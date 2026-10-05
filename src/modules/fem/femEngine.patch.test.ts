import { describe, expect, it } from 'vitest';
import { analyzeFemDocument, type FemDocumentV1, type FemElementType } from './femEngine';

/**
 * Patch test de esfuerzo plano.
 *
 * Es la verificación estándar de un elemento finito: bajo un estado de esfuerzo
 * uniforme, la malla debe reproducirlo de forma exacta, elemento por elemento e
 * independientemente de cómo esté dividida. Un elemento que falla el patch test
 * no converge. Se comprueba aquí contra la solución cerrada, no contra una
 * corrida previa del propio motor.
 */

const E = 210_000; // MPa
const NU = 0.3;
const THICKNESS = 1; // mm
const LENGTH_X = 4; // mm
const LENGTH_Y = 2; // mm
const SIGMA = 100; // MPa, tracción uniaxial en x

const uniaxialPatch = (type: Extract<FemElementType, 'TRI3' | 'QUAD4'>): FemDocumentV1 => {
  const id = new Map<string, string>();
  const nodes = [] as { id: string; x: number; y: number }[];
  let counter = 0;
  for (let j = 0; j <= 1; j += 1) {
    for (let i = 0; i <= 2; i += 1) {
      const nodeId = `n${counter += 1}`;
      id.set(`${i},${j}`, nodeId);
      nodes.push({ id: nodeId, x: i * LENGTH_X / 2, y: j * LENGTH_Y });
    }
  }
  const at = (i: number, j: number) => id.get(`${i},${j}`)!;
  const elements = type === 'QUAD4'
    ? [0, 1].map((i) => ({ id: `E${i}`, type, nodeIds: [at(i, 0), at(i + 1, 0), at(i + 1, 1), at(i, 1)] }))
    : [0, 1].flatMap((i) => [
      { id: `E${i}a`, type, nodeIds: [at(i, 0), at(i + 1, 0), at(i + 1, 1)] },
      { id: `E${i}b`, type, nodeIds: [at(i, 0), at(i + 1, 1), at(i, 1)] },
    ]);
  // Resultante del borde traccionado repartida entre sus dos nodos.
  const edgeForce = SIGMA * LENGTH_Y * THICKNESS;
  return {
    kind: 'fem-document', schemaVersion: 1, id: `patch-${type}`, name: `Patch ${type}`, analysis: 'plane-stress',
    material: { id: 'patch-material', E, nu: NU, thickness: THICKNESS },
    nodes,
    elements,
    loads: [
      { id: 'L1', nodeId: at(2, 0), fx: edgeForce / 2, fy: 0 },
      { id: 'L2', nodeId: at(2, 1), fx: edgeForce / 2, fy: 0 },
    ],
    // Apoyos mínimos: impiden los tres modos de sólido rígido sin coaccionar
    // la contracción de Poisson, que debe quedar libre.
    restraints: [{ nodeId: at(0, 0), ux: true, uy: true }, { nodeId: at(0, 1), ux: true }],
  };
};

describe.each(['TRI3', 'QUAD4'] as const)('patch test de esfuerzo plano con %s', (type) => {
  const result = analyzeFemDocument(uniaxialPatch(type));

  it('resuelve la malla', () => {
    expect(result.success, result.reason).toBe(true);
    expect(result.stresses.length).toBeGreaterThanOrEqual(2);
  });

  it('reproduce el estado uniaxial uniforme en todos los elementos', () => {
    for (const element of result.stresses) {
      expect(element.stress[0], `${element.elementId} sigma_x`).toBeCloseTo(SIGMA, 9);
      expect(element.stress[1], `${element.elementId} sigma_y`).toBeCloseTo(0, 9);
      expect(element.stress[2], `${element.elementId} tau_xy`).toBeCloseTo(0, 9);
    }
  });

  it('reproduce las deformaciones de la ley de Hooke, incluida la de Poisson', () => {
    for (const element of result.stresses) {
      expect(element.strain[0], `${element.elementId} eps_x`).toBeCloseTo(SIGMA / E, 12);
      expect(element.strain[1], `${element.elementId} eps_y`).toBeCloseTo(-NU * SIGMA / E, 12);
      expect(element.strain[2], `${element.elementId} gamma_xy`).toBeCloseTo(0, 12);
      expect(element.vonMises, `${element.elementId} von Mises`).toBeCloseTo(SIGMA, 9);
    }
  });

  it('cierra el equilibrio global', () => {
    expect(result.equilibrium.normalized).not.toBeNull();
    expect(result.equilibrium.normalized!).toBeLessThan(1e-12);
    const reactionX = result.reactions.reduce((sum, reaction) => sum + reaction.ux, 0);
    expect(reactionX).toBeCloseTo(-SIGMA * LENGTH_Y * THICKNESS, 9);
  });
});
