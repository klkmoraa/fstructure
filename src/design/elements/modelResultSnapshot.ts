export type ModelResultKind = 'model2d' | 'model3d';

export interface ModelResultTarget {
  readonly id: string;
  readonly label: string;
  readonly kind: 'case' | 'combination';
  readonly factors: readonly { readonly caseId: string; readonly factor: number }[];
}

export interface ModelMemberRecord {
  readonly id: string;
  readonly label: string;
  readonly family: 'beam' | 'column' | 'other';
  readonly levelId: string | null;
  readonly axisIds: readonly string[];
  readonly lengthM: number;
  readonly section: {
    readonly shape: 'rectangular' | 'circular' | 'other';
    readonly widthMm: number | null;
    readonly depthMm: number | null;
    readonly fcMpa: number | null;
    readonly materialLabel: string;
  };
  readonly start: readonly [number, number, number];
  readonly end: readonly [number, number, number];
}

export interface ModelSupportRecord {
  readonly id: string;
  readonly label: string;
  readonly position: readonly [number, number, number];
}

export interface ModelResultInventory {
  readonly projectId: string;
  readonly kind: ModelResultKind;
  readonly revision: string;
  readonly targets: readonly ModelResultTarget[];
  readonly members: readonly ModelMemberRecord[];
  readonly supports: readonly ModelSupportRecord[];
  readonly levels: readonly { readonly id: string; readonly label: string; readonly heightM: number }[];
}

export interface ModelDemandSnapshot {
  readonly version: 1;
  readonly source: { readonly kind: ModelResultKind; readonly projectId: string; readonly revision: string; readonly memberId: string; readonly axisId?: string };
  readonly target: ModelResultTarget;
  readonly station: { readonly xM: number; readonly side: 'left' | 'right'; readonly lengthM: number };
  readonly units: 'kN-m';
  readonly axes: { readonly convention: string; readonly localBasis: readonly (readonly [number, number, number])[] };
  readonly actions: { readonly nKn: number; readonly vyKn: number; readonly vzKn: number; readonly torsionKnm: number; readonly myKnm: number; readonly mzKnm: number };
  readonly member: ModelMemberRecord;
}

export interface ModelSupportSnapshot {
  readonly version: 1;
  readonly source: { readonly kind: ModelResultKind; readonly projectId: string; readonly revision: string; readonly nodeId: string };
  readonly target: ModelResultTarget;
  readonly position: readonly [number, number, number];
  readonly units: 'kN-m';
  readonly reactionGlobal: { readonly fxKn: number; readonly fyKn: number; readonly fzKn: number; readonly mxKnm: number; readonly myKnm: number; readonly mzKnm: number };
}

export interface ModelResultProvider {
  readonly inventory: ModelResultInventory;
  member(request: { readonly memberId: string; readonly targetId: string; readonly xM: number; readonly side: 'left' | 'right'; readonly axisId?: string }, signal: AbortSignal): Promise<ModelDemandSnapshot>;
  support(request: { readonly nodeId: string; readonly targetId: string }, signal: AbortSignal): Promise<ModelSupportSnapshot>;
}

function requireFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} debe ser finito.`);
  return value;
}

export function assertFiniteDto(value: unknown, path = 'Resultado'): void {
  if (typeof value === 'number') { requireFinite(value, path); return; }
  if (Array.isArray(value)) { value.forEach((item, index) => assertFiniteDto(item, `${path}[${index}]`)); return; }
  if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => assertFiniteDto(item, `${path}.${key}`));
}

export function requireTarget(inventory: ModelResultInventory, targetId: string): ModelResultTarget {
  const matches = inventory.targets.filter((item) => item.id === targetId);
  if (matches.length > 1) throw new Error(`El objetivo «${targetId}» es ambiguo en el modelo.`);
  const target = matches[0];
  if (!target) throw new Error(`No existe el objetivo «${targetId}» en el modelo.`);
  return target;
}

export function requireMemberStation(inventory: ModelResultInventory, memberId: string, xM: number): ModelMemberRecord {
  const member = inventory.members.find((item) => item.id === memberId);
  if (!member) throw new Error(`No existe la barra «${memberId}» en el modelo.`);
  requireFinite(xM, 'La estación');
  const tolerance = Math.max(1, member.lengthM) * 1e-9;
  if (xM < -tolerance || xM > member.lengthM + tolerance) throw new Error('La estación queda fuera de la barra.');
  return member;
}

export function requireSupport(inventory: ModelResultInventory, nodeId: string): ModelSupportRecord {
  const support = inventory.supports.find((item) => item.id === nodeId);
  if (!support) throw new Error(`No existe el apoyo «${nodeId}» en el modelo.`);
  return support;
}
