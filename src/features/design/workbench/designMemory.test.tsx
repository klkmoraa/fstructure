// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reportFromMemoryItem, useDesignMemory } from './designMemory';
import { DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS } from './frameModel';
import { BEAM_DEFAULTS, DEFAULT_SPANS } from './beamModel';
import { FOOTING_DEFAULTS } from './footingModel';
import { DESIGN_STARTS, type DesignStart } from './designStarts';
import { createProjectWorkbenchStorage, WORKBENCH_DOCUMENT_KIND, type WorkbenchMemoryItem, type WorkbenchStorage } from './workbenchStorage';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';

const memoryStorage = (initial: Record<string, unknown>): WorkbenchStorage & { data: Record<string, unknown> } => {
  const data = { ...initial };
  return { data, read: (key) => data[key], write: (key, value) => { data[key] = value; } };
};

const AXES = [{ id: 'z:0', tag: 'Eje 1' }, { id: 'z:5', tag: 'Eje 2' }, { id: 'x:0', tag: 'Eje A' }];
const legacyBeamExercise: DesignStart = {
  id: 'exercise-beam-simple', category: 'exercise', element: 'beam', title: 'Viga simplemente apoyada', description: 'Caso heredado.',
  fields: { ...BEAM_DEFAULTS, exercise: 'exercise-beam-simple', leftEnd: 'pin', rightEnd: 'roller', selfWeight: 'no' },
  rows: [{ ...DEFAULT_SPANS[0]!, length: '5', dead: '10', live: '0' }],
};

const savedItem = (id: string, fields: Record<string, string>, overrides: Record<string, unknown> = {}): WorkbenchMemoryItem => ({
  id, element: 'beam', code: 'ntc-2023', savedAt: '2026-10-01', fields, rows: DEFAULT_SPANS, ...overrides,
} as unknown as WorkbenchMemoryItem);

const largeEntries = (valueLength = 32) => {
  const wideRecord = Object.fromEntries(Array.from({ length: 96 }, (_, index) => [`f${index}`.padEnd(31, 'k'), 'x'.repeat(valueLength)]));
  const eightRows = Array.from({ length: 8 }, () => ({ ...wideRecord }));
  return {
    beam: { tag: 'V incompleta', width: '25' },
    footing: { ...FOOTING_DEFAULTS, tag: 'Z existente' },
    code: 'ntc-2023', element: 'beam',
    'large-a': eightRows, 'large-b': eightRows, 'large-c': eightRows, 'large-d': eightRows,
    'small-a': [{ ...wideRecord }], 'small-b': [{ ...wideRecord }], 'small-c': [{ ...wideRecord }], 'small-d': [{ ...wideRecord }],
  };
};

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

it('deduplica una memoria legacy que omitía campos con sus defaults de elemento', () => {
  const beam = { ...BEAM_DEFAULTS, tag: 'V-legacy', futureField: 'preservado' };
  const legacyBeam = { id: 'beam-legacy', element: 'beam', code: 'ntc-2023', savedAt: '2026-10-01', fields: { tag: 'V-legacy', futureField: 'preservado' }, rows: DEFAULT_SPANS };
  const storage = memoryStorage({ beam, 'beam-spans': DEFAULT_SPANS, element: 'beam', memory: [legacyBeam] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!)).toBe('started'); });

  expect(result.current.items).toHaveLength(1);
  expect(result.current.items[0]).toEqual(legacyBeam);
  expect(storage.read('beam')).toEqual(beam);
});

