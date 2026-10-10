// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import { DesignWorkbench } from './DesignWorkbench';
import { FOOTING_DEFAULTS } from './footingModel';
import { DESIGN_WORKBENCH_SCHEMA_VERSION, WORKBENCH_DOCUMENT_KIND, WorkbenchStorageContext, browserWorkbenchStorage, createProjectWorkbenchStorage, parseWorkbenchDocument } from './workbenchStorage';
import { inspectDesignDocument } from '../../../shared/project/designWorkbenchCodec';
import { useStoredDraft } from './common';

const workbenchDoc = (entries: Record<string, unknown>, schemaVersion = 6) => ({ kind: WORKBENCH_DOCUMENT_KIND, schemaVersion, entries });

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('design workbench document', () => {
  it('retains legacy raw draft strings while editing a known field', () => {
    const entries: Record<string, unknown> = { beam: { width: '25', legacyLoad: 'yes' } };
    const storage = { read: (key: string) => entries[key], write: (key: string, value: unknown) => { entries[key] = value; } };
    const hook = renderHook(() => useStoredDraft('beam', { width: '', height: '' }), {
      wrapper: ({ children }) => <WorkbenchStorageContext.Provider value={storage as never}>{children}</WorkbenchStorageContext.Provider>,
    });
    act(() => hook.result.current.set('width')('30'));
    expect(entries.beam).toEqual({ width: '30', height: '', legacyLoad: 'yes' });
    expect((hook.result.current.draft as Record<string, string>).legacyLoad).toBe('yes');
  });

  it('keeps an incompatible future document read-only and byte-for-byte available', async () => {
    const raw = { kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 12, entries: { future: { nested: [1, true] } } };
    const persist = vi.fn();
    const storage = createProjectWorkbenchStorage(raw, persist, 60_000);
    expect(storage.readOnlyReason).toMatch(/12/);
    expect(storage.commitBatch!({ code: 'ntc-2023' })).toMatchObject({ accepted: false });
    expect(storage.write('code', 'ntc-2023')).toBe(false);
    storage.flush();
    expect(storage.rawDocument).toEqual(raw);
    expect(persist).not.toHaveBeenCalled();
    storage.dispose();
  });

  it('rejects an over-budget multi-entry batch without applying a partial write', () => {
    const entries = Object.fromEntries(Array.from({ length: 15 }, (_, index) => [`f${index}`, Object.fromEntries(
      Array.from({ length: 96 }, (_, field) => [`k${field}`, 'x'.repeat(32)]),
    )]));
    const storage = createProjectWorkbenchStorage(workbenchDoc(entries), vi.fn(), 60_000);
    const before = storage.rawDocument;
    const result = storage.commitBatch!({ extra: 'short', another: 'short' });
    expect(result.accepted).toBe(false);
    expect(storage.rawDocument).toEqual(before);
    expect(storage.read('extra')).toBeUndefined();
    storage.dispose();
  });

  it('uses valid bounded near-budget data to reject only the combined update batch', () => {
    const memoryFields = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`f${index}`.padEnd(32, 'k'), 'v'.repeat(32)]));
    const memory = Array.from({ length: 60 }, (_, index) => ({ id: `m${index}`, element: 'beam', code: 'ntc-2023', savedAt: '2026-10-09', fields: memoryFields }));
    const fullRow = Object.fromEntries(Array.from({ length: 96 }, (_, index) => [`f${index}`.padEnd(32, 'k'), 'x'.repeat(32)]));
    const entries = { memory, ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`row${index}`, fullRow])), lastA: 'a', lastB: 'b' };
    const initial = workbenchDoc(entries);
    const serializedLength = JSON.stringify(initial).length;
    expect(serializedLength).toBeLessThan(240_000);
    expect(serializedLength).toBeGreaterThan(220_000);
    expect(inspectDesignDocument(initial).status).toBe('supported');
    const large = (key: string) => {
      const candidate = createProjectWorkbenchStorage(initial, vi.fn(), 60_000);
      const result = candidate.commitBatch!({ [key]: fullRow });
      candidate.dispose();
      return result;
    };
    expect(large('lastA').accepted).toBe(true);
    expect(large('lastB').accepted).toBe(true);
    const storage = createProjectWorkbenchStorage(initial, vi.fn(), 60_000);
    const before = storage.rawDocument;
    expect(storage.commitBatch!({ lastA: fullRow, lastB: fullRow }).accepted).toBe(false);
    expect(storage.rawDocument).toEqual(before);
    storage.dispose();
  });

  it('rolls browser fallback keys back after a localStorage quota failure', () => {
    window.localStorage.clear();
    window.localStorage.setItem('fstructure.design-workbench.code', '"e060"');
    const original = Storage.prototype.setItem;
    let calls = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      calls += 1;
      if (calls === 2) throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    const result = browserWorkbenchStorage.commitBatch!({ code: 'ntc-2023', element: 'column' });
    expect(result.accepted).toBe(false);
    expect(window.localStorage.getItem('fstructure.design-workbench.code')).toBe('"e060"');
    expect(window.localStorage.getItem('fstructure.design-workbench.element')).toBeNull();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('keeps failed sink data pending and retry saves its complete current snapshot', async () => {
    let failing = true;
    const saved: JsonValue[] = [];
    const storage = createProjectWorkbenchStorage(workbenchDoc({}), async (document) => {
      if (failing) throw new Error('sink failed');
      saved.push(document);
    }, 60_000);
    expect(storage.commitBatch!({ beam: { moment: '10' } }).accepted).toBe(true);
    await expect(storage.flush()).rejects.toThrow('sink failed');
    expect(storage.saveState).toMatchObject({ status: 'failed', pending: true });
    failing = false;
    await storage.retry();
    expect(storage.saveState).toMatchObject({ status: 'saved', pending: false });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(workbenchDoc({ beam: { moment: '10' } }, DESIGN_WORKBENCH_SCHEMA_VERSION));
    storage.dispose();
  });

  it('does not let an older save completion clear a newer pending revision', async () => {
    let resolveFirst!: () => void;
    const persisted: JsonValue[] = [];
    const storage = createProjectWorkbenchStorage(workbenchDoc({}), (document) => {
      persisted.push(document);
      if (persisted.length === 1) return new Promise<void>((resolve) => { resolveFirst = resolve; });
    }, 60_000);
    storage.commitBatch!({ beam: { moment: '10' } });
    const firstFlush = storage.flush();
    storage.commitBatch!({ beam: { moment: '20' } });
    resolveFirst();
    await firstFlush;
    expect(storage.saveState).toMatchObject({ status: 'pending', pending: true });
    await storage.flush();
    expect(storage.saveState).toMatchObject({ status: 'saved', pending: false });
    expect(persisted).toHaveLength(2);
    expect(persisted[1]).toEqual(workbenchDoc({ beam: { moment: '20' } }, DESIGN_WORKBENCH_SCHEMA_VERSION));
    storage.dispose();
  });

  it('migrates v2 memory and retains the section studio draft and memory in v7', () => {
    const old = { id: 'a1', element: 'column', code: 'ntc-2023', savedAt: '2026-09-27', fields: { tag: 'C-1', width: '40' } };
    const section = { id: 'a2', element: 'section', code: 'ntc-2023', savedAt: '2026-10-01', fields: { tag: 'S-1', shape: 'octagonal', philosophy: 'allowable', cover: '4' } };
    const persist = vi.fn<(value: JsonValue) => void>();
    const storage = createProjectWorkbenchStorage(workbenchDoc({ memory: [old] }, 2), persist);
    storage.write('section', section.fields);
    storage.write('memory', [old, section]);
    storage.flush();
    const document = persist.mock.calls[0]?.[0] as { schemaVersion: number; entries: Record<string, JsonValue> };
    expect(document.schemaVersion).toBe(7);
    expect(parseWorkbenchDocument(document)).toEqual({ memory: [old, section], section: section.fields });
    storage.dispose();
  });

  it('keeps incomplete flexure inputs and flexure memory in schema v7', () => {
    const flexure = { tag: '', moment: '', width: '', height: '', fc: '', fy: '', cover: '4', objective: 'required' };
    const memory = [{ id: 'f1', element: 'flexure', code: 'ntc-2023', savedAt: '2026-10-10', fields: flexure }];
    const persist = vi.fn<(value: JsonValue) => void>();
    const storage = createProjectWorkbenchStorage(workbenchDoc({ flexure, memory }), persist);
    expect(storage.read('flexure')).toEqual(flexure);
    expect(storage.read('memory')).toEqual(memory);
    storage.write('flexure', { ...flexure, moment: '0' });
    storage.flush();
    const document = persist.mock.calls[0]?.[0] as { schemaVersion: number; entries: Record<string, JsonValue> };
    expect(document.schemaVersion).toBe(7);
    expect((parseWorkbenchDocument(document).flexure as Record<string, string>).moment).toBe('0');
    storage.dispose();
  });

  it('rejects the whole known document when any entry is invalid', () => {
    const parsed = parseWorkbenchDocument(workbenchDoc({
      code: 'nsr-10',
      beam: { width: '30', supportWidth: '45' },
      'beam-spans': [{ length: '5', dead: '10' }],
      nested: { deep: { value: '1' } },
      numbers: 5,
      long: 'x'.repeat(40),
      'Bad Key': 'no',
    }));
    expect(parsed).toEqual({});
  });

  it('reads v1 drafts and keeps a valid project memory', () => {
    expect(parseWorkbenchDocument(workbenchDoc({ code: 'e060', beam: { width: '30' } }, 1))).toEqual({ code: 'e060', beam: { width: '30' } });
    const memory = [
      { id: 'a1', element: 'beam', code: 'ntc-2023', savedAt: '2026-09-27T10:00:00.000Z', fields: { tag: 'V-1', width: '25' }, rows: [{ length: '5' }] },
      { id: 'a2', element: 'column', code: 'nsr-10', savedAt: '2026-09-27T10:01:00.000Z', fields: { tag: 'C-1' } },
    ];
    expect(parseWorkbenchDocument(workbenchDoc({ memory })).memory).toEqual(memory);
    expect(parseWorkbenchDocument(workbenchDoc({ memory: [{ ...memory[0], element: 'slab' }] })).memory).toBeUndefined();
    expect(parseWorkbenchDocument(workbenchDoc({ memory: [memory[0], memory[0]] })).memory).toBeUndefined();
    expect(parseWorkbenchDocument(workbenchDoc({ notMemory: memory })).notMemory).toBeUndefined();
  });

  it('keeps v3 documents and stores frames with their bays and levels in v7', () => {
    const beam = { id: 'a1', element: 'beam', code: 'ntc-2023', savedAt: '2026-09-27', fields: { tag: 'V-1' }, rows: [{ length: '5' }] };
    const persist = vi.fn<(value: JsonValue) => void>();
    const storage = createProjectWorkbenchStorage(workbenchDoc({ code: 'e060', memory: [beam] }, 3), persist);
    const frame = {
      id: 'a2', element: 'frame', code: 'e060', savedAt: '2026-10-03', fields: { tag: 'P-1', beamHeight: '55', proposalBars: 'yes' },
      rows: [{ length: '5' }, { length: '4' }], levels: [{ height: '3.5', dead: '22', live: '7.6', lateral: '60', beamWidth: '30', beamHeight: '45', columnWidth: '40', columnHeight: '40' }],
    };
    storage.write('frame-bays', frame.rows);
    storage.write('frame-stories', frame.levels);
    storage.write('memory', [beam, frame]);
    storage.flush();
    const document = persist.mock.calls[0]?.[0] as { schemaVersion: number };
    expect(document.schemaVersion).toBe(7);
    expect(parseWorkbenchDocument(document)).toEqual({ code: 'e060', memory: [beam, frame], 'frame-bays': frame.rows, 'frame-stories': frame.levels });
    // Un nivel con una forma inesperada invalida la memoria, no la reinterpreta.
    expect(parseWorkbenchDocument(workbenchDoc({ memory: [{ ...frame, levels: [{ height: 3 }] }] })).memory).toBeUndefined();
    storage.dispose();
  });

  it('rejects foreign or oversized documents without throwing', () => {
    expect(parseWorkbenchDocument(null)).toEqual({});
    expect(parseWorkbenchDocument({ kind: 'other', schemaVersion: 1, entries: {} })).toEqual({});
    expect(parseWorkbenchDocument({ ...workbenchDoc({}), schemaVersion: 8 })).toEqual({});
    expect(parseWorkbenchDocument(workbenchDoc({ wide: Object.fromEntries(Array.from({ length: 97 }, (_, index) => [`f${index}`, 'x'])) }))).toEqual({});
    const fields = Object.fromEntries(Array.from({ length: 96 }, (_, index) => [`f${index}`.padEnd(32, 'k'), 'x'.repeat(32)]));
    const huge = { memory: Array.from({ length: 60 }, (_, index) => ({ id: `m${index}`, element: 'beam', code: 'ntc-2023', savedAt: '2026-09-27', fields })) };
    expect(parseWorkbenchDocument(workbenchDoc(huge))).toEqual({});
  });

  it('roundtrips all 79 footing draft fields and a memory item while allowing at most 96 fields per record', () => {
    expect(Object.keys(FOOTING_DEFAULTS)).toHaveLength(79);
    const memory = [{ id: 'footing-1', element: 'footing', code: 'ntc-2023', savedAt: '2026-10-01', fields: { ...FOOTING_DEFAULTS } }];
    const persist = vi.fn<(value: JsonValue) => void>();
    const storage = createProjectWorkbenchStorage(workbenchDoc({}), persist, 0);
    storage.write('footing', FOOTING_DEFAULTS);
    storage.write('memory', memory);
    storage.flush();
    const document = persist.mock.calls[0]?.[0];
    expect(parseWorkbenchDocument(document)).toEqual({ footing: FOOTING_DEFAULTS, memory });
    const excessive = Object.fromEntries(Array.from({ length: 97 }, (_, index) => [`f${index}`, 'x']));
    expect(parseWorkbenchDocument(workbenchDoc({ footing: excessive }))).toEqual({});
    storage.dispose();
  });

  it.each([1, 2, 3, 4, 5, 6, 7])('retains workshop document compatibility for schema v%d', (schemaVersion) => {
    expect(parseWorkbenchDocument(workbenchDoc({ code: 'e060', beam: { width: '30' } }, schemaVersion))).toEqual({ code: 'e060', beam: { width: '30' } });
  });

  it('batches writes and persists the whole document once', async () => {
    vi.useFakeTimers();
    const persist = vi.fn<(value: JsonValue) => void>();
    const storage = createProjectWorkbenchStorage(workbenchDoc({ code: 'e060' }), persist, 500);
    expect(storage.read('code')).toBe('e060');
    storage.write('element', 'column');
    storage.write('column', { width: '40' });
    storage.write('column', { width: '40' });
    expect(persist).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenLastCalledWith(workbenchDoc({ code: 'e060', element: 'column', column: { width: '40' } }, 7));
    storage.write('code', 'ntc-2023');
    await storage.flush();
    expect(persist).toHaveBeenCalledTimes(2);
    storage.write('column', { nested: { value: 1 } } as unknown as JsonValue);
    storage.dispose();
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('preflights all combined entries without changing a full 16-entry document', () => {
    const entries = Object.fromEntries(Array.from({ length: 16 }, (_, index) => [`extra-${index}`, `v${index}`]));
    const persist = vi.fn<(value: JsonValue) => void>();
    const storage = createProjectWorkbenchStorage(workbenchDoc(entries), persist);

    expect(storage.canWrite?.({ memory: [], 'memory-active': '' })).toBe(false);
    expect(storage.read('extra-0')).toBe('v0');
    expect(storage.read('memory')).toBeUndefined();
    storage.flush();
    expect(persist).not.toHaveBeenCalled();
    storage.dispose();
  });

  it('exports v6 entries in v7 without losing legacy fields', () => {
    const persist = vi.fn<(value: JsonValue) => void>();
    const storage = createProjectWorkbenchStorage(workbenchDoc({ beam: { legacy: 'yes' } }, 6), persist, 0);
    storage.write('beam-details', { kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [] } as unknown as JsonValue);
    storage.flush();
    const document = persist.mock.calls[0]?.[0] as { schemaVersion: number; entries: Record<string, JsonValue> };
    expect(document.schemaVersion).toBe(7);
    expect(document.entries.beam).toEqual({ legacy: 'yes' });
    expect(parseWorkbenchDocument(document)['beam-details']).toEqual({ kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [] });
    storage.dispose();
  });

  it('accepts only bounded structured beam details and rejects other element keys', () => {
    const empty = { kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [] };
    const load = { id: 'L', span: '1', kind: 'point', category: 'dead', start: '0', end: '0', startValue: '', endValue: '' };
    expect(parseWorkbenchDocument(workbenchDoc({ 'beam-details': empty }, 7))['beam-details']).toEqual(empty);
    expect(parseWorkbenchDocument(workbenchDoc({ 'column-details': empty }, 7))['column-details']).toBeUndefined();
    const columnWithDetails = [{ id: 'C1', element: 'column', code: 'ntc-2023', savedAt: '2026-10-09', fields: {}, details: empty }];
    expect(parseWorkbenchDocument(workbenchDoc({ memory: columnWithDetails }, 7)).memory).toBeUndefined();
    const tooMany = { ...empty, loads: Array.from({ length: 33 }, () => load) };
    const tooLong = { ...empty, loads: [{ ...load, startValue: '1'.repeat(33) }] };
    expect(parseWorkbenchDocument(workbenchDoc({ 'beam-details': tooMany }, 7))['beam-details']).toBeUndefined();
    expect(parseWorkbenchDocument(workbenchDoc({ 'beam-details': tooLong }, 7))['beam-details']).toBeUndefined();
  });

  it('opens the workbench with the code stored in the project', () => {
    const storage = createProjectWorkbenchStorage(workbenchDoc({ code: 'nsr-10', element: 'column' }), () => undefined);
    render(<WorkbenchStorageContext.Provider value={storage}><DesignWorkbench nativeTool={false} /></WorkbenchStorageContext.Provider>);
    expect((screen.getByLabelText('Norma de diseño') as HTMLSelectElement).value).toBe('nsr-10');
    expect(screen.getByRole('heading', { name: 'Columna' })).toBeTruthy();
    storage.dispose();
  });
});

 it('migra v5 sin perder borradores y rechaza memorias de acero inválidas', () => {
  const persist = vi.fn();
  const storage = createProjectWorkbenchStorage(workbenchDoc({ code: 'e060', 'frame-stories': [{ beamWidth: '30' }] }, 5), persist);
  const selection = { memberId: 'barra-' + 'x'.repeat(150), combinationId: 'U', savedAt: '2026-10-04T10:00:00Z' };
  storage.write('steel-memory', [selection]); storage.flush();
  expect(parseWorkbenchDocument(persist.mock.calls[0]![0])).toEqual({ code: 'e060', 'frame-stories': [{ beamWidth: '30' }], 'steel-memory': [selection] });
  for (const invalid of [[{ ...selection, savedAt: 'bad' }], [{ ...selection, result: 100 }], [selection, selection], 'bad', [{ ...selection, combinationId: '' }]]) {
    expect(parseWorkbenchDocument(workbenchDoc({ 'steel-memory': invalid }))['steel-memory']).toBeUndefined();
  }
  storage.dispose();
});
