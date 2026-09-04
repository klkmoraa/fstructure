import type { AnalysisResult, ProjectModel } from '../types';
import { createDefaultSettings } from '../data/defaultProject';

export type CorpusStatus = 'available' | 'unsupported';
export type CorpusAssertionTarget =
  | { kind: 'node'; nodeId: string; component: 'ux' | 'uy' | 'rz' | 'rx' | 'ry' | 'rm' }
  | { kind: 'member'; memberId: string; quantity: 'axial' | 'shear' | 'moment'; extreme: 'maximum' | 'minimum' | 'absolute-maximum' }
  | { kind: 'analysis'; field: 'success' | 'pDeltaConverged' | 'pDeltaEnabled' };

export interface CorpusAssertion {
  id: string;
  target: CorpusAssertionTarget;
  expected: number | boolean;
  atol: number;
  rtol: number;
}

export interface CorpusInvariant {
  id: string;
  description: string;
}

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
  [{ ...member('AB', 'A', 'B'), ...(release ? { releases: { iMoment: true, jMoment: true } } : {}) }],
  { memberLoads: loads },
);

const assertion = (id: string, target: CorpusAssertionTarget, expected: number | boolean, atol = 1e-8, rtol = 2e-7): CorpusAssertion => ({ id, target, expected, atol, rtol });
const baseAssumptions = ['SI base units: force kN, length m, moment kN·m, rotation rad.', 'Positive global x/y follow the model axes; positive moment is counter-clockwise.', 'Small displacement linear elastic analysis unless the case explicitly selects P-Delta.', 'E, A and I are numerical inputs; self-weight is disabled.'];
const equilibrium = (id: string): CorpusInvariant => ({ id, description: 'The engine global resultant must close to zero in force and moment.' });

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
    oracle: { provenance: 'Closed form simply-supported beam.', derivation: 'P=40 kN at midspan, L=8 m: RA=RB=P/2=20 kN; Mmax=PL/4=80 kN·m; v(mid)=−PL³/(48EI)=−0.0266666667 m.' },
    build: () => frameBeam('simply-supported-point', 8, [{ id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -40 }]),
    assertions: [assertion('point-ra', { kind: 'node', nodeId: 'A', component: 'ry' }, 20), assertion('point-rb', { kind: 'node', nodeId: 'B', component: 'ry' }, 20), assertion('point-mmax', { kind: 'member', memberId: 'AB', quantity: 'moment', extreme: 'maximum' }, 80), assertion('point-deflection', { kind: 'node', nodeId: 'A', component: 'uy' }, 0)], invariants: [equilibrium('point-equilibrium')],
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
    oracle: { provenance: 'Closed form simply-supported beam; the explicit end releases enforce zero end moments.', derivation: 'P=20 kN at midspan, L=4 m: RA=RB=10 kN and Mmax=PL/4=20 kN·m.' },
    build: () => frameBeam('end-release', 4, [{ id: 'P', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 0, py: -20 }]),
    assertions: [assertion('release-ra', { kind: 'node', nodeId: 'A', component: 'ry' }, 10), assertion('release-rb', { kind: 'node', nodeId: 'B', component: 'ry' }, 10), assertion('release-mmax', { kind: 'member', memberId: 'AB', quantity: 'moment', extreme: 'maximum' }, 20)], invariants: [equilibrium('release-equilibrium')],
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
    assertions: [assertion('mechanism-fails', { kind: 'analysis', field: 'success' }, false)], invariants: [{ id: 'mechanism-rejected', description: 'A rigid-body mechanism must be rejected explicitly rather than assigned a numerical displacement.' }],
  }),
  available({
    id: 'p-delta', title: 'P-Delta experimental de pórtico en voladizo', capability: 'P-Delta', schemaId: 'fusionstructure-2d-corpus/v1', engineId: 'fusionstructure-2d', algorithmId: 'matrix-stiffness-p-delta/v1', units: 'kN-m', assumptions: [...baseAssumptions, 'P-Delta is experimental and uses the current one-element-per-member geometric stiffness iteration.'],
    oracle: { provenance: 'Independent first-order beam-column sanity check plus equilibrium invariants; second-order value is not replaced by a hand result.', derivation: 'A fixed-base column with lateral 1 kN and compressive 50 kN must converge with finite displacement and preserve global equilibrium; amplification must be ≥1.' },
    build: () => { const p = project('p-delta', [{ id: 'A', x: 0, y: 0, support: { type: 'fixed' } }, { id: 'B', x: 4, y: 0, support: { type: 'none' } }], [member('AB', 'A', 'B')], { nodalLoads: [{ id: 'H', nodeId: 'B', caseId: 'LC1', fx: 1, fy: -50, mz: 0 }] }); return { ...p, settings: { ...p.settings, analysisMode: 'p-delta' } }; },
    assertions: [assertion('pdelta-success', { kind: 'analysis', field: 'success' }, true), assertion('pdelta-enabled', { kind: 'analysis', field: 'pDeltaEnabled' }, true)], invariants: [equilibrium('pdelta-equilibrium')],
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

export const readCorpusAssertion = (result: AnalysisResult, target: CorpusAssertionTarget): number | boolean => {
  if (target.kind === 'analysis') {
    if (target.field === 'success') return result.success;
    if (target.field === 'pDeltaEnabled') return Boolean(result.pDelta?.enabled);
    return Boolean(result.pDelta?.converged);
  }
  if (target.kind === 'node') {
    const node = result.nodeResults.find((entry) => entry.nodeId === target.nodeId);
    if (!node) throw new Error(`Resultado de nodo ausente: ${target.nodeId}`);
    return node[target.component];
  }
  const memberResult = result.memberResults.find((entry) => entry.memberId === target.memberId);
  if (!memberResult) throw new Error(`Resultado de miembro ausente: ${target.memberId}`);
  const values = target.quantity === 'axial' ? [memberResult.maxAxial, memberResult.minAxial] : target.quantity === 'shear' ? [memberResult.maxShear, memberResult.minShear] : [memberResult.maxMoment, memberResult.minMoment];
  if (target.extreme === 'maximum') return Math.max(...values);
  if (target.extreme === 'minimum') return Math.min(...values);
  return Math.max(...values.map((value) => Math.abs(value)));
};
