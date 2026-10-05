import type { AnalysisResult, LoadCombination, MemberLoad, ProjectModel } from '../types';
import { createDefaultSettings } from '../data/defaultProject';
import { analyzeProject } from './solver';

export type CorpusStatus = 'available' | 'unsupported';
export type CorpusAssertionTarget =
  | { kind: 'node'; nodeId: string; component: 'ux' | 'uy' | 'rz' | 'rx' | 'ry' | 'rm' }
  | { kind: 'member'; memberId: string; quantity: 'axial' | 'shear' | 'moment'; extreme: 'maximum' | 'minimum' | 'absolute-maximum' }
  | { kind: 'member-end-force'; memberId: string; end: 'i' | 'j'; quantity: 'axial' | 'shear' | 'moment' }
  | { kind: 'member-deformation'; memberId: string; x: number; quantity: 'u' | 'v' | 'theta' }
  | { kind: 'analysis'; field: 'success' | 'pDeltaConverged' | 'pDeltaEnabled' | 'finiteDisplacement' | 'pDeltaAmplification' };

export interface CorpusAssertion {
  id: string;
  target: CorpusAssertionTarget;
  expected: number | boolean;
  atol: number;
  rtol: number;
  nearZeroTolerance: number;
}

export type CorpusInvariant =
  | { id: string; kind: 'global-equilibrium'; description: string; atol: number; rtol: number; supportedLoadDomain: string }
  | { id: string; kind: 'finite-displacement'; description: string }
  | { id: string; kind: 'pdelta-amplification'; description: string; minimum: number }
  | { id: string; kind: 'node-symmetry'; description: string; nodeA: string; nodeB: string; component: 'ux' | 'uy' | 'rz'; atol: number; rtol: number }
  | { id: string; kind: 'member-end-near-zero'; description: string; memberId: string; end: 'i' | 'j'; quantity: 'axial' | 'shear' | 'moment'; tolerance: number }
  | { id: string; kind: 'analysis-failed'; description: string };

export interface Solver2DCorpusCase {
  id: string;
  title: string;
  status: CorpusStatus;
  capability: string;
  schemaId: string;
  engineId: string;
  algorithmId: string;
  units: 'kN-m';
  assumptions: string[];
  oracle: { provenance: string; derivation: string };
  project?: ProjectModel;
  build?: () => ProjectModel;
  assertions: CorpusAssertion[];
  invariants: CorpusInvariant[];
  unsupportedReason?: string;
}

const identity = { materialOrigin: 'custom' as const, sectionOrigin: 'custom' as const };
const member = (id: string, i: string, j: string, type: 'frame' | 'truss' = 'frame') => ({
  id, i, j, type, ...identity, E: 200_000, A: 0.01, I: 8e-5,
});

