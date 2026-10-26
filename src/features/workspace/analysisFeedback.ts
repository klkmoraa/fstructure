import { resolveReliability } from '../../engine/reliability';
import type { Language } from '../../i18n/catalogs';
import type { AnalysisResult, ProjectModel } from '../../types';
import type { WorkspaceToast } from './workspaceCommands';

const copy = {
  es: {
    failed: 'No se pudo completar un análisis válido',
    failedDetail: 'Revisa los errores y la calidad numérica en Resultados antes de usar las cifras.',
    partial: 'Solo equilibrio · estructura inestable',
    partialDetail: 'Hay fuerzas en equilibrio, pero no una solución estable. No hay desplazamientos válidos ni resultados de diseño.',
    relative: 'Análisis completado · rigidez relativa',
    relativeDetail: 'El modelo se resolvió. Los desplazamientos usan una referencia de rigidez, no valores físicos.',
    warning: 'Análisis completado con advertencias',
    warningDetail: 'Hay resultados. Revisa sus límites y las advertencias antes de usarlos.',
    success: 'Análisis completado',
    successDetail: 'Consulta los esfuerzos, las reacciones y los desplazamientos en Resultados.',
    results: 'Ver resultados',
  },
  en: {
    failed: 'A valid analysis could not be completed',
    failedDetail: 'Review errors and numerical quality in Results before using these values.',
    partial: 'Force equilibrium only · unstable structure',
    partialDetail: 'Forces are in equilibrium, but this is not a stable solution. Displacements and design results are not available.',
    relative: 'Analysis completed · relative stiffness',
    relativeDetail: 'The model was solved. Displacements use a reference stiffness, not physical values.',
    warning: 'Analysis completed with warnings',
    warningDetail: 'Results are available. Review their limits and warnings before using them.',
    success: 'Analysis completed',
    successDetail: 'Review member forces, reactions and displacements in Results.',
    results: 'View results',
  },
} as const;

/** Feedback describes the finished run, never a new validation of a later model. */
export function analysisFeedback(result: AnalysisResult, language: Language, doctorLabel: string): WorkspaceToast {
  const text = copy[language];
  const quality = resolveReliability(result);
  const base = { id: 'analysis-result', action: { label: text.results, command: 'open-results' as const } };
  if (!result.success && result.trussEquilibrium) {
    return { ...base, message: text.partial, description: text.partialDetail, tone: 'warning', durationMs: 0 };
  }
  if (!result.success || !quality.usable || quality.level === 'failed' || quality.level === 'unreliable'
    || result.issues.some(issue => issue.severity === 'error')) {
    return { ...base, message: text.failed, description: text.failedDetail, tone: 'error', durationMs: 0 };
  }
  const warnings = result.issues.filter(issue => issue.severity === 'warning');
  if (quality.level === 'reliable' && warnings.length > 0 && warnings.every(issue => issue.id === 'relative-stiffness')) {
    return {
      ...base, message: text.relative, description: text.relativeDetail, tone: 'info', durationMs: 10000,
      action: { label: doctorLabel, command: 'open-model-doctor' },
    };
  }
  if (warnings.length > 0 || quality.level === 'limited') {
    return { ...base, message: text.warning, description: text.warningDetail, tone: 'warning', durationMs: 0 };
  }
  return { ...base, message: text.success, description: text.successDetail, tone: 'success', durationMs: 6000 };
}

/** Zero bending under a particular load does not turn a frame into a truss. */
export function defaultAnalysisLayer(project: Pick<ProjectModel, 'members'>): 'moment' | 'axial' {
  const deformable = project.members.filter(member => member.type !== 'rigid');
  return deformable.length > 0 && deformable.every(member => member.type === 'truss') ? 'axial' : 'moment';
}
