import { Copy, FileDown, FolderOpen, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Field, Select } from '../../../design-system/components/controls';
import { Dialog } from '../../../design-system/components/overlays';
import { DESIGN_CODE_IDS, designCode, isDesignCodeId } from '../../../design/elements/codes';
import type { ExternalStructureAxes, ExternalStructureSource } from '../../../design/elements/structure';
import { verdictHeadline } from './common';
import { reportFromMemoryItem, type DesignMemory } from './designMemory';
import { reportHeading, type DesignElementKind, type DesignReport } from './designReport';
import { filterMemoryRows, selectedMemoryReports, type MemoryFilter, type MemoryStatusFilter, type MemoryViewRow } from './designMemoryView';
import { MAX_MEMORY_ITEMS } from './workbenchStorage';
import './designMemory.css';

const ELEMENT_LABEL: Record<DesignElementKind, string> = { beam: 'Viga', column: 'Columna', frame: 'Estructura', footing: 'Zapata', section: 'Sección' };
const percent = (ratio: number) => Number.isFinite(ratio) ? `${Math.round(ratio * 100)} %` : '—';
const savedDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};
const DEFAULT_FILTER: MemoryFilter = { query: '', element: 'all', code: 'all', status: 'all' };

export function DesignMemoryDialog({ open, onOpenChange, memory, element, onLoad, onExport, exporting, message, modelSource = null, modelAxes = null, onClearMessage }: {
  open: boolean;
  modelSource?: ExternalStructureSource | null;
  modelAxes?: ExternalStructureAxes | null;
  onOpenChange: (open: boolean) => void;
  memory: DesignMemory;
  element: DesignElementKind;
  onLoad: (id: string) => void;
  onExport: (reports: readonly DesignReport[]) => void;
  exporting: boolean;
  message: string | null;
  onClearMessage?: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<MemoryFilter>(DEFAULT_FILTER);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo<MemoryViewRow[]>(() => open ? memory.items.map((item) => ({ item, outcome: reportFromMemoryItem(item, modelSource, modelAxes) })) : [], [open, memory.items, modelSource, modelAxes]);
  const visibleRows = useMemo(() => filterMemoryRows(rows, filters), [rows, filters]);
  const reports = useMemo(() => rows.flatMap((row) => row.outcome.ok ? [row.outcome.report] : []), [rows]);
  const selectedReports = useMemo(() => selectedMemoryReports(rows, selectedIds), [rows, selectedIds]);
  const invalid = rows.length - reports.length;
  const validIds = useMemo(() => new Set(rows.flatMap((row) => row.outcome.ok ? [row.item.id] : [])), [rows]);
  const visibleValidIds = visibleRows.flatMap((row) => row.outcome.ok ? [row.item.id] : []);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [validIds]);

  const changeFilter = <K extends keyof MemoryFilter>(key: K, value: MemoryFilter[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters(DEFAULT_FILTER);
  const setVisibleSelected = () => setSelectedIds((current) => new Set([...current, ...visibleValidIds]));
  const clearSelection = () => setSelectedIds(new Set());
  const toggleSelection = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const save = (asNew = false) => {
    if (memory.save(asNew) === 'full') setNotice(`No hay espacio suficiente para guardar. La memoria admite hasta ${MAX_MEMORY_ITEMS} elementos y el documento tiene un límite de almacenamiento.`);
    else { setNotice(null); onClearMessage?.(); }
  };
  const duplicate = (id: string) => {
    if (memory.duplicate(id) === 'full') setNotice('No hay espacio suficiente para duplicar esta pieza. Quita elementos o libera espacio en el documento.');
    else { setNotice(null); onClearMessage?.(); }
  };
  const remove = (id: string) => {
    const result = memory.remove(id);
    if (result === 'full') setNotice('No hay espacio suficiente para actualizar la memoria en este documento.');
    else { setNotice(null); onClearMessage?.(); }
  };
  const filterActive = filters.query !== '' || filters.element !== 'all' || filters.code !== 'all' || filters.status !== 'all';
  const counts = {
    pass: rows.filter((row) => row.outcome.ok && row.outcome.report.status === 'pass').length,
    warning: rows.filter((row) => row.outcome.ok && row.outcome.report.status === 'warning').length,
    fail: rows.filter((row) => row.outcome.ok && row.outcome.report.status === 'fail').length,
    invalid,
    partial: rows.filter((row) => row.outcome.ok && row.outcome.report.outOfScope.length > 0).length,
  };
  const statusValue: MemoryStatusFilter = filters.status;

  return <Dialog open={open} onOpenChange={onOpenChange} title="Memoria del proyecto"
    description="Se recalculan al abrirlos o exportarlos."
    className="dw-memory"
    footer={<>
      {memory.active ? <Button variant="secondary" onClick={() => save(true)} disabled={exporting} leadingIcon={<Plus size={15} aria-hidden="true" />}>Guardar como nuevo</Button> : null}
      <Button variant="secondary" onClick={() => save(false)} disabled={exporting || memory.saved} leadingIcon={<Save size={15} aria-hidden="true" />}>
        {memory.active ? `Guardar ${memory.active.fields.tag || ELEMENT_LABEL[memory.active.element].toLowerCase()}` : `Agregar ${ELEMENT_LABEL[element].toLowerCase()} actual`}
      </Button>
      <Button variant="secondary" onClick={() => onExport(selectedReports)} disabled={!selectedReports.length || exporting} leadingIcon={<FileDown size={15} aria-hidden="true" />}>
        {exporting ? 'Generando…' : `Exportar selección (${selectedReports.length})`}
      </Button>
      <Button variant="primary" onClick={() => onExport(reports)} disabled={!reports.length || exporting} leadingIcon={<FileDown size={15} aria-hidden="true" />}>
        {exporting ? 'Generando…' : `Exportar memoria (${reports.length})`}
      </Button>
    </>}>
    {notice || message ? <p className="dw-memory__notice" role="status">{notice ?? message}</p> : null}
    <div className="dw-memory__summary" aria-label="Resumen de la memoria">
      <span>{rows.length} {rows.length === 1 ? 'elemento' : 'elementos'}</span><span>{counts.pass} cumple</span><span>{counts.warning} revisión</span><span>{counts.fail} no cumple</span><span>{counts.invalid} incompletos</span>
      {counts.partial ? <span>{counts.partial} con alcance parcial</span> : null}
    </div>
    <div className="dw-memory__filters" aria-label="Filtros de memoria">
      <Field type="search" label="Buscar en memoria" aria-label="Buscar en memoria" value={filters.query} onChange={(event) => changeFilter('query', event.currentTarget.value)} />
      <Select label="Elemento" aria-label="Filtrar por elemento" value={filters.element} onChange={(event) => changeFilter('element', event.currentTarget.value as MemoryFilter['element'])}>
        <option value="all">Todos los elementos</option>{Object.entries(ELEMENT_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </Select>
      <Select label="Norma" aria-label="Filtrar por norma" value={filters.code} onChange={(event) => changeFilter('code', event.currentTarget.value)}>
        <option value="all">Todas las normas</option>{DESIGN_CODE_IDS.map((id) => <option key={id} value={id}>{designCode(id).name}</option>)}
      </Select>
      <Select label="Estado" aria-label="Filtrar por estado" value={statusValue} onChange={(event) => changeFilter('status', event.currentTarget.value as MemoryStatusFilter)}>
        <option value="all">Todos los estados</option><option value="pass">Cumple</option><option value="warning">Revisión pendiente</option><option value="fail">No cumple</option><option value="invalid">Datos incompletos</option>
      </Select>
    </div>
    <div className="dw-memory__selection">
      <span aria-live="polite">{selectedReports.length} seleccionados</span>
      <Button variant="secondary" size="sm" onClick={setVisibleSelected} disabled={!visibleValidIds.length}>Seleccionar visibles</Button>
      <Button variant="ghost" size="sm" onClick={clearSelection} disabled={!selectedIds.size}>Limpiar selección</Button>
      {filterActive ? <Button variant="ghost" size="sm" onClick={clearFilters}>Limpiar filtros</Button> : null}
    </div>
    {rows.length ? visibleRows.length ? <div className="dw-memory__table-wrap"><table className="dw-table dw-memory__table" aria-label="Elementos de la memoria">
      <thead><tr><th scope="col">Selección</th><th scope="col">Elemento</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
      <tbody>{visibleRows.map(({ item, outcome }) => {
        const report = outcome.ok ? outcome.report : null;
        const status = report ? report.status : 'invalid';
        const label = item.fields.tag || ELEMENT_LABEL[item.element];
        const code = isDesignCodeId(item.code) ? designCode(item.code) : designCode('ntc-2023');
        return <tr key={item.id} data-active={item.id === memory.activeId || undefined}>
          <td className="dw-memory__check">{report ? <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelection(item.id)} aria-label={`Seleccionar ${label}`} /> : <span className="dw-memory__not-selectable" aria-label={`${label}: datos incompletos, excluido de selección`}>—</span>}</td>
          <th scope="row">
            <strong>{report ? reportHeading(report) : `${label} · datos incompletos`}</strong>
            <small>{[item.fields.place, report?.basisLabel ?? code.name, savedDate(item.savedAt)].filter(Boolean).join(' · ')}</small>
          </th>
          <td data-status={status}>{report ? `${verdictHeadline(report.status, report.outOfScope.length > 0)} · ${percent(report.governingRatio)}` : 'No se puede calcular'}</td>
          <td className="dw-memory__actions">
            <button type="button" className="dw-icon-button" onClick={() => onLoad(item.id)} aria-label={`Abrir ${label}`} title="Abrir en la mesa"><FolderOpen size={15} aria-hidden="true" /></button>
            <button type="button" className="dw-icon-button" onClick={() => duplicate(item.id)} aria-label={`Duplicar ${label}`} title="Duplicar pieza"><Copy size={15} aria-hidden="true" /></button>
            <button type="button" className="dw-icon-button" onClick={() => remove(item.id)} aria-label={`Quitar ${label} de la memoria`} title="Quitar de la memoria"><Trash2 size={15} aria-hidden="true" /></button>
          </td>
        </tr>;
      })}</tbody>
    </table></div> : <div className="dw-memory__empty"><p>No hay coincidencias con estos filtros.</p><Button variant="secondary" size="sm" onClick={clearFilters}>Restablecer filtros</Button></div>
      : <p className="dw-memory__empty">Aún no hay elementos. Diseña uno y agrégalo.</p>}
    {invalid ? <p className="dw-footnote">{`${invalid} ${invalid === 1 ? 'elemento incompleto se excluye' : 'elementos incompletos se excluyen'} de la selección y del PDF.`}</p> : null}
  </Dialog>;
}