const project = (name: string, nodes: ProjectModel['nodes'], members: ProjectModel['members'], extra: Partial<ProjectModel> = {}): ProjectModel => ({
  schemaVersion: 7,
  id: `corpus-${name}`,
  name,
  nodes,
  members,
  loadCases: [{ id: 'LC1', name: 'Servicio', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  nodeLinks: [],
  multiPointConstraints: [],
  nodalMasses: [],
  generatedLoadSources: [],
  movingLoadCases: [],
  settings: createDefaultSettings(),
  ...extra,
});

const frameBeam = (name: string, length: number, loads: ProjectModel['memberLoads'], release = true): ProjectModel => project(
  name,
  [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: length, y: 0, support: { type: 'roller', angleDeg: 90 } }],
  [{ ...member('AB', 'A', 'B'), E: 200_000_000, ...(release ? { releases: { iMoment: true, jMoment: true } } : {}) }],
  { memberLoads: loads },
);

const assertion = (id: string, target: CorpusAssertionTarget, expected: number | boolean, atol = 1e-8, rtol = 2e-7, nearZeroTolerance = 1e-10): CorpusAssertion => ({ id, target, expected, atol, rtol, nearZeroTolerance });
const baseAssumptions = ['SI base units: force kN, length m, moment kN·m, rotation rad.', 'Positive global x/y follow the model axes; positive moment is counter-clockwise.', 'Small displacement linear elastic analysis unless the case explicitly selects P-Delta.', 'E, A and I are numerical inputs; self-weight is disabled.'];
const equilibrium = (id: string): CorpusInvariant => ({ id, kind: 'global-equilibrium', description: 'Independently recomputed external loads plus reactions must close to zero in force and moment.', atol: 1e-8, rtol: 2e-7, supportedLoadDomain: 'Nodal loads, point/moment loads, and full-span uniform distributed loads in global axes with real-length basis.' });

const available = (definition: Omit<Solver2DCorpusCase, 'status' | 'build'> & { build: () => ProjectModel }): Solver2DCorpusCase => ({ ...definition, status: 'available' });
const unsupported = (id: string, title: string, capability: string, reason: string): Solver2DCorpusCase => ({
  id, title, status: 'unsupported', capability, schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'not-implemented', units: 'kN-m', assumptions: baseAssumptions,
  oracle: { provenance: 'Capability inventory, not a numerical oracle.', derivation: reason }, assertions: [], invariants: [], unsupportedReason: reason,
});

export const solver2dCorpus: Solver2DCorpusCase[] = [
  available({
    id: 'axial-bar', title: 'Barra axial traccionada', capability: 'axial', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Closed form: N = P and δ = PL/(EA).', derivation: 'P=10 kN, L=2 m, E=200000 kN/m², A=0.01 m²; N=10 kN, δ=0.010000 m.' },
    build: () => project('axial-bar', [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 2, y: 0, support: { type: 'roller', angleDeg: 90 } }], [member('AB', 'A', 'B', 'truss')], { nodalLoads: [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 10, fy: 0, mz: 0 }] }),
    assertions: [assertion('axial-ux', { kind: 'node', nodeId: 'B', component: 'ux' }, 0.01), assertion('axial-force', { kind: 'member', memberId: 'AB', quantity: 'axial', extreme: 'maximum' }, 10), assertion('axial-reaction', { kind: 'node', nodeId: 'A', component: 'rx' }, -10)], invariants: [equilibrium('axial-equilibrium')],
  }),
  available({
    id: 'simply-supported-point', title: 'Viga simplemente apoyada con carga puntual', capability: 'simply-supported beam point load', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Closed form simply-supported beam.', derivation: 'P=40 kN at midspan, L=8 m, E=200000000 kN/m², I=8e−5 m⁴: RA=RB=P/2=20 kN; Mmax=PL/4=80 kN·m; v(mid)=−PL³/(48EI)=−0.0266666667 m.' },
    build: () => frameBeam('simply-supported-point', 8, [{ id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -40 }]),
    assertions: [assertion('point-ra', { kind: 'node', nodeId: 'A', component: 'ry' }, 20), assertion('point-rb', { kind: 'node', component: 'ry', nodeId: 'B' }, 20), assertion('point-mmax', { kind: 'member', memberId: 'AB', quantity: 'moment', extreme: 'maximum' }, 80), assertion('point-midspan-deflection', { kind: 'member-deformation', memberId: 'AB', x: 4, quantity: 'v' }, -0.026666666667)], invariants: [equilibrium('point-equilibrium')],
  }),
  available({
    id: 'simply-supported-udl', title: 'Viga simplemente apoyada con carga distribuida', capability: 'distributed load', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Closed form simply-supported beam under uniform load.', derivation: 'w=10 kN/m, L=6 m: RA=RB=wL/2=30 kN; Mmax=wL²/8=45 kN·m.' },
    build: () => frameBeam('simply-supported-udl', 6, [{ id: 'W', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10 }]),
    assertions: [assertion('udl-ra', { kind: 'node', nodeId: 'A', component: 'ry' }, 30), assertion('udl-rb', { kind: 'node', nodeId: 'B', component: 'ry' }, 30), assertion('udl-mmax', { kind: 'member', memberId: 'AB', quantity: 'moment', extreme: 'maximum' }, 45)], invariants: [equilibrium('udl-equilibrium')],
  }),
  available({
    id: 'cantilever-point', title: 'Voladizo con carga puntual en punta', capability: 'cantilever', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Closed form cantilever beam.', derivation: 'P=10 kN, L=4 m: v(L)=−PL³/(3EI)=−13.3333333333 m with EI=16 kN·m²; base shear=10 kN and base moment=−40 kN·m.' },
    build: () => project('cantilever-point', [{ id: 'A', x: 0, y: 0, support: { type: 'fixed' } }, { id: 'B', x: 4, y: 0, support: { type: 'none' } }], [member('AB', 'A', 'B')], { nodalLoads: [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }] }),
    assertions: [assertion('cantilever-point-v', { kind: 'node', nodeId: 'B', component: 'uy' }, -13.3333333333), assertion('cantilever-point-r', { kind: 'node', nodeId: 'A', component: 'ry' }, 10)], invariants: [equilibrium('cantilever-point-equilibrium')],
  }),
  available({
    id: 'cantilever-udl', title: 'Voladizo con carga distribuida', capability: 'cantilever distributed load', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Closed form cantilever beam under uniform load.', derivation: 'w=5 kN/m, L=4 m: v(L)=−wL⁴/(8EI)=−10.0000000000 m with EI=16 kN·m²; base shear=20 kN.' },
    build: () => project('cantilever-udl', [{ id: 'A', x: 0, y: 0, support: { type: 'fixed' } }, { id: 'B', x: 4, y: 0, support: { type: 'none' } }], [member('AB', 'A', 'B')], { memberLoads: [{ id: 'W', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -5, qyEnd: -5 }] }),
    assertions: [assertion('cantilever-udl-v', { kind: 'node', nodeId: 'B', component: 'uy' }, -10), assertion('cantilever-udl-r', { kind: 'node', nodeId: 'A', component: 'ry' }, 20)], invariants: [equilibrium('cantilever-udl-equilibrium')],
  }),
  available({
    id: 'sway-frame', title: 'Pórtico plano de traslación', capability: 'sway frame', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Independent symmetry and global equilibrium of a one-bay sway frame.', derivation: 'Equal 10 kN horizontal loads at both roof nodes make the two columns symmetric; each base takes −10 kN horizontal reaction and the roof translates in +x.' },
    build: () => project('sway-frame', [{ id: 'A', x: 0, y: 0, support: { type: 'fixed' } }, { id: 'B', x: 6, y: 0, support: { type: 'fixed' } }, { id: 'C', x: 0, y: 4, support: { type: 'none' } }, { id: 'D', x: 6, y: 4, support: { type: 'none' } }], [member('AC', 'A', 'C'), member('CD', 'C', 'D'), member('BD', 'B', 'D')], { nodalLoads: [{ id: 'HC', nodeId: 'C', caseId: 'LC1', fx: 10, fy: 0, mz: 0 }, { id: 'HD', nodeId: 'D', caseId: 'LC1', fx: 10, fy: 0, mz: 0 }] }),
    assertions: [assertion('sway-reaction', { kind: 'node', nodeId: 'A', component: 'rx' }, -10)], invariants: [equilibrium('sway-equilibrium')],
  }),
  available({
    id: 'triangular-truss', title: 'Armadura triangular 3–4–5', capability: 'truss', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Method of joints, independent statics.', derivation: 'For a 60 kN vertical load at the apex of the 3–4–5 triangle: RAy=RBy=30 kN, FAB=+22.5 kN tension and FAC=FBC=−37.5 kN compression.' },
    build: () => project('triangular-truss', [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } }, { id: 'C', x: 3, y: 4, support: { type: 'none' } }], [member('AB', 'A', 'B', 'truss'), member('AC', 'A', 'C', 'truss'), member('BC', 'B', 'C', 'truss')], { nodalLoads: [{ id: 'P', nodeId: 'C', caseId: 'LC1', fx: 0, fy: -60, mz: 0 }] }),
    assertions: [assertion('truss-ra', { kind: 'node', nodeId: 'A', component: 'ry' }, 30), assertion('truss-rb', { kind: 'node', nodeId: 'B', component: 'ry' }, 30), assertion('truss-ab', { kind: 'member', memberId: 'AB', quantity: 'axial', extreme: 'maximum' }, 22.5), assertion('truss-ac', { kind: 'member', memberId: 'AC', quantity: 'axial', extreme: 'minimum' }, -37.5), assertion('truss-bc', { kind: 'member', memberId: 'BC', quantity: 'axial', extreme: 'minimum' }, -37.5)], invariants: [equilibrium('truss-equilibrium')],
  }),
  available({
    id: 'end-release', title: 'Liberación de momento en extremo', capability: 'release', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Closed form propped cantilever; a released member end makes the prop carry a determinate compatibility reaction.', derivation: 'P=20 kN at a=L/2 on L=4 m: RB=5P/16=6.25 kN, RA=13.75 kN, and the released j-end moment is exactly zero.' },
    build: () => project('end-release', [{ id: 'A', x: 0, y: 0, support: { type: 'fixed' } }, { id: 'B', x: 4, y: 0, support: { type: 'custom', restrainY: true } }], [{ ...member('AB', 'A', 'B'), releases: { jMoment: true } }], { memberLoads: [{ id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -20 }] }),
    assertions: [assertion('release-ra', { kind: 'node', nodeId: 'A', component: 'ry' }, 13.75), assertion('release-rb', { kind: 'node', nodeId: 'B', component: 'ry' }, 6.25), assertion('release-j-moment', { kind: 'member-end-force', memberId: 'AB', end: 'j', quantity: 'moment' }, 0)], invariants: [equilibrium('release-equilibrium'), { id: 'release-zero-moment', kind: 'member-end-near-zero', description: 'The explicit j-end moment release must be visible in the recovered local end forces.', memberId: 'AB', end: 'j', quantity: 'moment', tolerance: 1e-10 }],
  }),
  available({
    id: 'spring-supported-bar', title: 'Barra axial con resorte de apoyo', capability: 'spring', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Closed form two springs in parallel: u=P/(EA/L+k).', derivation: 'P=10 kN, EA/L=1000 kN/m, support kx=1000 kN/m, therefore u=0.005 m.' },
    build: () => project('spring-supported-bar', [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 2, y: 0, support: { type: 'custom', restrainY: true, spring: { kx: 1000 } } }], [member('AB', 'A', 'B', 'truss')], { nodalLoads: [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 10, fy: 0, mz: 0 }] }),
    assertions: [assertion('spring-ux', { kind: 'node', nodeId: 'B', component: 'ux' }, 0.005)], invariants: [equilibrium('spring-equilibrium')],
  }),
  available({
    id: 'imposed-displacement', title: 'Desplazamiento impuesto', capability: 'imposed action', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Closed form axial compatibility: N=EA·δ/L.', derivation: 'δ=0.001 m, E=200000 kN/m², A=0.01 m², L=2 m; N=1 kN.' },
    build: () => project('imposed-displacement', [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 2, y: 0, support: { type: 'custom', restrainX: true, restrainY: true } }], [member('AB', 'A', 'B', 'truss')], { prescribedDisplacements: [{ id: 'settle', nodeId: 'B', caseId: 'LC1', component: 'ux', value: 0.001 }] }),
    assertions: [assertion('imposed-ux', { kind: 'node', nodeId: 'B', component: 'ux' }, 0.001), assertion('imposed-force', { kind: 'member', memberId: 'AB', quantity: 'axial', extreme: 'maximum' }, 1)], invariants: [equilibrium('imposed-equilibrium')],
  }),
  available({
    id: 'thermal-restraint', title: 'Acción térmica en barra restringida', capability: 'thermal action', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: [...baseAssumptions, 'α=1e−5 /°C; temperature is uniform along the bar and both axial ends are restrained.'],
    oracle: { provenance: 'Closed form restrained thermal stress N=EAαΔT (compression for positive heating).', derivation: 'E=200000 kN/m², A=0.01 m², α=1e−5 /°C, ΔT=10 °C; |N|=0.2 kN.' },
    build: () => project('thermal-restraint', [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 2, y: 0, support: { type: 'custom', restrainX: true, restrainY: true } }], [member('AB', 'A', 'B', 'truss')], { memberInitialEffects: [{ id: 'heat', memberId: 'AB', caseId: 'LC1', type: 'temperature', alpha: 1e-5, deltaT: 10 }] }),
    assertions: [assertion('thermal-force', { kind: 'member', memberId: 'AB', quantity: 'axial', extreme: 'minimum' }, -0.2)], invariants: [equilibrium('thermal-equilibrium')],
  }),
  available({
    id: 'mechanism-singularity', title: 'Mecanismo y singularidad', capability: 'mechanism/singularity', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Independent stability check: a free two-node bar has rigid-body modes and cannot be solved.', derivation: 'No support restrains the horizontal/vertical rigid-body modes; the expected result is an explicit failed analysis, never a fabricated zero response.' },
    build: () => project('mechanism-singularity', [{ id: 'A', x: 0, y: 0, support: { type: 'none' } }, { id: 'B', x: 2, y: 0, support: { type: 'none' } }], [member('AB', 'A', 'B', 'truss')]),
    assertions: [assertion('mechanism-fails', { kind: 'analysis', field: 'success' }, false)], invariants: [{ id: 'mechanism-rejected', kind: 'analysis-failed', description: 'A rigid-body mechanism must be rejected explicitly rather than assigned a numerical displacement.' }],
  }),
  available({
    id: 'p-delta', title: 'P-Delta experimental de pórtico en voladizo', capability: 'P-Delta', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-p-delta/v1', units: 'kN-m', assumptions: [...baseAssumptions, 'P-Delta is experimental and uses the current one-element-per-member geometric stiffness iteration.'],
    oracle: { provenance: 'Independent first-order beam-column sanity check plus equilibrium invariants; second-order value is not replaced by a hand result.', derivation: 'A fixed-base column with lateral 1 kN and subcritical compressive 0.5 kN must converge with finite displacement and preserve global equilibrium; amplification must be ≥1.' },
    build: () => { const p = project('p-delta', [{ id: 'A', x: 0, y: 0, support: { type: 'fixed' } }, { id: 'B', x: 0, y: 4, support: { type: 'none' } }], [member('AB', 'A', 'B')], { nodalLoads: [{ id: 'H', nodeId: 'B', caseId: 'LC1', fx: 1, fy: -0.5, mz: 0 }] }); return { ...p, settings: { ...p.settings, analysisMode: 'p-delta' } }; },
    assertions: [assertion('pdelta-success', { kind: 'analysis', field: 'success' }, true), assertion('pdelta-enabled', { kind: 'analysis', field: 'pDeltaEnabled' }, true), assertion('pdelta-converged', { kind: 'analysis', field: 'pDeltaConverged' }, true), assertion('pdelta-finite-displacement', { kind: 'analysis', field: 'finiteDisplacement' }, true)], invariants: [equilibrium('pdelta-equilibrium'), { id: 'pdelta-finite', kind: 'finite-displacement', description: 'Every converged P-Delta displacement must be finite.' }, { id: 'pdelta-amplification', kind: 'pdelta-amplification', description: 'A stable compressive P-Delta case must not reduce the governing first-order displacement.', minimum: 1 }],
  }),
  available({
    id: 'load-combination', title: 'Combinación lineal de casos', capability: 'load combinations', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-linear-static/v1', units: 'kN-m', assumptions: baseAssumptions,
    oracle: { provenance: 'Superposition closed form for two point loads on a symmetric beam.', derivation: 'Each case carries a 10 kN midspan load; factors 1.5 and 0.5 produce 20 kN total, RA=RB=10 kN and Mmax=20 kN·m.' },
    build: () => { const p = frameBeam('load-combination', 4, [{ id: 'P1', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -10 }, { id: 'P2', memberId: 'AB', caseId: 'LC2', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -10 }], true); return { ...p, loadCases: [{ id: 'LC1', name: 'A', category: 'variable', active: true }, { id: 'LC2', name: 'B', category: 'variable', active: true }], combinations: [{ id: 'COMB', name: '1.5A+0.5B', factors: { LC1: 1.5, LC2: 0.5 } }] }; },
    assertions: [assertion('combination-ra', { kind: 'node', nodeId: 'A', component: 'ry' }, 10), assertion('combination-mmax', { kind: 'member', memberId: 'AB', quantity: 'moment', extreme: 'maximum' }, 20)], invariants: [equilibrium('combination-equilibrium')],
  }),
  unsupported('buckling', 'Pandeo eigenvalor', 'buckling', 'No existe extracción modal/eigenvalor en el motor 2D actual; P-Delta sólo expone una estimación experimental de carga crítica y no se convierte en un caso de pandeo.'),
  unsupported('modal', 'Modos y frecuencias', 'modal', 'El motor 2D no ensambla una matriz de masa generalizada ni resuelve eigenvalores; nodalMasses son datos preparados para estudios futuros.'),
  unsupported('influence', 'Línea de influencia', 'influence', 'La línea de influencia vive en el flujo de cargas móviles/worker y no forma parte del contrato directo de analyzeProject; no se duplica como resultado estático.'),
];