it('conserva como distinta una instantánea frente a un campo explícito inválido', () => {
  const complete = { ...BEAM_DEFAULTS, tag: 'V-1' };
  const incomplete = { ...complete, fc: 'dato pendiente' };
  const savedBeam = { id: 'beam-defaults', element: 'beam', code: 'ntc-2023', savedAt: '2026-10-01', fields: complete };
  const storage = memoryStorage({ beam: incomplete, 'beam-spans': DEFAULT_SPANS, element: 'beam', memory: [savedBeam] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-footing')!)).toBe('started'); });

  expect(result.current.items).toHaveLength(2);
  expect(result.current.items[0]?.fields).toEqual(complete);
  expect(result.current.items[1]?.fields).toEqual(incomplete);
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

it('guardar, abrir y duplicar conserva el detalle incompleto de una viga', () => {
  const details = {
    kind: 'beam', version: 1,
    loads: [{ id: 'L1', span: '1', kind: 'point', category: 'dead', start: '0.5', end: '0.5', startValue: '', endValue: '' }],
    bastions: [{ id: 'B1', bed: 'top', count: '2', diameterMm: '15.9', startM: '0', endM: '1.2' }],
    stirrupZones: [{ span: '1', endSpacingMm: '100', endLengthM: '1', centerSpacingMm: '200' }],
  };
  const storage = memoryStorage({ beam: { tag: 'Viga' }, 'beam-details': details, 'beam-spans': DEFAULT_SPANS });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.save()).toBe('saved'); });
  const saved = result.current.active!;
  expect(saved.details).toEqual(details);

  storage.data['beam-details'] = { kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [] };
  act(() => { expect(result.current.open(saved.id)).toEqual(saved); });
  expect(storage.read('beam-details')).toEqual(details);

  act(() => { expect(result.current.duplicate(saved.id)).toBe('duplicated'); });
  expect(result.current.items.at(-1)?.details).toEqual(details);
});

it.each(['start', 'open'] as const)('%s preserva valores vacíos del detalle activo antes de cambiar de pieza', (route) => {
  const details = {
    kind: 'beam', version: 1,
    loads: [{ id: 'L-empty', span: '1', kind: 'point', category: 'dead', start: '', end: '', startValue: '', endValue: '' }],
    bastions: [], stirrupZones: [],
  };
  const target = { id: 'column-target', element: 'column', code: 'ntc-2023', savedAt: '2026-10-09', fields: { tag: 'C destino' } };
  const storage = memoryStorage({ beam: { tag: 'V actual' }, 'beam-details': details, 'beam-spans': DEFAULT_SPANS, memory: [target] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => {
    if (route === 'start') expect(result.current.start(legacyBeamExercise)).toBe('started');
    else expect(result.current.open(target.id)).toBeTruthy();
  });

  const preserved = (storage.read('memory') as WorkbenchMemoryItem[]).find((item) => item.element === 'beam' && item.id !== target.id);
  expect(preserved?.details).toEqual(details);
  expect(preserved?.details?.loads[0]?.startValue).toBe('');
});

it('trata el detalle de viga ausente como el borrador canónico vacío al comparar', () => {
  const emptyDetails = { kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [] };
  const item = savedItem('beam-empty', { tag: 'V-1' }, { details: emptyDetails });
  const storage = memoryStorage({ beam: { tag: 'V-1' }, 'beam-spans': DEFAULT_SPANS, element: 'beam', memory: [item] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.start(DESIGN_STARTS.find((entry) => entry.id === 'piece-footing')!)).toBe('started'); });

  expect(result.current.items).toHaveLength(1);
});

it('un preflight de memoria llena evita todas las escrituras y cambios al abrir una viga', () => {
  const details = { kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [] };
  const target = savedItem('target', { tag: 'V-guardada' }, { details });
  const fillers = Array.from({ length: 59 }, (_, index) => savedItem(`f${index}`, { tag: `V-${index}` }));
  const storage = memoryStorage({ memory: [target, ...fillers], 'memory-active': 'target', beam: { tag: 'V actual' }, 'beam-details': { kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [] } });
  const writes: string[] = [];
  storage.write = (key, value) => { writes.push(key); storage.data[key] = value; };
  const before = structuredClone(storage.data);
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.open('target')).toBe('full'); });

  expect(writes).toEqual([]);
  expect(storage.data).toEqual(before);
  expect(result.current.items).toHaveLength(60);
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
  const entries = largeEntries();
  const eightRows = entries['large-a'];
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

