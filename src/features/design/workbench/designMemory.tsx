import { FileDown, FolderOpen, Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '../../../design-system/components/controls';
import { Dialog } from '../../../design-system/components/overlays';
import { designCode, isDesignCodeId, type DesignCodeId } from '../../../design/elements/codes';
import type { ExternalStructureAxes, ExternalStructureSource } from '../../../design/elements/structure';
import { BEAM_DEFAULTS, beamReportFromDraft, parseSpans, DEFAULT_SPANS } from './beamModel';
import { COLUMN_DEFAULTS, columnReportFromDraft } from './columnModel';
import { SECTION_DEFAULTS, sectionReportFromDraft } from './concreteStudioModel';
import { verdictHeadline } from './common';
import { reportHeading, stableJson, type DesignElementKind, type DesignReport } from './designReport';
import { FOOTING_DEFAULTS, footingReportFromDraft } from './footingModel';
import { DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, FRAME_LEGACY, externalFor, frameReportFromDraft, parseBays, parseStories } from './frameModel';
import { MAX_MEMORY_ITEMS, isMemoryItem, type WorkbenchMemoryItem, type WorkbenchStorage } from './workbenchStorage';

/**
 * Memoria del proyecto: los elementos que la persona guarda para la memoria de
 * cálculo. Se guarda el borrador (no el resultado) y se recalcula al mostrar o
 * exportar, así que la memoria siempre sale con el motor vigente.
 */
const ELEMENT_LABEL: Record<DesignElementKind, string> = { beam: 'Viga', column: 'Columna', frame: 'Estructura', footing: 'Zapata', section: 'Sección' };
/** Presupuesto del documento para la memoria; el resto queda para los borradores. */
const MEMORY_BUDGET_CHARS = 180_000;

const merge = <T extends Record<string, string>>(defaults: T, fields: Record<string, string>): T => {
  const merged = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = fields[key as string];
    if (typeof value === 'string') merged[key] = value as T[keyof T];
  }
  return merged;
};

type MemoryReport = { readonly ok: true; readonly report: DesignReport } | { readonly ok: false; readonly errors: readonly string[] };

/** Recalcula un elemento guardado; una estructura del Modelo 2D o de un eje del 3D usa el modelo vigente del proyecto. */
export function reportFromMemoryItem(item: WorkbenchMemoryItem, modelSource: ExternalStructureSource | null = null, modelAxes: ExternalStructureAxes | null = null): MemoryReport {
  const code: DesignCodeId = isDesignCodeId(item.code) ? item.code : 'ntc-2023';
  switch (item.element) {
    case 'beam': return beamReportFromDraft(code, merge(BEAM_DEFAULTS, item.fields), parseSpans(item.rows) ?? DEFAULT_SPANS);
    case 'column': return columnReportFromDraft(code, merge(COLUMN_DEFAULTS, item.fields));
    case 'frame': {
      const draft = merge({ ...FRAME_DEFAULTS, ...FRAME_LEGACY }, item.fields);
      return frameReportFromDraft(code, draft, parseBays(item.rows) ?? DEFAULT_BAYS, parseStories(item.levels) ?? DEFAULT_STORIES, externalFor(draft, modelSource, modelAxes));
    }
    case 'footing': return footingReportFromDraft(code, merge(FOOTING_DEFAULTS, item.fields));
    case 'section': return sectionReportFromDraft(code, merge(SECTION_DEFAULTS, item.fields));
  }
}

/** Borrador vigente de un elemento, tal como lo guarda la mesa. */
type MemoryDraft = Pick<WorkbenchMemoryItem, 'fields' | 'rows' | 'levels'>;

function currentDraft(storage: WorkbenchStorage, element: DesignElementKind): MemoryDraft {
  const raw = storage.read(element);
  const fields = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {};
  if (element === 'frame') {
    const bays = storage.read('frame-bays');
    const stories = storage.read('frame-stories');
    return {
      fields,
      rows: Array.isArray(bays) ? bays as Record<string, string>[] : DEFAULT_BAYS.map((bay) => ({ ...bay })),
      levels: Array.isArray(stories) ? stories as Record<string, string>[] : DEFAULT_STORIES.map((story) => ({ ...story })),
    };
  }
  if (element !== 'beam') return { fields };
  const rows = storage.read('beam-spans');
  return { fields, rows: Array.isArray(rows) ? rows as Record<string, string>[] : DEFAULT_SPANS.map((span) => ({ ...span })) };
}

