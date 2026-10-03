import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { evaluateDiagramAt } from '../../engine/diagram';
import { analyzeProject } from '../../engine/solver';
import type { MemberLoad, NodalLoad, ProjectModel } from '../../types';
import { designCode, type DesignCodeId } from './codes';
import { designFrame, swayEffectiveLengthFactor, type FrameDesignInput } from './frame';

const frameInput = (overrides: Partial<FrameDesignInput> = {}, code: DesignCodeId = 'ntc-2023'): FrameDesignInput => ({
  code,
  bays: [5, 4],
  stories: [
    { heightM: 3.5, deadKnPerM: 20, liveKnPerM: 9, lateralKn: 0 },
    { heightM: 3, deadKnPerM: 16, liveKnPerM: 5, lateralKn: 0 },
  ],
  base: 'fixed',
  braced: false,
  beam: { widthMm: 300, heightMm: 550 },
  column: { widthMm: 400, heightMm: 400 },
  coverMm: 40,
  fcMpa: 25,
  fyMpa: 420,
  fyStirrupMpa: 420,
  maxAggregateMm: 19,
  includeSelfWeight: true,
  combinations: designCode(code).loadCombinations('B'),
  lateralCombinations: designCode(code).lateralCombinations('B').combinations,
  lateralReference: designCode(code).lateralCombinations('B').reference,
  sustainedLiveRatio: 0.4,
  longTermXi: 2,
  damagesNonstructural: false,
  beamBarDiameterMm: null,
  stirrupDiameterMm: null,
  columnReinforcement: { barDiameterMm: 19.1, barsAlongWidth: 3, barsAlongDepth: 3, tieDiameterMm: 9.5 },
  group: 'B2',
  beamInertiaFactor: 1,
  columnInertiaFactor: 1,
  effectiveLengthFactor: null,
  ...overrides,
});

/** El mismo pórtico de un claro y un nivel en el solver 2D, con la carga factorizada en un solo caso. */
function enginePortal(widthM: number, heightM: number, beamKnPerM: number, columnKnPerM: number, lateralKn: number, input: FrameDesignInput): ProjectModel {
  const base = createDefaultProject();
  const e = designCode(input.code).elasticModulusMpa(input.fcMpa) * 1e3;
  const column = { E: e, A: input.column.widthMm * input.column.heightMm / 1e6, I: input.column.widthMm * input.column.heightMm ** 3 / 12 / 1e12 };
  const beam = { E: e, A: input.beam.widthMm * input.beam.heightMm / 1e6, I: input.beam.widthMm * input.beam.heightMm ** 3 / 12 / 1e12 };
  const memberLoads: MemberLoad[] = [
    { id: 'qb', memberId: 'B', caseId: 'U', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -beamKnPerM, qyEnd: -beamKnPerM },
    ...['C1', 'C2'].map((memberId) => ({ id: `q${memberId}`, memberId, caseId: 'U', type: 'distributed' as const, coordinateSystem: 'global' as const, lengthBasis: 'real' as const, start: 0, end: 1, qyStart: -columnKnPerM, qyEnd: -columnKnPerM })),
  ];
  const nodalLoads: NodalLoad[] = lateralKn ? [{ id: 'h1', nodeId: 'B1', caseId: 'U', fx: lateralKn / 2, fy: 0, mz: 0 }, { id: 'h2', nodeId: 'B2', caseId: 'U', fx: lateralKn / 2, fy: 0, mz: 0 }] : [];
  return {
    ...base,
    nodes: [
      { id: 'A1', x: 0, y: 0, support: { type: 'fixed' } }, { id: 'A2', x: widthM, y: 0, support: { type: 'fixed' } },
      { id: 'B1', x: 0, y: heightM, support: { type: 'none' } }, { id: 'B2', x: widthM, y: heightM, support: { type: 'none' } },
    ],
    members: [
      { id: 'C1', i: 'A1', j: 'B1', type: 'frame', ...column },
      { id: 'C2', i: 'A2', j: 'B2', type: 'frame', ...column },
      { id: 'B', i: 'B1', j: 'B2', type: 'frame', ...beam },
    ],
    loadCases: [{ id: 'U', name: 'U', category: 'permanent', active: true, selfWeightFactor: 0 }],
    combinations: [], prescribedDisplacements: [], memberInitialEffects: [], nodeLinks: [], multiPointConstraints: [], generatedLoadSources: [], movingLoadCases: [], designAssignments: [],
    memberLoads,
    nodalLoads,
  };
}

