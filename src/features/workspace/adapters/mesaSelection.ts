/**
 * Barras seleccionadas en el modo 3D de cada proyecto mientras dura la sesión.
 * Al pasar a Diseño, Estructura abre el eje y el diseño de la que se eligió.
 * (La selección del 2D ya vive en el contexto común de la mesa.)
 */
const SPACE3D_SELECTION = new Map<string, readonly string[]>();

export const rememberSpace3DSelection = (projectId: string, memberIds: readonly string[]): void => {
  if (memberIds.length) SPACE3D_SELECTION.set(projectId, [...memberIds]);
  else SPACE3D_SELECTION.delete(projectId);
};

export const space3dSelection = (projectId: string): readonly string[] => SPACE3D_SELECTION.get(projectId) ?? [];
