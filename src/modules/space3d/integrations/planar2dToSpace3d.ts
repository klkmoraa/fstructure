/**
 * Serialized integration contract consumed by the standalone Space 3D app.
 *
 * The adapter that creates this snapshot lives in the FusionStructure
 * governance/host repository. Keeping the consumer contract here means the
 * extracted product never imports the 2D model or store.
 */
import type { Space3DEntityKind, Space3DProjectV1 } from '../space3d/public';

export const PLANAR_2D_TO_SPACE3D_HANDOFF_VERSION = 1 as const;

export type Planar2DToSpace3DSourceEntityKind =
  | Space3DEntityKind
  | 'member-load'
  | 'prescribed-displacement'
  | 'initial-effect'
  | 'node-link'
  | 'multi-point-constraint'
  | 'nodal-mass'
  | 'generated-load-source'
  | 'moving-load-case';

export interface Planar2DSourceReference {
  readonly system: 'solver2d';
  readonly projectId: string;
  readonly schemaVersion: number;
  readonly hash: { readonly algorithm: 'fnv1a-32'; readonly value: string };
  readonly reference: string;
}

export interface Planar2DToSpace3DMapping {
  readonly id: string;
  readonly source: { readonly entityKind: Planar2DToSpace3DSourceEntityKind; readonly entityId: string };
  readonly target: { readonly entityKind: Space3DEntityKind; readonly entityId: string } | null;
  readonly disposition: 'preserved' | 'transformed' | 'omitted';
}

export type Space3DBridgeCode =
  | 'pending-shear-modulus' | 'pending-weak-axis-inertia' | 'pending-torsion-constant'
  | 'out-of-plane-unrestrained' | 'truss-member-as-frame' | 'dropped-member-release'
  | 'dropped-internal-hinge' | 'dropped-semi-rigid-connection' | 'dropped-rigid-offset'
  | 'dropped-support-spring' | 'dropped-inclined-support' | 'dropped-prescribed-support-motion'
  | 'dropped-self-weight' | 'dropped-rigid-member' | 'dropped-axial-behavior'
  | 'dropped-timoshenko-theory' | 'dropped-shear-area'
  | 'dropped-member-load' | 'dropped-prescribed-displacement' | 'dropped-initial-effect'
  | 'dropped-node-link' | 'dropped-multi-point-constraint' | 'dropped-nodal-mass'
  | 'dropped-generated-load-source' | 'dropped-moving-load-case';

export type Space3DLossClassification = 'missing-required-property' | 'missing-required-configuration' | 'changed-semantics' | 'omitted-semantics';

export interface Space3DBridgeNote {
  readonly id: string;
  readonly code: Space3DBridgeCode;
  readonly classification: Space3DLossClassification;
  readonly source: { readonly entityKind: Planar2DToSpace3DSourceEntityKind; readonly entityId: string; readonly field: string };
  readonly target: { readonly entityKind: Space3DEntityKind; readonly entityId: string; readonly field: string } | null;
  readonly entityKind: Planar2DToSpace3DSourceEntityKind;
  readonly entityId: string;
  readonly field: string;
  readonly blocking: boolean;
  /** Value inserted by the adapter only as a visible hypothesis. */
  readonly hypothesis?: number;
}

export interface Planar2DToSpace3DLossReport {
  readonly status: 'lossless' | 'review-required';
  readonly entries: readonly Space3DBridgeNote[];
}

export interface Planar2DToSpace3DHandoffV1 {
  readonly kind: 'planar-2d-to-space3d-handoff';
  readonly version: typeof PLANAR_2D_TO_SPACE3D_HANDOFF_VERSION;
  readonly handoffId: string;
  readonly source: Planar2DSourceReference;
  readonly candidateModel: Space3DProjectV1;
  readonly mapping: readonly Planar2DToSpace3DMapping[];
  readonly provenance: {
    readonly adapter: 'fusionstructure/integrations/planar2d-to-space3d';
    readonly sourceReference: string;
    readonly candidateSchemaVersion: number;
  };
  readonly lossReport: Planar2DToSpace3DLossReport;
}

