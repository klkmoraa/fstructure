import { useId, type CSSProperties, type ReactNode } from 'react';
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

type ScreenPoint = { x: number; y: number };

/** Clip the existing exact curve at N=0. The sign follows the positive
 * ordinate, including inclined members and the reversed diagram side. */
export const AxialDiagramSigns = ({ baselineStart, baselineEnd, positivePoint, extent, children }: {
  baselineStart: ScreenPoint; baselineEnd: ScreenPoint; positivePoint: ScreenPoint; extent: number; children: ReactNode;
}) => {
  const id = useId();
  const length = Math.hypot(baselineEnd.x - baselineStart.x, baselineEnd.y - baselineStart.y) || 1;
  const dx = (baselineEnd.x - baselineStart.x) / length;
  const dy = (baselineEnd.y - baselineStart.y) / length;
  const ordinate = Math.hypot(positivePoint.x - baselineStart.x, positivePoint.y - baselineStart.y) || 1;
  const nx = (positivePoint.x - baselineStart.x) / ordinate;
  const ny = (positivePoint.y - baselineStart.y) / ordinate;
  const a = { x: baselineStart.x - dx * extent, y: baselineStart.y - dy * extent };
  const b = { x: baselineEnd.x + dx * extent, y: baselineEnd.y + dy * extent };
  return <>{(['tension', 'compression'] as const).map((state) => {
    const side = state === 'tension' ? 1 : -1;
    const clipId = `${id}-${state}`;
    const points = [a, b, { x: b.x + side * nx * extent, y: b.y + side * ny * extent }, { x: a.x + side * nx * extent, y: a.y + side * ny * extent }];
    return <g key={state}>
      <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} /></clipPath></defs>
      <g data-axial-state={state} clipPath={`url(#${clipId})`} style={{ '--axial': `var(--sc-color-axial-${state})` } as CSSProperties}>{children}</g>
    </g>;
  })}</>;
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

export const TrussAxialTable = ({ project, readings, language, onSelect, selectedMemberId, collapsible = false }: Props & { collapsible?: boolean; onSelect: (id: string) => void; selectedMemberId?: string }) => {
  if (!readings.size) return null;
  const Container = collapsible ? 'details' : 'section';
  return <Container className="truss-axial-summary">
    {collapsible ? <summary>{language === 'es' ? 'Fuerza axial de todas las barras' : 'Axial force in every member'} <small>({readings.size})</small></summary> : null}
    <header><div><strong>{language === 'es' ? 'Qué hace cada barra' : 'What each member carries'}</strong><p>{language === 'es' ? 'Elige una barra para inspeccionarla. Tensión positiva; compresión negativa.' : 'Select a member to inspect it. Tension is positive; compression is negative.'}</p></div></header>
    <div className="table-wrap"><table className="results-table truss-axial-table"><caption>{language === 'es' ? 'Fuerza axial de todas las barras' : 'Axial force in every member'}</caption><thead><tr><th>{language === 'es' ? 'Barra' : 'Member'}</th><th>{language === 'es' ? 'Estado' : 'State'}</th><th>N · {unitLabel(project.settings.units, 'force')}</th></tr></thead><tbody>{[...readings.values()].map((reading) => <tr key={reading.memberId} className={reading.memberId === selectedMemberId ? 'is-selected' : undefined}>
      <th scope="row"><button type="button" onClick={() => onSelect(reading.memberId)} aria-pressed={reading.memberId === selectedMemberId}>{reading.memberId}</button></th>
      <td><span className={`truss-axial-key ${reading.state}`}><i aria-hidden="true" /><b>{trussAxialSymbol(reading.state)}</b> {trussAxialLabel(reading.state, language)}</span></td>
      <td>{forceText(reading, project)}</td>
    </tr>)}</tbody></table></div>
  </Container>;
};
