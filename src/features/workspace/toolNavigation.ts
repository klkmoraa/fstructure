import { createContext, useContext } from 'react';
import type { ToolId } from '../../shared/contracts';

/**
 * Abrir otra herramienta desde una mesa. Lo provee la app; lo usan las mesas a
 * través de la frontera (`src/features/workspace`), que deja antes su
 * intención (`toolIntent`). Así una herramienta lleva a otra sin conocerla.
 */
export const ToolNavigationContext = createContext<((tool: ToolId) => void) | null>(null);

export const useToolNavigation = () => useContext(ToolNavigationContext);
