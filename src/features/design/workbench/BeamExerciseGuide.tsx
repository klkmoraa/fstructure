import type { BeamExerciseEvaluation } from './beamExercises';
import './beamExercises.css';

export function BeamExerciseGuide({ evaluation, onDismiss }: { evaluation: BeamExerciseEvaluation | null; onDismiss: () => void }) {
  if (!evaluation) return null;
  return <section className="dw-exercise" aria-labelledby="dw-exercise-title" data-status={evaluation.status}>
    <header className="dw-exercise__head">
      <div><span className="dw-exercise__eyebrow">Aula · referencia de servicio</span><h3 id="dw-exercise-title">{evaluation.title}</h3></div>
      <button type="button" className="dw-inline-action" onClick={onDismiss}>Ocultar guía</button>
    </header>
    <p className="dw-exercise__problem">{evaluation.problem}</p>
    <ul aria-label="Hipótesis del ejercicio">{evaluation.hypotheses.map((hypothesis) => <li key={hypothesis}>{hypothesis}</li>)}</ul>
    {evaluation.status === 'comparable' ? <div className="dw-exercise__comparison">
      <p><strong>Fórmula actual</strong><span>{evaluation.formula}</span></p>
      <p><strong>Sustitución</strong><span>{evaluation.substitution}</span></p>
      <p><strong>Referencia idealizada</strong><span>{evaluation.expectedKnm.toFixed(2)} kN·m</span></p>
      <p><strong>Solver de servicio</strong><span>{evaluation.solverKnm.toFixed(2)} kN·m</span></p>
      <p><strong>Diferencia absoluta</strong><span>{evaluation.differenceKnm.toFixed(4)} kN·m</span></p>
      <small>Compara la referencia educativa con CM + CV en servicio. No es una revisión normativa ni usa Mu factorizado.</small>
    </div> : <p className="dw-exercise__state" role="status">{evaluation.status === 'changed' ? `Comparación suspendida: ${evaluation.reason}` : `Datos incompletos: ${evaluation.reason}`}</p>}
  </section>;
}