const sameDraft = (item: WorkbenchMemoryItem, draft: MemoryDraft) =>
  stableJson({ fields: item.fields, rows: item.rows ?? null, levels: item.levels ?? null }) === stableJson({ fields: draft.fields, rows: draft.rows ?? null, levels: draft.levels ?? null });

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replaceAll('-', '').slice(0, 12);

interface DesignMemory {
  readonly items: readonly WorkbenchMemoryItem[];
  readonly activeId: string;
  /** El elemento abierto está en la memoria y no tiene cambios sin guardar. */
  readonly saved: boolean;
  readonly active: WorkbenchMemoryItem | undefined;
  save(asNew?: boolean): 'saved' | 'full';
  remove(id: string): void;
  /** Carga un elemento guardado en la mesa (borrador, norma y elemento). */
  open(id: string): WorkbenchMemoryItem | undefined;
  /**
   * Guarda la Estructura de cada eje del Modelo 3D con el borrador vigente (un
   * elemento por eje, con su clave «Eje 1»). Un eje que ya estaba se actualiza.
   */
  saveAxes(axes: readonly { readonly id: string; readonly tag: string }[]): 'saved' | 'full';
}

export function useDesignMemory(storage: WorkbenchStorage, element: DesignElementKind, code: DesignCodeId, revision: unknown): DesignMemory {
  const [items, setItems] = useState<WorkbenchMemoryItem[]>(() => {
    const raw = storage.read('memory');
    return Array.isArray(raw) ? raw.filter(isMemoryItem) : [];
  });
  const [activeId, setActiveId] = useState(() => {
    const raw = storage.read('memory-active');
    return typeof raw === 'string' ? raw : '';
  });
  const commit = useCallback((next: WorkbenchMemoryItem[], nextActive: string) => {
    setItems(next);
    setActiveId(nextActive);
    storage.write('memory', next as unknown as Parameters<WorkbenchStorage['write']>[1]);
    storage.write('memory-active', nextActive);
  }, [storage]);
  const active = items.find((item) => item.id === activeId && item.element === element);
  // `revision` cambia con cada resultado de la mesa: el borrador se vuelve a leer.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const saved = useMemo(() => Boolean(active && active.code === code && sameDraft(active, currentDraft(storage, element))), [active, code, element, storage, revision]);

  return {
    items,
    activeId: active?.id ?? '',
    saved,
    active,
    save(asNew = false) {
      const draft = currentDraft(storage, element);
      const item: WorkbenchMemoryItem = {
        id: !asNew && active ? active.id : newId(),
        element,
        code,
        savedAt: new Date().toISOString(),
        fields: draft.fields,
        ...(draft.rows ? { rows: draft.rows } : {}),
        ...(draft.levels ? { levels: draft.levels } : {}),
      };
      const next = !asNew && active ? items.map((entry) => entry.id === item.id ? item : entry) : [...items, item];
      if (next.length > MAX_MEMORY_ITEMS || JSON.stringify(next).length > MEMORY_BUDGET_CHARS) return 'full';
      commit(next, item.id);
      return 'saved';
    },
    saveAxes(axes) {
      const draft = currentDraft(storage, 'frame');
      const savedAt = new Date().toISOString();
      const next = [...items];
      // El eje abierto se guarda tal cual (con su clave) y queda como el activo de la memoria.
      // Sin eje elegido, la mesa abre el primero (`axisOf`); aquí vale lo mismo.
      // Un eje que ya no existe sigue siendo otro elemento: no se pisa.
      const axisIdOf = (fields: Readonly<Record<string, string>>) => fields.axis ? fields.axis : axes[0]?.id;
      const open = draft.fields.source === 'model3d' ? axisIdOf(draft.fields) : undefined;
      let nextActive = activeId;
      for (const axis of axes) {
        const position = next.findIndex((item) => item.element === 'frame' && item.fields.source === 'model3d' && axisIdOf(item.fields) === axis.id);
        const item: WorkbenchMemoryItem = {
          id: position >= 0 ? next[position]!.id : newId(),
          element: 'frame',
          code,
          savedAt,
          fields: axis.id === open ? draft.fields : { ...draft.fields, source: 'model3d', axis: axis.id, tag: axis.tag },
          ...(draft.rows ? { rows: draft.rows } : {}),
          ...(draft.levels ? { levels: draft.levels } : {}),
        };
        if (position >= 0) next[position] = item; else next.push(item);
        if (axis.id === open) nextActive = item.id;
      }
      if (next.length > MAX_MEMORY_ITEMS || JSON.stringify(next).length > MEMORY_BUDGET_CHARS) return 'full';
      commit(next, nextActive);
      return 'saved';
    },
    remove(id) {
      commit(items.filter((item) => item.id !== id), id === activeId ? '' : activeId);
    },
    open(id) {
      const item = items.find((entry) => entry.id === id);
      if (!item) return undefined;
      storage.write(item.element, item.fields);
      if (item.element === 'frame') {
        if (item.rows) storage.write('frame-bays', item.rows);
        if (item.levels) storage.write('frame-stories', item.levels);
      } else if (item.rows) storage.write('beam-spans', item.rows);
      storage.write('element', item.element);
      if (isDesignCodeId(item.code)) storage.write('code', item.code);
      commit(items, item.id);
      return item;
    },
  };
}

