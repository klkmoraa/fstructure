import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../engine/solver';
import { createBlankProject } from './defaultProject';
import { MODEL_STARTS, MODEL_START_DEFAULTS, modelStartFieldError, modelStartValid, withModelStart, type ModelStartId, type ModelStartParams } from './modelStarts';

const G = 9.80665;
const service = (id: ModelStartId, params?: Partial<ModelStartParams>) => {
  const project = withModelStart(createBlankProject(), id, { ...MODEL_START_DEFAULTS[id], ...params });
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

  it('armadura Pratt de seis tableros: cada apoyo toma la mitad de las cargas de los cinco nudos superiores', () => {
    const { ry, project } = service('truss-pratt', { span: 12, count: 6, height: 2.5, dead: 8, live: 4 });
    expect(project.members.filter((member) => member.type === 'truss')).toHaveLength(6 + 4 + 6 + 5);
    expect(ry('B0')).toBeCloseTo(5 * 12 / 2, 3);
    expect(ry('B6')).toBeCloseTo(5 * 12 / 2, 3);
  });

  it('pórtico de dos claros y tres niveles: la vertical total es la carga de las vigas más el peso propio', () => {
    const { project, result } = service('frame-portal', { count: 2, span: 5, levels: 3, height: 3, dead: 10, live: 5, lateral: 0 });
    expect(project.nodes.filter((node) => node.support.type === 'fixed')).toHaveLength(3);
    const vertical = result.nodeResults.reduce((total, node) => total + node.ry, 0);
    expect(vertical).toBeGreaterThan(3 * 2 * 5 * 15);
  });

  it('arco biarticulado: la carga vertical se reparte por igual y aparece empuje', () => {
    const { project, result } = service('arch', { span: 12, height: 4 });
    expect(project.members[0]!.curve?.bulge).toBeCloseTo(2 * 4 / 12, 12);
    const [left, right] = result.nodeResults;
    expect(left!.ry).toBeCloseTo(right!.ry, 3);
    expect(Math.abs(left!.rx)).toBeGreaterThan(1);
    expect(left!.rx).toBeCloseTo(-right!.rx, 3);
  });

  it('rechaza medidas fuera de alcance sin tocar el proyecto', () => {
    const blank = createBlankProject();
    expect(modelStartFieldError('arch', 'height', { ...MODEL_START_DEFAULTS.arch, span: 6, height: 4 })?.key).toBe('rise');
    expect(modelStartFieldError('truss-pratt', 'count', { ...MODEL_START_DEFAULTS['truss-pratt'], count: 5 })?.key).toBe('even');
    expect(modelStartFieldError('frame-portal', 'levels', { ...MODEL_START_DEFAULTS['frame-portal'], levels: 0 })?.key).toBe('range');
    expect(modelStartValid('beam-simple', { ...MODEL_START_DEFAULTS['beam-simple'], span: Number.NaN })).toBe(false);
    expect(withModelStart(blank, 'arch', { ...MODEL_START_DEFAULTS.arch, height: 99 })).toBe(blank);
  });
});
