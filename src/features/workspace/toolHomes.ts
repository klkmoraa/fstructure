import { lazy, type ComponentType } from 'react';
import type { ToolId } from '../../shared/contracts';

type ToolHomeComponent = ComponentType<{ onOpenWorkspace: () => void; onOpenSuite: () => void }>;

/**
 * Bienvenida propia de cada herramienta aislada. Cada una vive en el
 * territorio de su herramienta y se carga sólo cuando se abre; FStructure
 * (Modelo 2D) conserva su bienvenida original en `features/welcome`.
 */
export const TOOL_HOMES: Record<Exclude<ToolId, 'model2d'>, ToolHomeComponent> = {
  space3d: lazy(() => import('../../modules/space3d/Space3DHome')),
  fem: lazy(() => import('../../modules/fem/FemHome')),
  design: lazy(() => import('../design/DesignHome')),
};
