import type { LoadCombination, MemberModel, ProjectModel } from '../types';
import { analyzeProject as analyzeStraight, memberGeometry as straightGeometry, frameLocalStiffness as straightStiffness, validateProject as validateStraight, type AnalyzeProjectOptions } from './straightSolver';
import { prepareCurvedAnalysis, restoreCurvedAnalysis } from './curvedMemberAnalysis';
import { abortedAnalysis } from './analysisFailure';
export * from './straightSolver';

/** Dispatch only: the proven straight-element solver stays unchanged. */
export const analyzeProject = (project: ProjectModel, combination?: LoadCombination | null, options?: AnalyzeProjectOptions) => {
  if (!project.members.some(m => m.curve)) return analyzeStraight(project, combination, options);
  try {
    if (options?.pDeltaAxialForces || options?.nodeLinkLinearizations
      || (project.settings as { analysisMode?: string }).analysisMode === 'p-delta') {
      throw new Error('P-Delta y contactos con barras curvas aún no están verificados. Usa análisis estático lineal; la curva no se sustituirá por su cuerda.');
    }
    const mesh = prepareCurvedAnalysis(project);
    return restoreCurvedAnalysis(project, mesh, analyzeStraight(mesh.project, combination, { ...options, includeEducationTrace: false }));
  } catch (error) {
    return abortedAnalysis([{ id: 'curved-analysis', severity: 'error', title: 'Revisar barra curva', message: error instanceof Error ? error.message : String(error) }]);
  }
};

/** Other engines must opt into a curved formulation instead of using a chord. */
export const memberGeometry: typeof straightGeometry = (member, nodes) => {
  if (member.curve) throw new Error('Esta operación aún no admite barras curvas. Usa el análisis estático lineal.');
  return straightGeometry(member, nodes);
};
export const frameLocalStiffness = (member: MemberModel, length: number) => {
  if (member.curve) throw new Error('La rigidez recta no se puede aplicar a una barra curva.');
  return straightStiffness(member, length);
};
export const validateProject = (project: ProjectModel) => {
  if (!project.members.some(m => m.curve)) return validateStraight(project);
  try {
    const mesh = prepareCurvedAnalysis(project);
    return validateStraight(mesh.project).map(issue => ({ ...issue,
      objectId: issue.objectId ? mesh.physicalId.get(issue.objectId) ?? issue.objectId : undefined }));
  } catch (error) {
    return [{ id: 'curve-validation', severity: 'error' as const, title: 'Geometría curva no válida', message: error instanceof Error ? error.message : String(error) }];
  }
};
