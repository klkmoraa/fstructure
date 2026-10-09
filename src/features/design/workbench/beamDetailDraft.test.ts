// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_BEAM_DETAILS, isBeamDetailDraft, useStoredBeamDetails } from './beamDetailDraft';
import { browserWorkbenchStorage, createProjectWorkbenchStorage, WORKBENCH_DOCUMENT_KIND, type WorkbenchStorage } from './workbenchStorage';

const oversizedValidDetails = () => ({
  kind: 'beam' as const,
  version: 1 as const,
  loads: Array.from({ length: 32 }, (_, index) => ({
    id: `load-${index}`, span: '1', kind: 'distributed' as const, category: 'dead' as const,
    start: '1'.repeat(32), end: '2'.repeat(32), startValue: '3'.repeat(32), endValue: '4'.repeat(32),
  })),
  bastions: Array.from({ length: 16 }, (_, index) => ({
    id: `bar-${index}`, bed: 'top' as const, count: '1'.repeat(32), diameterMm: '2'.repeat(32), startM: '3'.repeat(32), endM: '4'.repeat(32),
  })),
  stirrupZones: Array.from({ length: 8 }, () => ({ span: '1', endSpacingMm: '1'.repeat(32), endLengthM: '2'.repeat(32), centerSpacingMm: '3'.repeat(32) })),
});

