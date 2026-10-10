import { useEffect, useMemo, useState } from 'react';
import type { ModelDemandSnapshot, ModelResultProvider } from '../../../design/elements/modelResultSnapshot';
import type { ExternalStructureAxes, ExternalStructureSource } from '../../../design/elements/structure';

type Candidate = { provider: ModelResultProvider; source: 'Modelo 2D' | 'Modelo 3D'; memberId: string; axisId?: string };
type SourceList = { label: 'Modelo 2D' | 'Modelo 3D'; provider?: ModelResultProvider; axisId?: string };

function candidates(modelSource: ExternalStructureSource | null, modelAxes: ExternalStructureAxes | null): Candidate[] {
  const sources: SourceList[] = [
    { label: 'Modelo 2D', provider: modelSource?.resultProvider },
    ...(modelAxes?.resultProvider ? [{ label: 'Modelo 3D' as const, provider: modelAxes.resultProvider }] : (modelAxes?.axes ?? []).map((axis) => {
      try { return { label: 'Modelo 3D' as const, provider: modelAxes!.source(axis.id).resultProvider, axisId: axis.id }; }
      catch { return { label: 'Modelo 3D' as const, axisId: axis.id }; }
    })),
  ];
  const result: Candidate[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source.provider) continue;
    for (const member of source.provider.inventory.members) {
      if (source.axisId && !member.axisIds.includes(source.axisId)) continue;
      const key = `${source.provider.inventory.kind}|${source.provider.inventory.projectId}|${member.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const axisId = source.axisId ?? member.axisIds[0];
      result.push({ provider: source.provider, source: source.label, memberId: member.id, ...(axisId ? { axisId } : {}) });
    }
  }
  return result;
}

export function ModelMemberNavigator({ modelSource = null, modelAxes = null, origins = [], onShowMembers, onCreateLinked, onClose }: {
  modelSource?: ExternalStructureSource | null;
  modelAxes?: ExternalStructureAxes | null;
  origins?: readonly ModelDemandSnapshot[];
  onShowMembers?: (ids: readonly string[], axisId?: string, kind?: 'model2d' | 'model3d') => void;
  onCreateLinked: (snapshot: ModelDemandSnapshot, element: 'column' | 'flexure') => void;
  onClose?: () => void;
}) {
  const rows = useMemo(() => candidates(modelSource, modelAxes), [modelSource, modelAxes]);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [axis, setAxis] = useState('all');
  const [family, setFamily] = useState('all');
  const [review, setReview] = useState('all');
  const [selected, setSelected] = useState<string>('');
  const [targetId, setTargetId] = useState('');
  const [stationM, setStationM] = useState('0');
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [controller, setController] = useState<AbortController | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ModelDemandSnapshot | null>(null);
  const allMembers = rows.flatMap((row) => {
    const member = row.provider.inventory.members.find((item) => item.id === row.memberId)!;
    return [{ row, member }];
  });
  const levels = [...new Map(allMembers.flatMap(({ member }) => member.levelId ? [[member.levelId, member.levelId] as const] : [])).entries()];
  const axes = [...new Set(allMembers.flatMap(({ member }) => member.axisIds))];
  const keyOf = (row: Candidate, id: string) => `${row.provider.inventory.kind}|${row.provider.inventory.projectId}|${id}|${row.axisId ?? ''}`;
  const visible = allMembers.filter(({ row, member }) => {
    const linked = origins.some((origin) => origin.source.memberId === member.id && origin.source.kind === row.provider.inventory.kind);
    const text = `${row.source} ${member.id} ${member.label} ${member.levelId ?? 'sin nivel'} ${member.axisIds.join(' ')}`.toLocaleLowerCase();
    return (!query || text.includes(query.toLocaleLowerCase())) && (level === 'all' || (level === '__unassigned' ? member.levelId === null : member.levelId === level)) && (axis === 'all' || (axis === '__unassigned' ? member.axisIds.length === 0 : member.axisIds.includes(axis)))
      && (family === 'all' || member.family === family) && (review === 'all' || (review === 'linked' ? linked : !linked));
  });
  useEffect(() => {
    if (selected && !allMembers.some(({ row, member }) => keyOf(row, member.id) === selected)) {
      setSelected(''); setTargetId(''); setSelectedSnapshot(null);
    }
  // Filters retain a real selection in context; only a source deletion clears it.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, allMembers]);
  const chosen = allMembers.find(({ row, member }) => `${row.provider.inventory.kind}|${row.provider.inventory.projectId}|${member.id}|${row.axisId ?? ''}` === selected);
  const targets = chosen?.row.provider.inventory.targets ?? [];
  const target = targets.find((item) => item.id === targetId) ?? targets[0];
  const select = (row: Candidate, id: string) => {
    const member = row.provider.inventory.members.find((item) => item.id === id)!;
    setSelected(keyOf(row, id)); setTargetId(row.provider.inventory.targets[0]?.id ?? ''); setStationM('0'); setSelectedSnapshot(null);
    setLevel(member.levelId ?? 'all'); setAxis(row.axisId ?? member.axisIds[0] ?? 'all');
  };
  const create = async (element: 'column' | 'flexure') => {
    if (!chosen || !target || busy) return;
    const xM = Number(stationM);
    if (!Number.isFinite(xM) || xM < 0 || xM > chosen.member.lengthM) { setError('La estación debe quedar dentro de la barra.'); return; }
    const abort = new AbortController(); setController(abort); setBusy(true); setError('');
    try {
      const snapshot = await chosen.row.provider.member({ memberId: chosen.member.id, targetId: target.id, xM, side, ...(chosen.row.axisId ? { axisId: chosen.row.axisId } : {}) }, abort.signal);
      if (!abort.signal.aborted) { setSelectedSnapshot(snapshot); onCreateLinked(snapshot, element); }
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo leer el resultado actual del modelo.');
    } finally { if (!abort.signal.aborted) { setBusy(false); setController(null); } }
  };
  return <section className="dw-member-navigator" aria-label="Navegador del edificio" data-testid="model-member-navigator">
    <div className="dw-member-navigator__head"><h2>Navegador del edificio</h2>{onClose ? <button type="button" onClick={onClose} aria-label="Cerrar navegador">×</button> : null}</div>
    <div className="dw-member-navigator__filters">
      <label>Buscar<input aria-label="Buscar miembros" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      <label>Nivel<select aria-label="Filtrar por nivel" value={level} onChange={(event) => setLevel(event.currentTarget.value)}><option value="all">Todos</option><option value="__unassigned">Sin asignar</option>{levels.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Eje<select aria-label="Filtrar por eje" value={axis} onChange={(event) => setAxis(event.currentTarget.value)}><option value="all">Todos</option><option value="__unassigned">Sin asignar</option>{axes.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
      <label>Familia<select aria-label="Filtrar por familia" value={family} onChange={(event) => setFamily(event.currentTarget.value)}><option value="all">Todas</option><option value="column">Columnas</option><option value="beam">Vigas</option><option value="other">Otros</option></select></label>
      <label>Revisión<select aria-label="Filtrar por vínculo" value={review} onChange={(event) => setReview(event.currentTarget.value)}><option value="all">Todas</option><option value="linked">Con pieza vinculada</option><option value="unlinked">Sin pieza vinculada</option></select></label>
    </div>
    <div className="dw-member-navigator__table-wrap"><table><thead><tr><th>Modelo</th><th>Nivel</th><th>Eje</th><th>Miembro</th><th>Sección</th><th>Origen</th></tr></thead><tbody>
      {visible.map(({ row, member }) => <tr key={keyOf(row, member.id)} data-member-id={member.id} aria-selected={selected === keyOf(row, member.id)} onClick={() => select(row, member.id)}>
        <td>{row.source}</td><td>{member.levelId ?? 'Sin asignar'}</td><td>{member.axisIds.join(', ') || 'Sin asignar'}</td><td><button type="button" aria-label={`Seleccionar ${member.label} ${member.id}`} onClick={(event) => { event.stopPropagation(); select(row, member.id); }}>{member.label} · {member.id}</button></td>
        <td>{member.section.shape === 'other' ? `No compatible · ${member.section.materialLabel}` : `${member.section.shape} ${member.section.widthMm} × ${member.section.depthMm} mm · ${member.section.fcMpa ?? 'f′c no confirmado'} MPa`}</td><td>{origins.some((origin) => origin.source.memberId === member.id && origin.source.kind === row.provider.inventory.kind) ? 'Con vínculo' : 'Sin vínculo'}</td>
      </tr>)}
    </tbody></table>{visible.length === 0 ? <p>No hay miembros en estos filtros.</p> : null}</div>
    {chosen ? <div className="dw-member-navigator__selection" data-testid="member-selection">
      <strong>{chosen.member.label} · {chosen.member.id}</strong>
      {!visible.some(({ row, member }) => keyOf(row, member.id) === selected) ? <p role="status">La selección sigue activa, fuera de los filtros visibles.</p> : null}
      <label>Estado o combinación<select aria-label="Estado o combinación" value={target?.id ?? ''} onChange={(event) => setTargetId(event.currentTarget.value)}>{targets.map((item) => <option key={item.id} value={item.id}>{item.label}{item.factors.length ? ` · ${item.factors.map((factor) => `${factor.caseId} × ${factor.factor}`).join(' + ')}` : ''}</option>)}</select></label>
      <label>Estación desde i<input aria-label="Estación desde i" type="number" min="0" max={chosen.member.lengthM} step="any" value={stationM} onChange={(event) => setStationM(event.currentTarget.value)} /> m</label>
      <label>Lado del salto<select aria-label="Lado del salto" value={side} onChange={(event) => setSide(event.currentTarget.value as 'left' | 'right')}><option value="left">Izquierdo</option><option value="right">Derecho</option></select></label>
      {onShowMembers ? <button type="button" onClick={() => onShowMembers([chosen.member.id], chosen.row.axisId, chosen.row.provider.inventory.kind)}>Ver en el modelo</button> : null}
      {chosen.member.family === 'column' ? <button type="button" disabled={busy} onClick={() => void create('column')}>Crear columna vinculada</button> : null}
      {chosen.member.family === 'beam' ? <button type="button" disabled={busy} onClick={() => void create('flexure')}>Crear flexión vinculada</button> : null}
      {busy ? <><span role="status">Leyendo resultado actual…</span><button type="button" onClick={() => { controller?.abort(); setBusy(false); setController(null); }}>Cancelar</button></> : null}
      {error ? <p role="alert">{error}</p> : null}
      {selectedSnapshot ? <div data-testid="selected-demand-snapshot" aria-label="Instantánea original seleccionada">
        <strong>Instantánea original seleccionada</strong><p>{selectedSnapshot.target.label} · x = {selectedSnapshot.station.xM} m · {selectedSnapshot.axes.convention}</p>
        <p>N {selectedSnapshot.actions.nKn} kN · Vy {selectedSnapshot.actions.vyKn} kN · Vz {selectedSnapshot.actions.vzKn} kN · T {selectedSnapshot.actions.torsionKnm} kN·m · My {selectedSnapshot.actions.myKnm} kN·m · Mz {selectedSnapshot.actions.mzKnm} kN·m</p>
      </div> : null}
    </div> : <p>Selecciona un miembro para elegir su estado, estación y lado.</p>}
  </section>;
}
