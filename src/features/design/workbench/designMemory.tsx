import { Copy, FileDown, FolderOpen, Plus, Save, Trash2 } from 'lucide-react';
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
import type { DesignStart } from './designStarts';

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

const ELEMENT_DEFAULT_FIELDS: Record<DesignElementKind, Record<string, string>> = {
  beam: BEAM_DEFAULTS,
  column: COLUMN_DEFAULTS,
  frame: { ...FRAME_DEFAULTS, ...FRAME_LEGACY },
  footing: FOOTING_DEFAULTS,
  section: SECTION_DEFAULTS,
};

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

/** Sólo conserva borradores que ya existen en storage; los defaults iniciales no son piezas. */
function hasStoredDraft(storage: WorkbenchStorage, element: DesignElementKind): boolean {
  const raw = storage.read(element);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)
    && Object.values(raw as Record<string, unknown>).some((value) => typeof value === 'string')) return true;
  if (element === 'beam') return Array.isArray(storage.read('beam-spans'));
  if (element === 'frame') return Array.isArray(storage.read('frame-bays')) || Array.isArray(storage.read('frame-stories'));
  return false;
}

const sameDraft = (item: WorkbenchMemoryItem, draft: MemoryDraft) => {
  const defaultRows = item.element === 'beam' ? DEFAULT_SPANS : item.element === 'frame' ? DEFAULT_BAYS : undefined;
  const defaultLevels = item.element === 'frame' ? DEFAULT_STORIES : undefined;
  const normalizeFields = (fields: Record<string, string>) => ({ ...ELEMENT_DEFAULT_FIELDS[item.element], ...fields });
  return stableJson({ fields: normalizeFields(item.fields), rows: item.rows ?? defaultRows ?? null, levels: item.levels ?? defaultLevels ?? null })
    === stableJson({ fields: normalizeFields(draft.fields), rows: draft.rows ?? defaultRows ?? null, levels: draft.levels ?? defaultLevels ?? null });
};

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replaceAll('-', '').slice(0, 12);

const uniqueId = (items: readonly WorkbenchMemoryItem[]) => {
  const ids = new Set(items.map((item) => item.id));
  let id = newId();
  while (ids.has(id)) id = newId();
  return id;
};