export const availableSolver2dCorpus = solver2dCorpus.filter((item) => item.status === 'available');
export const unsupportedSolver2dCapabilities = solver2dCorpus.filter((item) => item.status === 'unsupported');

export const resolveCorpusProject = (item: Solver2DCorpusCase): ProjectModel => {
  if (!item.build) throw new Error(`El caso ${item.id} no tiene fixture ejecutable.`);
  return item.build();
};

export const corpusAssertionMatches = (actual: number, expected: CorpusAssertion): boolean => {
  if (typeof expected.expected !== 'number' || !Number.isFinite(actual)) return false;
  const tolerance = Math.abs(expected.expected) <= expected.nearZeroTolerance ? expected.nearZeroTolerance : expected.atol;
  return Math.abs(actual - expected.expected) <= tolerance + expected.rtol * Math.max(Math.abs(actual), Math.abs(expected.expected));
};

export const readCorpusAssertion = (result: AnalysisResult, target: CorpusAssertionTarget): number | boolean => {
  if (target.kind === 'analysis') {
    if (target.field === 'success') return result.success;
    if (target.field === 'pDeltaEnabled') return Boolean(result.pDelta?.enabled);
    if (target.field === 'pDeltaConverged') return Boolean(result.pDelta?.converged);
    if (target.field === 'finiteDisplacement') return result.displacements.every(Number.isFinite);
    return result.pDelta?.amplificationFactor ?? Number.NaN;
  }
  if (target.kind === 'node') {
    const node = result.nodeResults.find((entry) => entry.nodeId === target.nodeId);
    if (!node) throw new Error(`Resultado de nodo ausente: ${target.nodeId}`);
    return node[target.component];
  }
  const memberResult = result.memberResults.find((entry) => entry.memberId === target.memberId);
  if (!memberResult) throw new Error(`Resultado de miembro ausente: ${target.memberId}`);
  if (target.kind === 'member-end-force') {
    const offset = target.end === 'i' ? 0 : 3;
    const index = target.quantity === 'axial' ? offset : target.quantity === 'shear' ? offset + 1 : offset + 2;
    return target.quantity === 'axial' && target.end === 'i' ? -memberResult.localEndForces[index] : memberResult.localEndForces[index];
  }
  if (target.kind === 'member-deformation') {
    const segment = memberResult.deformationSegments.find((candidate) => target.x >= candidate.x0 - 1e-10 && target.x <= candidate.x1 + 1e-10);
    if (!segment) throw new Error(`Segmento de deformada ausente en x=${target.x}`);
    const coefficients = segment[target.quantity];
    const localX = target.x - segment.x0;
    return coefficients.reduceRight((value, coefficient) => value * localX + coefficient, 0);
  }
  const values = target.quantity === 'axial' ? [memberResult.maxAxial, memberResult.minAxial] : target.quantity === 'shear' ? [memberResult.maxShear, memberResult.minShear] : [memberResult.maxMoment, memberResult.minMoment];
  if (target.extreme === 'maximum') return Math.max(...values);
  if (target.extreme === 'minimum') return Math.min(...values);
  return Math.max(...values.map((value) => Math.abs(value)));
};

