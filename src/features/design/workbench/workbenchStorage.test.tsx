// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import { DesignWorkbench } from './DesignWorkbench';
import { WORKBENCH_DOCUMENT_KIND, WorkbenchStorageContext, createProjectWorkbenchStorage, parseWorkbenchDocument } from './workbenchStorage';

const workbenchDoc = (entries: Record<string, unknown>, schemaVersion = 5) => ({ kind: WORKBENCH_DOCUMENT_KIND, schemaVersion, entries });

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('design workbench document', () => {
  it('migrates v2 memory and retains the section studio draft and memory in v5', () => {
    const old = { id: 'a1', element: 'column', code: 'ntc-2023', savedAt: '2026-09-27', fields: { tag: 'C-1', width: '40' } };
    const section = { id: 'a2', element: 'section', code: 'ntc-2023', savedAt: '2026-10-01', fields: { tag: 'S-1', shape: 'octagonal', philosophy: 'allowable', cover: '4' } };
    const persist = vi.fn<(value: JsonValue) => void>();
    const storage = createProjectWorkbenchStorage(workbenchDoc({ memory: [old] }, 2), persist);
    storage.write('section', section.fields);
    storage.write('memory', [old, section]);
    storage.flush();
    const document = persist.mock.calls[0]?.[0] as { schemaVersion: number; entries: Record<string, JsonValue> };
    expect(document.schemaVersion).toBe(5);
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

  it('keeps v3 documents and stores frames with their bays and levels in v5', () => {
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
    expect(document.schemaVersion).toBe(5);
    expect(parseWorkbenchDocument(document)).toEqual({ code: 'e060', memory: [beam, frame], 'frame-bays': frame.rows, 'frame-stories': frame.levels });
    // Un nivel con una forma inesperada invalida la memoria, no la reinterpreta.
    expect(parseWorkbenchDocument(workbenchDoc({ memory: [{ ...frame, levels: [{ height: 3 }] }] })).memory).toBeUndefined();
    storage.dispose();
  });

  it('rejects foreign or oversized documents without throwing', () => {
    expect(parseWorkbenchDocument(null)).toEqual({});
    expect(parseWorkbenchDocument({ kind: 'other', schemaVersion: 1, entries: {} })).toEqual({});
    expect(parseWorkbenchDocument({ ...workbenchDoc({}), schemaVersion: 6 })).toEqual({});
    expect(parseWorkbenchDocument(workbenchDoc({ wide: Object.fromEntries(Array.from({ length: 70 }, (_, index) => [`f${index}`, 'x'])) }))).toEqual({});
    const fields = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`f${index}`.padEnd(32, 'k'), 'x'.repeat(32)]));
    const huge = { memory: Array.from({ length: 60 }, (_, index) => ({ id: `m${index}`, element: 'beam', code: 'ntc-2023', savedAt: '2026-09-27', fields })) };
    expect(parseWorkbenchDocument(workbenchDoc(huge))).toEqual({});
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
