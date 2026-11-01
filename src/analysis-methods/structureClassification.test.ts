import { describe, expect, it } from 'vitest';
import { createBlankProject, createConcreteFrameProject, createDefaultProject, exampleProjects } from '../data/defaultProject';
import { MODEL_STARTS, MODEL_START_DEFAULTS, withModelStart } from '../data/modelStarts';
import { analyzeProject } from '../engine/solver';
import { availableSolver2dCorpus, resolveCorpusProject } from '../engine/solver2dCorpus';
import type { MemberModel, NodeModel, ProjectModel } from '../types';
import { SOLUTION_METHODS, applicableMethods } from './methodRegistry';
import { solveStaticsSections } from './staticsSections';
import { classifyStructure } from './structureClassification';

const SECTION = { E: 2e8, A: 0.02, I: 8e-5 };
const node = (id: string, x: number, y: number, support: NodeModel['support'] = { type: 'none' }, extra: Partial<NodeModel> = {}): NodeModel =>
  ({ id, x, y, support, ...extra });
const bar = (id: string, i: string, j: string, extra: Partial<MemberModel> = {}): MemberModel => ({ id, i, j, type: 'frame', ...SECTION, ...extra });
const model = (nodes: NodeModel[], members: MemberModel[], extra: Partial<ProjectModel> = {}): ProjectModel => ({
  ...createBlankProject(),
  nodes,
  members,
  memberLoads: [],
  nodalLoads: [],
  ...extra,
});

/**
 * The frame count as it read before this change: one condition per internal hinge and one per
 * released end, whatever met at the node. Kept here only to prove what did *not* move.
 */
const legacyFrameIndeterminacy = (project: ProjectModel): number => {
  const members = project.members.filter((member) => member.type !== 'rigid');
  const { reactionCount } = classifyStructure(project);
  const releases = members.reduce((total, member) => total + Number(Boolean(member.releases?.iMoment)) + Number(Boolean(member.releases?.jMoment)), 0);
  const hinges = project.nodes.filter((entry) => entry.internalHinge).length;
  return reactionCount + 3 * members.length - 3 * project.nodes.length - releases - hinges;
};

const offered = (project: ProjectModel, indeterminacy?: number): string[] => {
  const classification = classifyStructure(project);
  const read = indeterminacy === undefined ? classification : { ...classification, indeterminacy };
  return SOLUTION_METHODS.filter((method) => method.applies(read, project)).map((method) => method.id);
};

/** Every model the app ships: examples, model starts (and a larger portal), and the solver corpus. */
const shippedModels = (): Array<{ name: string; project: ProjectModel }> => [
  ...exampleProjects.map((example) => ({ name: example.name, project: example.build() })),
  { name: 'proyecto por defecto', project: createDefaultProject() },
  { name: 'pórtico de concreto', project: createConcreteFrameProject() },
  ...MODEL_STARTS.map((id) => ({ name: `inicio ${id}`, project: withModelStart(createBlankProject(), id, MODEL_START_DEFAULTS[id]) })),
  { name: 'inicio frame-portal 2×2', project: withModelStart(createBlankProject(), 'frame-portal', { ...MODEL_START_DEFAULTS['frame-portal'], count: 2, levels: 2 }) },
  ...availableSolver2dCorpus.map((item) => ({ name: `corpus ${item.id}`, project: resolveCorpusProject(item) })),
];

