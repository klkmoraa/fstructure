import { describe, expect, it } from 'vitest';
import { createBlankProject, createConcreteFrameProject, createDefaultProject } from '../../data/defaultProject';
import { designCode, type DesignCodeId } from './codes';
import { designFrame, type FrameDesignInput } from './frame';
import { designStructure, type StructureDesignOptions } from './structure';
import type { MemberLoad, MemberModel, NodeModel, ProjectModel } from '../../types';
import { model2dDesignSource } from './model2dSource';
import { withConcreteFrame } from '../../data/concreteFrame';
import { outOfScopeChecks } from './scope';

const code: DesignCodeId = 'nsr-10';
const frameInput: FrameDesignInput = {
  code,
  bays: [5, 4],
  stories: [
    { heightM: 3.5, deadKnPerM: 20, liveKnPerM: 9, lateralKn: 60 },
    { heightM: 3, deadKnPerM: 16, liveKnPerM: 5, lateralKn: 45 },
  ],
  base: 'fixed',
  braced: false,
  beam: { widthMm: 300, heightMm: 550 },
  column: { widthMm: 450, heightMm: 450 },
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
};

const options: StructureDesignOptions = {
  code, coverMm: 40, fcMpa: 25, fyMpa: 420, fyStirrupMpa: 420, maxAggregateMm: 19, includeSelfWeight: true,
  combinations: frameInput.combinations, lateralCombinations: frameInput.lateralCombinations, lateralReference: frameInput.lateralReference!,
  sustainedLiveRatio: 0.4, longTermXi: 2, damagesNonstructural: false, beamBarDiameterMm: null, stirrupDiameterMm: null,
  columnReinforcement: frameInput.columnReinforcement, group: 'B2', effectiveLengthFactor: null,
};

/** El mismo pórtico dibujado en el Modelo 2D: una carga muerta, una viva y un sismo. */
function modelOfFrame(): ProjectModel {
  const base = createDefaultProject();
  const e = designCode(code).elasticModulusMpa(25) * 1e3;
  const xs = [0, 5, 9];
  const ys = [0, 3.5, 6.5];
  const nodes: NodeModel[] = ys.flatMap((y, level) => xs.map((x, line) => ({ id: `N${line}${level}`, x, y, support: level === 0 ? { type: 'fixed' } : { type: 'none' } })));
  const column = { type: 'frame' as const, E: e, A: 0.45 * 0.45, I: 0.45 ** 4 / 12 };
  const beam = { type: 'frame' as const, E: e, A: 0.3 * 0.55, I: 0.3 * 0.55 ** 3 / 12 };
  const members: MemberModel[] = [
    ...[1, 2].flatMap((level) => xs.map((_, line) => ({ id: `C${line}${level}`, i: `N${line}${level - 1}`, j: `N${line}${level}`, ...column }))),
    ...[1, 2].flatMap((level) => [0, 1].map((bay) => ({ id: `B${bay}${level}`, i: `N${bay}${level}`, j: `N${bay + 1}${level}`, ...beam }))),
  ];
  const uniform = (id: string, memberId: string, caseId: string, q: number): MemberLoad => ({ id, memberId, caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -q, qyEnd: -q });
  const beamWeight = 24 * 0.3 * 0.55;
  const columnWeight = 24 * 0.45 * 0.45;
  const memberLoads: MemberLoad[] = [
    ...[1, 2].flatMap((level) => [0, 1].flatMap((bay) => [
      uniform(`D${bay}${level}`, `B${bay}${level}`, 'CM', frameInput.stories[level - 1]!.deadKnPerM + beamWeight),
      uniform(`L${bay}${level}`, `B${bay}${level}`, 'CV', frameInput.stories[level - 1]!.liveKnPerM),
    ])),
    ...members.filter((member) => member.id.startsWith('C')).map((member) => uniform(`W${member.id}`, member.id, 'CM', columnWeight)),
  ];
  return {
    ...base,
    name: 'Pórtico dibujado',
    nodes,
    members,
    loadCases: [
      { id: 'CM', name: 'Carga muerta', category: 'permanent', active: true, selfWeightFactor: 0 },
      { id: 'CV', name: 'Carga viva', category: 'variable', active: true, selfWeightFactor: 0 },
      { id: 'S', name: 'Sismo', category: 'accidental', active: true, selfWeightFactor: 0 },
    ],
    combinations: [],
    memberLoads,
    nodalLoads: [1, 2].flatMap((level) => xs.map((_, line) => ({ id: `S${line}${level}`, nodeId: `N${line}${level}`, caseId: 'S', fx: frameInput.stories[level - 1]!.lateralKn / 3, fy: 0, mz: 0 }))),
    prescribedDisplacements: [], memberInitialEffects: [], nodeLinks: [], multiPointConstraints: [], generatedLoadSources: [], movingLoadCases: [], designAssignments: [],
  };
}

