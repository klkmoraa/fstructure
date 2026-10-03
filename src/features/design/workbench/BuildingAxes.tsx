import { BookPlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DesignCodeId } from '../../../design/elements/codes';
import { summarizeExternalStructure, type ExternalStructureAxes, type ExternalStructureAxis, type StructureAxisSummary } from '../../../design/elements/structure';
import { afterTransition } from '../../../design-system/afterTransition';
import { ratioBand } from './FrameDrawings';
import { structureOptions, type FrameDraft } from './frameModel';
import { Plate } from './WorkbenchLayout';

/**
 * Todos los ejes del Modelo 3D: cada eje se diseña con los mismos datos de la
 * mesa, uno por vez para que la interfaz siga respondiendo, y se resume en una
 * planta y una tabla. Una columna pertenece a dos ejes (x = cte y z = cte): en
 * planta rige el mayor de sus cocientes en todos sus niveles y ejes.
 */

type AxisSummary = StructureAxisSummary;

const worst = (values: readonly number[]) => values.reduce((best, value) => Math.max(best, value), 0);
const percent = (ratio: number) => Number.isFinite(ratio) ? `${Math.round(ratio * 100)} %` : '—';

let axesIdentity = 0;
const identities = new WeakMap<ExternalStructureAxes, number>();
const identityOf = (axes: ExternalStructureAxes) => {
  let id = identities.get(axes);
  if (id === undefined) { id = ++axesIdentity; identities.set(axes, id); }
  return id;
};

/**
 * Diseña los ejes: en un worker si la fuente lo ofrece (la interfaz no se
 * detiene), si no uno por tarea en el hilo principal. Conserva lo ya calculado
 * mientras avanza.
 */
function useBuildingDesign(axes: ExternalStructureAxes, code: DesignCodeId, draft: FrameDraft) {
  // La clave omite lo que no cambia el cálculo: clave, ubicación, eje elegido y fuente.
  const { tag: _tag, place: _place, axis: _axis, source: _source, ...relevant } = draft;
  const key = JSON.stringify([identityOf(axes), code, relevant]);
  const [state, setState] = useState<{ key: string; results: ReadonlyMap<string, AxisSummary> }>({ key, results: new Map() });
  const latest = useRef({ axes, code, draft });
  latest.current = { axes, code, draft };
  useEffect(() => {
    let cancelled = false;
    const results = new Map<string, AxisSummary>();
    setState({ key, results });
    const { axes: current, code: currentCode, draft: currentDraft } = latest.current;
    const request = { options: structureOptions(currentCode, currentDraft), braced: currentDraft.braced === 'yes' };
    const publish = (axisId: string, summary: AxisSummary) => {
      if (cancelled) return;
      results.set(axisId, summary);
      setState({ key, results: new Map(results) });
    };
    let cancelWork = () => undefined as void;
    const cancelStart = afterTransition(() => {
      if (current.designAll) {
        cancelWork = current.designAll(request, publish);
        return;
      }
      let index = 0;
      let handle = 0;
      const step = () => {
        const axis = current.axes[index];
        if (cancelled || !axis) return;
        index += 1;
        publish(axis.id, summarizeExternalStructure(current.source(axis.id), request.options, request.braced));
        handle = window.setTimeout(step, 16);
      };
      step();
      cancelWork = () => window.clearTimeout(handle);
    });
    return () => { cancelled = true; cancelStart(); cancelWork(); };
  }, [key]);
  return state.key === key ? state.results : new Map<string, AxisSummary>();
}

const PLAN_WIDTH = 560;
const PLAN_MARGIN = 46;

