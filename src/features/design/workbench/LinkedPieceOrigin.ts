import type { ModelDemandSnapshot, ModelResultProvider } from '../../../design/elements/modelResultSnapshot';

export interface LinkedPieceOrigin {
  readonly version: 1;
  readonly snapshot: ModelDemandSnapshot;
  readonly copiedFields: Record<string, string>;
}

export interface WorkbenchOriginsDraft {
  readonly version: 1;
  readonly byElement: Partial<Record<'column' | 'flexure', LinkedPieceOrigin>>;
}

export type WorkbenchOrigin = LinkedPieceOrigin;
export type OriginState = { readonly source: 'current' | 'stale' | 'unavailable'; readonly edited: boolean };

export function originState(origin: LinkedPieceOrigin | undefined, provider: ModelResultProvider | null | undefined, currentFields: Readonly<Record<string, string>>): OriginState {
  if (!origin || !provider) return { source: 'unavailable', edited: Boolean(origin && Object.entries(origin.copiedFields).some(([key, value]) => currentFields[key] !== value)) };
  const source = origin.snapshot.source;
  const inventory = provider.inventory;
  const sameMember = inventory.members.some((member) => member.id === source.memberId && (!source.axisId || member.axisIds.includes(source.axisId)));
  const sameTarget = inventory.targets.some((target) => target.id === origin.snapshot.target.id);
  const sourceStatus = inventory.projectId !== source.projectId || inventory.kind !== source.kind || inventory.revision !== source.revision || !sameMember || !sameTarget
    ? 'stale' as const : 'current' as const;
  const edited = Object.entries(origin.copiedFields).some(([key, value]) => currentFields[key] !== value);
  return { source: sourceStatus, edited };
}

export function originForElement(raw: unknown, element: 'column' | 'flexure'): LinkedPieceOrigin | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const draft = raw as Partial<WorkbenchOriginsDraft>;
  const origin = draft.version === 1 && draft.byElement && typeof draft.byElement === 'object' ? draft.byElement[element] : undefined;
  return origin && origin.version === 1 ? origin : undefined;
}

export function withElementOrigin(raw: unknown, element: 'column' | 'flexure', origin: LinkedPieceOrigin | undefined): WorkbenchOriginsDraft {
  const current = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Partial<WorkbenchOriginsDraft> : {};
  const byElement = current.version === 1 && current.byElement && typeof current.byElement === 'object' ? { ...current.byElement } : {};
  if (origin) byElement[element] = origin; else delete byElement[element];
  return { version: 1, byElement };
}

