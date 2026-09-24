/**
 * Intención de arranque de una herramienta, de un solo uso.
 *
 * La bienvenida de cada herramienta ofrece entradas concretas («Generar una
 * estructura», «Importar Gmsh 4.1», «Diseñar una columna»). La bienvenida deja
 * aquí la intención y la mesa la toma —y la borra— al montarse. Vive sólo en
 * memoria: una recarga abre la mesa sin intención, que es lo seguro.
 */
export type ToolIntent =
  | { tool: 'space3d'; kind: 'generate' | 'example' | 'first-node' }
  | { tool: 'fem'; kind: 'analyze' }
  | { tool: 'fem'; kind: 'import-gmsh'; fileName: string; text: string }
  | { tool: 'design'; kind: 'element'; element: 'beam' | 'column' | 'footing'; code?: string };

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
