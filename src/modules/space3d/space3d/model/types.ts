/**
 * Space 3D · Contratos inmutables del dominio espacial (S3D-1).
 *
 * Este módulo es la única fuente de verdad de los tipos 3D y no comparte
 * estructuras con el dominio 2D: Foundation sólo aporta `UnitSystemId`
 * para que ambos productos hablen del mismo sistema de unidades.
 *
 * Convenciones fijas de S3D-1 — no reinterpretarlas fuera de este archivo:
 *
 *   · Ejes globales: X y Z horizontales, **Y vertical hacia arriba**. Es la
 *     misma convención que el editor 2D (plano XY con Y arriba), de modo que
 *     un modelo plano es un caso particular de uno espacial con z = 0.
 *   · Orden de GDL nodales: `[ux, uy, uz, rx, ry, rz]`.
 *   · Orden de GDL del elemento: los seis del nudo `i` y luego los seis de `j`.
 *   · Unidades internas: `m`, `kN`, `kN·m`, `kN/m²`, `m²`, `m⁴`, `rad`.
 *   · Ejes locales: `x` del nudo `i` al `j`; `y` es la referencia global
 *     proyectada perpendicular a `x` y girada por `rollRadians`; `z = x × y`.
 *   · Inercias: `Iz` gobierna la flexión en el plano `x–y` (desplazamiento
 *     local `v`, giro `rz`) y `Iy` la del plano `x–z` (`w`, `ry`).
 */
import type { UnitSystemId } from '../../../../foundation/units';

export const SPACE3D_LEGACY_SCHEMA_VERSION = 1 as const;
export const SPACE3D_SCHEMA_VERSION = 2 as const;
export const SPACE3D_ANALYSIS_SPACE = 'space-3d' as const;

/**
 * Tolerancias geométricas y de serialización. La admisión numérica depende del
 * presupuesto adaptativo del runtime; el modelo no impone máximos de entidades.
 */
export const SPACE3D_LIMITS = Object.freeze({
  maxCoordinateMagnitude: 1e9,
  minMemberLength: 1e-9,
  minReferenceNorm: 1e-12,
  minPerpendicularRatio: 1e-8,
});

export type Space3DVector = readonly [number, number, number];

export interface Space3DRestraints {
  readonly ux: boolean;
  readonly uy: boolean;
  readonly uz: boolean;
  readonly rx: boolean;
  readonly ry: boolean;
  readonly rz: boolean;
}

