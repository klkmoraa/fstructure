// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import { DesignWorkbench } from './DesignWorkbench';
import { FOOTING_DEFAULTS } from './footingModel';
import { WORKBENCH_DOCUMENT_KIND, WorkbenchStorageContext, createProjectWorkbenchStorage, parseWorkbenchDocument } from './workbenchStorage';

const workbenchDoc = (entries: Record<string, unknown>, schemaVersion = 6) => ({ kind: WORKBENCH_DOCUMENT_KIND, schemaVersion, entries });

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('design workbench document', () => {
  it('migrates v2 memory and retains the section studio draft and memory in v6', () => {
    const old = { id: 'a1', element: 'column', code: 'ntc-2023', savedAt: '2026-09-27', fields: { tag: 'C-1', width: '40' } };
    const section = { id: 'a2', element: 'section', code: 'ntc-2023', savedAt: '2026-10-01', fields: { tag: 'S-1', shape: 'octagonal', philosophy: 'allowable', cover: '4' } };
    const persist = vi.fn<(value: JsonValue) => void>();
    const storage = createProjectWorkbenchStorage(workbenchDoc({ memory: [old] }, 2), persist);
    storage.write('section', section.fields);
    storage.write('memory', [old, section]);
    storage.flush();
    const document = persist.mock.calls[0]?.[0] as { schemaVersion: number; entries: Record<string, JsonValue> };
    expect(document.schemaVersion).toBe(6);
    expect(parseWorkbenchDocument(document)).toEqual({ memory: [old, section], section: section.fields });
    storage.dispose();
  });

  it('keeps short strings, records of strings and short lists of records only', () => {
    const parsed = parseWorkbenchDocument(workbenchDoc({
      code: 'nsr-10',
      beam: { width: '30', supportWidth: '45' },
      'beam-spans': [{ length: '5', dead: '10' }],
      nested: { deep: { value: '1' } },
      numbers: 5,
      long: 'x'.repeat(40),
      'Bad Key': 'no',
    }));
    expect(parsed).toEqual({ code: 'nsr-10', beam: { width: '30', supportWidth: '45' }, 'beam-spans': [{ length: '5', dead: '10' }] });
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

  it('keeps v3 documents and stores frames with their bays and levels in v6', () => {
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
    expect(document.schemaVersion).toBe(6);
    expect(parseWorkbenchDocument(document)).toEqual({ code: 'e060', memory: [beam, frame], 'frame-bays': frame.rows, 'frame-stories': frame.levels });
    // Un nivel con una forma inesperada invalida la memoria, no la reinterpreta.
    expect(parseWorkbenchDocument(workbenchDoc({ memory: [{ ...frame, levels: [{ height: 3 }] }] })).memory).toBeUndefined();
    storage.dispose();
  });

  it('rejects foreign or oversized documents without throwing', () => {
    expect(parseWorkbenchDocument(null)).toEqual({});
    expect(parseWorkbenchDocument({ kind: 'other', schemaVersion: 1, entries: {} })).toEqual({});
    expect(parseWorkbenchDocument({ ...workbenchDoc({}), schemaVersion: 7 })).toEqual({});
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

  it.each([1, 2, 3, 4, 5, 6])('retains workshop document compatibility for schema v%d', (schemaVersion) => {
    expect(parseWorkbenchDocument(workbenchDoc({ code: 'e060', beam: { width: '30' } }, schemaVersion))).toEqual({ code: 'e060', beam: { width: '30' } });
  });

  it('batches writes and persists the whole document once', () => {
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
    expect(persist).toHaveBeenLastCalledWith(workbenchDoc({ code: 'e060', element: 'column', column: { width: '40' } }));
    storage.write('code', 'ntc-2023');
    storage.flush();
    expect(persist).toHaveBeenCalledTimes(2);
    storage.write('column', { nested: { value: 1 } } as unknown as JsonValue);
    storage.dispose();
    expect(persist).toHaveBeenCalledTimes(2);
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