it('saveAxes y open abortan antes de persistir si el documento válido está cerca de 240k', () => {
  const entries = largeEntries();
  for (const key of Object.keys(entries['small-d'][0]!).slice(0, 22)) delete entries['small-d'][0]![key];
  entries['small-d'][0]!.nearA = 'x'.repeat(32);
  entries['small-d'][0]!.nearB = 'x'.repeat(32);
  const current = savedItem('saved-beam', { ...BEAM_DEFAULTS, tag: 'V guardada' });
  const initial = { kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 6, entries: { ...entries, memory: [current], 'memory-active': '' } };
  expect(JSON.stringify(initial).length).toBeGreaterThan(239_000);
  expect(JSON.stringify(initial).length).toBeLessThan(240_000);
  let persisted: unknown = structuredClone(initial);
  const persist = vi.fn((document: unknown) => { persisted = document; });
  const storage = createProjectWorkbenchStorage(initial, persist, 60_000);
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'e060', 0));
  const beforeItems = structuredClone(result.current.items);
  const beforeActive = result.current.activeId;
  const beforeDraft = structuredClone(storage.read('beam'));

  act(() => {
    expect(result.current.saveAxes(AXES)).toBe('full');
    expect(result.current.open(current.id)).toBe('full');
  });
  storage.flush();

  expect(persist).not.toHaveBeenCalled();
  expect(result.current.items).toEqual(beforeItems);
  expect(result.current.activeId).toBe(beforeActive);
  expect(storage.read('beam')).toEqual(beforeDraft);
  expect(storage.read('memory')).toEqual([current]);
  expect(persisted).toEqual(initial);
  storage.dispose();
});

it('todas las mutaciones respetan canWrite=false sin escribir ni cambiar el estado en memoria', () => {
  const item = savedItem('current', { ...BEAM_DEFAULTS, tag: 'V-1' });
  const data: Record<string, unknown> = { beam: { ...BEAM_DEFAULTS }, memory: [item], 'memory-active': item.id };
  const writes: string[] = [];
  const storage: WorkbenchStorage = { read: (key) => data[key], write: (key, value) => { writes.push(key); data[key] = value; }, canWrite: () => false };
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'e060', 0));
  const beforeItems = structuredClone(result.current.items);

  act(() => {
    expect(result.current.save()).toBe('full');
    expect(result.current.saveAxes(AXES)).toBe('full');
    expect(result.current.remove(item.id)).toBe('full');
    expect(result.current.open(item.id)).toBe('full');
    expect(result.current.duplicate(item.id)).toBe('full');
  });

  expect(writes).toEqual([]);
  expect(data).toEqual({ beam: { ...BEAM_DEFAULTS }, memory: [item], 'memory-active': item.id });
  expect(result.current.items).toEqual(beforeItems);
  expect(result.current.activeId).toBe(item.id);
});

it('open conserva borradores incompletos actual y destino con la norma vigente, sin tocar piezas guardadas', () => {
  const current = { tag: 'V incompleta', width: '25', fc: 'dato pendiente' };
  const targetDraft = { ...FOOTING_DEFAULTS, tag: 'Z destino incompleta', dead: 'pendiente' };
  const target = savedItem('footing-target', { ...targetDraft, dead: 'saved distinto' }, { element: 'footing', rows: undefined });
  const untouched = savedItem('untouched', { ...BEAM_DEFAULTS, tag: 'V guardada' });
  const storage = memoryStorage({ beam: current, footing: targetDraft, element: 'beam', code: 'e060', memory: [target, untouched], 'memory-active': 'untouched' });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'e060', 0));

  act(() => { expect(result.current.open(target.id)).toEqual(target); });

  expect(result.current.items).toHaveLength(4);
  expect(result.current.items[0]).toEqual(target);
  expect(result.current.items[1]).toEqual(untouched);
  expect(result.current.items.slice(2).map((item) => item.fields.tag)).toEqual(['V incompleta', 'Z destino incompleta']);
  expect(result.current.items.slice(2).every((item) => item.code === 'e060')).toBe(true);
  expect(storage.read('beam')).toEqual(current);
  expect(storage.read('footing')).toEqual(target.fields);
  expect(storage.read('code')).toBe('ntc-2023');
  expect(storage.read('memory-active')).toBe(target.id);
  expect((storage.read('memory') as WorkbenchMemoryItem[])[0]).toEqual(target);
  expect((storage.read('memory') as WorkbenchMemoryItem[])[1]).toEqual(untouched);
});

