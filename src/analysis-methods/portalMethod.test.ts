import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { MODEL_START_DEFAULTS, withModelStart } from '../data/modelStarts';
import { analyzeProject } from '../engine/solver';
import type { LoadCombination, MemberLoad, ProjectModel } from '../types';
import { solveCantileverMethod, type CantileverMethodResult } from './cantileverMethod';
import { solvePortalMethod, type PortalMethodResult } from './portalMethod';

/**
 * The app's own portal start: one bay of 6 m, one storey of 3.5 m, fixed bases, 15 + 7 kN/m on
 * the beam, self-weight in CM and 30 kN of lateral load shared by the two top joints (case S).
 */
const portalStart = (): ProjectModel => withModelStart(createBlankProject(), 'frame-portal', MODEL_START_DEFAULTS['frame-portal']);
const combinationOf = (project: ProjectModel, id: string): LoadCombination => project.combinations.find((entry) => entry.id === id)!;

const portal = (project: ProjectModel, combination: LoadCombination | null): PortalMethodResult => {
  const outcome = solvePortalMethod(project, combination);
  if (!outcome.applicable) throw new Error(`Portal rejected the model: ${outcome.reasonKey}`);
  return outcome;
};
const cantilever = (project: ProjectModel, combination: LoadCombination | null): CantileverMethodResult => {
  const outcome = solveCantileverMethod(project, combination);
  if (!outcome.applicable) throw new Error(`Cantilever rejected the model: ${outcome.reasonKey}`);
  return outcome;
};

const columnLoad = (overrides: Partial<MemberLoad>): MemberLoad => ({
  id: 'w', memberId: 'C11', caseId: 'S', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
  start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: 0, qyEnd: 0, ...overrides,
});