function BuildingPlan({ axes, results, current, onOpen }: {
  axes: ExternalStructureAxes;
  results: ReadonlyMap<string, AxisSummary>;
  current: string;
  onOpen: (axisId: string) => void;
}) {
  const xs = [...axes.axes.filter((axis) => axis.direction === 'x').map((axis) => axis.coordinate), ...axes.columns.map((column) => column.x)];
  const zs = [...axes.axes.filter((axis) => axis.direction === 'z').map((axis) => axis.coordinate), ...axes.columns.map((column) => column.z)];
  const [minX, maxX] = [Math.min(...xs, 0), Math.max(...xs, 1)];
  const [minZ, maxZ] = [Math.min(...zs, 0), Math.max(...zs, 1)];
  const scale = (PLAN_WIDTH - 2 * PLAN_MARGIN) / Math.max(maxX - minX, maxZ - minZ, 1e-9);
  const height = Math.max(160, (maxZ - minZ) * scale + 2 * PLAN_MARGIN);
  const px = (x: number) => PLAN_MARGIN + (x - minX) * scale;
  const pz = (z: number) => PLAN_MARGIN + (z - minZ) * scale;
  // Cociente de cada barra de columna: el mayor entre los ejes ya diseñados.
  const columnRatio = new Map<string, number>();
  for (const summary of results.values()) {
    if (!summary.ok) continue;
    for (const [id, ratio] of summary.columnRatios) columnRatio.set(id, Math.max(columnRatio.get(id) ?? 0, ratio));
  }
  const size = Math.max(8, Math.min(16, scale * 0.45));
  return <svg className="dw-drawing dw-building-plan" viewBox={`0 0 ${PLAN_WIDTH} ${height}`} role="group"
    aria-label={`Planta del Modelo 3D: ${axes.axes.length} ejes y ${axes.columns.length} columnas, coloreadas por su mayor cociente`}>
    {axes.axes.map((axis) => {
      const summary = results.get(axis.id);
      const band = summary?.ok ? ratioBand(summary.ratio) : summary ? 'skip' : 'pending';
      const vertical = axis.direction === 'x';
      const [x1, y1, x2, y2] = vertical
        ? [px(axis.coordinate), PLAN_MARGIN - 18, px(axis.coordinate), height - PLAN_MARGIN + 18]
        : [PLAN_MARGIN - 18, pz(axis.coordinate), PLAN_WIDTH - PLAN_MARGIN + 18, pz(axis.coordinate)];
      const label = axis.short ?? (vertical ? `x ${axis.coordinate}` : `z ${axis.coordinate}`);
      return <g key={axis.id} className="dw-building-plan__axis" data-band={band} data-current={axis.id === current || undefined}
        role="button" tabIndex={0} aria-label={`${axis.label}${summary?.ok ? ` · rige ${percent(summary.ratio)}` : ''}: abrir`}
        onClick={() => onOpen(axis.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(axis.id); } }}>
        <line className="dw-building-plan__hit" x1={x1} y1={y1} x2={x2} y2={y2} />
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <circle cx={vertical ? x1 : x1 - 12} cy={vertical ? y1 - 12 : y1} r={11} />
        <text x={vertical ? x1 : x1 - 12} y={(vertical ? y1 - 12 : y1) + 4} textAnchor="middle">{label.length > 3 ? label.slice(0, 3) : label}</text>
      </g>;
    })}
    {axes.columns.map((column) => {
      const ratios = column.memberIds.map((id) => columnRatio.get(id)).filter((value): value is number => value !== undefined);
      const ratio = ratios.length ? worst(ratios) : Number.NaN;
      return <rect key={`${column.x}|${column.z}`} className="dw-building-plan__column" data-band={ratios.length ? ratioBand(ratio) : 'pending'}
        x={px(column.x) - size / 2} y={pz(column.z) - size / 2} width={size} height={size} rx={2}>
        <title>{`Columna en x = ${column.x} m, z = ${column.z} m · ${column.memberIds.length} ${column.memberIds.length === 1 ? 'tramo' : 'tramos'}${ratios.length ? ` · rige ${percent(ratio)}` : ''}`}</title>
      </rect>;
    })}
  </svg>;
}