const factorFor = (project: ProjectModel, caseId: string, combination?: LoadCombination | null): number => {
  if (combination) return combination.factors[caseId] ?? 0;
  return project.loadCases.find((loadCase) => loadCase.id === caseId)?.active ? 1 : 0;
};

const memberGeometry = (project: ProjectModel, memberId: string) => {
  const source = project.members.find((candidate) => candidate.id === memberId);
  if (!source) return undefined;
  const start = project.nodes.find((node) => node.id === source.i);
  const end = project.nodes.find((node) => node.id === source.j);
  if (!start || !end) return undefined;
  const dx = end.x - start.x; const dy = end.y - start.y; const length = Math.hypot(dx, dy);
  return { source, start, dx, dy, length, c: dx / length, s: dy / length };
};

const globalLoadVector = (load: MemberLoad, geometry: NonNullable<ReturnType<typeof memberGeometry>>, x: number): [number, number, number] => {
  if (load.type === 'moment') return [0, 0, (load.moment ?? 0)];
  const local = load.type === 'point'
    ? [load.px ?? 0, load.py ?? 0]
    : [(load.qxStart ?? 0) + ((load.qxEnd ?? load.qxStart ?? 0) - (load.qxStart ?? 0)) * x, (load.qyStart ?? 0) + ((load.qyEnd ?? load.qyStart ?? 0) - (load.qyStart ?? 0)) * x];
  const [lx, ly] = load.coordinateSystem === 'local' ? local : local;
  return load.coordinateSystem === 'local' ? [geometry.c * lx - geometry.s * ly, geometry.s * lx + geometry.c * ly, 0] : [lx, ly, 0];
};

