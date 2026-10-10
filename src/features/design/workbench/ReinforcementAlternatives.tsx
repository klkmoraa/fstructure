import type { ReinforcementCandidate } from '../../../design/elements/reinforcementAlternatives';
import { formatNumber } from './common';

export function ReinforcementAlternatives({ candidates, onApply }: { candidates: readonly ReinforcementCandidate[]; onApply: (candidate: ReinforcementCandidate) => void }) {
  if (!candidates.length) return <p role="status">No hay un armado factible con los diámetros y la geometría indicados.</p>;
  return <ol className="dw-proposal" aria-label="Alternativas de armado">
    {candidates.map((candidate) => <li key={candidate.id}>
      <p><strong>{candidate.display ?? `${candidate.reinforcement.group.count} × Ø ${candidate.reinforcement.group.diameterMm} mm · ${candidate.reinforcement.bed === 'top' ? 'lecho superior' : 'lecho inferior'}`}</strong> · As {formatNumber(candidate.steelAreaMm2, 1)} mm² · {formatNumber(candidate.steelWeightKg, 3)} kg (estimado)</p>
      <p>Sección fija {candidate.geometry.widthMm} × {candidate.geometry.heightMm} mm. {candidate.checked.checks.map((check) => `${check.label}: ${check.status === 'pass' ? 'pasa' : 'falla'}`).join(' · ')}</p>
      <p>Fuera de alcance: {candidate.checked.excluded.map((check) => check.label).join(', ') || 'ninguno'}. {candidate.checked.information?.length ? `Información: ${candidate.checked.information.map((check) => check.label).join(', ')}. ` : ''}{candidate.weightAssumption}</p>
      <button type="button" className="dw-inline-action" onClick={() => onApply(candidate)}>Aplicar este armado</button>
    </li>)}
  </ol>;
}
