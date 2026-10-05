import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { bandScale, DiagramBand, nearestStation, type BandTone } from '../../design-system/components/diagramBands';
import { evaluateDeformationAt, evaluateDiagramAt } from '../../engine/diagram';
import { unitLabel } from '../../engine/units';
import { toDisplay } from '../../foundation/units';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import type { MemberResult } from '../../types';
import { formatFixed } from '../../utils/numberFormat';

const WIDTH = 820;
const LEFT = 74;
const RIGHT = 30;
const PLOT = WIDTH - LEFT - RIGHT;
const FRAME = { left: LEFT, plot: PLOT } as const;
const BAND_TOP = 70;
const BAND_HEIGHT = 58;
const BAND_GAP = 24;

interface Station { x: number; axial: number; shear: number; moment: number; deflection: number }

/**
 * Estaciones del miembro: cada tramo del diagrama exacto muestreado con su
 * valor a la derecha del inicio y a la izquierda del final, así un salto
 * (carga puntual) queda vertical en vez de inclinado.
 */
function stationsOf(result: MemberResult): Station[] {
  const length = result.length;
  const stations: Station[] = [];
  for (const segment of result.diagramSegments) {
    const count = Math.max(8, Math.ceil(36 * (segment.x1 - segment.x0) / Math.max(length, 1e-9)));
    for (let step = 0; step <= count; step += 1) {
      const x = segment.x0 + (segment.x1 - segment.x0) * step / count;
      const point = evaluateDiagramAt(result.diagramSegments, result.diagramJumps, x, step === count ? 'left' : 'right');
      if (!point) continue;
      const deformation = result.deformationSegments.length ? evaluateDeformationAt(result.deformationSegments, x) : null;
      stations.push({ x, axial: point.axial, shear: point.shear, moment: point.moment, deflection: deformation?.v ?? 0 });
    }
  }
  return stations;
}

/**
 * Lámina del miembro: N, V, M y la flecha apilados sobre el mismo eje, con un
 * cursor que los lee juntos. Es la presentación de Diseño (bandas comunes de
 * `design-system`) sobre el resultado exacto del Modelo 2D.
 */
