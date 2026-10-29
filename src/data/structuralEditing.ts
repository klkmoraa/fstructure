import { prepareStructuralEdit as prepareBase, createStructuralEditGeometryPreview as previewBase } from './linearStructuralEditing';
import type { ProjectModel } from '../types';
import type { StructuralEditRequest } from './linearStructuralEditing';
export * from './linearStructuralEditing';

/** A reflection must reverse native curvature; never apply the straight-only transform silently. */
const verifyCurveOperation = (project: ProjectModel, request: StructuralEditRequest) => {
  if (request.kind === 'mirror' && project.members.some(member => member.curve)) {
    throw new Error('La operación Espejo aún no está verificada en modelos con curvas. Usa Invertir curvatura en el inspector de la barra; no se modificó el modelo.');
  }
};
export const prepareStructuralEdit: typeof prepareBase = (project, request) => {
  verifyCurveOperation(project, request);
  return prepareBase(project, request);
};
export const createStructuralEditGeometryPreview: typeof previewBase = (project, request) => {
  verifyCurveOperation(project, request);
  return previewBase(project, request);
};
