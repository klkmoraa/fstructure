import type { ConcreteSectionGroup } from '../../data/concreteFrame';

/**
 * Intención de arranque de una herramienta, de un solo uso.
 *
 * La bienvenida de cada herramienta ofrece entradas concretas («Generar una
 * estructura», «Importar Gmsh 4.1»). La bienvenida deja aquí la intención y la
 * mesa la toma —y la borra— al montarse. Vive sólo en memoria: una recarga abre
 * la mesa sin intención, que es lo seguro.
 */
type ToolIntent =
  | { tool: 'space3d'; kind: 'generate' | 'example' | 'first-node' | 'bring-2d' }
  /** El modo 3D abre en una vista (el alzado de un eje que se diseña en Diseño), con barras seleccionadas. */
  | { tool: 'space3d'; kind: 'view'; view: string; members?: readonly string[]; sections?: { beam: { width: number; height: number }; column: { width: number; height: number }; groups?: readonly ConcreteSectionGroup[]; sourceModel: string } }
  /**
   * Diseño abierto desde un modo con modelo: la estructura se diseña con ese
   * modelo. `member` (desde el Inspector) abre Estructura en el diseño de esa barra.
   */
  | { tool: 'design'; kind: 'model' | 'model3d' | 'frame'; member?: string; element?: 'beam' | 'column' | 'footing' | 'frame' };

let pending: ToolIntent | null = null;

export const setToolIntent = (intent: ToolIntent): void => { pending = intent; };

/** Devuelve la intención si es de `tool` y la consume; si es de otra herramienta, la descarta. */
export function takeToolIntent<T extends ToolIntent['tool']>(tool: T): Extract<ToolIntent, { tool: T }> | null {
  const intent = pending;
  pending = null;
  return intent && intent.tool === tool ? intent as Extract<ToolIntent, { tool: T }> : null;
}

/** Lee sin consumir: para decidir durante el render inicial sin efectos. */
export function peekToolIntent<T extends ToolIntent['tool']>(tool: T): Extract<ToolIntent, { tool: T }> | null {
  return pending && pending.tool === tool ? pending as Extract<ToolIntent, { tool: T }> : null;
}
