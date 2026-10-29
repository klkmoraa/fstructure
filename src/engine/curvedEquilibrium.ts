import type { AnalysisResult, ProjectModel, ValidationIssue } from '../types';
import { classifyAnalysisReliability } from './reliability';

/**
 * Recheck physical resultants with a dimensionally homogeneous vector norm.
 * A nominally unloaded axis must not normalize round-off by that same round-off
 * (e.g. Rx=4e-10, Fx=0 => residual/Rx=1). No reaction is rounded or zeroed.
 * Force and moment tolerances are the same 1e-8 / 1e-6 gates as the base solver.
 * This only re-evaluates the global-resultant check; all other failures remain.
 */
export const auditCurvedEquilibrium = (project: ProjectModel, result: AnalysisResult): AnalysisResult => {
  if (!result.equilibrium || !result.loadAudit || result.nodeResults.length !== project.nodes.length
    || !result.displacements.length) return result;
  const { source, referencePoint } = result.loadAudit;
  if (!referencePoint) return result;
  const nodes = new Map(project.nodes.map(node => [node.id, node]));
  const width = Math.max(...project.nodes.map(n => n.x)) - Math.min(...project.nodes.map(n => n.x));
  const height = Math.max(...project.nodes.map(n => n.y)) - Math.min(...project.nodes.map(n => n.y));
  const length = Math.hypot(width, height);
  if (!(length > 0) || !Number.isFinite(length)) return result;
  let sumFx = source.fx, sumFy = source.fy, sumM = source.mz;
  let forceActivity = Math.abs(source.fx) + Math.abs(source.fy), momentActivity = Math.abs(source.mz);
  for (const r of result.nodeResults) {
    const node = nodes.get(r.nodeId);
    if (!node) return result;
    const dx = node.x - referencePoint.x, dy = node.y - referencePoint.y;
    sumFx += r.rx; sumFy += r.ry; sumM += r.rm + dx * r.ry - dy * r.rx;
    forceActivity += Math.abs(r.rx) + Math.abs(r.ry);
    momentActivity += Math.abs(r.rm) + Math.abs(dx * r.ry) + Math.abs(dy * r.rx);
  }
  // Independent member audits supply activity for self-equilibrated loads too.
  for (const audit of result.loadAudit.memberAudits) {
    const q = audit.mechanical.source;
    forceActivity += Math.abs(q[0]) + Math.abs(q[1]) + Math.abs(q[3]) + Math.abs(q[4]);
    momentActivity += Math.abs(q[2]) + Math.abs(q[5]);
  }
  const forceScale = forceActivity + momentActivity / length;
  const momentScale = momentActivity + forceActivity * length;
  const normalized = (value: number, scale: number) => scale > 0 ? Math.abs(value) / scale : value === 0 ? 0 : Infinity;
  const normalizedComponents = { fx: normalized(sumFx, forceScale), fy: normalized(sumFy, forceScale), mz: normalized(sumM, momentScale) };
  const residual = Math.max(...Object.values(normalizedComponents));
  if (![sumFx, sumFy, sumM, forceActivity, momentActivity, residual].every(Number.isFinite)) return result;
  const issues: ValidationIssue[] = result.issues.filter(issue => issue.id !== 'global-equilibrium');
  if (residual > 1e-8) issues.push({ id: 'global-equilibrium', severity: residual > 1e-6 ? 'error' : 'warning',
    title: residual > 1e-6 ? 'El equilibrio global no cierra' : 'Cierre global limitado',
    message: `Residuo físico de la malla curva: ${residual.toExponential(3)}. Las fuerzas se normalizan como un vector y los momentos con la escala geométrica del modelo.`,
    suggestedFix: 'Revisa cargas, apoyos, rigideces y condicionamiento. No uses resultados con error.' });
  const hadOnlyGlobalFailure = !result.success && result.issues.some(issue => issue.id === 'global-equilibrium' && issue.severity === 'error')
    && !result.issues.some(issue => issue.id !== 'global-equilibrium' && issue.severity === 'error');
  const audited: AnalysisResult = { ...result, issues,
    success: (result.success || hadOnlyGlobalFailure) && !issues.some(issue => issue.severity === 'error'),
    equilibrium: { ...result.equilibrium, sumFx, sumFy, sumM, normalizedComponents, normalizedResidual: residual }, reliability: undefined };
  audited.reliability = classifyAnalysisReliability(audited);
  return audited;
};