describe('Portal y Voladizo: la carga lateral se reparte, la gravitacional se declara', () => {
  it('el inicio de pórtico bajo U2 (1.2 CM + 1.0 CV + 1.0 S) admite ambos métodos', () => {
    const project = portalStart();
    const u2 = combinationOf(project, 'U2');
    const analysis = analyzeProject(project, u2, { includeEducationTrace: false });
    expect(analysis.success).toBe(true);

    // A mano, H = 30 kN en el nivel 1 y h = 3.5 m: dos columnas de igual ancho tributario
    // (3 m cada una) toman V = 15 kN; con el punto de inflexión a media altura, M = 15·1.75 =
    // 26.25 kN·m en sus dos extremos; la viga, con inflexión al centro, toma 26.25 kN·m en cada
    // extremo y un cortante 2·26.25/6 = 8.75 kN, que es la axial ±8.75 kN de las columnas.
    const solution = portal(project, u2);
    expect(solution.storyShear).toEqual([expect.closeTo(30, 12)]);
    for (const column of solution.columns) {
      expect(column.shear).toBeCloseTo(15, 12);
      expect(Math.abs(column.bottomMoment)).toBeCloseTo(26.25, 12);
      expect(Math.abs(column.topMoment)).toBeCloseTo(26.25, 12);
      expect(Math.abs(column.axial)).toBeCloseTo(8.75, 12);
    }
    expect(Math.abs(solution.beams[0].moment)).toBeCloseTo(26.25, 12);
    expect(Math.abs(solution.beams[0].shear)).toBeCloseTo(8.75, 12);

    // The gravity of the combination is declared, not distributed: 15 and 7 kN/m on the beam and
    // the self-weight, with their factors.
    expect(solution.excluded).toEqual([
      { kind: 'beam-gravity', loadId: 'CM-V11', memberId: 'V11', factor: 1.2 },
      { kind: 'beam-gravity', loadId: 'CV-V11', memberId: 'V11', factor: 1 },
      { kind: 'self-weight', loadId: 'peso propio', factor: 1.2 },
    ]);
    // Exactly the numbers of the lateral case alone: the gravity changes nothing in the method.
    const lateralOnly = portal(project, { id: 'S', name: 'S', factors: { S: 1 } });
    expect(lateralOnly.excluded).toEqual([]);
    solution.columns.forEach((column, index) => {
      expect(column.shear).toBeCloseTo(lateralOnly.columns[index].shear, 12);
      expect(column.axial).toBeCloseTo(lateralOnly.columns[index].axial, 12);
    });

    // The comparison is against a matrix run with only the lateral loads: its base reactions add
    // up to −30 kN horizontally and to zero vertically — no gravity in the oracle.
    const solverRx = solution.baseChecks.reduce((sum, check) => sum + check.solverRx, 0);
    const solverRy = solution.baseChecks.reduce((sum, check) => sum + check.solverRy, 0);
    expect(solverRx).toBeCloseTo(-30, 9);
    expect(solverRy).toBeCloseTo(0, 9);
    // The full U2 analysis, by contrast, carries the gravity on its supports.
    expect(analysis.nodeResults.reduce((sum, entry) => sum + entry.ry, 0)).toBeGreaterThan(100);
  });

  it('Voladizo sobre el mismo pórtico: axial por la fórmula de flexión, la misma exclusión', () => {
    const project = portalStart();
    const u2 = combinationOf(project, 'U2');
    const solution = cantilever(project, u2);
    // Corte a media altura: momento de vuelco 30·1.75 = 52.5 kN·m; con dos columnas iguales a ±3 m
    // del centroide, N = 52.5·3/(2·3²) = 8.75 kN, y el cortante de cada columna vuelve a ser 15 kN.
    for (const column of solution.columns) {
      expect(Math.abs(column.axial)).toBeCloseTo(8.75, 12);
      expect(column.shear).toBeCloseTo(15, 12);
    }
    expect(solution.excluded.map((action) => action.kind)).toEqual(['beam-gravity', 'beam-gravity', 'self-weight']);
    expect(solution.baseChecks.reduce((sum, check) => sum + check.solverRy, 0)).toBeCloseTo(0, 9);
  });

  it('admite carga a lo largo de una columna y rechaza la que la empuja de lado', () => {
    const base = portalStart();
    const u2 = combinationOf(base, 'U2');
    const withLoad = (load: MemberLoad): ProjectModel => ({ ...base, memberLoads: [...base.memberLoads, load] });
    const accepted = (project: ProjectModel) => {
      const outcomes = [solvePortalMethod(project, u2), solveCantileverMethod(project, u2)];
      for (const outcome of outcomes) if (!outcome.applicable) throw new Error(outcome.reasonKey);
      return outcomes as [PortalMethodResult, CantileverMethodResult];
    };
    const rejected = (project: ProjectModel) => {
      expect(solvePortalMethod(project, u2)).toEqual({ applicable: false, reasonKey: 'method.rejectedMemberLateralLoad' });
      expect(solveCantileverMethod(project, u2)).toEqual({ applicable: false, reasonKey: 'method.rejectedMemberLateralLoad' });
    };

    // Peso de un muro sobre la columna, a lo largo de su eje: se declara.
    const [axial] = accepted(withLoad(columnLoad({ id: 'muro', qyStart: -4, qyEnd: -4 })));
    expect(axial.excluded).toContainEqual({ kind: 'column-axial', loadId: 'muro', memberId: 'C11', factor: 1 });
    // A local load along the column's own axis (local x) is the same thing.
    accepted(withLoad(columnLoad({ id: 'eje', coordinateSystem: 'local', qxStart: -2, qxEnd: -2 })));
    // Viento repartido sobre la columna, global o en ejes locales, o una puntual horizontal: no.
    rejected(withLoad(columnLoad({ id: 'viento', qxStart: 2, qxEnd: 2 })));
    rejected(withLoad(columnLoad({ id: 'viento-local', coordinateSystem: 'local', qyStart: -2, qyEnd: -2 })));
    rejected(withLoad(columnLoad({ id: 'P', type: 'point', position: 0.5, px: 5, py: 0, start: 0.5, end: 0.5 })));
    // A sloping push on the beam has a horizontal part too.
    rejected(withLoad(columnLoad({ id: 'inclinada', memberId: 'V11', caseId: 'CM', qxStart: 1, qxEnd: 1, qyStart: -3, qyEnd: -3 })));
    // Wind generated on the column by a tributary surface is seen and refused like typed wind.
    rejected({
      ...base,
      generatedLoadSources: [{ id: 'viento', kind: 'tributary-surface', caseId: 'S', memberIds: ['C11'], pressure: 1, tributaryWidth: 3, direction: 'global-x' }],
    });
    // A load of an inactive case in the combination does not count either way.
    accepted(withLoad(columnLoad({ id: 'otro', caseId: 'NOPE', qxStart: 2, qxEnd: 2 })));
  });

  it('sin carga lateral no hay nada que repartir', () => {
    const project = portalStart();
    expect(solvePortalMethod(project, combinationOf(project, 'U1'))).toEqual({ applicable: false, reasonKey: 'method.rejectedNoLateralLoad' });
    expect(solveCantileverMethod(project, combinationOf(project, 'SERV'))).toEqual({ applicable: false, reasonKey: 'method.rejectedNoLateralLoad' });
  });
});
