import { describe, expect, it } from 'vitest';
import { createBlankProject, createDefaultProject } from '../data/defaultProject';
import { parseSpace3DDraft, parseSpace3DProject } from '../modules/space3d/space3d/data/codec';
import { applySpace3DCommand } from '../modules/space3d/space3d/data/commands';
import { validateSpace3DProject } from '../modules/space3d/space3d/model/validation';
import { analyzeSpace3DProject } from '../modules/space3d/space3d/engine/solver';
import { linkSpace3DToShell } from '../features/workspace/adapters/space3dShellBridge';
import { createUnifiedProjectBundle } from '../shared/project/unifiedProjectBundle';
import { validateBundle } from '../storage/bundleValidation';
import type { ProjectModel } from '../types';
import { buildPlanar2DToSpace3DHandoff, roundTripPlanarSpace3DTo2D } from './planar2dToSpace3d';
import { prepareSpace3DSyncReview } from './space3dSync';

const kitchenSinkProject = (): ProjectModel => ({
  ...createDefaultProject(),
  id: 'kitchen-sink',
  name: 'Todas las semánticas planares',
  nodes: [
    {
      id: 'N1', x: 0, y: 0, internalHinge: true,
      support: {
        type: 'custom', angleDeg: 32, restrainX: true, restrainY: false, restrainR: true,
        spring: { kx: 10, ky: 20, kr: 30, kNormal: 40, angleDeg: 17 },
        prescribed: { ux: 0.001, uy: -0.002, rz: 0.003, normal: 0.004 },
      },
    },
    { id: 'N2', x: 4, y: 0, support: { type: 'roller', angleDeg: 27 } },
    { id: 'N3', x: 8, y: 2, support: { type: 'none' } },
    { id: 'N4', x: 12, y: 2, support: { type: 'fixed' } },
  ],
  members: [
    {
      id: 'FRAME', i: 'N1', j: 'N2', type: 'frame', materialId: 'steel', materialOrigin: 'catalog',
      sectionId: 'W', sectionOrigin: 'imported', E: 200e6, G: 77e6, A: 0.01, I: 8e-5,
      beamTheory: 'timoshenko', shearArea: 0.008, density: 7850,
      releases: { iAxial: true, iShear: true, iMoment: true, jAxial: true, jShear: true, jMoment: true },
      axialBehavior: 'compression-only', rotationalSpringI: 12, rotationalSpringJ: 13,
      rigidOffsetI: 0.2, rigidOffsetJ: 0.3, label: 'Marco completo',
    },
    { id: 'TRUSS', i: 'N2', j: 'N3', type: 'truss', E: 190e6, A: 0.02, I: 0, axialBehavior: 'tension-only' },
    { id: 'RIGID', i: 'N3', j: 'N4', type: 'rigid', E: 1, A: 1, I: 1, label: 'Vínculo rígido' },
  ],
  loadCases: [
    { id: 'DL', name: 'Permanente', category: 'permanent', active: true, selfWeightFactor: 1.25 },
    { id: 'LL', name: 'Variable', category: 'variable', active: false, selfWeightFactor: 0 },
  ],
  combinations: [{
    id: 'ULS', name: 'Última', factors: { DL: 1.3, LL: 1.5 }, source: 'fixture', sourceUrl: 'https://example.test',
    jurisdiction: 'MX', edition: '2023', stateLimit: 'ultimate', reviewedAt: '2026-09-15',
  }],
  nodalLoads: [{ id: 'NL', nodeId: 'N2', caseId: 'LL', fx: 2, fy: -8, mz: 3 }],
  prescribedDisplacements: [
    { id: 'PDX', nodeId: 'N1', caseId: 'DL', component: 'ux', value: 0.01 },
    { id: 'PDN', nodeId: 'N2', caseId: 'DL', component: 'normal', value: -0.02 },
  ],
  memberLoads: [
    { id: 'MLD', memberId: 'FRAME', caseId: 'LL', type: 'distributed', coordinateSystem: 'local', lengthBasis: 'horizontal', start: 0.1, end: 0.9, qxStart: 1, qxEnd: 2, qyStart: -3, qyEnd: -4 },
    { id: 'MLP', memberId: 'TRUSS', caseId: 'LL', type: 'point', coordinateSystem: 'global', lengthBasis: 'vertical', start: 0, end: 1, px: 5, py: -6, position: 0.4 },
    { id: 'MLM', memberId: 'RIGID', caseId: 'DL', type: 'moment', coordinateSystem: 'local', lengthBasis: 'real', start: 0, end: 1, moment: 7, position: 0.7 },
  ],
  memberInitialEffects: [
    { id: 'TEMP', memberId: 'FRAME', caseId: 'DL', type: 'temperature', alpha: 1.2e-5, deltaT: 25, gradient: 3 },
    { id: 'STRAIN', memberId: 'TRUSS', caseId: 'LL', type: 'initial-strain', axialStrain: 0.002, curvature: 0.003 },
  ],
  nodeLinks: [{ id: 'LINK', nodeI: 'N1', nodeJ: 'N2', behavior: 'friction', angleDeg: 21, stiffness: 900, clearance: 0.01, slipForce: 12, label: 'Link' }],
  multiPointConstraints: [{ id: 'MPC', terms: [{ nodeId: 'N1', component: 'ux', coefficient: -1 }, { nodeId: 'N2', component: 'rz', coefficient: 2 }], value: 0.005, label: 'Diafragma' }],
  nodalMasses: [{ id: 'MASS', nodeId: 'N3', mass: 450, rotationalInertia: 30, label: 'Equipo' }],
  generatedLoadSources: [
    { id: 'TRIB', kind: 'tributary-surface', caseId: 'LL', memberIds: ['FRAME'], pressure: 4, tributaryWidth: 2, direction: 'global-y', label: 'Losa' },
    { id: 'HYDRO', kind: 'hydrostatic', caseId: 'DL', memberIds: ['FRAME'], referenceY: 3, unitWeight: 9.81, pressureAtReference: 2, direction: 'global-x', sign: -1, label: 'Agua' },
    { id: 'SOIL', kind: 'soil-pressure', caseId: 'DL', memberIds: ['FRAME'], referenceY: 2, unitWeight: 18, direction: 'global-x' },
    { id: 'FOUND', kind: 'elastic-foundation', memberIds: ['FRAME'], stiffness: 3000, direction: 'global-y', label: 'Winkler' },
    { id: 'LIVE', kind: 'live-pattern', caseId: 'LL', memberIds: ['FRAME', 'TRUSS'], qx: 1, qy: -2, coordinateSystem: 'global', lengthBasis: 'real', pattern: 'alternating-even' },
    { id: 'CHAIN', kind: 'member-chain', caseId: 'LL', memberIds: ['FRAME', 'TRUSS'], qy: -3, pattern: 'all' },
    { id: 'PRE', kind: 'prestress', caseId: 'DL', memberIds: ['FRAME'], force: -100, eccentricity: 0.04 },
  ],
  movingLoadCases: [{
    id: 'MOV', name: 'Camión', memberIds: ['FRAME', 'TRUSS'], targetMemberId: 'TRUSS', targetPosition: 0.35,
    quantity: 'M', startNodeId: 'N1', impactFactor: 1.2, axles: [{ id: 'A1', P: 80, offset: 0 }, { id: 'A2', P: 120, offset: 3.5 }],
  }],
});