describe('el Modelo 2D como fuente de Estructura', () => {
  it.each(['ntc-2023', 'nsr-10', 'e060'] as const)('diseña flexión/cortante de una viga inclinada con longitud real (%s)', (selectedCode) => {
    const length = Math.hypot(6, 2);
    const project: ProjectModel = { ...createBlankProject(),
      nodes: [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 6, y: 2, support: { type: 'roller', angleDeg: 90 } }],
      members: [{ id: 'V', i: 'A', j: 'B', type: 'frame', E: 25e6, A: .3 * .55, I: .3 * .55 ** 3 / 12 }],
      loadCases: [{ id: 'D', name: 'Muerta', category: 'permanent', active: true, selfWeightFactor: 0 }],
      memberLoads: [{ id: 'q', memberId: 'V', caseId: 'D', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -20, qyEnd: -20 }],
    };
    const source = model2dDesignSource(project).create({ braced: true })!;
    expect(source.members[0]!.kind).toBe('beam');
    const profile = designCode(selectedCode), combinations = profile.loadCombinations('B');
    const result = designStructure(source, { ...options, code: selectedCode, includeSelfWeight: false, combinations, lateralCombinations: [] });
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const beam = result.beams[0]!.result;
    // Equilibrio estático independiente: q normal = q global cos(theta), M = qn L² / 8.
    const factor = Math.max(...combinations.map((c) => c.dead));
    expect(beam.extremes.positiveMomentKnm).toBeCloseTo(factor * 20 * (6 / length) * length ** 2 / 8, 6);
    expect(beam.extremes.shearKn).toBeCloseTo(factor * 20 * (6 / length) * length / 2, 6);
    expect(beam.spans[0]!.lengthM).toBeCloseTo(length, 8);
    expect(outOfScopeChecks('frame', selectedCode, { inclinedBeams: true })).toContainEqual(expect.objectContaining({ id: 'scope-inclined-beam-axial', status: 'out-of-scope' }));
  });
  it('diseña igual el pórtico dibujado en el 2D que el generado por el taller', () => {
    const generated = designFrame(frameInput);
    if (!generated.ok) throw new Error(generated.errors.join('\n'));
    const external = model2dDesignSource(modelOfFrame());
    expect(external.errors).toEqual([]);
    expect(external.summary).toMatchObject({ beams: 4, columns: 6, skipped: 0, deadCases: 1, liveCases: 4, lateralCases: 1 });
    const source = external.create({ braced: false })!;
    const fromModel = designStructure(source, options);
    if (!fromModel.ok) throw new Error(fromModel.errors.join('\n'));
    expect(fromModel.beams.map((beam) => beam.label)).toEqual(generated.beams.map((beam) => beam.label));
    fromModel.beams.forEach((beam, index) => {
      const reference = generated.beams[index]!.result;
      expect(beam.result.extremes.negativeMomentKnm).toBeCloseTo(reference.extremes.negativeMomentKnm, 4);
      expect(beam.result.extremes.positiveMomentKnm).toBeCloseTo(reference.extremes.positiveMomentKnm, 4);
      expect(beam.result.extremes.shearKn).toBeCloseTo(reference.extremes.shearKn, 4);
      expect(beam.result.deflection.checkedMm).toBeCloseTo(reference.deflection.checkedMm, 3);
      expect(beam.result.governingRatio).toBeCloseTo(reference.governingRatio, 4);
    });
    fromModel.columns.forEach((column) => {
      const reference = generated.columns.find((item) => item.label === column.label)!;
      expect(column.result.governingRatio).toBeCloseTo(reference.result.governingRatio, 4);
      expect(column.effectiveLengthFactor).toBeCloseTo(reference.effectiveLengthFactor, 6);
    });
    fromModel.stories.forEach((story, index) => {
      expect(story.stabilityIndex).toBeCloseTo(generated.stories[index]!.stabilityIndex, 6);
      expect(story.driftMm).toBeCloseTo(generated.stories[index]!.driftMm, 4);
    });
    expect(fromModel.governingRatio).toBeCloseTo(generated.governingRatio, 4);
  });

  it('declara lo que no diseña y lee la sección y el concreto del catálogo', () => {
    const project = modelOfFrame();
    const withExtras: ProjectModel = {
      ...project,
      members: [
        ...project.members.map((member) => member.id === 'B01' ? { ...member, sectionId: 'rect-concrete-300x500', materialId: 'concrete-28mpa' } : member),
        { id: 'T1', i: 'N00', j: 'N11', type: 'truss', E: 2e8, A: 0.002, I: 1e-6 },
        { id: 'S1', i: 'N10', j: 'N21', type: 'frame', E: 2e8, A: 0.005, I: 8e-5, materialId: 'steel-a36' },
      ],
      loadCases: [...project.loadCases, { id: 'X', name: 'Temperatura', category: 'other', active: true }, { id: 'Y', name: 'Viento', category: 'accidental', active: false }],
    };
    const external = model2dDesignSource(withExtras);
    expect(external.summary.skipped).toBe(2);
    expect(external.summary.ignoredCases).toEqual(['Temperatura', 'Viento (inactivo)']);
    expect(external.fcMpa).toBe(28);
    const source = external.create({ braced: false })!;
    expect(source.members.find((member) => member.id === 'B01')!.section).toEqual({ widthMm: 300, heightMm: 500 });
    expect(source.members.find((member) => member.id === 'T1')!.kind).toBe('other');
    expect(source.members.find((member) => member.id === 'S1')!.reason).toMatch(/A36/);
    // Sección equivalente desde A e I: 45 × 45.
    const column = source.members.find((member) => member.id === 'C01')!.section;
    expect(column.widthMm).toBeCloseTo(450, 6);
    expect(column.heightMm).toBeCloseTo(450, 6);
  });

  it('el marco arriostrado no lleva acción lateral ni sondeo', () => {
    const source = model2dDesignSource(modelOfFrame()).create({ braced: true })!;
    expect(source.cases.some((item) => item.kind === 'lateral' || item.kind === 'probe')).toBe(false);
    const result = designStructure(source, options);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.lateral).toBe(false);
    expect(result.columns.every((column) => column.effectiveLengthFactor === 1)).toBe(true);
  });

  it('explica por qué no puede diseñar un modelo vacío o sin concreto', () => {
    expect(model2dDesignSource(createBlankProject()).errors[0]).toMatch(/vacío/);
    const steel = modelOfFrame();
    const onlySteel = model2dDesignSource({ ...steel, members: steel.members.map((member) => ({ ...member, materialId: 'steel-a36' })) });
    expect(onlySteel.errors[0]).toMatch(/no tiene barras de concreto/);
    expect(onlySteel.create({ braced: false })).toBeNull();
  });

  it('cambia de revisión cuando cambia el modelo', () => {
    const project = modelOfFrame();
    const first = model2dDesignSource(project).revision;
    expect(model2dDesignSource(project).revision).toBe(first);
    expect(model2dDesignSource({ ...project, memberLoads: project.memberLoads.slice(1) }).revision).not.toBe(first);
  });
});

