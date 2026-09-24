// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import { DesignWorkbench } from './DesignWorkbench';
import { WORKBENCH_DOCUMENT_KIND, WorkbenchStorageContext, createProjectWorkbenchStorage, parseWorkbenchDocument } from './workbenchStorage';

const workbenchDoc = (entries: Record<string, unknown>) => ({ kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 1, entries });

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('design workbench document', () => {
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

  it('rejects foreign or oversized documents without throwing', () => {
    expect(parseWorkbenchDocument(null)).toEqual({});
    expect(parseWorkbenchDocument({ kind: 'other', schemaVersion: 1, entries: {} })).toEqual({});
    expect(parseWorkbenchDocument({ ...workbenchDoc({}), schemaVersion: 2 })).toEqual({});
    expect(parseWorkbenchDocument(workbenchDoc({ wide: Object.fromEntries(Array.from({ length: 70 }, (_, index) => [`f${index}`, 'x'])) }))).toEqual({});
    const huge = Object.fromEntries(Array.from({ length: 16 }, (_, entry) => [`e${entry}`, Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`f${index}`, 'x'.repeat(30)]))]));
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
