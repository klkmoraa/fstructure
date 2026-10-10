import type { ReinforcementCandidate } from '../../../design/elements/reinforcementAlternatives';
import { formatNumber } from './common';

function ArrangementPreview({ candidate }: { candidate: ReinforcementCandidate }) {
  const { arrangement, geometry } = candidate;
  const scale = Math.min(180 / geometry.widthMm, 130 / geometry.heightMm);
  const x = (xMm: number) => 110 + xMm * scale;
  const y = (yMm: number) => 85 - yMm * scale;
  const points = arrangement.outlinePointsMm ?? [];
  const diameterSet = [...new Set(arrangement.longitudinalDiametersMm)].sort((a, b) => a - b);
  const layoutSummary = arrangement.distribution === 'beam-beds'
    ? `${arrangement.beds?.length ?? 2} lechos · hasta ${arrangement.layers} ${arrangement.layers === 1 ? 'capa por lecho' : 'capas por lecho'}`
    : arrangement.distribution === 'tension-bed' ? `lecho a tensión · ${arrangement.layers} ${arrangement.layers === 1 ? 'capa' : 'capas'}`
      : arrangement.distribution === 'column-perimeter' ? 'distribución perimetral de columna'
        : arrangement.distribution === 'circular-perimeter' ? 'distribución en perímetro circular'
          : arrangement.distribution === 'experimental-layers' ? `lechos experimentales · ${arrangement.layers} ${arrangement.layers === 1 ? 'capa' : 'capas'}`
            : arrangement.distribution === 'experimental-zones' ? 'grupos experimentales por zonas' : 'distribución perimetral Experimental';
  return <div className="dw-arrangement-preview">
    <svg viewBox="0 0 220 170" role="img" aria-label={`Acomodo efectivo: ${arrangement.bars.length} barras · ${layoutSummary}`}>
      {arrangement.shape === 'circle'
        ? <circle cx="110" cy="85" r={Math.min(geometry.widthMm, geometry.heightMm) / 2 * scale} fill="none" stroke="currentColor" strokeWidth="1.5" />
        : <polygon points={points.map((point) => `${x(point.xMm)},${y(point.yMm)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {arrangement.bars.map((bar, index) => <circle key={index} cx={x(bar.xMm)} cy={y(bar.yMm)} r={Math.max(1, Math.min(6, bar.diameterMm * scale / 2))} fill="currentColor">
        <title>{`${bar.kind ? `${bar.kind} · ` : ''}Ø ${bar.diameterMm} mm · capa ${bar.layer} · (${formatNumber(bar.xMm, 1)}, ${formatNumber(bar.yMm, 1)}) mm`}</title>
      </circle>)}
    </svg>
    <p><strong>Acomodo efectivo del motor</strong> · {arrangement.bars.length} barras · {layoutSummary} · diámetros longitudinales: {diameterSet.map((diameter) => `Ø${formatNumber(diameter, 1)}`).join(', ') || '—'} mm.</p>
    {arrangement.spacingByBed?.length ? arrangement.spacingByBed.map((spacing) => <p key={spacing.bed}>
      Lecho {spacing.bed === 'top' ? 'superior' : 'inferior'} · separación horizontal libre real: {spacing.clearSpacingMm === null ? 'no aplica' : `${formatNumber(spacing.clearSpacingMm, 1)} mm`} (motor: {formatNumber(spacing.requiredClearSpacingMm, 1)} mm)
      {spacing.verticalLayerClearSpacingMm !== null ? ` · separación libre real entre capas: ${formatNumber(spacing.verticalLayerClearSpacingMm, 1)} mm (motor: ${formatNumber(spacing.requiredVerticalLayerClearSpacingMm, 1)} mm)` : ''}.
    </p>) : <p>{arrangement.spacingBasis === 'horizontal-per-layer' ? 'Separación horizontal libre mínima' : 'Separación libre mínima'}: {arrangement.clearSpacingMm === null ? 'no aplica' : `${formatNumber(arrangement.clearSpacingMm, 1)} mm`}
      {arrangement.requiredClearSpacingMm === null ? '' : ` · requerida por el motor: ${formatNumber(arrangement.requiredClearSpacingMm, 1)} mm`}
      {arrangement.layers > 1 && arrangement.verticalLayerClearSpacingMm !== undefined ? ` · entre capas: ${formatNumber(arrangement.verticalLayerClearSpacingMm ?? 0, 1)} mm (motor: ${formatNumber(arrangement.requiredVerticalLayerClearSpacingMm ?? 0, 1)} mm)` : ''}.
    </p>}
    {arrangement.longitudinalRuns?.length ? <div><p>Bastones longitudinales conservados (por claro; el croquis muestra las corridas continuas):</p><ul aria-label="Bastones longitudinales conservados">{arrangement.longitudinalRuns.map((run, index) => <li key={index}>{run.count} × Ø {formatNumber(run.diameterMm, 1)} mm · lecho {run.bed === 'top' ? 'superior' : 'inferior'} · {formatNumber(run.startM, 2)}–{formatNumber(run.endM, 2)} m</li>)}</ul></div> : null}
  </div>;
}

export function ReinforcementAlternatives({ candidates, onApply }: { candidates: readonly ReinforcementCandidate[]; onApply: (candidate: ReinforcementCandidate) => void }) {
  if (!candidates.length) return <p role="status">No hay un armado factible con los diámetros y la geometría indicados.</p>;
  return <ol className="dw-proposal" aria-label="Alternativas de armado">
    {candidates.map((candidate) => <li key={candidate.id}>
      <p><strong>{candidate.display ?? `${candidate.reinforcement.group.count} × Ø ${candidate.reinforcement.group.diameterMm} mm · ${candidate.reinforcement.bed === 'top' ? 'lecho superior' : 'lecho inferior'}`}</strong> · As {formatNumber(candidate.steelAreaMm2, 1)} mm² · {formatNumber(candidate.steelWeightKg, 3)} kg (estimado)</p>
      <p>Sección fija {candidate.geometry.widthMm} × {candidate.geometry.heightMm} mm. {candidate.checked.checks.map((check) => `${check.label}: ${check.status === 'pass' ? 'pasa' : 'falla'}`).join(' · ')}</p>
      <ArrangementPreview candidate={candidate} />
      <p>Fuera de alcance: {candidate.checked.excluded.map((check) => check.label).join(', ') || 'ninguno'}. {candidate.checked.information?.length ? `Información: ${candidate.checked.information.map((check) => check.label).join(', ')}. ` : ''}{candidate.weightAssumption}</p>
      <button type="button" className="dw-inline-action" onClick={() => onApply(candidate)}>Aplicar este armado</button>
    </li>)}
  </ol>;
}