it('open deduplica snapshots equivalentes de ambos borradores antes de cargar la pieza', () => {
  const draft = { ...BEAM_DEFAULTS, tag: 'V-1' };
  const saved = savedItem('beam-saved', draft);
  const target = savedItem('footing-saved', { ...FOOTING_DEFAULTS, tag: 'Z-1' }, { element: 'footing', rows: undefined });
  const storage = memoryStorage({ beam: draft, footing: target.fields, element: 'beam', code: 'ntc-2023', memory: [saved, target] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.open(target.id)).toEqual(target); });

  expect(result.current.items.map((item) => item.id)).toEqual(['beam-saved', 'footing-saved']);
});

it('open carga filas y niveles por defecto si la pieza guardada legacy los omitía', () => {
  const target = savedItem('legacy-frame', { ...FRAME_DEFAULTS, tag: 'P-legacy' }, { element: 'frame', rows: undefined, levels: undefined });
  const staleRows = [{ length: '99' }];
  const staleLevels = [{ height: '99' }];
  const storage = memoryStorage({ beam: { tag: 'borrador' }, 'beam-spans': staleRows, frame: { tag: 'anterior' }, 'frame-bays': staleRows, 'frame-stories': staleLevels,
    element: 'beam', code: 'ntc-2023', memory: [target] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { result.current.open(target.id); });

  expect(storage.read('frame-bays')).toEqual(expect.any(Array));
  expect(storage.read('frame-bays')).toEqual(DEFAULT_BAYS);
  expect(storage.read('frame-stories')).toEqual(DEFAULT_STORIES);
  expect(storage.read('frame-bays')).not.toEqual(staleRows);
  expect(storage.read('frame-stories')).not.toEqual(staleLevels);
});

it('open usa claros por defecto al cargar una viga legacy que los omitía', () => {
  const target = savedItem('legacy-beam', { ...BEAM_DEFAULTS, tag: 'V-legacy' }, { rows: undefined });
  const staleRows = [{ length: '99' }];
  const storage = memoryStorage({ beam: { tag: 'V anterior' }, 'beam-spans': staleRows, element: 'beam', memory: [target] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { result.current.open(target.id); });

  expect(storage.read('beam-spans')).toEqual(DEFAULT_SPANS);
  expect(storage.read('beam-spans')).not.toEqual(staleRows);
});

it('open aborta al exceder el límite de piezas al conservar el borrador actual', () => {
  const target = savedItem('target', { ...BEAM_DEFAULTS, tag: 'V guardada' });
  const fillers = Array.from({ length: 59 }, (_, index) => ({ id: `f${index}`, element: 'column', code: 'ntc-2023', savedAt: '2026-10-01', fields: { tag: `C-${index}` } }));
  const storage = memoryStorage({ beam: { tag: 'V actual incompleta' }, element: 'beam', memory: [target, ...fillers] });
  const writes: string[] = [];
  storage.write = (key, value) => { writes.push(key); storage.data[key] = value; };
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.open(target.id)).toBe('full'); });

  expect(writes).toEqual([]);
  expect(storage.read('beam')).toEqual({ tag: 'V actual incompleta' });
  expect(result.current.items).toHaveLength(60);
});

