import type { ModelResultProvider } from '../../../design/elements/modelResultSnapshot';
import { originState, type LinkedPieceOrigin } from './LinkedPieceOrigin';

const fmt = (value: number) => Number.isFinite(value) ? String(Number(value.toFixed(4))) : '—';

export function LinkedPieceOriginView({ origin, provider, currentFields, onRefresh, onShowSource }: {
  origin: LinkedPieceOrigin;
  provider?: ModelResultProvider | null;
  currentFields: Readonly<Record<string, string>>;
  onRefresh?: () => void;
  onShowSource?: () => void;
}) {
  const state = originState(origin, provider, currentFields);
  const { snapshot } = origin;
  const { actions } = snapshot;
  return <section className="dw-linked-origin" data-testid="linked-piece-origin" data-origin-state={state.source}>
    <div className="dw-linked-origin__heading"><strong>Origen del modelo</strong><span>{state.source === 'current' ? 'Vigente' : state.source === 'stale' ? 'Desactualizado' : 'No comprobable'}{state.edited ? ' · Copia editada' : ''}</span></div>
    <p className="dw-linked-origin__summary">{snapshot.member.label} · {snapshot.target.label} · x = {fmt(snapshot.station.xM)} m</p>
    <div className="dw-linked-origin__actions">
      {onShowSource ? <button type="button" onClick={onShowSource}>Ver en el modelo</button> : null}
      {onRefresh ? <button type="button" onClick={onRefresh}>Actualizar origen</button> : null}
      <details className="dw-linked-origin__details">
        <summary>Instantánea original</summary>
        <div className="dw-linked-origin__provenance">
          <p>{snapshot.source.kind === 'model2d' ? 'Modelo 2D' : 'Modelo 3D'} · {snapshot.member.label} ({snapshot.source.memberId}) · {snapshot.target.label}</p>
          <p>Estación x = {fmt(snapshot.station.xM)} m desde i · {snapshot.station.side === 'left' ? 'lado izquierdo' : 'lado derecho'} · {snapshot.source.axisId ? `Eje ${snapshot.source.axisId}` : 'sin eje'}</p>
          <p>Factores: {snapshot.target.factors.length ? snapshot.target.factors.map((factor) => `${factor.caseId} × ${fmt(factor.factor)}`).join(' · ') : 'caso directo'}</p>
          <p className="dw-linked-origin__vector">N {fmt(actions.nKn)} kN · Vy {fmt(actions.vyKn)} kN · Vz {fmt(actions.vzKn)} kN · T {fmt(actions.torsionKnm)} kN·m · My {fmt(actions.myKnm)} kN·m · Mz {fmt(actions.mzKnm)} kN·m</p>
          <p>{snapshot.axes.convention} · base local: {snapshot.axes.localBasis.map((axis) => `(${axis.map(fmt).join(', ')})`).join(' · ')}</p>
        </div>
      </details>
    </div>
  </section>;
}