export interface Planar2DToSpace3DHandoffCancellationV1 {
  readonly kind: 'planar-2d-to-space3d-handoff-cancellation';
  readonly version: typeof PLANAR_2D_TO_SPACE3D_HANDOFF_VERSION;
  readonly status: 'cancelled';
  readonly handoffId: string;
  readonly sourceReference: string;
  readonly reason: 'user-cancelled-before-open';
}

export interface Planar2DSourceSnapshot {
  readonly id: string;
  readonly name: string;
  readonly candidateModel: Space3DProjectV1;
  readonly lossReport: Planar2DToSpace3DLossReport;
}

export const preparePlanar2DToSpace3DHandoff = (source: Planar2DSourceSnapshot): Planar2DToSpace3DHandoffV1 => {
  const reference = `solver2d:${source.id}:snapshot`;
  return {
    kind: 'planar-2d-to-space3d-handoff',
    version: PLANAR_2D_TO_SPACE3D_HANDOFF_VERSION,
    handoffId: `handoff:${reference}`,
    source: { system: 'solver2d', projectId: source.id, schemaVersion: 7, hash: { algorithm: 'fnv1a-32', value: 'fixture' }, reference },
    candidateModel: source.candidateModel,
    mapping: [],
    provenance: { adapter: 'fusionstructure/integrations/planar2d-to-space3d', sourceReference: reference, candidateSchemaVersion: source.candidateModel.schemaVersion },
    lossReport: source.lossReport,
  };
};

export const cancelPlanar2DToSpace3DHandoff = (handoff: Planar2DToSpace3DHandoffV1): Planar2DToSpace3DHandoffCancellationV1 => ({
  kind: 'planar-2d-to-space3d-handoff-cancellation',
  version: PLANAR_2D_TO_SPACE3D_HANDOFF_VERSION,
  status: 'cancelled',
  handoffId: handoff.handoffId,
  sourceReference: handoff.source.reference,
  reason: 'user-cancelled-before-open',
});

const PROPERTY_NOTES: Partial<Record<Space3DBridgeCode, 'G' | 'Iy' | 'J'>> = {
  'pending-shear-modulus': 'G',
  'pending-weak-axis-inertia': 'Iy',
  'pending-torsion-constant': 'J',
};

const positive = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Stable comparison for persisted handoffs. JSON.stringify follows insertion
 * order, so two equivalent models could otherwise look different depending on
 * how they were assembled. Undefined and non-finite numbers are retained as
 * distinct tokens as well; silently collapsing them would hide malformed or
 * incomplete bridge data.
 */
const stableSerialize = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'number:NaN';
    if (value === Number.POSITIVE_INFINITY) return 'number:Infinity';
    if (value === Number.NEGATIVE_INFINITY) return 'number:-Infinity';
    return JSON.stringify(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'bigint') return `bigint:${value.toString()}`;
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(',')}}`;
  }
  return `${typeof value}:${String(value)}`;
};

export const unresolvedSpace3DBridgeNotes = (
  notes: readonly Space3DBridgeNote[],
  project: Space3DProjectV1,
  acknowledged: ReadonlySet<string>,
): readonly Space3DBridgeNote[] => notes.filter((item) => {
  if (!item.blocking) return false;
  if (acknowledged.has(item.id) || acknowledged.has(item.code)) return false;
  const property = PROPERTY_NOTES[item.code];
  if (property) {
    const member = project.members.find((candidate) => candidate.id === item.entityId);
    if (!member || !positive(member[property])) return true;
    // The adapter may expose a positive hypothesis so the candidate remains
    // inspectable and editable. It is still pending until the value changes
    // from that hypothesis or the user explicitly acknowledges the note.
    return item.hypothesis !== undefined && member[property] === item.hypothesis;
  }
  if (item.code === 'out-of-plane-unrestrained') {
    return project.nodes.length > 0 && !project.nodes.some((node) => node.restraints.uz || node.restraints.rx || node.restraints.ry);
  }
  return true;
});

export const space3DMatchesPlanarHandoff = (project: Space3DProjectV1, handoff: Planar2DToSpace3DHandoffV1): boolean => {
  const candidate = handoff.candidateModel;
  // A stored 3D copy must match every candidate datum. Comparing only node
  // coordinates and member connectivity allowed stale supports, properties,
  // loads, cases, combinations, units, or array entries to be reused silently.
  return project.id === candidate.id && stableSerialize(project) === stableSerialize(candidate);
};