const structuralProjection = (project: ProjectModel) => ({
  id: project.id,
  name: project.name,
  nodes: project.nodes,
  members: project.members,
  loadCases: project.loadCases,
  combinations: project.combinations,
  nodalLoads: project.nodalLoads,
  prescribedDisplacements: project.prescribedDisplacements ?? [],
  memberLoads: project.memberLoads,
  memberInitialEffects: project.memberInitialEffects ?? [],
  nodeLinks: project.nodeLinks ?? [],
  multiPointConstraints: project.multiPointConstraints ?? [],
  nodalMasses: project.nodalMasses ?? [],
  generatedLoadSources: project.generatedLoadSources ?? [],
  movingLoadCases: project.movingLoadCases ?? [],
});

describe('planar 2D → spatial V2', () => {
  it('preserva el fixture completo sin omisiones y hace round-trip planar exacto', () => {
    const source = kitchenSinkProject();
    const handoff = buildPlanar2DToSpace3DHandoff(source);

    expect(handoff.candidateModel.schemaVersion).toBe(2);
    expect(handoff.lossReport).toEqual({ status: 'lossless', entries: [] });
    expect(handoff.mapping.some((entry) => entry.disposition === 'omitted')).toBe(false);
    expect(handoff.candidateModel.nodes[0]).toMatchObject({
      id: 'N1', x: 0, y: 0, z: 0, internalHinge: true,
      planarSupport: { type: 'custom', angleDeg: 32, spring: { kNormal: 40 }, prescribed: { normal: 0.004 } },
    });
    expect(handoff.candidateModel.members.map((member) => member.type)).toEqual(['frame', 'truss', 'rigid']);
    expect(handoff.candidateModel.memberLoads).toHaveLength(3);
    expect(handoff.candidateModel.generatedLoadSources).toHaveLength(7);
    expect(structuralProjection(roundTripPlanarSpace3DTo2D(handoff.candidateModel, source))).toEqual(structuralProjection(source));

    const trussIssues = validateSpace3DProject(handoff.candidateModel)
      .filter((issue) => issue.entityKind === 'member' && issue.entityId === 'TRUSS');
    expect(trussIssues).toEqual([]);
    expect(handoff.candidateModel.members.find((member) => member.id === 'TRUSS')).toMatchObject({ Iy: 0, Iz: 0, J: 0 });
    expect(() => parseSpace3DProject(JSON.stringify(handoff.candidateModel))).not.toThrow();
    const analysis = analyzeSpace3DProject(handoff.candidateModel, 'DL');
    expect(analysis.success).toBe(false);
    expect(analysis.issues.filter((issue) => issue.code === 'unsupported-member-type').map((issue) => issue.entityId)).toEqual(['TRUSS', 'RIGID']);
  });

  it('crea una rama espacial vacía cuando el 2D no contiene estructura', () => {
    const handoff = buildPlanar2DToSpace3DHandoff({ ...createBlankProject(), id: 'empty' });
    expect(handoff.lossReport.status).toBe('lossless');
    expect({ nodes: handoff.candidateModel.nodes, members: handoff.candidateModel.members, loads: handoff.candidateModel.nodalLoads }).toEqual({ nodes: [], members: [], loads: [] });
  });

  it('valida estrictamente las colecciones V2 y conserva una base 2D exacta sólo en ramas nuevas', () => {
    const source = kitchenSinkProject();
    const candidate = buildPlanar2DToSpace3DHandoff(source).candidateModel;
    const semanticCollections = [
      'prescribedDisplacements', 'memberLoads', 'memberInitialEffects', 'nodeLinks',
      'multiPointConstraints', 'nodalMasses', 'generatedLoadSources', 'movingLoadCases',
    ] as const;
    for (const collection of semanticCollections) {
      expect(() => parseSpace3DDraft(JSON.stringify({ ...candidate, [collection]: [{}] })), collection).toThrow();
    }
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      memberLoads: [{ ...candidate.memberLoads[0], type: 'volumetric' }],
    }))).toThrow();
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      prescribedDisplacements: [{ ...candidate.prescribedDisplacements[0], nodeId: 'NO-EXISTE' }],
    }))).toThrow(/missing-reference/);
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      multiPointConstraints: [{ ...candidate.multiPointConstraints[0], terms: [] }],
    }))).toThrow(/invalid-model/);
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      generatedLoadSources: [{ ...candidate.generatedLoadSources[0], memberIds: [] }],
    }))).toThrow(/invalid-model/);
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      movingLoadCases: [{ ...candidate.movingLoadCases[0], memberIds: ['FRAME'], targetMemberId: 'TRUSS' }],
    }))).toThrow(/invalid-model/);
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      nodeLinks: [{ ...candidate.nodeLinks[0], nodeJ: candidate.nodeLinks[0].nodeI }],
    }))).toThrow(/invalid-model/);
    const reversedMemberLoad = parseSpace3DDraft(JSON.stringify({
      ...candidate,
      memberLoads: [{ ...candidate.memberLoads[0], start: 0.9, end: 0.1, qyStart: -3, qyEnd: -4 }],
    })).memberLoads[0];
    expect(reversedMemberLoad).toMatchObject({ start: 0.1, end: 0.9, qyStart: -4, qyEnd: -3 });
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      memberLoads: [{ ...candidate.memberLoads[0], start: -0.1 }],
    }))).toThrow(/invalid-model/);
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      memberLoads: [{ ...candidate.memberLoads[1], position: 1.1 }],
    }))).toThrow(/invalid-model/);
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      movingLoadCases: [{ ...candidate.movingLoadCases[0], memberIds: [] }],
    }))).toThrow(/invalid-model/);
    expect(() => parseSpace3DDraft(JSON.stringify({
      ...candidate,
      movingLoadCases: [{ ...candidate.movingLoadCases[0], axles: [] }],
    }))).toThrow(/invalid-model/);

    const linked = linkSpace3DToShell(source, 'source-v1', candidate);
    const capturedX = source.nodes[0].x;
    source.nodes[0].x = 999;
    expect(linked.sourceModel2D?.nodes[0].x).toBe(capturedX);
    expect(() => prepareSpace3DSyncReview(linked, { ...source, nodes: source.nodes.map((node) => ({ ...node })) })).not.toThrow();

    const legacy = linkSpace3DToShell(source.id, 'legacy-v1', candidate);
    const legacyBundle = createUnifiedProjectBundle(source, 'current-v2');
    legacyBundle.space3d = legacy;
    const reloadedLegacy = validateBundle(JSON.parse(JSON.stringify(legacyBundle))).space3d!;
    expect(() => prepareSpace3DSyncReview(reloadedLegacy, source)).toThrow(/volver a derivar|rederive/i);

    const rederivedBundle = { ...legacyBundle, space3d: linkSpace3DToShell(source, 'current-v2', candidate) };
    const reloadedExact = validateBundle(JSON.parse(JSON.stringify(rederivedBundle))).space3d!;
    expect(reloadedExact.baselineStatus).toBe('exact');
    expect(() => prepareSpace3DSyncReview(reloadedExact, source)).not.toThrow();
  });

  it('rechaza magnitudes físicas negativas al admitir el modelo y permite editar una armadura axial', () => {
    const source = kitchenSinkProject();
    const candidate = buildPlanar2DToSpace3DHandoff(source).candidateModel;
    const negativeCases = [
      ['nodalMasses', { ...candidate.nodalMasses[0], mass: -1 }],
      ['nodalMasses', { ...candidate.nodalMasses[0], rotationalInertia: -1 }],
      ['generatedLoadSources', { ...candidate.generatedLoadSources[0], tributaryWidth: -1 }],
      ['generatedLoadSources', { ...candidate.generatedLoadSources[1], unitWeight: -1 }],
      ['generatedLoadSources', { ...candidate.generatedLoadSources[3], stiffness: -1 }],
    ] as const;
    for (const [collection, entity] of negativeCases) {
      const malformed = { ...candidate, [collection]: [entity] };
      expect(() => parseSpace3DProject(JSON.stringify(malformed))).toThrow(/invalid-model/);
      expect(() => parseSpace3DDraft(JSON.stringify(malformed))).not.toThrow();
    }

    const truss = candidate.members.find((member) => member.id === 'TRUSS')!;
    expect(() => applySpace3DCommand(candidate, {
      kind: 'update-member', memberId: truss.id, changes: { A: truss.A * 1.1 },
    })).not.toThrow();
  });
});
