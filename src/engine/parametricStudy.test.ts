import { describe, expect, it } from 'vitest';
import { availableSolver2dCorpus, resolveCorpusProject } from './solver2dCorpus';
import {
  PARAMETRIC_MAX_VARIANTS,
  parseParametricFactors,
  runParametricStudy,
  validateParametricFactors,
} from './parametricStudy';

describe('estudio paramétrico de propiedades de miembro', () => {
  it('interpreta factores relativos y rechaza entradas no físicas', () => {
    expect(parseParametricFactors('0.8, 1, 1.2')).toEqual([0.8, 1, 1.2]);
    expect(parseParametricFactors('0.5; 2')).toEqual([0.5, 2]);
    expect(() => parseParametricFactors('0.8, hola')).toThrow(/factor/i);
    expect(() => validateParametricFactors([0, 1])).toThrow(/positivo/i);
    expect(() => validateParametricFactors(Array.from({ length: PARAMETRIC_MAX_VARIANTS + 1 }, () => 1))).toThrow(/máximo/i);
  });

  it('resuelve variantes sin mutar el proyecto y devuelve métricas del miembro', () => {
    const fixture = availableSolver2dCorpus.find((item) => item.id === 'axial-bar');
    if (!fixture) throw new Error('No se encontró el fixture axial-bar.');
    const project = resolveCorpusProject(fixture);
    const before = structuredClone(project);

    const study = runParametricStudy({
      project,
      memberId: 'AB',
      parameter: 'E',
      factors: [0.5, 1, 2],
    });

    expect(project).toEqual(before);
    expect(study.memberId).toBe('AB');
    expect(study.parameter).toBe('E');
    expect(study.baseValue).toBe(project.members[0].E);
    expect(study.variants).toHaveLength(3);
    expect(study.variants.map((variant) => variant.parameterValue)).toEqual([project.members[0].E * 0.5, project.members[0].E, project.members[0].E * 2]);
    expect(study.variants.every((variant) => variant.success)).toBe(true);
    expect(study.variants[0].metrics.axial).toBeCloseTo(10, 8);
    expect(study.variants[0].metrics.deformation).not.toBeNull();
  });

  it('valida el miembro objetivo antes de lanzar resoluciones', () => {
    const fixture = availableSolver2dCorpus.find((item) => item.id === 'axial-bar');
    if (!fixture) throw new Error('No se encontró el fixture axial-bar.');
    const project = resolveCorpusProject(fixture);

    expect(() => runParametricStudy({ project, memberId: 'missing', parameter: 'I', factors: [1] })).toThrow(/miembro/i);
    expect(() => runParametricStudy({ project, memberId: 'AB', parameter: 'A', factors: [-1] })).toThrow(/positivo/i);
    expect(runParametricStudy({ project, memberId: 'AB', parameter: 'E', factors: [Number.MAX_VALUE] }).variants[0]).toMatchObject({ success: false, reliability: 'failed' });
  });
});