describe('pórtico de vigas y columnas', () => {
  it('diseña cada nivel de vigas y cada columna', () => {
    const result = designFrame(frameInput());
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.beams).toHaveLength(2);
    expect(result.columns).toHaveLength(6);
    expect(result.members).toHaveLength(6 + 4);
    expect(result.lateral).toBe(false);
    expect(result.checks.filter((check) => check.id.startsWith('beam-'))).toHaveLength(2);
    expect(result.checks.filter((check) => check.id.startsWith('column-'))).toHaveLength(6);
    // Las vigas trazan su demanda al pórtico.
    expect(result.beams[0]!.result.checks.find((check) => check.id === 'flexure-negative')?.combination).toMatch(/^Pórtico · nivel 1/);
  });

  it('reproduce el solver 2D en un marco de un claro con la carga factorizada', () => {
    const input = frameInput({ bays: [6], stories: [{ heightM: 3.2, deadKnPerM: 18, liveKnPerM: 8, lateralKn: 0 }] });
    const result = designFrame(input);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const [combination] = input.combinations;
    const beamWeight = 24 * 0.3 * 0.55;
    const columnWeight = 24 * 0.4 * 0.4;
    // Con un solo claro la viva siempre desfavorece la sección de apoyo y la compresión de las columnas.
    const project = enginePortal(6, 3.2, combination!.dead * (18 + beamWeight) + combination!.live * 8, combination!.dead * columnWeight, 0, input);
    const engine = analyzeProject(project, { id: 'c', name: 'c', factors: { U: 1 } }, { includeEducationTrace: false });
    const beam = engine.memberResults.find((member) => member.memberId === 'B')!;
    const end = evaluateDiagramAt(beam.diagramSegments, beam.diagramJumps, 0, 'right')!;
    expect(result.beams[0]!.result.diagram.momentMinKnm[0]).toBeCloseTo(end.moment, 6);
    const column = engine.memberResults.find((member) => member.memberId === 'C1')!;
    const base = evaluateDiagramAt(column.diagramSegments, column.diagramJumps, 0, 'right')!;
    const left = result.columns.find((item) => item.line === 0)!;
    const maxAxial = left.states.find((state) => state.label === 'Pu máx.')!;
    expect(maxAxial.axialKn).toBeCloseTo(-base.axial, 6);
  });

  it('es simétrico con claros y cargas simétricas', () => {
    const result = designFrame(frameInput({ bays: [5, 5] }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    for (const story of [0, 1]) {
      const left = result.columns.find((item) => item.line === 0 && item.story === story)!;
      const right = result.columns.find((item) => item.line === 2 && item.story === story)!;
      expect(left.result.governingRatio).toBeCloseTo(right.result.governingRatio, 6);
      expect(left.states[left.governingState]!.axialKn).toBeCloseTo(right.states[right.governingState]!.axialKn, 6);
      expect(result.beams[story]!.bayRatios[0]).toBeCloseTo(result.beams[story]!.bayRatios[1]!, 6);
    }
  });

  it('calcula el índice de estabilidad con la rigidez lateral del marco', () => {
    const input = frameInput({ bays: [6], stories: [{ heightM: 3.2, deadKnPerM: 18, liveKnPerM: 8, lateralKn: 40 }] });
    const result = designFrame(input);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.lateral).toBe(true);
    const project = enginePortal(6, 3.2, 0, 0, 40, input);
    const engine = analyzeProject(project, { id: 'c', name: 'c', factors: { U: 1 } }, { includeEducationTrace: false });
    const drift = engine.nodeResults.filter((node) => node.nodeId.startsWith('B')).reduce((total, node) => total + node.ux, 0) / 2;
    const story = result.stories[0]!;
    expect(story.driftMm).toBeCloseTo(drift * 1e3, 6);
    expect(story.stiffnessKnPerM).toBeCloseTo(40 / drift, 3);
    expect(story.stabilityIndex).toBeCloseTo(story.verticalLoadKn * drift / (40 * 3.2), 6);
    // Las combinaciones accidentales entran en la envolvente de la viga y de las columnas, en ambos sentidos.
    expect(result.combinations.some((item) => item.lateral)).toBe(true);
    const column = result.columns[0]!;
    expect(column.states.some((state) => state.combination.includes('(→)'))).toBe(true);
    expect(column.states.some((state) => state.combination.includes('(←)'))).toBe(true);
    expect(column.states.some((state) => Math.abs(state.swayKnm) > 1)).toBe(true);
  });

  it('el marco arriostrado no se desplaza ni amplifica por desplazamiento', () => {
    const result = designFrame(frameInput({ braced: true, stories: [{ heightM: 3.5, deadKnPerM: 20, liveKnPerM: 9, lateralKn: 50 }] }));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.lateral).toBe(false);
    expect(result.stories[0]!.stabilityIndex).toBe(0);
    expect(result.columns.every((column) => column.effectiveLengthFactor === 1)).toBe(true);
  });

  it('reporta datos inválidos sin lanzar', () => {
    const result = designFrame(frameInput({ bays: [] }));
    expect(result.ok).toBe(false);
    const tall = designFrame(frameInput({ beam: { widthMm: 300, heightMm: 3600 } }));
    expect(tall.ok).toBe(false);
  });

  it.each(['ntc-2023', 'nsr-10', 'e060'] as const)('aplica las combinaciones laterales de %s', (code) => {
    const input = frameInput({ stories: [{ heightM: 3.5, deadKnPerM: 20, liveKnPerM: 9, lateralKn: 60 }, { heightM: 3, deadKnPerM: 16, liveKnPerM: 5, lateralKn: 40 }] }, code);
    const result = designFrame(input);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const lateral = result.checks.find((check) => check.id === 'lateral-combinations')!;
    expect(lateral.reference.standard).toBe(code === 'ntc-2023' ? 'ntc-cdmx-2023-criteria-actions' : 'complementary');
    expect(result.stories.every((story) => story.driftMm > 0)).toBe(true);
  });
});

describe('factor de longitud efectiva con desplazamiento lateral', () => {
  it('coincide con el nomograma', () => {
    // Valores del nomograma de marcos no arriostrados (Jackson y Moreland).
    expect(swayEffectiveLengthFactor(1, 1)).toBeCloseTo(1.32, 2);
    expect(swayEffectiveLengthFactor(1e-6, 1e6)).toBeCloseTo(2, 1);
    expect(swayEffectiveLengthFactor(10, 10)).toBeGreaterThan(3);
    expect(swayEffectiveLengthFactor(0, 0)).toBeCloseTo(1, 2);
  });
});
