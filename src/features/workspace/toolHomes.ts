import { lazy, type ComponentType } from 'react';
import type { ToolId } from '../../shared/contracts';

type ToolHomeComponent = ComponentType<{ onOpenWorkspace: () => void; onOpenSuite: () => void }>;

/**
 * Bienvenida propia de cada herramienta aislada. Cada una vive en el
 * territorio de su herramienta y se carga sólo cuando se abre; FStructure
 * (modelo 2D, 3D y Diseño) conserva su bienvenida original en `features/welcome`.
 */
export const TOOL_HOMES: Record<Exclude<ToolId, 'model2d'>, ToolHomeComponent> = {
  fem: lazy(() => import('../../modules/fem/FemHome')),
};