export function BuildingAxes({ axes, code, draft, current, onOpen, onClose, onSaveAll }: {
  axes: ExternalStructureAxes;
  code: DesignCodeId;
  draft: FrameDraft;
  /** Eje abierto en la mesa. */
  current: string;
  onOpen: (axisId: string) => void;
  onClose: () => void;
  /** Guarda todos los ejes en la memoria del proyecto (para el PDF del edificio). */
  onSaveAll?: (axes: readonly { readonly id: string; readonly tag: string }[]) => 'saved' | 'full';
}) {
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const results = useBuildingDesign(axes, code, draft);
  const done = axes.axes.filter((axis) => results.has(axis.id)).length;
  const governing = useMemo(() => axes.axes.reduce<{ axis: ExternalStructureAxis; ratio: number } | null>((best, axis) => {
    const summary = results.get(axis.id);
    return summary?.ok && (!best || summary.ratio > best.ratio) ? { axis, ratio: summary.ratio } : best;
  }, null), [axes, results]);
  const failing = axes.axes.filter((axis) => { const summary = results.get(axis.id); return summary?.ok && summary.status === 'fail'; }).length;
  const note = done < axes.axes.length
    ? `Diseñando eje ${done + 1} de ${axes.axes.length}…`
    : `${axes.axes.length} ejes · ${governing ? `rige ${governing.axis.short ? `el eje ${governing.axis.short}` : governing.axis.label} (${percent(governing.ratio)})` : 'sin resultados'}${failing ? ` · ${failing} no ${failing === 1 ? 'cumple' : 'cumplen'}` : ''}`;
  return <Plate title="Edificio · todos los ejes" wide note={note}>
    <div className="dw-building" aria-busy={done < axes.axes.length || undefined}>
      <button type="button" className="dw-building__close" onClick={onClose} aria-label="Cerrar la vista de todos los ejes"><X size={14} aria-hidden="true" /></button>
      <BuildingPlan axes={axes} results={results} current={current} onOpen={onOpen} />
      <table className="dw-table dw-building__table" aria-label="Ejes del Modelo 3D (cociente que rige)">
        <thead><tr><th scope="col">Eje</th><th scope="col">Vigas</th><th scope="col">Columnas</th><th scope="col">Rige</th><th scope="col" aria-label="Abrir" /></tr></thead>
        <tbody>{axes.axes.map((axis) => {
          const summary = results.get(axis.id);
          return <tr key={axis.id} data-active={axis.id === current || undefined}>
            <th scope="row">{axis.label}</th>
            {summary?.ok ? <>
              <td data-band={ratioBand(summary.beams)}>{summary.beamCount ? percent(summary.beams) : '—'}</td>
              <td data-band={ratioBand(summary.columns)}>{summary.columnCount ? percent(summary.columns) : '—'}</td>
              <td data-band={ratioBand(summary.ratio)} data-status={summary.status === 'fail' ? 'fail' : undefined}>{percent(summary.ratio)}</td>
            </> : summary ? <td colSpan={3} className="dw-building__error">{summary.error}</td>
              : <td colSpan={3} className="dw-building__pending">En cola…</td>}
            <td><button type="button" className="dw-inline-action" onClick={() => onOpen(axis.id)} aria-label={`Abrir ${axis.label}`}>Abrir</button></td>
          </tr>;
        })}</tbody>
      </table>
      <p className="dw-input-note">Cada eje se diseña con los mismos datos de la mesa y las acciones del modelo completo. En planta, cada columna toma el mayor cociente de sus tramos en sus dos ejes.</p>
      {onSaveAll ? <div className="dw-building__save">
        <button type="button" className="dw-inline-action" onClick={() => {
          const outcome = onSaveAll(axes.axes.map((axis) => ({ id: axis.id, tag: axis.short ? `Eje ${axis.short}` : axis.label })));
          setSaveNote(outcome === 'full'
            ? 'La memoria no tiene espacio para todos los ejes: quita elementos antes de agregarlos.'
            : `${axes.axes.length} ejes en la memoria del proyecto: Memoria → PDF exporta el edificio completo.`);
        }}><BookPlus size={13} aria-hidden="true" />Guardar los {axes.axes.length} ejes en la memoria</button>
        {saveNote ? <span role="status">{saveNote}</span> : null}
      </div> : null}
    </div>
  </Plate>;
}