/** Independent statics checks; this intentionally does not read solver audit fields. */
export const evaluateCorpusInvariant = (project: ProjectModel, result: AnalysisResult, invariant: CorpusInvariant, combination?: LoadCombination | null): boolean => {
  if (invariant.kind === 'analysis-failed') return !result.success && result.issues.some((issue) => issue.severity === 'error');
  if (invariant.kind === 'finite-displacement') return result.success && result.displacements.every(Number.isFinite);
  if (invariant.kind === 'pdelta-amplification') {
    const firstOrder = analyzeProject(project, combination, { includeEducationTrace: false, linearBackend: 'dense' });
    if (!result.success || !firstOrder.success) return false;
    const firstByNode = new Map(firstOrder.nodeResults.map((entry) => [entry.nodeId, entry]));
    let amplification = 0; let counted = false;
    for (const second of result.nodeResults) {
      const first = firstByNode.get(second.nodeId);
      if (!first) return false;
      for (const component of ['ux', 'uy', 'rz'] as const) {
        if (Math.abs(first[component]) <= 1e-12) continue;
        amplification = Math.max(amplification, Math.abs(second[component]) / Math.abs(first[component]));
        counted = true;
      }
    }
    return counted && Number.isFinite(amplification) && amplification >= invariant.minimum;
  }
  if (invariant.kind === 'node-symmetry') {
    const first = result.nodeResults.find((entry) => entry.nodeId === invariant.nodeA)?.[invariant.component];
    const second = result.nodeResults.find((entry) => entry.nodeId === invariant.nodeB)?.[invariant.component];
    return first !== undefined && second !== undefined && Math.abs(first - second) <= invariant.atol + invariant.rtol * Math.max(Math.abs(first), Math.abs(second));
  }
  if (invariant.kind === 'member-end-near-zero') {
    try {
      const value = readCorpusAssertion(result, { kind: 'member-end-force', memberId: invariant.memberId, end: invariant.end, quantity: invariant.quantity });
      return typeof value === 'number' && Math.abs(value) <= invariant.tolerance;
    } catch { return false; }
  }
  let fx = 0; let fy = 0; let mz = 0;
  for (const load of project.nodalLoads) {
    const factor = factorFor(project, load.caseId, combination);
    const node = project.nodes.find((candidate) => candidate.id === load.nodeId);
    if (!node) continue;
    const nodeResult = result.nodeResults.find((candidate) => candidate.nodeId === node.id);
    // P-Delta equilibrium is checked in the current configuration: a vertical
    // load acting through a laterally displaced node contributes P·Δ to moment.
    // The engine's non-follower nodal loads retain their original line of
    // action in y; only the lateral P·Δ arm changes in this benchmark.
    const x = node.x + (result.pDelta ? (nodeResult?.ux ?? 0) : 0); const y = node.y;
    fx += factor * load.fx; fy += factor * load.fy; mz += factor * (x * load.fy - y * load.fx + load.mz);
  }
  for (const load of project.memberLoads) {
    const geometry = memberGeometry(project, load.memberId);
    if (!geometry) continue;
    const factor = factorFor(project, load.caseId, combination);
    const startFraction = Math.min(load.start, load.end); const endFraction = Math.max(load.start, load.end);
    if (load.type === 'distributed' && (load.coordinateSystem !== 'global' || load.lengthBasis !== 'real' || Math.abs(load.start) > 1e-12 || Math.abs(load.end - 1) > 1e-12 || Math.abs((load.qxEnd ?? load.qxStart ?? 0) - (load.qxStart ?? 0)) > 1e-12 || Math.abs((load.qyEnd ?? load.qyStart ?? 0) - (load.qyStart ?? 0)) > 1e-12)) return false;
    if (load.type === 'point') {
      const x = load.position ?? 0.5; const [px, py, pm] = globalLoadVector(load, geometry, x);
      const gx = geometry.start.x + geometry.dx * x; const gy = geometry.start.y + geometry.dy * x;
      fx += factor * px; fy += factor * py; mz += factor * (gx * py - gy * px + pm);
    } else if (load.type === 'distributed') {
      const span = (endFraction - startFraction) * geometry.length; const [qaX, qaY] = globalLoadVector(load, geometry, startFraction); const [qbX, qbY] = globalLoadVector(load, geometry, endFraction);
      const totalX = factor * span * (qaX + qbX) / 2; const totalY = factor * span * (qaY + qbY) / 2;
      const gx = geometry.start.x + geometry.dx * (startFraction + endFraction) / 2; const gy = geometry.start.y + geometry.dy * (startFraction + endFraction) / 2;
      fx += totalX; fy += totalY; mz += gx * totalY - gy * totalX;
    } else {
      const [,, pm] = globalLoadVector(load, geometry, load.position ?? 0.5); mz += factor * pm;
    }
  }
  for (const reaction of result.nodeResults) {
    const node = project.nodes.find((candidate) => candidate.id === reaction.nodeId);
    if (!node) continue;
    fx += reaction.rx; fy += reaction.ry; mz += node.x * reaction.ry - node.y * reaction.rx + reaction.rm;
  }
  const scale = Math.max(1, Math.abs(fx), Math.abs(fy), Math.abs(mz));
  return Math.abs(fx) <= invariant.atol + invariant.rtol * scale
    && Math.abs(fy) <= invariant.atol + invariant.rtol * scale
    && Math.abs(mz) <= invariant.atol + invariant.rtol * scale;
};
