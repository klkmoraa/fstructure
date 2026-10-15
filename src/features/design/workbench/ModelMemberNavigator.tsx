import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelDemandSnapshot, ModelResultProvider } from '../../../design/elements/modelResultSnapshot';
import type { ExternalStructureAxes, ExternalStructureSource } from '../../../design/elements/structure';
import type { DesignCodeId } from '../../../design/elements/codes';
import type { FrameDraft } from './frameCalculation';
import type { ModelSectionsBridge } from './WorkbenchLayout';
import type { ProposalStep } from './frameProposal';

type Candidate = { provider: ModelResultProvider; source: 'Modelo 2D' | 'Modelo 3D'; memberId: string; axisId?: string };
type SourceList = { label: 'Modelo 2D' | 'Modelo 3D'; provider?: ModelResultProvider; axisId?: string };
type LinkedPieceCreationResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

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

/** Barra elegida fuera del navegador (en el 2D, el 3D, Estructura o en una visita anterior). */
export type NavigatorMember = { readonly id: string; readonly kind?: 'model2d' | 'model3d' };

export function ModelMemberNavigator({ modelSource = null, modelAxes = null, modelSections, space3dSections, code, frameDraft, origins = [], initialMember, onSelectMember, onShowMembers, onCreateLinked, onClose }: {
  modelSource?: ExternalStructureSource | null;
  modelAxes?: ExternalStructureAxes | null;
  modelSections?: ModelSectionsBridge | null;
  space3dSections?: ModelSectionsBridge | null;
  code?: DesignCodeId;
  frameDraft?: FrameDraft;
  origins?: readonly ModelDemandSnapshot[];
  onShowMembers?: (ids: readonly string[], axisId?: string, kind?: 'model2d' | 'model3d') => void;
  onCreateLinked: (snapshot: ModelDemandSnapshot, element: 'column' | 'flexure') => void | LinkedPieceCreationResult | Promise<void | LinkedPieceCreationResult>;
  onClose?: () => void;
  /** Abre con esta barra elegida y sus controles a la vista. */
  initialMember?: NavigatorMember;
  /** Cada elección, para que la siguiente visita abra con ella. */
  onSelectMember?: (member: NavigatorMember) => void;
}) {
  const rows = useMemo(() => candidates(modelSource, modelAxes), [modelSource, modelAxes]);
  // La elección con la que se abre: la misma barra, del modelo de donde vino si se sabe.
  const [start] = useState(() => {
    if (!initialMember) return null;
    const matches = rows.filter((row) => row.memberId === initialMember.id);
    const row = matches.find((item) => item.provider.inventory.kind === initialMember.kind) ?? matches[0];
    const member = row?.provider.inventory.members.find((item) => item.id === initialMember.id);
    return row && member ? { row, member } : null;
  });
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState(start?.member.levelId ?? 'all');
  const [axis, setAxis] = useState(start ? start.row.axisId ?? start.member.axisIds[0] ?? 'all' : 'all');
  const [family, setFamily] = useState('all');
  const [review, setReview] = useState('all');
  const [selected, setSelected] = useState<string>(() => start ? `${start.row.provider.inventory.kind}|${start.row.provider.inventory.projectId}|${start.member.id}|${start.row.axisId ?? ''}` : '');
  const [targetId, setTargetId] = useState(start?.row.provider.inventory.targets[0]?.id ?? '');
  const [stationM, setStationM] = useState('0');
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeController = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const latestContext = useRef('');
  const objectIds = useRef(new WeakMap<object, number>());
  const nextObjectId = useRef(1);
  const objectId = (value: object) => {
    let id = objectIds.current.get(value);
    if (id === undefined) { id = nextObjectId.current++; objectIds.current.set(value, id); }
    return id;
  };
  const [selectedSnapshot, setSelectedSnapshot] = useState<ModelDemandSnapshot | null>(null);
  const [proposalStep, setProposalStep] = useState<ProposalStep | null>(null);
  const proposalCancel = useRef<(() => void) | null>(null);
  const proposalContext = useRef<{ key: string; scope: readonly string[] } | null>(null);
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
  const plan = visible.map(({ row, member }) => {
    const coordinate = (point: readonly number[]) => ({ x: point[0] ?? 0, y: row.provider.inventory.kind === 'model3d' ? point[2] ?? 0 : point[1] ?? 0 });
    return { row, member, start: coordinate(member.start), end: coordinate(member.end) };
  });
  const planBounds = plan.reduce((bounds, item) => ({ minX: Math.min(bounds.minX, item.start.x, item.end.x), maxX: Math.max(bounds.maxX, item.start.x, item.end.x), minY: Math.min(bounds.minY, item.start.y, item.end.y), maxY: Math.max(bounds.maxY, item.start.y, item.end.y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const planSpanX = Math.max(planBounds.maxX - planBounds.minX, 1e-6);
  const planSpanY = Math.max(planBounds.maxY - planBounds.minY, 1e-6);
  const planPoint = (point: { x: number; y: number }) => ({ x: 14 + 332 * (point.x - planBounds.minX) / planSpanX, y: 14 + 152 * (1 - (point.y - planBounds.minY) / planSpanY) });
  useEffect(() => {
    if (selected && !allMembers.some(({ row, member }) => keyOf(row, member.id) === selected)) {
      setSelected(''); setTargetId(''); setSelectedSnapshot(null);
    }
  // Filters retain a real selection in context; only a source deletion clears it.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, allMembers]);
  const chosen = allMembers.find(({ row, member }) => `${row.provider.inventory.kind}|${row.provider.inventory.projectId}|${member.id}|${row.axisId ?? ''}` === selected);
  const sectionBridge = chosen?.row.provider.inventory.kind === 'model2d' ? modelSections : space3dSections;
  const selectedGroup = chosen ? sectionBridge?.groups?.find((group) => group.memberIds.includes(chosen.member.id)) : undefined;
  const groupScope = selectedGroup?.memberIds.filter((id) => chosen?.row.provider.inventory.members.some((member) => member.id === id)) ?? [];
  const targets = chosen?.row.provider.inventory.targets ?? [];
  const target = targets.find((item) => item.id === targetId) ?? targets[0];
  const designContext = JSON.stringify([code ?? null, frameDraft ?? null]);
  const bridgeContext = sectionBridge ? `${sectionBridge.kind}:${sectionBridge.projectId}:${sectionBridge.revision}` : '';
  const contextKey = `${selected}|${target?.id ?? ''}|${stationM}|${side}|${rows.map(({ provider }) => `${provider.inventory.kind}:${provider.inventory.projectId}:${provider.inventory.revision}:${objectId(provider)}`).join(';')}|${bridgeContext}|${designContext}`;
  latestContext.current = contextKey;
  const invalidate = () => { requestId.current++; activeController.current?.abort(); activeController.current = null; setBusy(false); };
  useEffect(() => () => { requestId.current++; activeController.current?.abort(); proposalCancel.current?.(); }, []);
  useEffect(() => { requestId.current++; activeController.current?.abort(); activeController.current = null; setBusy(false); proposalCancel.current?.(); proposalCancel.current = null; proposalContext.current = null; setProposalStep(null); }, [contextKey]);
  useEffect(() => () => proposalCancel.current?.(), []);
  const select = (row: Candidate, id: string) => {
    invalidate();
    const member = row.provider.inventory.members.find((item) => item.id === id)!;
    setSelected(keyOf(row, id)); setTargetId(row.provider.inventory.targets[0]?.id ?? ''); setStationM('0'); setSelectedSnapshot(null);
    setLevel(member.levelId ?? 'all'); setAxis(row.axisId ?? member.axisIds[0] ?? 'all');
    onSelectMember?.({ id, kind: row.provider.inventory.kind });
  };
  const create = async (element: 'column' | 'flexure') => {
    if (!chosen || !target || busy) return;
    const xM = Number(stationM);
    if (!Number.isFinite(xM) || xM < 0 || xM > chosen.member.lengthM) { setError('La estación debe quedar dentro de la barra.'); return; }
    const abort = new AbortController(); const id = ++requestId.current; const requestContext = contextKey;
    activeController.current = abort; setBusy(true); setError('');
    try {
      const snapshot = await chosen.row.provider.member({ memberId: chosen.member.id, targetId: target.id, xM, side, ...(chosen.row.axisId ? { axisId: chosen.row.axisId } : {}) }, abort.signal);
      if (!abort.signal.aborted && id === requestId.current && requestContext === latestContext.current) {
        setSelectedSnapshot(snapshot);
        const result = await onCreateLinked(snapshot, element);
        if (id === requestId.current && requestContext === latestContext.current && result && !result.ok) setError(result.reason);
      }
    } catch (cause) {
      if (!abort.signal.aborted && id === requestId.current && requestContext === latestContext.current) setError(cause instanceof Error ? cause.message : 'No se pudo leer el resultado actual del modelo.');
    } finally { if (id === requestId.current && requestContext === latestContext.current) { activeController.current = null; setBusy(false); } }
  };
  const proposeGroup = () => {
    const propose = sectionBridge?.propose;
    if (!sectionBridge || !propose || !sectionBridge.apply || !selectedGroup || !code || !frameDraft || !groupScope.length) return;
    proposalCancel.current?.(); setProposalStep({ kind: 'trying', phase: 'grow', beam: { width: 0, height: 0 }, column: { width: 0, height: 0 }, trial: 0 });
    const bridge = sectionBridge, scope = [...groupScope], key = `${contextKey}|${selectedGroup.id}`;
    proposalContext.current = { key, scope };
    const cancel = propose.call(bridge, code, frameDraft, (step) => {
      if (proposalContext.current?.key === key) setProposalStep(step);
    }, scope);
    if (cancel) proposalCancel.current = cancel;
    else setProposalStep({ kind: 'failed', reason: 'No se pudo iniciar la búsqueda en el trabajador disponible.', trials: 0 });
  };
  const applyGroupProposal = () => {
    const current = proposalContext.current;
    if (!current || !sectionBridge || !selectedGroup || current.key !== `${contextKey}|${selectedGroup.id}` || proposalStep?.kind !== 'done') return;
    sectionBridge.apply(proposalStep.proposal.beam, proposalStep.proposal.column, proposalStep.proposal.groups, current.scope);
    proposalCancel.current?.(); proposalCancel.current = null; proposalContext.current = null; setProposalStep(null);
  };
  return <section className="dw-member-navigator" aria-label="Navegador del edificio" data-testid="model-member-navigator">
    <div className="dw-member-navigator__head"><h2>Navegador del edificio</h2>{onClose ? <button type="button" onClick={() => { invalidate(); proposalContext.current = null; proposalCancel.current?.(); onClose(); }} aria-label="Cerrar navegador">×</button> : null}</div>
    <div className="dw-member-navigator__filters">
      <label>Buscar<input aria-label="Buscar miembros" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      <label>Nivel<select aria-label="Filtrar por nivel" value={level} onChange={(event) => setLevel(event.currentTarget.value)}><option value="all">Todos</option><option value="__unassigned">Sin asignar</option>{levels.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Eje<select aria-label="Filtrar por eje" value={axis} onChange={(event) => setAxis(event.currentTarget.value)}><option value="all">Todos</option><option value="__unassigned">Sin asignar</option>{axes.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
      <label>Familia<select aria-label="Filtrar por familia" value={family} onChange={(event) => setFamily(event.currentTarget.value)}><option value="all">Todas</option><option value="column">Columnas</option><option value="beam">Vigas</option><option value="other">Otros</option></select></label>
      <label>Revisión<select aria-label="Filtrar por vínculo" value={review} onChange={(event) => setReview(event.currentTarget.value)}><option value="all">Todas</option><option value="linked">Con pieza vinculada</option><option value="unlinked">Sin pieza vinculada</option></select></label>
    </div>
    <div className="dw-member-navigator__plan-wrap">
      <strong>{plan.some(({ row }) => row.provider.inventory.kind === 'model3d') && plan.some(({ row }) => row.provider.inventory.kind === 'model2d') ? 'Planta 3D (XZ) y alzado 2D (XY)' : plan.some(({ row }) => row.provider.inventory.kind === 'model2d') ? 'Alzado del Modelo 2D (XY)' : 'Planta del edificio (XZ)'}</strong>
      {plan.length ? <svg className="dw-member-navigator__plan" viewBox="0 0 360 180" role="group" aria-label="Planta del edificio">
        {plan.map(({ row, member, start, end }) => {
          const a = planPoint(start), b = planPoint(end);
          const isSelected = selected === keyOf(row, member.id);
          const point = Math.hypot(a.x - b.x, a.y - b.y) < 1e-5;
          return <g key={keyOf(row, member.id)} role="button" tabIndex={0} aria-pressed={isSelected} aria-label={`${member.label} ${member.id} en planta`}
            data-member-id={member.id} onClick={() => select(row, member.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(row, member.id); } }}>
            <title>{member.label} · {member.id}</title>
            {point ? <><circle className="dw-member-navigator__plan-hit" cx={a.x} cy={a.y} r="12" /><circle cx={a.x} cy={a.y} r={isSelected ? 7 : 5} /></>
              : <><line className="dw-member-navigator__plan-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} /><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} /><circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={isSelected ? 6 : 4} /></>}
          </g>;
        })}
      </svg> : <p>No hay miembros en estos filtros para mostrar en planta.</p>}
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
      <label>Estado o combinación<select aria-label="Estado o combinación" value={target?.id ?? ''} onChange={(event) => { invalidate(); setTargetId(event.currentTarget.value); }}>{targets.map((item) => <option key={item.id} value={item.id}>{item.label}{item.factors.length ? ` · ${item.factors.map((factor) => `${factor.caseId} × ${factor.factor}`).join(' + ')}` : ''}</option>)}</select></label>
      <label>Estación desde i<input aria-label="Estación desde i" type="number" min="0" max={chosen.member.lengthM} step="any" value={stationM} onChange={(event) => { invalidate(); setStationM(event.currentTarget.value); }} /> m</label>
      <label>Lado del salto<select aria-label="Lado del salto" value={side} onChange={(event) => { invalidate(); setSide(event.currentTarget.value as 'left' | 'right'); }}><option value="left">Izquierdo</option><option value="right">Derecho</option></select></label>
      {onShowMembers ? <button type="button" onClick={() => onShowMembers([chosen.member.id], chosen.row.axisId, chosen.row.provider.inventory.kind)}>Ver en el modelo</button> : null}
      {!selectedGroup && (chosen.member.family === 'column' || chosen.member.family === 'beam') ? <p role="status">Este miembro no pertenece a un conjunto de concreto compatible con una propuesta completa.</p> : null}
      {selectedGroup ? <div className="dw-member-navigator__group" data-testid="linked-section-group">
        <p>Conjunto {selectedGroup.label} · {groupScope.length} barras</p>
        {!sectionBridge?.propose ? <p role="status">El conjunto no puede proponer secciones con los datos actuales del modelo.</p> : null}
        <button type="button" data-testid="propose-linked-group" onClick={proposeGroup} disabled={!sectionBridge?.propose || !code || !frameDraft || !groupScope.length}>Proponer secciones del conjunto</button>
        {proposalStep?.kind === 'trying' ? <p role="status" data-testid="group-proposal-progress">Buscando sección · prueba {proposalStep.trial}</p> : null}
        {proposalStep?.kind === 'failed' ? <p role="alert">No se encontró una propuesta válida para este conjunto. No se aplicó ninguna sección; los miembros fuera del conjunto conservan sus secciones actuales.</p> : null}
        {proposalStep?.kind === 'done' ? <div data-testid="group-proposal-preview"><p>Vista previa · {selectedGroup.kind === 'beam' ? `viga ${proposalStep.proposal.groups?.find((group) => group.id === selectedGroup.id)?.width ?? proposalStep.proposal.beam.width} × ${proposalStep.proposal.groups?.find((group) => group.id === selectedGroup.id)?.height ?? proposalStep.proposal.beam.height} cm` : `columna ${proposalStep.proposal.groups?.find((group) => group.id === selectedGroup.id)?.width ?? proposalStep.proposal.column.width} × ${proposalStep.proposal.groups?.find((group) => group.id === selectedGroup.id)?.height ?? proposalStep.proposal.column.height} cm`} · utilización global ${Math.round(proposalStep.proposal.ratio * 100)} %</p>
          <p>Los cambios se limitan a {selectedGroup.label}; la comprobación incluye el modelo completo. Fuera del conjunto se conservan las secciones actuales.</p>
          <button type="button" data-testid="apply-linked-group" onClick={applyGroupProposal}>Aplicar secciones del conjunto</button>
          <button type="button" onClick={() => { proposalCancel.current?.(); proposalContext.current = null; setProposalStep(null); }}>Descartar propuesta</button>
        </div> : null}
      </div> : null}
      {chosen.member.family === 'column' ? <button type="button" disabled={busy} onClick={() => void create('column')}>Crear columna vinculada</button> : null}
      {chosen.member.family === 'beam' ? <button type="button" disabled={busy} onClick={() => void create('flexure')}>Crear flexión vinculada</button> : null}
      {busy ? <><span role="status">Leyendo resultado actual…</span><button type="button" onClick={() => invalidate()}>Cancelar</button></> : null}
      {error ? <p role="alert">{error}</p> : null}
      {selectedSnapshot ? <div data-testid="selected-demand-snapshot" aria-label="Instantánea original seleccionada">
        <strong>Instantánea original seleccionada</strong><p>{selectedSnapshot.target.label} · x = {selectedSnapshot.station.xM} m · {selectedSnapshot.axes.convention}</p>
        <p>N {selectedSnapshot.actions.nKn} kN · Vy {selectedSnapshot.actions.vyKn} kN · Vz {selectedSnapshot.actions.vzKn} kN · T {selectedSnapshot.actions.torsionKnm} kN·m · My {selectedSnapshot.actions.myKnm} kN·m · Mz {selectedSnapshot.actions.mzKnm} kN·m</p>
      </div> : null}
    </div> : <p>Selecciona un miembro para elegir su estado, estación y lado.</p>}
  </section>;
}
