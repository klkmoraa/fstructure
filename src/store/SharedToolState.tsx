import { createContext, useContext, type ReactNode } from 'react';
import type { UnifiedProjectSession } from '../storage/unifiedProjectSession';

/**
 * Lo único que las herramientas comparten: la sesión que guarda el proyecto.
 * Cada herramienta lee y escribe sólo su propia rama del bundle.
 */
interface SharedToolState {
  session: UnifiedProjectSession | null;
}
const Context = createContext<SharedToolState | null>(null);
export function SharedToolStateProvider({ children, session = null }: { children: ReactNode; session?: UnifiedProjectSession | null }) {
  return <Context value={{ session }}>{children}</Context>;
}
// oxlint-disable-next-line react/only-export-components
export const useSharedToolState = () => useContext(Context);