export const SPACE3D_DOF_KEYS = Object.freeze(['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const);
export type Space3DDofKey = (typeof SPACE3D_DOF_KEYS)[number];

export interface Space3DNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly restraints: Space3DRestraints;
  /** Semántica planar exacta de origen; ausente en nodos creados sólo en 3D. */
  readonly planarSupport?: Space3DPlanarSupport;
  readonly internalHinge?: boolean;
}

interface Space3DSpringDefinition {
  readonly kx?: number;
  readonly ky?: number;
  readonly kz?: number;
  /** Alias planar exacto para el resorte alrededor de Z. */
  readonly kr?: number;
  readonly krx?: number;
  readonly kry?: number;
  readonly krz?: number;
  readonly kNormal?: number;
  readonly direction?: Space3DVector;
  readonly angleDeg?: number;
}

export interface Space3DPlanarSupport {
  readonly type: 'none' | 'pin' | 'roller' | 'fixed' | 'custom';
  readonly angleDeg?: number;
  readonly restrainX?: boolean;
  readonly restrainY?: boolean;
  readonly restrainR?: boolean;
  readonly spring?: Space3DSpringDefinition;
  readonly prescribed?: { readonly ux?: number; readonly uy?: number; readonly rz?: number; readonly normal?: number };
}

export interface Space3DMemberOrientation {
  /** Vector global que define el plano `x–y` local antes de aplicar el roll. */
  readonly localYReferenceGlobal: Space3DVector;
  /** Giro de la triada alrededor del eje local `x`, en radianes. */
  readonly rollRadians: number;
}

export interface Space3DFrameMember {
  readonly id: string;
  readonly i: string;
  readonly j: string;
  /** Módulo de elasticidad, kN/m². */
  readonly E: number;
  /** Módulo de corte, kN/m². */
  readonly G: number;
  /** Área, m². */
  readonly A: number;
  /** Inercia respecto al eje local y, m⁴ (flexión en el plano x–z). */
  readonly Iy: number;
  /** Inercia respecto al eje local z, m⁴ (flexión en el plano x–y). */
  readonly Iz: number;
  /** Constante torsional de St. Venant, m⁴. */
  readonly J: number;
  readonly orientation: Space3DMemberOrientation;
  /** Frames, armaduras y vínculos rígidos permanecen entidades distintas. */
  readonly type?: 'frame' | 'truss' | 'rigid';
  readonly materialId?: string;
  readonly materialOrigin?: 'catalog' | 'custom' | 'imported' | 'legacy';
  readonly sectionId?: string;
  readonly sectionOrigin?: 'catalog' | 'custom' | 'imported' | 'legacy';
  readonly beamTheory?: 'euler-bernoulli' | 'timoshenko';
  readonly shearArea?: number;
  /** Densidad de masa del material, kg/m³. */
  readonly density?: number;
  readonly releases?: Space3DMemberRelease;
  readonly axialBehavior?: 'both' | 'tension-only' | 'compression-only';
  readonly rotationalSpringI?: number;
  readonly rotationalSpringJ?: number;
  readonly rigidOffsetI?: number;
  readonly rigidOffsetJ?: number;
  readonly label?: string;
  /** Distingue un G declarado en 2D de la hipótesis visible usada por el solver 3D legacy. */
  readonly planarG?: number | null;
}

export interface Space3DMemberRelease {
  readonly iUx?: boolean;
  readonly iUy?: boolean;
  readonly iUz?: boolean;
  readonly iRx?: boolean;
  readonly iRy?: boolean;
  readonly iRz?: boolean;
  readonly jUx?: boolean;
  readonly jUy?: boolean;
  readonly jUz?: boolean;
  readonly jRx?: boolean;
  readonly jRy?: boolean;
  readonly jRz?: boolean;
}

export interface Space3DNodalLoad {
  readonly id: string;
  readonly caseId: string;
  readonly nodeId: string;
  /** Fuerzas globales, kN. */
  readonly fx: number;
  readonly fy: number;
  readonly fz: number;
  /** Momentos globales, kN·m. */
  readonly mx: number;
  readonly my: number;
  readonly mz: number;
}

export interface Space3DLoadCase {
  readonly id: string;
  readonly name: string;
  readonly category?: 'permanent' | 'variable' | 'accidental' | 'other';
  readonly active?: boolean;
  readonly selfWeightFactor?: number;
}

export interface Space3DLoadCombinationTerm {
  readonly caseId: string;
  readonly factor: number;
}

export interface Space3DLoadCombination {
  readonly id: string;
  readonly name: string;
  readonly terms: readonly Space3DLoadCombinationTerm[];
  readonly source?: string;
  readonly sourceUrl?: string;
  readonly jurisdiction?: string;
  readonly edition?: string;
  readonly stateLimit?: 'service' | 'ultimate' | 'other';
  readonly reviewedAt?: string;
}

export interface Space3DPrescribedDisplacement {
  readonly id: string;
  readonly nodeId: string;
  readonly caseId: string;
  readonly component: Space3DDofKey | 'normal';
  readonly value: number;
  readonly normalDirection?: Space3DVector;
}

export interface Space3DMemberLoad {
  readonly id: string;
  readonly memberId: string;
  readonly caseId: string;
  readonly type: 'distributed' | 'point' | 'moment';
  readonly coordinateSystem: 'global' | 'local';
  readonly lengthBasis: 'real' | 'horizontal' | 'vertical';
  readonly start: number;
  readonly end: number;
  readonly qxStart?: number;
  readonly qxEnd?: number;
  readonly qyStart?: number;
  readonly qyEnd?: number;
  readonly qzStart?: number;
  readonly qzEnd?: number;
  readonly px?: number;
  readonly py?: number;
  readonly pz?: number;
  readonly mx?: number;
  readonly my?: number;
  readonly mz?: number;
  readonly moment?: number;
  readonly position?: number;
}

export interface Space3DMemberInitialEffect {
  readonly id: string;
  readonly memberId: string;
  readonly caseId: string;
  readonly type: 'temperature' | 'initial-strain';
  readonly alpha?: number;
  readonly deltaT?: number;
  readonly gradient?: number;
  readonly gradientY?: number;
  readonly gradientZ?: number;
  readonly axialStrain?: number;
  readonly curvature?: number;
  readonly curvatureY?: number;
  readonly curvatureZ?: number;
}

export interface Space3DNodeLink {
  readonly id: string;
  readonly nodeI: string;
  readonly nodeJ?: string;
  readonly behavior: 'linear' | 'compression-only' | 'tension-only' | 'stop' | 'friction';
  readonly direction: Space3DVector;
  readonly angleDeg?: number;
  readonly stiffness: number;
  readonly clearance?: number;
  readonly slipForce?: number;
  readonly label?: string;
}

export interface Space3DMultiPointConstraint {
  readonly id: string;
  readonly terms: readonly { readonly nodeId: string; readonly component: Space3DDofKey; readonly coefficient: number }[];
  readonly value?: number;
  readonly label?: string;
}

export interface Space3DNodalMass {
  readonly id: string;
  readonly nodeId: string;
  readonly mass: number;
  readonly rotationalInertia?: number;
  readonly massX?: number;
  readonly massY?: number;
  readonly massZ?: number;
  readonly inertiaX?: number;
  readonly inertiaY?: number;
  readonly inertiaZ?: number;
  readonly label?: string;
}

export interface Space3DGeneratedLoadSource {
  readonly id: string;
  readonly kind: 'tributary-surface' | 'hydrostatic' | 'soil-pressure' | 'elastic-foundation' | 'live-pattern' | 'member-chain' | 'prestress';
  readonly caseId?: string;
  readonly memberIds: readonly string[];
  readonly pressure?: number;
  readonly tributaryWidth?: number;
  readonly direction?: 'global-x' | 'global-y' | 'global-z';
  readonly referenceY?: number;
  readonly unitWeight?: number;
  readonly pressureAtReference?: number;
  readonly sign?: 1 | -1;
  readonly stiffness?: number;
  readonly qx?: number;
  readonly qy?: number;
  readonly qz?: number;
  readonly coordinateSystem?: 'global' | 'local';
  readonly lengthBasis?: 'real' | 'horizontal' | 'vertical';
  readonly pattern?: 'all' | 'alternating-odd' | 'alternating-even';
  readonly force?: number;
  readonly eccentricity?: number;
  readonly label?: string;
}

export interface Space3DMovingLoadCase {
  readonly id: string;
  readonly name: string;
  readonly memberIds: readonly string[];
  readonly targetMemberId: string;
  readonly targetPosition: number;
  readonly quantity: 'R' | 'N' | 'V' | 'M';
  readonly startNodeId?: string;
  readonly impactFactor?: number;
  readonly axles: readonly { readonly id?: string; readonly P: number; readonly offset: number }[];
}

interface LegacySpace3DProjectV1 {
  readonly analysisSpace: typeof SPACE3D_ANALYSIS_SPACE;
  readonly schemaVersion: typeof SPACE3D_LEGACY_SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly units: UnitSystemId;
  readonly nodes: readonly Space3DNode[];
  readonly members: readonly Space3DFrameMember[];
  readonly nodalLoads: readonly Space3DNodalLoad[];
  readonly loadCases: readonly Space3DLoadCase[];
  readonly loadCombinations: readonly Space3DLoadCombination[];
}

export interface Space3DProjectV2 extends Omit<LegacySpace3DProjectV1, 'schemaVersion' | 'nodes' | 'members'> {
  readonly schemaVersion: typeof SPACE3D_SCHEMA_VERSION;
  readonly nodes: readonly Space3DNode[];
  readonly members: readonly Space3DFrameMember[];
  readonly prescribedDisplacements: readonly Space3DPrescribedDisplacement[];
  readonly memberLoads: readonly Space3DMemberLoad[];
  readonly memberInitialEffects: readonly Space3DMemberInitialEffect[];
  readonly nodeLinks: readonly Space3DNodeLink[];
  readonly multiPointConstraints: readonly Space3DMultiPointConstraint[];
  readonly nodalMasses: readonly Space3DNodalMass[];
  readonly generatedLoadSources: readonly Space3DGeneratedLoadSource[];
  readonly movingLoadCases: readonly Space3DMovingLoadCase[];
}
/** @deprecated Usa Space3DProjectV2; alias temporal para consumidores internos del editor existente. */
export type Space3DProjectV1 = Space3DProjectV2;

export type Space3DEntityKind = 'project' | 'node' | 'member' | 'load' | 'case' | 'combination'
  | 'member-load' | 'prescribed-displacement' | 'initial-effect' | 'node-link'
  | 'multi-point-constraint' | 'nodal-mass' | 'generated-load-source' | 'moving-load-case';

export type Space3DValidationCode =
  | 'duplicate-id'
  | 'empty-id'
  | 'missing-reference'
  | 'self-referential-member'
  | 'invalid-coordinate'
  | 'invalid-property'
  | 'degenerate-length'
  | 'degenerate-orientation'
  | 'missing-case'
  | 'unknown-field'
  | 'limit-exceeded';

export interface Space3DValidationIssue {
  readonly code: Space3DValidationCode;
  readonly entityKind: Space3DEntityKind;
  readonly entityId: string;
  /** Campo concreto responsable, o cadena vacía cuando el problema es de entidad. */
  readonly field: string;
}

export type Space3DAnalysisIssueCode =
  | Space3DValidationCode
  | 'empty-model'
  | 'unknown-target'
  | 'no-free-dof'
  | 'mechanism'
  | 'non-finite-solution'
  | 'memory-budget'
  /** Task 6 persists these member families, but the legacy frame solver does not analyze them. */
  | 'unsupported-member-type'
  /** A preserved semantic is not silently reinterpreted by the current solver. */
  | 'unsupported-semantics';

export interface Space3DAnalysisIssue {
  readonly code: Space3DAnalysisIssueCode;
  readonly entityKind: Space3DEntityKind;
  readonly entityId: string;
  readonly field: string;
}

export interface Space3DDofValues {
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
}

export interface Space3DNodeResult {
  readonly nodeId: string;
  /** Desplazamientos globales, m y rad. */
  readonly displacement: Space3DDofValues;
  /** Reacciones globales, kN y kN·m; cero en los GDL libres. */
  readonly reaction: Space3DDofValues;
}

/**
 * Acciones internas en un extremo, expresadas en ejes locales del miembro.
 * `N` es el axil, `T` el torsor, `Vy`/`Vz` los cortantes y `My`/`Mz` los
 * flectores alrededor de los ejes locales homónimos.
 */
export interface Space3DMemberEndForces {
  readonly N: number;
  readonly Vy: number;
  readonly Vz: number;
  readonly T: number;
  readonly My: number;
  readonly Mz: number;
}

export interface Space3DOrientationBasis {
  readonly x: Space3DVector;
  readonly y: Space3DVector;
  readonly z: Space3DVector;
}

/**
 * Esfuerzos internos y elástica en una sección de la barra, en ejes locales.
 * `N` es positivo a tracción; `Mz` positivo si la curvatura `v''` es positiva
 * (en una viga con `y` hacia arriba, momento de vano); `u`, `v`, `w` son los
 * desplazamientos locales de la sección, m.
 */
export interface Space3DMemberStation {
  /** Distancia desde el extremo `i`, m. */
  readonly x: number;
  readonly N: number;
  readonly Vy: number;
  readonly Vz: number;
  readonly T: number;
  readonly My: number;
  readonly Mz: number;
  readonly u: number;
  readonly v: number;
  readonly w: number;
}

export interface Space3DMemberResult {
  readonly memberId: string;
  readonly length: number;
  readonly basis: Space3DOrientationBasis;
  readonly start: Space3DMemberEndForces;
  readonly end: Space3DMemberEndForces;
  /**
   * Estaciones a lo largo de la barra, ordenadas por `x`. En una carga
   * concentrada la posición se repite (valor a la izquierda y a la derecha).
   */
  readonly stations?: readonly Space3DMemberStation[];
}

export interface Space3DEquilibriumAudit {
  /** Σ de fuerzas aplicadas y reacciones, kN. */
  readonly force: Space3DVector;
  /** Σ de momentos respecto al origen global, kN·m. */
  readonly moment: Space3DVector;
  /** Residual normalizado por la mayor acción presente y por 1. */
  readonly normalized: number;
}

export interface Space3DAnalysisDiagnostics {
  readonly dofCount: number;
  readonly freeDofCount: number;
  readonly restrainedDofCount: number;
  /** Residual relativo del sistema lineal reducido. */
  readonly relativeResidual: number;
  readonly conditionEstimate: number;
  readonly equilibrium: Space3DEquilibriumAudit;
  /**
   * GDL sin rigidez ni carga que se fijaron solos: giros de nudos a los que
   * sólo llegan armaduras o barras articuladas, o nudos sueltos.
   */
  readonly autoRestrainedDofCount?: number;
}

export interface Space3DAnalysisResult {
  readonly success: boolean;
  readonly targetId: string;
  readonly targetKind: 'case' | 'combination' | 'unknown';
  readonly nodeResults: readonly Space3DNodeResult[];
  readonly memberResults: readonly Space3DMemberResult[];
  readonly issues: readonly Space3DAnalysisIssue[];
  readonly diagnostics: Space3DAnalysisDiagnostics;
}

/** Error de geometría degenerada; su `message` es el código estable. */
export class Space3DGeometryError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'Space3DGeometryError';
    this.code = code;
  }
}

export const fixedSpace3DRestraints = (): Space3DRestraints => ({
  ux: true, uy: true, uz: true, rx: true, ry: true, rz: true,
});

export const freeSpace3DRestraints = (): Space3DRestraints => ({
  ux: false, uy: false, uz: false, rx: false, ry: false, rz: false,
});