export function MemberSheet({ memberResult, memberId }: { memberResult: MemberResult | undefined; memberId: string }) {
  const { project, analysis, setSelection, resultCursor, setResultCursor } = useProject();
  const { t, language } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const stations = useMemo(() => memberResult?.diagramSegments.length ? stationsOf(memberResult) : [], [memberResult]);
  if (!memberResult || !stations.length) return <div className="empty-small">{t('results.selectMember')}</div>;

  const units = project.settings.units;
  const length = memberResult.length;
  const scaleX = (x: number) => LEFT + x / Math.max(length, 1e-9) * PLOT;
  const xs = stations.map((station) => station.x);
  const forceUnit = unitLabel(units, 'force');
  const momentUnit = unitLabel(units, 'moment');
  const deflectionUnit = unitLabel(units, 'sectionDimension');
  const all = [
    { key: 'axial' as const, tone: 'axial' as BandTone, label: 'N', unit: forceUnit, values: stations.map((station) => toDisplay(station.axial, units, 'force')), positive: 'up' as const },
    { key: 'shear' as const, tone: 'shear' as BandTone, label: 'V', unit: forceUnit, values: stations.map((station) => toDisplay(station.shear, units, 'force')), positive: 'up' as const },
    { key: 'moment' as const, tone: 'moment' as BandTone, label: 'M', unit: momentUnit, values: stations.map((station) => toDisplay(station.moment, units, 'moment')),
      positive: project.settings.diagramSide === 'negative' ? 'down' as const : 'up' as const },
    { key: 'deflection' as const, tone: 'deformed' as BandTone, label: 'Δ', unit: deflectionUnit, values: stations.map((station) => toDisplay(station.deflection, units, 'sectionDimension')), positive: 'up' as const },
  ];
  // Una banda en cero no dice nada (cortante y momento de una armadura).
  const bands = all.filter((band) => band.values.some((value) => Math.abs(value) > 1e-9));
  const height = BAND_TOP + bands.length * (BAND_HEIGHT + BAND_GAP) - 6;
  const scales = bands.map((band, index) => bandScale({ upper: band.values, top: BAND_TOP + index * (BAND_HEIGHT + BAND_GAP), height: BAND_HEIGHT, positive: band.positive }));
  const breaks = [...new Set(memberResult.diagramJumps.map((jump) => jump.x).filter((x) => x > 1e-9 && x < length - 1e-9))];
  const pinned = resultCursor?.memberId === memberId && resultCursor.pinned ? nearestStation(xs, resultCursor.x) : null;
  const probe = pinned ?? hover;
  const format = (value: number) => formatFixed(value, Math.abs(value) >= 100 ? 1 : 2);
  const lengthText = (x: number) => `${formatFixed(toDisplay(x, units, 'length'), 2)} ${unitLabel(units, 'length')}`;

  const stationAt = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return null;
    const x = ((event.clientX - rect.left) / rect.width * WIDTH - LEFT) / PLOT * length;
    return x < -0.02 * length || x > 1.02 * length ? null : nearestStation(xs, Math.min(length, Math.max(0, x)));
  };
  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    const current = probe ?? 0;
    let next: number | null = current;
    if (event.key === 'ArrowRight') next = xs.findIndex((x) => x > xs[current]! + length / 400);
    else if (event.key === 'ArrowLeft') { const target = xs[current]! - length / 400; next = xs.reduce((best, x, index) => x < target ? index : best, -1); }
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = xs.length - 1;
    else if (event.key === 'Escape') { setResultCursor(null); setHover(null); event.preventDefault(); return; }
    else return;
    event.preventDefault();
    event.stopPropagation();
    const index = next !== null && next >= 0 ? next : current;
    setResultCursor({ memberId, x: xs[index]!, pinned: true });
  };
  const reading = probe !== null ? stations[probe]! : null;
  const memberOptions = analysis?.memberResults ?? [];
  const es = language === 'es';
  const description = es
    ? `Lámina del miembro ${memberId}: ${bands.map((band) => band.label).join(', ')} a lo largo de ${lengthText(length)}. Usa las flechas para leer cada sección`
    : `Member ${memberId} sheet: ${bands.map((band) => band.label).join(', ')} along ${lengthText(length)}. Use the arrow keys to read each section`;

  return <div className="member-sheet fs-probe-frame" data-testid="member-sheet">
    <div className="member-sheet__heading">
      <label><span>{t('results.member')}</span>
        <select aria-label={t('results.memberForDiagram')} value={memberId} onChange={(event) => { setSelection({ kind: 'member', id: event.target.value }); setResultCursor(null); }}>
          {memberOptions.map((member) => <option key={member.memberId} value={member.memberId}>{member.memberId}</option>)}
        </select>
      </label>
      <small>{es ? 'N, V, M y flecha en el mismo eje, como en Diseño. Toca para fijar el cursor; también se ve en el lienzo.' : 'N, V, M and deflection on one axis, as in Design. Tap to pin the cursor; it also shows on the canvas.'}</small>
    </div>
    <p className="fs-probe-readout" aria-live="polite">
      {reading ? <>
        <span><b>x</b> {lengthText(reading.x)}</span>
        <span data-tone="axial"><b>N</b> {format(toDisplay(reading.axial, units, 'force'))} {forceUnit}</span>
        <span data-tone="shear"><b>V</b> {format(toDisplay(reading.shear, units, 'force'))} {forceUnit}</span>
        <span data-tone="moment"><b>M</b> {format(toDisplay(reading.moment, units, 'moment'))} {momentUnit}</span>
        <span data-tone="deformed"><b>Δ</b> {format(toDisplay(reading.deflection, units, 'sectionDimension'))} {deflectionUnit}</span>
      </> : <span className="fs-probe-readout__hint">{es ? 'Pasa el cursor o toca la lámina para leer N, V, M y Δ en cada sección.' : 'Hover or tap the sheet to read N, V, M and Δ at each section.'}</span>}
    </p>
    <svg className="member-sheet__drawing fs-probe-target" viewBox={`0 0 ${WIDTH} ${height}`} role="img" tabIndex={0} aria-label={description}
      onPointerMove={(event) => { const index = stationAt(event); if (index !== null) setHover(index); }}
      onPointerLeave={() => setHover(null)}
      onPointerDown={(event) => { const index = stationAt(event); if (index !== null) setResultCursor(pinned === index ? null : { memberId, x: xs[index]!, pinned: true }); }}
      onKeyDown={onKeyDown}>
      <g className="member-sheet__member">
        <line x1={LEFT} x2={LEFT + PLOT} y1={30} y2={30} />
        <circle cx={LEFT} cy={30} r={4} /><circle cx={LEFT + PLOT} cy={30} r={4} />
        <text x={LEFT} y={16} textAnchor="start">{memberResult.memberId} · i</text>
        <text x={LEFT + PLOT} y={16} textAnchor="end">j</text>
        {breaks.map((x) => <line key={x} className="member-sheet__break" x1={scaleX(x)} x2={scaleX(x)} y1={24} y2={36} />)}
        <line className="member-sheet__dimension" x1={LEFT} x2={LEFT + PLOT} y1={50} y2={50} />
        <text x={LEFT + PLOT / 2} y={46} textAnchor="middle">{lengthText(length)}</text>
      </g>
      {bands.map((band, index) => <DiagramBand key={band.key} xs={xs} upper={band.values} top={BAND_TOP + index * (BAND_HEIGHT + BAND_GAP)} height={BAND_HEIGHT}
        scaleX={scaleX} positive={band.positive} tone={band.tone} label={band.label} unit={band.unit} nodesAtM={breaks} frame={FRAME} format={format} />)}
      {probe !== null ? <g className="fs-probe" aria-hidden="true">
        <line className="fs-probe__line" x1={scaleX(xs[probe]!)} x2={scaleX(xs[probe]!)} y1={22} y2={height - 4} />
        {bands.map((band, index) => <circle key={band.key} className={`fs-probe__dot fs-probe__dot--${band.tone}`} cx={scaleX(xs[probe]!)} cy={scales[index]!(band.values[probe]!)} r={4} />)}
      </g> : null}
    </svg>
  </div>;
}
