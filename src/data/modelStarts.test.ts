import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../engine/solver';
import { createBlankProject } from './defaultProject';
import { MODEL_STARTS, withModelStart, type ModelStartId } from './modelStarts';

const G = 9.80665;
const service = (id: ModelStartId) => {
  const project = withModelStart(createBlankProject(), id);
  const result = analyzeProject(project, project.combinations.find((item) => item.id === 'SERV'), { includeEducationTrace: false });
  expect(result.success).toBe(true);
  return { project, result, ry: (nodeId: string) => result.nodeResults.find((node) => node.nodeId === nodeId)!.ry };
};

describe('inicios del Modelo 2D', () => {
  it('cada inicio produce un modelo que se calcula', () => {
    for (const start of MODEL_STARTS) service(start);
  });

  it('viga apoyada: cada reacción es wL/2 con el peso propio de la sección 30 × 50', () => {
    const { ry } = service('beam-simple');
    const w = 15 + 8 + 0.15 * 2400 * G / 1000;
    expect(ry('N1')).toBeCloseTo(w * 6 / 2, 2);
    expect(ry('N2')).toBeCloseTo(w * 6 / 2, 2);
  });

  it('voladizo: el empotramiento toma wL y wL²/2', () => {
    const { result } = service('beam-cantilever');
    const w = 12 + 6 + 0.15 * 2400 * G / 1000;
    const fixed = result.nodeResults.find((node) => node.nodeId === 'N1')!;
    expect(fixed.ry).toBeCloseTo(w * 3, 2);
    expect(Math.abs(fixed.rm)).toBeCloseTo(w * 3 ** 2 / 2, 2);
  });

  it('viga continua de dos claros iguales: 3wL/8 en los extremos y 10wL/8 al centro', () => {
    const { ry } = service('beam-continuous');
    const w = 15 + 8 + 0.15 * 2400 * G / 1000;
    expect(ry('N1')).toBeCloseTo(3 * w * 5 / 8, 1);
    expect(ry('N2')).toBeCloseTo(10 * w * 5 / 8, 1);
    expect(ry('N3')).toBeCloseTo(3 * w * 5 / 8, 1);
  });

  it('armadura Pratt simétrica: cada apoyo toma la mitad de las cargas de los nudos', () => {
    const { ry } = service('truss-pratt');
    expect(ry('B0')).toBeCloseTo(3 * 16 / 2, 3);
    expect(ry('B4')).toBeCloseTo(3 * 16 / 2, 3);
  });

  it('sólo escribe en un modelo vacío', () => {
    const project = withModelStart(createBlankProject(), 'beam-simple');
    expect(withModelStart(project, 'truss-pratt')).toBe(project);
  });
});