describe('plantilla «Pórtico de concreto» del Modelo 2D', () => {
  it('se diseña completa desde el 2D con sus tres casos', () => {
    const external = model2dDesignSource(createConcreteFrameProject());
    expect(external.errors).toEqual([]);
    expect(external.summary).toMatchObject({ beams: 4, columns: 6, skipped: 0, deadCases: 1, lateralCases: 1 });
    expect(external.fcMpa).toBe(28);
    expect(external.includesSelfWeight).toBe(true);
    const result = designStructure(external.create({ braced: false })!, { ...options, fcMpa: 28 });
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.beams.map((beam) => beam.label)).toEqual(['Viga del nivel 1', 'Viga del nivel 2']);
    expect(result.columns).toHaveLength(6);
    expect(result.lateral).toBe(true);
    expect(result.status).not.toBe('fail');
  });
});

describe('pórtico rápido llevado al Modelo 2D', () => {
  it('se diseña igual que el pórtico paramétrico (sin peso propio, mismas cargas)', () => {
    const input: FrameDesignInput = { ...frameInput, includeSelfWeight: false };
    const generated = designFrame(input);
    if (!generated.ok) throw new Error(generated.errors.join('\n'));
    const project = withConcreteFrame(createBlankProject(), {
      bays: input.bays, stories: input.stories, base: input.base, beam: input.beam, column: input.column,
      fcMpa: 25, elasticModulusKpa: designCode(code).elasticModulusMpa(25) * 1e3, includeSelfWeight: false,
    });
    expect(project.members).toHaveLength(10);
    expect(project.loadCases.map((item) => item.id)).toEqual(['CM', 'CV', 'S']);
    const external = model2dDesignSource(project);
    expect(external.errors).toEqual([]);
    const fromModel = designStructure(external.create({ braced: false })!, { ...options, includeSelfWeight: external.includesSelfWeight });
    if (!fromModel.ok) throw new Error(fromModel.errors.join('\n'));
    fromModel.beams.forEach((beam, index) => {
      const reference = generated.beams[index]!.result;
      expect(beam.result.extremes.negativeMomentKnm).toBeCloseTo(reference.extremes.negativeMomentKnm, 4);
      expect(beam.result.governingRatio).toBeCloseTo(reference.governingRatio, 4);
    });
    fromModel.columns.forEach((column) => {
      expect(column.result.governingRatio).toBeCloseTo(generated.columns.find((item) => item.label === column.label)!.result.governingRatio, 4);
    });
  });

  it('conserva identidad y nombre del proyecto y vacía lo que dependía del modelo anterior', () => {
    const before = { ...createDefaultProject(), name: 'Mi proyecto' };
    const after = withConcreteFrame(before, {
      bays: [6], stories: [{ heightM: 3, deadKnPerM: 10, liveKnPerM: 5, lateralKn: 0 }], base: 'pinned',
      beam: { widthMm: 300, heightMm: 500 }, column: { widthMm: 400, heightMm: 400 }, fcMpa: 28, elasticModulusKpa: 2.5e7, includeSelfWeight: true,
    });
    expect(after.id).toBe(before.id);
    expect(after.name).toBe('Mi proyecto');
    expect(after.nodes.filter((node) => node.support.type === 'pin')).toHaveLength(2);
    // Sin fuerza lateral no hay caso de sismo; las secciones y el concreto salen del catálogo.
    expect(after.loadCases.some((item) => item.id === 'S')).toBe(false);
    expect(after.members.find((member) => member.id === 'V11')!.sectionId).toBe('rect-concrete-300x500');
    expect(after.members.every((member) => member.materialId === 'concrete-28mpa')).toBe(true);
    expect(after.designAssignments).toEqual([]);
  });
});