const uniqueCopyTag = (tag: string | undefined, items: readonly WorkbenchMemoryItem[]) => {
  const used = new Set(items.map((item) => item.fields.tag).filter((value): value is string => Boolean(value)));
  const base = (tag ?? '').trim();
  for (let copy = 1; ; copy += 1) {
    const suffix = copy === 1 ? ' · copia' : ` · copia ${copy}`;
    const candidate = `${base.slice(0, Math.max(0, 32 - suffix.length)).trimEnd()}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
};

interface DesignMemory {
  readonly items: readonly WorkbenchMemoryItem[];
  readonly activeId: string;
  /** El elemento abierto está en la memoria y no tiene cambios sin guardar. */
  readonly saved: boolean;
  readonly active: WorkbenchMemoryItem | undefined;
  save(asNew?: boolean): 'saved' | 'full';
  remove(id: string): 'removed' | 'full' | 'missing';
  /** Carga un elemento guardado en la mesa (borrador, norma y elemento). */
  open(id: string): WorkbenchMemoryItem | 'full' | undefined;
  /** Crea una copia independiente sin abrirla ni cambiar la pieza activa. */
  duplicate(id: string): 'duplicated' | 'full' | 'missing';
  /**
   * Guarda la Estructura de cada eje del Modelo 3D con el borrador vigente (un
   * elemento por eje, con su clave «Eje 1»). Un eje que ya estaba se actualiza.
   */
  saveAxes(axes: readonly { readonly id: string; readonly tag: string }[]): 'saved' | 'full';
  /** Conserva borradores afectados y prepara un arranque sin cambiar la norma ni el modelo. */
  start(start: DesignStart): 'started' | 'full';
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
  const commit = useCallback((next: WorkbenchMemoryItem[], nextActive: string, additionalWrites: Record<string, Parameters<WorkbenchStorage['write']>[1]> = {}) => {
    if (next.length > MAX_MEMORY_ITEMS || !next.every(isMemoryItem)
      || new Set(next.map((item) => item.id)).size !== next.length) return false;
    try {
      if (JSON.stringify(next).length > MEMORY_BUDGET_CHARS) return false;
    } catch {
      return false;
    }
    const writes = {
      ...additionalWrites,
      memory: next as unknown as Parameters<WorkbenchStorage['write']>[1],
      'memory-active': nextActive,
    };
    if (storage.canWrite && !storage.canWrite(writes)) return false;
    setItems(next);
    setActiveId(nextActive);
    for (const [key, value] of Object.entries(writes)) storage.write(key, value);
    return true;
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
        id: !asNew && active ? active.id : uniqueId(items),
        element,
        code,
        savedAt: new Date().toISOString(),
        fields: structuredClone(draft.fields),
        ...(draft.rows ? { rows: structuredClone(draft.rows) } : {}),
        ...(draft.levels ? { levels: structuredClone(draft.levels) } : {}),
      };
      const next = !asNew && active ? items.map((entry) => entry.id === item.id ? item : entry) : [...items, item];
      return commit(next, item.id) ? 'saved' : 'full';
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
          id: position >= 0 ? next[position]!.id : uniqueId(next),
          element: 'frame',
          code,
          savedAt,
          fields: axis.id === open ? draft.fields : { ...draft.fields, source: 'model3d', axis: axis.id, tag: axis.tag },
          ...(draft.rows ? { rows: structuredClone(draft.rows) } : {}),
          ...(draft.levels ? { levels: structuredClone(draft.levels) } : {}),
        };
        if (position >= 0) next[position] = item; else next.push(item);
        if (axis.id === open) nextActive = item.id;
      }
      return commit(next, nextActive) ? 'saved' : 'full';
    },
    start(start) {
      const preserve = new Map<DesignElementKind, MemoryDraft>();
      if (hasStoredDraft(storage, element)) preserve.set(element, currentDraft(storage, element));
      if (!preserve.has(start.element) && hasStoredDraft(storage, start.element)) preserve.set(start.element, currentDraft(storage, start.element));

      const next = [...items];
      const savedAt = new Date().toISOString();
      for (const [kind, draft] of preserve) {
        const duplicate = next.some((item) => item.element === kind && item.code === code && sameDraft(item, draft));
        if (duplicate) continue;
        next.push({
          id: uniqueId(next), element: kind, code, savedAt,
          fields: structuredClone(draft.fields),
          ...(draft.rows ? { rows: structuredClone(draft.rows) } : {}),
          ...(draft.levels ? { levels: structuredClone(draft.levels) } : {}),
        });
      }
      const writes: Record<string, Parameters<WorkbenchStorage['write']>[1]> = {
        element: start.element,
      };
      if (start.source) {
        const existing = storage.read('frame');
        const fields = existing && typeof existing === 'object' && !Array.isArray(existing)
          ? Object.fromEntries(Object.entries(existing as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
          : {};
        writes.frame = { ...fields, source: start.source };
      } else {
        writes[start.element] = start.fields;
      }
      if (start.rows) {
        writes[start.element === 'frame' ? 'frame-bays' : 'beam-spans'] = start.rows;
      }
      if (start.levels) writes['frame-stories'] = start.levels;
      return commit(next, '', writes) ? 'started' : 'full';
    },
    remove(id) {
      if (!items.some((item) => item.id === id)) return 'missing';
      return commit(items.filter((item) => item.id !== id), id === activeId ? '' : activeId) ? 'removed' : 'full';
    },
    open(id) {
      const item = items.find((entry) => entry.id === id);
      if (!item) return undefined;
      const preserve = new Map<DesignElementKind, MemoryDraft>();
      if (hasStoredDraft(storage, element)) preserve.set(element, currentDraft(storage, element));
      if (!preserve.has(item.element) && hasStoredDraft(storage, item.element)) preserve.set(item.element, currentDraft(storage, item.element));
      const next = [...items];
      const savedAt = new Date().toISOString();
      for (const [kind, draft] of preserve) {
        if (next.some((entry) => entry.element === kind && entry.code === code && sameDraft(entry, draft))) continue;
        next.push({
          id: uniqueId(next), element: kind, code, savedAt,
          fields: structuredClone(draft.fields),
          ...(draft.rows ? { rows: structuredClone(draft.rows) } : {}),
          ...(draft.levels ? { levels: structuredClone(draft.levels) } : {}),
        });
      }
      const writes: Record<string, Parameters<WorkbenchStorage['write']>[1]> = {
        [item.element]: structuredClone(item.fields),
        element: item.element,
      };
      if (item.element === 'frame') {
        writes['frame-bays'] = structuredClone(item.rows ?? DEFAULT_BAYS);
        writes['frame-stories'] = structuredClone(item.levels ?? DEFAULT_STORIES);
      } else if (item.element === 'beam') {
        writes['beam-spans'] = structuredClone(item.rows ?? DEFAULT_SPANS) as unknown as Parameters<WorkbenchStorage['write']>[1];
      }
      if (isDesignCodeId(item.code)) writes.code = item.code;
      if (!commit(next, item.id, writes)) return 'full';
      return item;
    },
    duplicate(id) {
      const source = items.find((item) => item.id === id);
      if (!source) return 'missing';
      const fields = structuredClone(source.fields);
      fields.tag = uniqueCopyTag(fields.tag, items);
      const copy: WorkbenchMemoryItem = {
        ...structuredClone(source), id: uniqueId(items), savedAt: new Date().toISOString(), fields,
      };
      return commit([...items, copy], activeId) ? 'duplicated' : 'full';
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
  const [notice, setNotice] = useState<string | null>(null);
  const rows = useMemo(() => open ? memory.items.map((item) => ({ item, outcome: reportFromMemoryItem(item, modelSource, modelAxes) })) : [], [open, memory.items, modelSource, modelAxes]);
  const reports = rows.flatMap((row) => row.outcome.ok ? [row.outcome.report] : []);
  const invalid = rows.length - reports.length;
  const save = (asNew = false) => {
    setNotice(memory.save(asNew) === 'full' ? `No hay espacio suficiente para guardar. La memoria admite hasta ${MAX_MEMORY_ITEMS} elementos y el documento tiene un límite de almacenamiento.` : null);
  };
  const load = (id: string) => {
    onLoad(id);
  };
  const duplicate = (id: string) => {
    const outcome = memory.duplicate(id);
    setNotice(outcome === 'full' ? 'No hay espacio suficiente para duplicar esta pieza. Quita elementos o libera espacio en el documento.' : null);
  };
  const remove = (id: string) => {
    const outcome = memory.remove(id);
    setNotice(outcome === 'full' ? 'No hay espacio suficiente para actualizar la memoria en este documento.' : null);
  };

  return <Dialog open={open} onOpenChange={onOpenChange} title="Memoria del proyecto"
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
            <button type="button" className="dw-icon-button" onClick={() => duplicate(item.id)} aria-label={`Duplicar ${item.fields.tag || ELEMENT_LABEL[item.element]}`} title="Duplicar pieza">
              <Copy size={15} aria-hidden="true" />
            </button>
            <button type="button" className="dw-icon-button" onClick={() => remove(item.id)} aria-label={`Quitar ${item.fields.tag || ELEMENT_LABEL[item.element]} de la memoria`} title="Quitar de la memoria">
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </td>
        </tr>;
      })}</tbody>
    </table> : <p className="dw-memory__empty">Aún no hay elementos. Diseña uno y agrégalo.</p>}
    {invalid ? <p className="dw-footnote">{`${invalid} ${invalid === 1 ? 'elemento no se puede calcular y queda' : 'elementos no se pueden calcular y quedan'} fuera del PDF.`}</p> : null}
  </Dialog>;
}