it('duplicate copia una pieza incompleta sin cambiar el activo y crea datos profundamente independientes', () => {
  const source = savedItem('source', { tag: 'P-7', width: 'dato pendiente', source: 'model3d', axis: 'z:5' }, {
    element: 'frame', rows: [{ length: '5', nested: 'original' }], levels: [{ height: '3' }], code: 'e060',
  });
  const storage = memoryStorage({ memory: [source], 'memory-active': source.id, frame: source.fields });
  const { result } = renderHook(() => useDesignMemory(storage, 'frame', 'ntc-2023', 0));

  act(() => { expect(result.current.duplicate(source.id)).toBe('duplicated'); });

  const copy = result.current.items.find((item) => item.id !== source.id)!;
  expect(copy).toMatchObject({ element: source.element, code: source.code, fields: { ...source.fields, tag: 'P-7 · copia' }, rows: source.rows, levels: source.levels });
  expect(copy.id).not.toBe(source.id);
  expect(copy.savedAt).not.toBe(source.savedAt);
  expect(result.current.activeId).toBe(source.id);
  expect(storage.read('memory-active')).toBe(source.id);
  expect(storage.read('frame')).toEqual(source.fields);
  expect(copy.fields).not.toBe(source.fields);
  expect(copy.rows).not.toBe(source.rows);
  expect(copy.levels).not.toBe(source.levels);
  expect(copy.rows?.[0]).not.toBe(source.rows?.[0]);
});

it('duplicate asigna claves únicas de hasta 32 caracteres a copias repetidas de cualquier fila', () => {
  const source = savedItem('source', { tag: '12345678901234567890123456789012', width: 'dato pendiente' });
  const storage = memoryStorage({ memory: [source] });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.duplicate(source.id)).toBe('duplicated'); });
  act(() => { expect(result.current.duplicate(source.id)).toBe('duplicated'); });

  const tags = result.current.items.map((item) => item.fields.tag!);
  expect(new Set(tags).size).toBe(tags.length);
  expect(tags[1]).toContain(' · copia');
  expect(tags[2]).toContain(' · copia 2');
  expect(tags.every((tag) => tag.length <= 32)).toBe(true);
});

it('duplicate devuelve full sin cambiar piezas cuando el presupuesto de memoria está lleno', () => {
  const source = savedItem('source', { ...BEAM_DEFAULTS, tag: 'V-1' });
  const fillers = Array.from({ length: 59 }, (_, index) => savedItem(`f${index}`, { tag: `V-${index + 2}` }));
  const storage = memoryStorage({ memory: [source, ...fillers], 'memory-active': source.id });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));
  const before = structuredClone(result.current.items);

  act(() => { expect(result.current.duplicate(source.id)).toBe('full'); });

  expect(result.current.items).toEqual(before);
  expect(storage.read('memory')).toEqual(before);
  expect(result.current.activeId).toBe(source.id);
});

it('duplicate respeta el presupuesto de caracteres aunque queden menos de 60 piezas', () => {
  const fields = Object.fromEntries([
    ['tag', 'V-1'],
    ...Array.from({ length: 95 }, (_, index) => [`f${index}`.padEnd(31, 'k'), 'x'.repeat(32)]),
  ]);
  const items = Array.from({ length: 26 }, (_, index) => savedItem(`m${index}`, { ...fields, tag: index === 0 ? 'V-1' : `V-${index}` }));
  expect(items.length).toBeLessThan(60);
  expect(JSON.stringify(items).length).toBeLessThan(180_000);
  const storage = memoryStorage({ memory: items });
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));
  const before = structuredClone(result.current.items);

  act(() => { expect(result.current.duplicate(items[0]!.id)).toBe('full'); });

  expect(result.current.items).toEqual(before);
  expect(storage.read('memory')).toEqual(before);
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
  const start = legacyBeamExercise;

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

it('conserva el id de ejercicio en borrador, memoria de proyecto y al reabrir sin cambiar el esquema', () => {
  const writes: unknown[] = [];
  const storage = createProjectWorkbenchStorage({ kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 6, entries: {} }, (document) => { writes.push(document); }, 0);
  const recipe = legacyBeamExercise;
  const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));

  act(() => { expect(result.current.start(recipe)).toBe('started'); });
  expect((storage.read('beam') as Record<string, string>).exercise).toBe(recipe.id);
  act(() => { expect(result.current.save()).toBe('saved'); });
  const saved = result.current.items[0]!;
  expect(saved.fields.exercise).toBe(recipe.id);

  storage.flush();
  const document = writes.at(-1) as { schemaVersion: number; entries: Record<string, unknown> };
  expect(document.schemaVersion).toBe(8);
  expect((document.entries.memory as WorkbenchMemoryItem[])[0]?.fields.exercise).toBe(recipe.id);
  storage.write('beam', { ...recipe.fields, exercise: '' });
  act(() => { expect(result.current.open(saved.id)).toBeTruthy(); });
  expect((storage.read('beam') as Record<string, string>).exercise).toBe(recipe.id);
  storage.dispose();
});

