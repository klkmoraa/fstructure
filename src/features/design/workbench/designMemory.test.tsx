// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useDesignMemory } from './designMemory';
import { FRAME_DEFAULTS } from './frameModel';
import { FOOTING_DEFAULTS } from './footingModel';
import { DEFAULT_SPANS } from './beamModel';
import { DESIGN_STARTS } from './designStarts';
import { createProjectWorkbenchStorage, WORKBENCH_DOCUMENT_KIND, type WorkbenchStorage } from './workbenchStorage';

const memoryStorage = (initial: Record<string, unknown>): WorkbenchStorage & { data: Record<string, unknown> } => {
  const data = { ...initial };
  return { data, read: (key) => data[key], write: (key, value) => { data[key] = value; } };
};

const AXES = [{ id: 'z:0', tag: 'Eje 1' }, { id: 'z:5', tag: 'Eje 2' }, { id: 'x:0', tag: 'Eje A' }];

it('guardar los ejes agrega uno por eje, deja activo el abierto y al repetirlo los actualiza sin duplicar', () => {
  const storage = memoryStorage({ frame: { ...FRAME_DEFAULTS, source: 'model3d', axis: '', tag: 'P-7' } });
  const { result } = renderHook(() => useDesignMemory(storage, 'frame', 'nsr-10', 0));
  act(() => { expect(result.current.saveAxes(AXES)).toBe('saved'); });
  expect(result.current.items.map((item) => item.fields.tag)).toEqual(['P-7', 'Eje 2', 'Eje A']);
  // Sin eje elegido la mesa abre el primero: ése es el que queda guardado tal cual y activo.
  expect(result.current.active?.fields.axis).toBe('');
  expect(result.current.saved).toBe(true);
  const ids = result.current.items.map((item) => item.id);
  act(() => { result.current.saveAxes(AXES); });
  expect(result.current.items.map((item) => item.id)).toEqual(ids);
});

it('un eje guardado que ya no existe no se pisa', () => {
  const stale = { id: 'old', element: 'frame', code: 'nsr-10', savedAt: '2026-10-01', fields: { ...FRAME_DEFAULTS, source: 'model3d', axis: 'z:9', tag: 'Eje 9' } };
  const storage = memoryStorage({ frame: { ...FRAME_DEFAULTS, source: 'model3d', axis: 'z:0' }, memory: [stale] });
  const { result } = renderHook(() => useDesignMemory(storage, 'frame', 'nsr-10', 0));
  act(() => { result.current.saveAxes(AXES); });
  expect(result.current.items).toHaveLength(4);
  expect(result.current.items[0]).toEqual(stale);
});

it('start conserva el borrador incompleto activo y el borrador anterior del destino', () => {
  const beam = { tag: 'V incompleta', width: '25', fc: 'dato pendiente' };
  const footing = { ...FOOTING_DEFAULTS, tag: 'Z existente', dead: 'sin dato' };
  const storage = memoryStorage({ beam, footing, element: 'beam', code: 'e060' });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'e060', 0));

  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!)).toBe('started'); });

  expect(result.current.items).toHaveLength(2);
  expect(result.current.items.map((item) => item.fields.tag)).toEqual(['V incompleta', 'Z existente']);
  expect(result.current.items[0]?.fields).toEqual(beam);
  expect(result.current.items[1]?.fields).toEqual(footing);
  expect(storage.read('element')).toBe('footing');
  expect(storage.read('code')).toBe('e060');
  expect(storage.read('memory-active')).toBe('');
  expect(storage.read('footing')).toEqual(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!.fields);
});

it('start no duplica borradores equivalentes ya guardados', () => {
  const beam = { tag: 'V-1', width: '25' };
  const savedBeam = { id: 'beam-1', element: 'beam', code: 'ntc-2023', savedAt: '2026-10-01', fields: beam, rows: DEFAULT_SPANS };
  const footing = { ...FOOTING_DEFAULTS, tag: 'Z-1' };
  const savedFooting = { id: 'footing-1', element: 'footing', code: 'ntc-2023', savedAt: '2026-10-02', fields: footing };
  const storage = memoryStorage({ beam, 'beam-spans': DEFAULT_SPANS, footing, element: 'beam', memory: [savedBeam, savedFooting] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!)).toBe('started'); });

  expect(result.current.items).toHaveLength(2);
  expect(result.current.items.map((item) => item.id)).toEqual(['beam-1', 'footing-1']);
});

it('reconoce como equivalente la pieza antigua que omite sus claros por defecto', () => {
  const beam = { tag: 'V-1', width: '25' };
  const legacyBeam = { id: 'beam-legacy', element: 'beam', code: 'ntc-2023', savedAt: '2026-10-01', fields: beam };
  const storage = memoryStorage({ beam, element: 'beam', memory: [legacyBeam] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!)).toBe('started'); });

  expect(result.current.items).toHaveLength(1);
  expect(result.current.items[0]?.id).toBe('beam-legacy');
});

it('start no crea una pieza vacía para un destino que todavía no tiene borrador', () => {
  const beam = { tag: 'V-1', width: '25' };
  const storage = memoryStorage({ beam, element: 'beam' });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!)).toBe('started'); });

  expect(result.current.items).toHaveLength(1);
  expect(result.current.items[0]?.element).toBe('beam');
});

