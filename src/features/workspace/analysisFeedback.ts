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
    relative: 'Calculado · rigidez relativa',
    relativeDetail: 'Desplazamientos relativos; no son una comprobación física.',
    warning: 'Análisis completado con advertencias',
    warningDetail: 'Hay resultados. Revisa sus límites y las advertencias antes de usarlos.',
    success: 'Análisis completado',
    successDetail: 'Consulta los esfuerzos, las reacciones y los desplazamientos en Resultados.',
    results: 'Ver resultados',
    resultsShort: 'Resultados',
  },
  en: {
    failed: 'A valid analysis could not be completed',
    failedDetail: 'Review errors and numerical quality in Results before using these values.',
    partial: 'Force equilibrium only · unstable structure',
    partialDetail: 'Forces are in equilibrium, but this is not a stable solution. Displacements and design results are not available.',
    relative: 'Analysis completed · relative stiffness',
    relativeDetail: 'Relative displacements; not a physical verification.',
    warning: 'Analysis completed with warnings',
    warningDetail: 'Results are available. Review their limits and warnings before using them.',
    success: 'Analysis completed',
    successDetail: 'Review member forces, reactions and displacements in Results.',
    results: 'View results',
    resultsShort: 'Results',
  },
} as const;

/** Feedback describes the finished run, never a new validation of a later model. */
export function analysisFeedback(result: AnalysisResult, language: Language, _doctorLabel?: string): WorkspaceToast {
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
  const relative = warnings.some(issue => issue.id === 'relative-stiffness');
  // Reference EI has no physical displacement scale. Its small-displacement
  // check is a limitation of that reference, not proof of a faulty structure.
  // Keep every raw issue in Results; never soften numeric or unrelated issues.
  const referenceOnly = relative && warnings.every(issue =>
    issue.id === 'relative-stiffness' || issue.id === 'small-displacement-assumption');
  const compact = { ...base, compact: true, action: { label: text.resultsShort, command: 'open-results' as const } };
  if (quality.level === 'reliable' && referenceOnly) {
    return { ...compact, message: text.relative, description: text.relativeDetail, tone: 'info', durationMs: 6000 };
  }
  if (warnings.length > 0 || quality.level === 'limited') {
    const cause = warnings.find(issue => issue.id !== 'relative-stiffness'
      && !(relative && issue.id === 'small-displacement-assumption'));
    return { ...compact, message: text.warning,
      description: quality.governing?.label ?? cause?.title ?? text.warningDetail,
      tone: 'warning', durationMs: 0 };
  }
  return { ...compact, message: text.success, tone: 'success', durationMs: 3200 };
}

/** Zero bending under a particular load does not turn a frame into a truss. */
export function defaultAnalysisLayer(project: Pick<ProjectModel, 'members'>): 'moment' | 'axial' {
  const deformable = project.members.filter(member => member.type !== 'rigid');
  return deformable.length > 0 && deformable.every(member => member.type === 'truss') ? 'axial' : 'moment';
}
