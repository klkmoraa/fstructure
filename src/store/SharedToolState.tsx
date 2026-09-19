import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Selection } from '../types';
import { map2DSelection, type EntityReference, type SolverSnapshot } from '../shared/project/toolSnapshot';
import type { UnifiedProjectSession } from '../storage/unifiedProjectSession';

interface SharedToolState {
  session: UnifiedProjectSession | null;
  selection2d: readonly EntityReference[];
  selection3d: readonly EntityReference[];
  publish3DSelection: (selection: readonly EntityReference[]) => void;
  snapshot: SolverSnapshot | null;
}
const Context = createContext<SharedToolState | null>(null);
export function SharedToolStateProvider({ projectId, selection2d, snapshot, children, session = null }: {
  projectId: string; selection2d: Selection; snapshot: SolverSnapshot | null; children: ReactNode; session?: UnifiedProjectSession | null;
}) {
  const [selection3d, publish3DSelection] = useState<readonly EntityReference[]>([]);
  const mapped = useMemo(() => map2DSelection(projectId, selection2d), [projectId, selection2d]);
  const value = useMemo(() => ({ session, selection2d: mapped,
    selection3d: selection3d.filter((entity) => entity.projectId === projectId), publish3DSelection, snapshot,
  }), [session, mapped, projectId, selection3d, snapshot]);
  return <Context value={value}>{children}</Context>;
}
// oxlint-disable-next-line react/only-export-components
export const useSharedToolState = () => useContext(Context);
