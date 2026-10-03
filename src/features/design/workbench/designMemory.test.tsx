// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useDesignMemory } from './designMemory';
import { FRAME_DEFAULTS } from './frameModel';
import type { WorkbenchStorage } from './workbenchStorage';

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
