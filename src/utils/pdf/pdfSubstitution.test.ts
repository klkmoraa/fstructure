import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../../engine/solver';
import { createBlankProject } from '../../data/defaultProject';
import { MODEL_START_DEFAULTS, withModelStart } from '../../data/modelStarts';
import { solveMethodOfJoints } from '../../analysis-methods/methodOfJoints';
import { createModelIndex, type ReportContext } from './reportContext';
import { freeBodyEquations } from './pdfSubstitution';

describe('equilibrio de un cuerpo libre de armadura', () => {
  it('cierra las dos sumas en un nudo al que las barras llegan por su extremo j', () => {
    const project = withModelStart(createBlankProject(), 'truss-pratt', MODEL_START_DEFAULTS['truss-pratt']);
    const combination = project.combinations.find((entry) => entry.id === 'SERV')!;
    const analysis = analyzeProject(project, combination);
    const context = { project, analysis, scenarioFactors: combination.factors, index: createModelIndex(project, analysis) } as unknown as ReportContext;
    const solution = solveMethodOfJoints(project, analysis, combination);
    if (!solution.applicable) throw new Error('el método de los nudos debe aplicar a la Pratt');
    const solved = solution.steps.flatMap((step) => step.members);
    // B4 es el extremo j de CI4 (B3 → B4) y de D4 (T3 → B4): antes su coseno se invertía dos
    // veces, la suma vertical no cerraba y se omitía en silencio.
    const meeting = project.members
      .filter((member) => member.i === 'B4' || member.j === 'B4')
      .map((member) => ({ memberId: member.id, nodeId: 'B4', force: solved.find((entry) => entry.memberId === member.id)!.value }));
    const sums = freeBodyEquations(context, ['B4'], meeting);
    expect(sums.map((sum) => sum.lhs)).toEqual(['ΣF_x', 'ΣF_y']);
    expect(sums[1]!.symbolic).toBe('N_{D4} s_{D4} + F_y(B4)');
  });
});
