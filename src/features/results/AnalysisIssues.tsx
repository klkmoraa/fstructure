import type { AnalysisResult } from '../../types';
import { useI18n } from '../../i18n/useI18n';
import './analysisIssues.css';

/** The issues of this run stay inspectable beside its numbers, not behind Doctor. */
export function AnalysisIssues({ analysis }: { analysis: AnalysisResult }) {
  const { language } = useI18n();
  const en = language === 'en';
  const issues = analysis.issues;
  if (!issues.length) return null;
  const hasErrors = issues.some(issue => issue.severity === 'error');
  const relative = issues.some(issue => issue.id === 'relative-stiffness');
  return <details className="analysis-issues" open={hasErrors || undefined}>
    <summary>{en ? 'Calculation notes' : 'Notas del cálculo'} <span>({issues.length})</span></summary>
    {relative ? <p className="analysis-issues__reference">{en
      ? 'Reference stiffness: this calculation does not validate physical displacements. The small-displacement check also uses that reference. Enter real properties to assess physical behavior.'
      : 'Rigidez de referencia: este cálculo no valida los desplazamientos físicos. El aviso de pequeñas deformaciones también usa esa referencia. Introduce propiedades reales para revisar el comportamiento físico.'}</p> : null}
    <ul>{issues.map((issue, index) => <li key={`${issue.id}-${index}`} data-severity={issue.severity}>
      <strong>{issue.title}</strong>
      <p>{issue.message}</p>
      {issue.suggestedFix ? <p className="analysis-issues__fix">{issue.suggestedFix}</p> : null}
    </li>)}</ul>
  </details>;
}
