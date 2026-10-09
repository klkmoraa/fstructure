import { designCode, isDesignCodeId } from '../../../design/elements/codes';
import type { DesignElementKind, DesignReport } from './designReport';
import type { WorkbenchMemoryItem } from './workbenchStorage';

export type MemoryStatusFilter = 'all' | DesignReport['status'] | 'invalid';
export type MemoryFilter = {
  query: string;
  element: 'all' | DesignElementKind;
  code: 'all' | string;
  status: MemoryStatusFilter;
};
export type MemoryViewRow = {
  item: WorkbenchMemoryItem;
  outcome: { ok: true; report: DesignReport } | { ok: false; errors: readonly string[] };
};

export const normalizeMemorySearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

/** Proyecta filas ya calculadas; filtrar no vuelve a ejecutar motores de diseño. */
export function filterMemoryRows(rows: readonly MemoryViewRow[], filters: MemoryFilter): MemoryViewRow[] {
  const query = normalizeMemorySearch(filters.query);
  return rows.filter(({ item, outcome }) => {
    if (filters.element !== 'all' && item.element !== filters.element) return false;
    if (filters.code !== 'all' && item.code !== filters.code) return false;
    if (filters.status !== 'all' && (outcome.ok ? outcome.report.status !== filters.status : filters.status !== 'invalid')) return false;
    if (!query) return true;
    const code = isDesignCodeId(item.code) ? designCode(item.code) : designCode('ntc-2023');
    const searchable = [item.fields.tag, item.fields.place, code.name, item.code, ...(outcome.ok ? [outcome.report.title] : [`${item.fields.tag || item.element} datos incompletos`])];
    return searchable.some((value) => normalizeMemorySearch(value ?? '').includes(query));
  });
}

/** La selección se resuelve contra la memoria completa y conserva su orden guardado. */
export function selectedMemoryReports(rows: readonly MemoryViewRow[], selectedIds: ReadonlySet<string>): DesignReport[] {
  return rows.flatMap(({ item, outcome }) => selectedIds.has(item.id) && outcome.ok ? [outcome.report] : []);
}
