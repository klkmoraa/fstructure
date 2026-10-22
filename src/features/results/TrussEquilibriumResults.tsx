import type { AnalysisResult } from '../../types';
import type { UnitSystemId } from '../../foundation/units';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import './trussEquilibriumResults.css';

export const TrussEquilibriumResults = ({ result, units, language }: {
  result: NonNullable<AnalysisResult['trussEquilibrium']>;
  units: UnitSystemId;
  language: 'es' | 'en';
}) => {
  const en = language === 'en';
  const force = (value: number) => formatFixed(toDisplay(Math.abs(value) < 1e-12 ? 0 : value, units, 'force'), 3);
  const unit = unitLabel(units, 'force');
  return <section className="truss-equilibrium-results" aria-label={en ? 'Force equilibrium only' : 'Sólo equilibrio de fuerzas'}>
    <h3>{en ? 'Force equilibrium · Experimental' : 'Equilibrio de fuerzas · Experimental'}</h3>
    <p role="status">{en
      ? 'The model has a mechanism. These forces balance only the selected load in the initial geometry. They do not establish stability. Displacements are not unique; deformation and yield checks are unavailable.'
      : 'El modelo tiene un mecanismo. Estas fuerzas equilibran sólo la carga seleccionada en la geometría inicial. No acreditan estabilidad. Los desplazamientos no son únicos; no se calcula deformada ni fluencia.'}</p>
    <table>
      <caption>{en ? 'Member forces · positive tension, negative compression' : 'Fuerzas en barras · positivo tensión, negativo compresión'}</caption>
      <thead><tr><th scope="col">{en ? 'Member' : 'Barra'}</th><th scope="col">N ({unit})</th></tr></thead>
      <tbody>{result.memberForces.map(member => <tr key={member.memberId}><th scope="row">{member.memberId}</th><td>{force(member.axial)}</td></tr>)}</tbody>
    </table>
    <table>
      <caption>{en ? 'Support reactions' : 'Reacciones de los apoyos'}</caption>
      <thead><tr><th scope="col">{en ? 'Node' : 'Nodo'}</th><th scope="col">Rx ({unit})</th><th scope="col">Ry ({unit})</th></tr></thead>
      <tbody>{result.reactions.map(node => <tr key={node.nodeId}><th scope="row">{node.nodeId}</th><td>{force(node.rx)}</td><td>{force(node.ry)}</td></tr>)}</tbody>
    </table>
  </section>;
};