describe('borrador estructurado de viga', () => {
  it('exporta un borrador vacío canónico y lo valida', () => {
    expect(EMPTY_BEAM_DETAILS).toEqual({ kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [] });
    expect(isBeamDetailDraft(EMPTY_BEAM_DETAILS)).toBe(true);
  });

  it('conserva campos físicos incompletos como cadenas editables', () => {
    expect(isBeamDetailDraft({
      kind: 'beam', version: 1,
      loads: [{ id: 'load-1', span: '1', kind: 'point', category: 'dead', start: '', end: '', startValue: '', endValue: '' }],
      bastions: [{ id: 'bar-1', bed: 'top', count: '', diameterMm: '', startM: '', endM: '' }],
      stirrupZones: [{ span: '1', endSpacingMm: '', endLengthM: '', centerSpacingMm: '' }],
    })).toBe(true);
  });

  it('rechaza datos fuera de límites y cadenas que exceden 32 caracteres', () => {
    const load = { id: 'L1', span: '1', kind: 'point', category: 'dead', start: '0', end: '0', startValue: '', endValue: '' };
    expect(isBeamDetailDraft({ ...EMPTY_BEAM_DETAILS, loads: Array.from({ length: 33 }, () => load) })).toBe(false);
    expect(isBeamDetailDraft({ ...EMPTY_BEAM_DETAILS, loads: [{ ...load, startValue: 'x'.repeat(33) }] })).toBe(false);
    expect(isBeamDetailDraft({ ...EMPTY_BEAM_DETAILS, loads: [{ ...load, id: 'unsafe id' }] })).toBe(false);
    expect(isBeamDetailDraft({ ...EMPTY_BEAM_DETAILS, bastions: Array.from({ length: 17 }, () => ({ id: 'B1', bed: 'top', count: '2', diameterMm: '16', startM: '0', endM: '1' })) })).toBe(false);
    expect(isBeamDetailDraft({ ...EMPTY_BEAM_DETAILS, stirrupZones: Array.from({ length: 9 }, () => ({ span: '1', endSpacingMm: '100', endLengthM: '1', centerSpacingMm: '200' })) })).toBe(false);
    expect(isBeamDetailDraft({ ...EMPTY_BEAM_DETAILS, unexpected: 'x' })).toBe(false);
  });

  it('lee del storage y persiste el detalle editado', () => {
    const initial = { ...EMPTY_BEAM_DETAILS, loads: [{ id: 'L1', span: '1', kind: 'point' as const, category: 'dead' as const, start: '0', end: '0', startValue: '', endValue: '' }] };
    const values: Record<string, unknown> = { 'beam-details': initial };
    const storage: WorkbenchStorage = { read: (key) => values[key], write: (key, value) => { values[key] = value; } };
    const { result } = renderHook(() => useStoredBeamDetails(storage));
    expect(result.current.details).toEqual(initial);

    const updated = { ...initial, loads: [{ ...initial.loads[0]!, startValue: '12' }] };
    act(() => { result.current.setDetails(updated); });

    expect(result.current.details).toEqual(updated);
    expect(values['beam-details']).toEqual(updated);
  });

  it('refresca el estado cuando memoria abre otro detalle desde el storage', () => {
    const values: Record<string, unknown> = { 'beam-details': EMPTY_BEAM_DETAILS };
    const storage: WorkbenchStorage = { read: (key) => values[key], write: (key, value) => { values[key] = value; } };
    const { result, rerender } = renderHook(() => useStoredBeamDetails(storage));
    const opened = { ...EMPTY_BEAM_DETAILS, loads: [{ id: 'L2', span: '1', kind: 'point' as const, category: 'live' as const, start: '3', end: '', startValue: '10', endValue: '' }] };
    values['beam-details'] = opened;
    rerender();
    expect(result.current.details).toEqual(opened);
  });

  it('rechaza una edición si sumar beam-details excede las 16 entradas sin mutar estado o documento', () => {
    const entries = Object.fromEntries(Array.from({ length: 16 }, (_, index) => [`entry-${index}`, `v${index}`]));
    const persist = vi.fn();
    const storage = createProjectWorkbenchStorage({ kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 7, entries }, persist, 0);
    const { result } = renderHook(() => useStoredBeamDetails(storage));

    act(() => { expect(result.current.setDetails(oversizedValidDetails())).toBe(false); });

    expect(result.current.details).toEqual(EMPTY_BEAM_DETAILS);
    expect(storage.read('beam-details')).toBeUndefined();
    expect(storage.read('entry-0')).toBe('v0');
    storage.flush();
    expect(persist).not.toHaveBeenCalled();
    storage.dispose();
  });

  it('rechaza una edición si el documento excedería 240000 caracteres sin mutar estado o storage', () => {
    const wideRecord = Object.fromEntries(Array.from({ length: 96 }, (_, index) => [`f${index}`.padEnd(31, 'k'), 'x'.repeat(32)]));
    const eightRows = Array.from({ length: 8 }, () => ({ ...wideRecord }));
    const entries = {
      beam: { tag: 'V incompleta', width: '25' }, footing: { tag: 'Z existente', width: '55' }, code: 'ntc-2023', element: 'beam',
      ...Object.fromEntries(['a', 'b', 'c', 'd'].map((key) => [`large-${key}`, eightRows])),
      ...Object.fromEntries(['a', 'b', 'c', 'd'].map((key) => [`small-${key}`, [{ ...wideRecord }]])),
    };
    const initial = { kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 7, entries };
    expect(JSON.stringify(initial).length).toBeLessThan(240_000);
    const persist = vi.fn();
    const storage = createProjectWorkbenchStorage(initial, persist, 0);
    expect(storage.canWrite?.({ 'beam-details': oversizedValidDetails() })).toBe(false);
    const { result } = renderHook(() => useStoredBeamDetails(storage));

    act(() => { expect(result.current.setDetails(oversizedValidDetails())).toBe(false); });

    expect(result.current.details).toEqual(EMPTY_BEAM_DETAILS);
    expect(storage.read('beam-details')).toBeUndefined();
    expect(storage.read('beam')).toEqual(entries.beam);
    storage.flush();
    expect(persist).not.toHaveBeenCalled();
    storage.dispose();
  });

  it('reabre desde localStorage un detalle válido mayor de 8000 caracteres', () => {
    localStorage.clear();
    const details = oversizedValidDetails();
    const serialized = JSON.stringify(details);
    expect(serialized.length).toBeGreaterThan(8_000);
    expect(isBeamDetailDraft(details)).toBe(true);
    const { result, unmount } = renderHook(() => useStoredBeamDetails(browserWorkbenchStorage));
    let accepted: unknown;
    act(() => { accepted = result.current.setDetails(details); });
    unmount();

    const reopened = renderHook(() => useStoredBeamDetails(browserWorkbenchStorage));
    expect(reopened.result.current.details).toEqual(details);
    expect(accepted).toBe(true);
    browserWorkbenchStorage.write('ordinary', 'x'.repeat(8_001));
    expect(browserWorkbenchStorage.read('ordinary')).toBeUndefined();
    localStorage.clear();
  });
});