describe('clasificación estática: articulaciones y liberaciones en marcos', () => {
  it('una articulación donde concurren tres barras aporta n − 1 = 2 condiciones', () => {
    const project = model(
      [
        node('A', 0, 0, { type: 'pin' }), node('B', 0, 4), node('C', 4, 4, { type: 'none' }, { internalHinge: true }),
        node('D', 8, 4), node('E', 8, 0, { type: 'roller', angleDeg: 90 }), node('G', 4, 0, { type: 'pin' }),
      ],
      [bar('C1', 'A', 'B'), bar('V1', 'B', 'C'), bar('V2', 'C', 'D'), bar('C2', 'D', 'E'), bar('C3', 'G', 'C')],
    );
    // r = 2 + 1 + 2 = 5, 3m = 15, 3j = 18: 5 + 15 − 18 − 2 = 0.
    expect(classifyStructure(project)).toMatchObject({ kind: 'frame', reactionCount: 5, indeterminacy: 0 });
    expect(legacyFrameIndeterminacy(project)).toBe(1);
    expect(applicableMethods(project).map((method) => method.id)).toContain('statics-sections');
    expect(offered(project, legacyFrameIndeterminacy(project))).not.toContain('statics-sections');

    // Four members at the hinge: three conditions. A fixed support at the hinge holds its rotation,
    // so then every pinned end counts (its reaction moment is what the node's ΣM determines).
    const four = model(
      [...project.nodes, node('F', 4, 8, { type: 'pin' })],
      [...project.members, bar('C4', 'C', 'F')],
    );
    expect(classifyStructure(four).indeterminacy).toBe(5 + 2 + 18 - 21 - 3);
    const held = model(
      [node('A', 0, 0, { type: 'fixed' }, { internalHinge: true }), node('B', 4, 0, { type: 'pin' }), node('C', 0, 4, { type: 'pin' })],
      [bar('M1', 'A', 'B'), bar('M2', 'A', 'C')],
    );
    expect(classifyStructure(held).indeterminacy).toBe(3 + 2 + 2 + 6 - 9 - 2);
  });

  it('dos barras liberadas en el mismo nudo valen una articulación, y la estática lo resuelve igual', () => {
    const nodes = (hinge: boolean) => [
      node('A', 0, 0, { type: 'pin' }), node('B', 0, 4), node('C', 3, 4, { type: 'none' }, hinge ? { internalHinge: true } : {}),
      node('D', 6, 4), node('E', 6, 0, { type: 'pin' }),
    ];
    const loads: Partial<ProjectModel> = {
      memberLoads: [
        { id: 'q1', memberId: 'V1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10 },
        { id: 'q2', memberId: 'V2', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10 },
      ],
      nodalLoads: [{ id: 'H', nodeId: 'B', caseId: 'LC1', fx: 20, fy: 0, mz: 0 }],
    };
    const hinged = model(nodes(true), [bar('C1', 'A', 'B'), bar('V1', 'B', 'C'), bar('V2', 'C', 'D'), bar('C2', 'D', 'E')], loads);
    const released = model(nodes(false), [
      bar('C1', 'A', 'B'), bar('V1', 'B', 'C', { releases: { jMoment: true } }), bar('V2', 'C', 'D', { releases: { iMoment: true } }), bar('C2', 'D', 'E'),
    ], loads);
    expect(classifyStructure(hinged).indeterminacy).toBe(0);
    expect(classifyStructure(released).indeterminacy).toBe(0);
    // Before, the two releases counted as two conditions and the frame read as a mechanism.
    expect(legacyFrameIndeterminacy(released)).toBe(-1);
    const reactions = (project: ProjectModel) => {
      const outcome = solveStaticsSections(project, analyzeProject(project));
      if (!outcome.applicable) throw new Error(outcome.reasonKey);
      return outcome.unknowns.map((unknown) => [unknown.symbol, unknown.value] as const);
    };
    const fromHinge = reactions(hinged);
    const fromReleases = reactions(released);
    expect(fromReleases.map(([symbol]) => symbol)).toEqual(fromHinge.map(([symbol]) => symbol));
    fromReleases.forEach(([, value], index) => expect(value).toBeCloseTo(fromHinge[index]![1], 9));

    // A column end released on a pin support adds nothing: the support already carries no moment.
    const pinnedBases = model(
      [node('A', 0, 0, { type: 'pin' }), node('B', 0, 4), node('C', 6, 4), node('D', 6, 0, { type: 'roller', angleDeg: 90 })],
      [bar('C1', 'A', 'B', { releases: { iMoment: true } }), bar('V1', 'B', 'C'), bar('C2', 'D', 'C', { releases: { iMoment: true } })],
      { nodalLoads: [{ id: 'H', nodeId: 'B', caseId: 'LC1', fx: 20, fy: 0, mz: 0 }] },
    );
    expect(classifyStructure(pinnedBases).indeterminacy).toBe(0);
    expect(solveStaticsSections(pinnedBases, analyzeProject(pinnedBases)).applicable).toBe(true);
    // A single released end at a rigid joint is still one condition, as it always was.
    const pinnedBeam = model(
      [node('A', 0, 0, { type: 'fixed' }), node('B', 0, 4), node('C', 6, 4), node('D', 6, 0, { type: 'fixed' })],
      [bar('C1', 'A', 'B'), bar('V1', 'B', 'C', { releases: { iMoment: true } }), bar('C2', 'D', 'C')],
    );
    expect(classifyStructure(pinnedBeam).indeterminacy).toBe(legacyFrameIndeterminacy(pinnedBeam));
    expect(classifyStructure(pinnedBeam).indeterminacy).toBe(2);
  });

  it('no cambia qué métodos se ofrecen para ningún modelo que trae la app', () => {
    const models = shippedModels();
    expect(models.length).toBeGreaterThan(10);
    let frames = 0;
    for (const { name, project } of models) {
      const classification = classifyStructure(project);
      if (classification.kind !== 'frame') continue;
      frames += 1;
      expect(classification.indeterminacy, name).toBe(legacyFrameIndeterminacy(project));
      expect(applicableMethods(project).map((method) => method.id), name).toEqual(offered(project, legacyFrameIndeterminacy(project)));
    }
    expect(frames).toBeGreaterThan(2);
  });
});