it('start aborta antes de escribir si la memoria alcanzó su capacidad', () => {
  const items = Array.from({ length: 60 }, (_, index) => ({
    id: `m${index}`, element: 'column', code: 'ntc-2023', savedAt: '2026-10-01', fields: { tag: `C-${index}` },
  }));
  const data: Record<string, unknown> = { beam: { width: 'incompleta' }, footing: { dead: 'pendiente' }, element: 'beam', memory: items };
  const writes: string[] = [];
  const storage: WorkbenchStorage = { read: (key) => data[key], write: (key, value) => { writes.push(key); data[key] = value; } };
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));
  const before = structuredClone(data);

  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!)).toBe('full'); });

  expect(writes).toEqual([]);
  expect(data).toEqual(before);
  expect(result.current.items).toHaveLength(60);
});

it('start aborta antes de escribir si preservar los borradores excede el presupuesto de memoria', () => {
  const largeFields = Object.fromEntries(Array.from({ length: 96 }, (_, index) => [`f${index}`, 'x'.repeat(32)]));
  const items = Array.from({ length: 44 }, (_, index) => ({
    id: `m${index}`, element: 'column', code: 'ntc-2023', savedAt: '2026-10-01', fields: largeFields,
  }));
  const data: Record<string, unknown> = {
    beam: { ...largeFields }, footing: { ...largeFields }, element: 'beam', memory: items,
  };
  expect(JSON.stringify(items).length).toBeLessThan(180_000);
  const writes: string[] = [];
  const storage: WorkbenchStorage = { read: (key) => data[key], write: (key, value) => { writes.push(key); data[key] = value; } };
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));
  const before = structuredClone(data);

  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!)).toBe('full'); });

  expect(writes).toEqual([]);
  expect(data).toEqual(before);
});

it('start aborta atómicamente cuando el documento combinado rebasaría 240k y se reabre intacto', () => {
  const wideRecord = Object.fromEntries(Array.from({ length: 96 }, (_, index) => [`f${index}`.padEnd(31, 'k'), 'x'.repeat(32)]));
  const eightRows = Array.from({ length: 8 }, () => ({ ...wideRecord }));
  const entries = {
    beam: { tag: 'V incompleta', width: '25' },
    footing: { ...FOOTING_DEFAULTS, tag: 'Z existente' },
    code: 'ntc-2023', element: 'beam',
    'large-a': eightRows, 'large-b': eightRows, 'large-c': eightRows, 'large-d': eightRows,
    'small-a': [{ ...wideRecord }], 'small-b': [{ ...wideRecord }], 'small-c': [{ ...wideRecord }], 'small-d': [{ ...wideRecord }],
  };
  const initial = { kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 6, entries };
  expect(JSON.stringify(initial).length).toBeLessThan(240_000);
  let persisted: unknown = structuredClone(initial);
  const persist = vi.fn((document: unknown) => { persisted = document; });
  const storage = createProjectWorkbenchStorage(initial, persist, 60_000);
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!)).toBe('full'); });
  storage.flush();

  expect(persist).not.toHaveBeenCalled();
  expect(storage.read('beam')).toEqual(entries.beam);
  expect(storage.read('footing')).toEqual(entries.footing);
  expect(storage.read('element')).toBe('beam');
  expect(storage.read('memory-active')).toBeUndefined();
  expect(storage.read('memory')).toBeUndefined();
  const reopened = createProjectWorkbenchStorage(persisted, vi.fn());
  expect(reopened.read('beam')).toEqual(entries.beam);
  expect(reopened.read('footing')).toEqual(entries.footing);
  expect(reopened.read('large-a')).toEqual(eightRows);
  storage.dispose();
  reopened.dispose();
});

it('un arranque de modelo conserva materiales propios, código y los demás campos del pórtico', () => {
  const frame = { ...FRAME_DEFAULTS, source: 'frame', fc: '300', fy: '5000', tag: 'P usuario', axis: 'z:5' };
  const storage = memoryStorage({ frame, element: 'frame', code: 'nsr-10' });
  const start = DESIGN_STARTS.find((item) => item.id === 'project-3d')!;
  const { result } = renderHook(() => useDesignMemory(storage, 'frame', 'nsr-10', 0));

  act(() => { expect(result.current.start(start)).toBe('started'); });

  expect(storage.read('frame')).toEqual({ ...frame, source: 'model3d' });
  expect(storage.read('code')).toBe('nsr-10');
  expect(result.current.items).toHaveLength(1);
  expect(result.current.items[0]?.fields).toEqual(frame);
});

it('arranques repetidos dejan piezas recuperables e independientes', () => {
  const storage = memoryStorage({ beam: { tag: 'borrador', width: '25' }, element: 'beam' });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));
  const start = DESIGN_STARTS.find((item) => item.id === 'exercise-beam-simple')!;

  act(() => { result.current.start(start); });
  act(() => { expect(result.current.save()).toBe('saved'); });
  const first = result.current.activeId;
  act(() => { result.current.start(start); });
  act(() => { expect(result.current.save()).toBe('saved'); });

  expect(result.current.items.map((item) => item.id)).toContain(first);
  expect(new Set(result.current.items.map((item) => item.id)).size).toBe(result.current.items.length);
  const second = result.current.items.find((item) => item.id !== first)!;
  act(() => { result.current.open(first); });
  expect(storage.read('beam')).toEqual(result.current.items.find((item) => item.id === first)?.fields);
  expect(result.current.activeId).toBe(first);
  expect(second.id).not.toBe(first);
});