it('guarda, duplica y abre el origen enlazado de columna conservando el origen independiente de flexión', () => {
  const origin = { version: 1 as const, snapshot: {
    version: 1 as const, source: { kind: 'model3d' as const, projectId: 'p', revision: 'r1', memberId: 'C1', axisId: 'x:0' },
    target: { id: 'LC1', label: 'LC1', kind: 'case' as const, factors: [] }, station: { xM: 1, side: 'right' as const, lengthM: 3 }, units: 'kN-m' as const,
    axes: { convention: 'local', localBasis: [[0, 1, 0], [0, 0, 1], [1, 0, 0]] as const }, actions: { nKn: -1, vyKn: 0, vzKn: 0, torsionKnm: 0, myKnm: 2, mzKnm: 3 },
    member: { id: 'C1', label: 'C1', family: 'column' as const, levelId: 'L1', axisIds: ['x:0'], lengthM: 3, section: { shape: 'rectangular' as const, widthMm: 300, depthMm: 500, fcMpa: 25, materialLabel: 'C25' }, start: [0, 0, 0] as [number, number, number], end: [0, 3, 0] as [number, number, number] },
  }, copiedFields: { axial: '1', momentX: '3' } };
  const flexureOrigin = { ...origin, copiedFields: { moment: '3' } };
  const storage = memoryStorage({ column: { tag: 'C1', axial: '1', momentX: '3' }, element: 'column', 'piece-origin': { version: 1, byElement: { column: origin, flexure: flexureOrigin } } });
  const { result } = renderHook(() => useDesignMemory(storage, 'column', 'ntc-2023', 0));
  act(() => { expect(result.current.save()).toBe('saved'); });
  const saved = result.current.items[0]!;
  expect(saved.origin).toEqual(origin);
  act(() => { expect(result.current.duplicate(saved.id)).toBe('duplicated'); });
  expect(result.current.items[1]?.origin).toEqual(origin);
  act(() => { expect(result.current.open(saved.id)).toEqual(saved); });
  expect(storage.read('piece-origin')).toEqual({ version: 1, byElement: { column: origin, flexure: flexureOrigin } });
  act(() => { expect(result.current.start(DESIGN_STARTS.find((item) => item.id === 'piece-column')!)).toBe('started'); });
  expect(storage.read('piece-origin')).toEqual({ version: 1, byElement: { flexure: flexureOrigin } });
});

it('rechaza un cambio enlazado cuando conservar el borrador previo excede la memoria llena', () => {
  const origin = { version: 1 as const, snapshot: {
    version: 1 as const, source: { kind: 'model2d' as const, projectId: 'p', revision: 'r1', memberId: 'C1' },
    target: { id: 'SERV', label: 'SERV', kind: 'case' as const, factors: [] }, station: { xM: 1, side: 'right' as const, lengthM: 3 }, units: 'kN-m' as const,
    axes: { convention: '2D', localBasis: [] as const }, actions: { nKn: -2, vyKn: 3, vzKn: 0, torsionKnm: 0, myKnm: 0, mzKnm: 4 },
    member: { id: 'C1', label: 'C1', family: 'column' as const, levelId: null, axisIds: [], lengthM: 3, section: { shape: 'rectangular' as const, widthMm: 300, depthMm: 500, fcMpa: 25, materialLabel: 'C25' }, start: [0, 0, 0] as [number, number, number], end: [0, 3, 0] as [number, number, number] },
  }, copiedFields: { axial: '2' } };
  const memory = Array.from({ length: 60 }, (_, index) => ({ id: `m${index}`, element: 'beam' as const, code: 'ntc-2023', savedAt: '2026-10-10', fields: { width: '25' } }));
  const data: Record<string, unknown> = { column: { tag: 'C1', axial: '2' }, element: 'column', memory, 'memory-active': '', 'piece-origin': { version: 1, byElement: { column: origin } } };
  const storage: WorkbenchStorage = { read: (key) => data[key], write: (key, value) => { data[key] = value; }, commitBatch(writes) {
    const next = { ...data, ...writes };
    if (Array.isArray(next.memory) && next.memory.length > 60) return { accepted: false, reason: 'La memoria está llena.' };
    Object.assign(data, writes); return { accepted: true };
  } };
  const before = structuredClone(data);
  const { result } = renderHook(() => useDesignMemory(storage, 'column', 'ntc-2023', 0));
  act(() => { expect(result.current.switchDraft({ column: { tag: 'C2', axial: '3' }, 'piece-origin': { version: 1, byElement: {} } as unknown as JsonValue }, 'column')).toBe('full'); });
  expect(data).toEqual(before);
  expect(result.current.items).toHaveLength(60);
});