const percent = (ratio: number) => Number.isFinite(ratio) ? `${Math.round(ratio * 100)} %` : '—';
const savedDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

/** Estado de la memoria sobre los resultados: guardado, con cambios o fuera de la memoria. */
export function MemoryStatus({ memory, element, onSave, onOpen }: { memory: DesignMemory; element: DesignElementKind; onSave: () => void; onOpen: () => void }) {
  const text = memory.active
    ? memory.saved ? `Guardado${memory.active.fields.tag ? ` · ${memory.active.fields.tag}` : ''}` : 'Cambios sin guardar'
    : `${ELEMENT_LABEL[element]} sin guardar`;
  return <div className="dw-memory-status" data-state={memory.active ? memory.saved ? 'saved' : 'dirty' : 'none'}>
    <button type="button" className="dw-memory-status__open" onClick={onOpen} title="Abrir la memoria del proyecto">
      <i aria-hidden="true" /><span>{text}</span>
    </button>
    {memory.saved ? null : <button type="button" className="dw-memory-status__save" onClick={onSave}>
      <Save size={13} aria-hidden="true" />Guardar
    </button>}
  </div>;
}

export function MemoryDialog({ open, onOpenChange, memory, element, onLoad, onExport, exporting, message, modelSource = null, modelAxes = null }: {
  open: boolean;
  /** Modelo 2D vigente: las estructuras guardadas desde el modelo se recalculan con él. */
  modelSource?: ExternalStructureSource | null;
  /** Ejes del Modelo 3D vigente, igual. */
  modelAxes?: ExternalStructureAxes | null;
  onOpenChange: (open: boolean) => void;
  memory: DesignMemory;
  element: DesignElementKind;
  /** Abre un elemento guardado en la mesa. */
  onLoad: (id: string) => void;
  onExport: (reports: readonly DesignReport[]) => void;
  exporting: boolean;
  message: string | null;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const rows = useMemo(() => open ? memory.items.map((item) => ({ item, outcome: reportFromMemoryItem(item, modelSource, modelAxes) })) : [], [open, memory.items, modelSource, modelAxes]);
  const reports = rows.flatMap((row) => row.outcome.ok ? [row.outcome.report] : []);
  const invalid = rows.length - reports.length;
  const dirty = Boolean(memory.active && !memory.saved);

  const save = (asNew = false) => {
    setNotice(memory.save(asNew) === 'full' ? `La memoria admite hasta ${MAX_MEMORY_ITEMS} elementos: quita alguno antes de agregar otro.` : null);
  };
  const load = (id: string) => {
    if (dirty && pending !== id) { setPending(id); return; }
    setPending(null);
    onLoad(id);
  };

  return <Dialog open={open} onOpenChange={(next) => { setPending(null); onOpenChange(next); }} title="Memoria del proyecto"
    description="Se recalculan al abrirlos o exportarlos."
    className="dw-memory"
    footer={<>
      {memory.active ? <Button variant="secondary" onClick={() => save(true)} disabled={exporting} leadingIcon={<Plus size={15} aria-hidden="true" />}>Guardar como nuevo</Button> : null}
      <Button variant="secondary" onClick={() => save(false)} disabled={exporting || memory.saved} leadingIcon={<Save size={15} aria-hidden="true" />}>
        {memory.active ? `Guardar ${memory.active.fields.tag || ELEMENT_LABEL[memory.active.element].toLowerCase()}` : `Agregar ${ELEMENT_LABEL[element].toLowerCase()} actual`}
      </Button>
      <Button variant="primary" onClick={() => onExport(reports)} disabled={!reports.length || exporting} leadingIcon={<FileDown size={15} aria-hidden="true" />}>
        {exporting ? 'Generando…' : `Exportar memoria${reports.length ? ` (${reports.length})` : ''}`}
      </Button>
    </>}>
    {notice || message ? <p className="dw-memory__notice" role="status">{notice ?? message}</p> : null}
    {pending ? <div className="dw-memory__confirm" role="alert">
      <p>{`El elemento abierto tiene cambios sin guardar${memory.active?.fields.tag ? ` (${memory.active.fields.tag})` : ''}.`}</p>
      <div>
        <Button size="sm" variant="secondary" onClick={() => { memory.save(false); const id = pending; setPending(null); onLoad(id); }}>Guardar y abrir</Button>
        <Button size="sm" variant="secondary" onClick={() => { const id = pending; setPending(null); onLoad(id); }}>Abrir sin guardar</Button>
        <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
      </div>
    </div> : null}
    {rows.length ? <table className="dw-table dw-memory__table" aria-label="Elementos de la memoria">
      <thead><tr><th scope="col">Elemento</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
      <tbody>{rows.map(({ item, outcome }) => {
        const report = outcome.ok ? outcome.report : null;
        const status = report ? report.status : 'fail';
        return <tr key={item.id} data-active={item.id === memory.activeId || undefined}>
          <th scope="row">
            <strong>{report ? reportHeading(report) : `${item.fields.tag || ELEMENT_LABEL[item.element]} · datos incompletos`}</strong>
            <small>{[item.fields.place, report?.basisLabel ?? designCode(isDesignCodeId(item.code) ? item.code : 'ntc-2023').name, savedDate(item.savedAt)].filter(Boolean).join(' · ')}</small>
          </th>
          <td data-status={status}>{report ? `${verdictHeadline(report.status, report.outOfScope.length > 0)} · ${percent(report.governingRatio)}` : 'No se puede calcular'}</td>
          <td className="dw-memory__actions">
            <button type="button" className="dw-icon-button" onClick={() => load(item.id)} aria-label={`Abrir ${item.fields.tag || ELEMENT_LABEL[item.element]}`} title="Abrir en la mesa">
              <FolderOpen size={15} aria-hidden="true" />
            </button>
            <button type="button" className="dw-icon-button" onClick={() => memory.remove(item.id)} aria-label={`Quitar ${item.fields.tag || ELEMENT_LABEL[item.element]} de la memoria`} title="Quitar de la memoria">
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </td>
        </tr>;
      })}</tbody>
    </table> : <p className="dw-memory__empty">Aún no hay elementos. Diseña uno y agrégalo.</p>}
    {invalid ? <p className="dw-footnote">{`${invalid} ${invalid === 1 ? 'elemento no se puede calcular y queda' : 'elementos no se pueden calcular y quedan'} fuera del PDF.`}</p> : null}
  </Dialog>;
}
