import { describe, expect, it } from 'vitest';
import { filterMemoryRows, normalizeMemorySearch, selectedMemoryReports, type MemoryFilter, type MemoryViewRow } from './designMemoryView';
import type { WorkbenchMemoryItem } from './workbenchStorage';
import type { DesignReport } from './designReport';

const report = (overrides: Partial<DesignReport> = {}): DesignReport => ({
  element: 'beam', title: 'Viga 25 × 50 cm', tag: 'V-Árbol', place: 'Eje Ñ · Planta baja', code: 'ntc-2023', status: 'pass', governingRatio: 0.8,
  memo: '', checks: [], notes: [], outOfScope: [], input: {}, data: [], reinforcement: [], values: [], tables: [], takeoff: { lines: [], concreteM3: 0, steelRatioKgM3: 0, steelKg: 0, basis: '' }, figures: [], ...overrides,
});
const item = (id: string, fields: Record<string, string>, overrides: Partial<WorkbenchMemoryItem> = {}): WorkbenchMemoryItem => ({
  id, element: 'beam', code: 'ntc-2023', savedAt: '2026-10-01', fields, ...overrides,
} as WorkbenchMemoryItem);
const row = (memoryItem: WorkbenchMemoryItem, result: DesignReport | null): MemoryViewRow => ({ item: memoryItem, outcome: result ? { ok: true, report: result } : { ok: false, errors: ['incompleto'] } });
const all: MemoryFilter = { query: '', element: 'all', code: 'all', status: 'all' };

 describe('vista de memoria', () => {
  it('normaliza mayúsculas, minúsculas y tildes', () => {
    expect(normalizeMemorySearch('  ÁRBOL, EJE Ñ  ')).toBe('arbol, eje n');
  });

  it('busca clave, título, ubicación y nombre de norma sin distinguir tildes ni caso', () => {
    const rowWithReport = row(item('a', { tag: 'V-Árbol', place: 'Eje Ñ · Planta baja' }), report());
    expect(filterMemoryRows([rowWithReport], { ...all, query: 'v-arbol' })).toEqual([rowWithReport]);
    expect(filterMemoryRows([rowWithReport], { ...all, query: 'VIGA 25' })).toEqual([rowWithReport]);
    expect(filterMemoryRows([rowWithReport], { ...all, query: 'planta BAJA' })).toEqual([rowWithReport]);
    expect(filterMemoryRows([rowWithReport], { ...all, query: 'NTC-CDMX 2023' })).toEqual([rowWithReport]);
  });

  it('combina filtros de elemento, norma y estado', () => {
    const rows = [
      row(item('a', { tag: 'Viga', place: '' }, { code: 'ntc-2023' }), report()),
      row(item('b', { tag: 'Columna', place: '' }, { element: 'column', code: 'e060' }), report({ element: 'column', code: 'e060', status: 'warning' })),
    ];
    expect(filterMemoryRows(rows, { query: '', element: 'column', code: 'e060', status: 'warning' })).toEqual([rows[1]]);
  });

  it('distingue pasa con alcance parcial y limita estado inválido a datos incompletos', () => {
    const partial = row(item('partial', { tag: 'P-1' }), report({ outOfScope: [{ id: 'cut', label: 'cortante', status: 'warning', demand: 0, capacity: 1, ratio: 0.5, reference: { standard: 'complementary', clauseIds: [], label: 'fuera del alcance' } }] }));
    const invalid = row(item('invalid', { tag: 'I-1' }), null);
    expect(partial.outcome.ok && partial.outcome.report.status).toBe('pass');
    expect(partial.outcome.ok && partial.outcome.report.outOfScope.length).toBeGreaterThan(0);
    expect(filterMemoryRows([partial, invalid], { ...all, status: 'pass' })).toEqual([partial]);
    expect(filterMemoryRows([partial, invalid], { ...all, status: 'invalid' })).toEqual([invalid]);
  });

  it('exporta por selección de ids en orden guardado y omite incompletos sin depender del filtro', () => {
    const first = row(item('first', { tag: '1' }), report({ tag: '1' }));
    const invalid = row(item('bad', { tag: 'x' }), null);
    const last = row(item('last', { tag: '2' }), report({ tag: '2' }));
    expect(selectedMemoryReports([first, invalid, last], new Set(['last', 'bad', 'first']))).toEqual([first.outcome.ok && first.outcome.report, last.outcome.ok && last.outcome.report]);
  });
});
