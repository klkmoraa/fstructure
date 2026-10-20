import type { ProjectModel } from '../../types';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import { trussAxialLabel, trussAxialSymbol, type TrussAxialReading } from '../results/trussAxial';
import './trussAxial.css';

type Props = { project: ProjectModel; readings: ReadonlyMap<string, TrussAxialReading>; language: string };

const forceText = (reading: TrussAxialReading, project: ProjectModel) => {
  const value = toDisplay(reading.axial, project.settings.units, 'force');
  return `${value > 0 ? '+' : ''}${formatFixed(value, 2)} ${unitLabel(project.settings.units, 'force')}`;
};

/** Axial evidence sits over the technical member line; all interaction stays
 * with the existing member hit targets and selection halos. */
export const TrussAxialLayer = ({ project, readings, toScreen, language, showValues, selectedMemberId }: Props & { toScreen: (x: number, y: number) => { x: number; y: number }; showValues: boolean; selectedMemberId?: string }) => {
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  return <g className="truss-axial-layer" pointerEvents="none" aria-hidden="true">{project.members.map((member) => {
    const reading = readings.get(member.id);
    const ni = nodes.get(member.i); const nj = nodes.get(member.j);
    if (!reading || !ni || !nj) return null;
    const a = toScreen(ni.x, ni.y); const b = toScreen(nj.x, nj.y);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1) return null;
    const x = (a.x + b.x) / 2; const y = (a.y + b.y) / 2;
    const nx = -(b.y - a.y) / length; const ny = (b.x - a.x) / length;
    const text = `${trussAxialSymbol(reading.state)} ${forceText(reading, project)}`;
    // A selected short member already has its ID below the line. Put its
    // force on the other side; the legend keeps the complete reading visible.
    const offset = length < 110 && selectedMemberId === member.id ? -17 : 17;
    return <g key={member.id} className={`truss-axial-member ${reading.state}`} data-truss-state={reading.state} data-member-id={member.id}>
      <title>{`${member.id} · ${trussAxialLabel(reading.state, language)} · ${forceText(reading, project)}`}</title>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {showValues && (length >= 110 || selectedMemberId === member.id) ? <text x={x + nx * offset} y={y + ny * offset} textAnchor="middle" dominantBaseline="middle">{text}</text> : null}
    </g>;
  })}</g>;
};

export const TrussAxialLegend = ({ readings, language, project, selectedMemberId }: Props & { selectedMemberId?: string }) => <div className="truss-axial-legend" aria-label={language === 'es' ? 'Estado axial de las barras' : 'Member axial state'} data-canvas-chrome="result-legend">
  <strong>N · {language === 'es' ? 'Armadura' : 'Truss'}</strong>
  {(['tension', 'compression', 'zero'] as const).map((state) => <span key={state} className={`truss-axial-key ${state}`}><i aria-hidden="true" /><b>{trussAxialSymbol(state)}</b> {trussAxialLabel(state, language)} <small>{[...readings.values()].filter((reading) => reading.state === state).length}</small></span>)}
  <small>{language === 'es' ? '+ tensión · − compresión' : '+ tension · − compression'}</small>
  {selectedMemberId && readings.has(selectedMemberId) ? <div className="truss-axial-selected"><strong>{selectedMemberId}</strong> · {trussAxialLabel(readings.get(selectedMemberId)!.state, language)} · <b>{forceText(readings.get(selectedMemberId)!, project)}</b></div> : null}
</div>;

export const TrussAxialTable = ({ project, readings, language, onSelect, selectedMemberId }: Props & { onSelect: (id: string) => void; selectedMemberId?: string }) => {
  if (!readings.size) return null;
  return <section className="truss-axial-summary">
    <header><div><strong>{language === 'es' ? 'Qué hace cada barra' : 'What each member carries'}</strong><p>{language === 'es' ? 'Elige una barra para inspeccionarla. Tensión positiva; compresión negativa.' : 'Select a member to inspect it. Tension is positive; compression is negative.'}</p></div></header>
    <div className="table-wrap"><table className="results-table truss-axial-table"><caption>{language === 'es' ? 'Fuerza axial de todas las barras' : 'Axial force in every member'}</caption><thead><tr><th>{language === 'es' ? 'Barra' : 'Member'}</th><th>{language === 'es' ? 'Estado' : 'State'}</th><th>N · {unitLabel(project.settings.units, 'force')}</th></tr></thead><tbody>{[...readings.values()].map((reading) => <tr key={reading.memberId} className={reading.memberId === selectedMemberId ? 'is-selected' : undefined}>
      <th scope="row"><button type="button" onClick={() => onSelect(reading.memberId)} aria-pressed={reading.memberId === selectedMemberId}>{reading.memberId}</button></th>
      <td><span className={`truss-axial-key ${reading.state}`}><i aria-hidden="true" /><b>{trussAxialSymbol(reading.state)}</b> {trussAxialLabel(reading.state, language)}</span></td>
      <td>{forceText(reading, project)}</td>
    </tr>)}</tbody></table></div>
  </section>;
};