describe('pieza guardada con una norma que esta versión no tiene', () => {
  const futureItem = () => savedItem('futura', { ...BEAM_DEFAULTS, tag: 'V-futura' }, { code: 'cte-2021' });

  it('no se recalcula con otra norma', () => {
    expect(reportFromMemoryItem(futureItem()).ok).toBe(false);
  });

  it('no se muestra ni se abre, y guardar otra pieza la conserva intacta', () => {
    const item = futureItem();
    const storage = memoryStorage({ element: 'beam', beam: { ...BEAM_DEFAULTS, tag: 'V-1' }, memory: [item], 'memory-active': 'futura' });
    const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));
    expect(result.current.items).toEqual([]);
    expect(result.current.active).toBeUndefined();
    act(() => { expect(result.current.open('futura')).toBeUndefined(); });
    expect(result.current.remove('futura')).toBe('missing');
    // Aunque la memoria activa apuntaba a ella, guardar agrega otra pieza y no la reetiqueta como NTC.
    act(() => { expect(result.current.save()).toBe('saved'); });
    expect(result.current.items.map((entry) => entry.fields.tag)).toEqual(['V-1']);
    expect(storage.data.memory).toEqual([item, expect.objectContaining({ code: 'ntc-2023', fields: expect.objectContaining({ tag: 'V-1' }) })]);
  });

  it('guardar los ejes no pisa un eje guardado con esa norma', () => {
    const future = { id: 'eje-futuro', element: 'frame', code: 'cte-2021', savedAt: '2026-10-01', fields: { ...FRAME_DEFAULTS, source: 'model3d', axis: 'z:5', tag: 'Eje 2' } };
    const storage = memoryStorage({ frame: { ...FRAME_DEFAULTS, source: 'model3d', axis: 'z:0' }, memory: [future] });
    const { result } = renderHook(() => useDesignMemory(storage, 'frame', 'ntc-2023', 0));
    act(() => { expect(result.current.saveAxes(AXES)).toBe('saved'); });
    expect((storage.data.memory as unknown[])[0]).toEqual(future);
    expect(result.current.items.filter((entry) => entry.fields.axis === 'z:5')).toHaveLength(1);
  });

  it('guardar → reabrir el documento del proyecto la conserva', () => {
    const item = futureItem();
    const initial = { kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 6, entries: { code: 'ntc-2023', element: 'beam', beam: { ...BEAM_DEFAULTS, tag: 'V-1' }, memory: [item] } };
    let persisted: unknown = structuredClone(initial);
    const storage = createProjectWorkbenchStorage(initial, (document) => { persisted = document; }, 60_000);
    const { result } = renderHook(() => useDesignMemory(storage, 'beam', 'ntc-2023', 0));
    act(() => { expect(result.current.save()).toBe('saved'); });
    storage.flush();
    const reopened = createProjectWorkbenchStorage(persisted, vi.fn());
    expect(reopened.read('memory')).toEqual([item, expect.objectContaining({ code: 'ntc-2023' })]);
    storage.dispose();
    reopened.dispose();
  });
});
