// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EMPTY_BEAM_DETAILS, isBeamDetailDraft, useStoredBeamDetails } from './beamDetailDraft';
import type { WorkbenchStorage } from './workbenchStorage';

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
});
