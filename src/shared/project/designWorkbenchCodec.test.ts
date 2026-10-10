import { describe, expect, it } from 'vitest';
import {
  DESIGN_WORKBENCH_SCHEMA_VERSION,
  inspectDesignDocument,
} from './designWorkbenchCodec';

const document = (entries: Record<string, unknown>, schemaVersion = 8) => ({
  kind: 'fstructure-design-workbench', schemaVersion, entries,
});

describe('inspectDesignDocument', () => {
  it('treats only nullish values and a plain empty object as empty', () => {
    expect(inspectDesignDocument(undefined).status).toBe('empty');
    expect(inspectDesignDocument(null).status).toBe('empty');
    expect(inspectDesignDocument({}).status).toBe('empty');
    expect(inspectDesignDocument([]).status).toBe('opaque');
    expect(inspectDesignDocument({ legacy: true }).status).toBe('opaque');
  });

  it('accepts supported versions and preserves valid incomplete fields', () => {
    expect(DESIGN_WORKBENCH_SCHEMA_VERSION).toBe(8);
    for (let version = 1; version <= 8; version += 1) {
      const result = inspectDesignDocument(document({ beam: { moment: '' }, 'old-field': 'yes' }, version));
      expect(result.status).toBe('supported');
      expect(result.entries).toEqual({ beam: { moment: '' }, 'old-field': 'yes' });
    }
  });

  it('rejects the complete known document when any entry is invalid', () => {
    const result = inspectDesignDocument(document({ beam: { moment: '' }, 'bad-key!': 'value' }));
    expect(result.status).toBe('invalid');
    expect(result.entries).toBeNull();
  });

  it('rejects an unknown wrapper field so a later v7 write cannot erase it', () => {
    const result = inspectDesignDocument({ ...document({ beam: { moment: '' } }), extraTop: 'preservar' });
    expect(result.status).toBe('invalid');
    expect(result.reason).toMatch(/campo|envoltura|documento/i);
  });

  it('rejects malformed memory rows and memory over its existing 180000-character limit', () => {
    expect(inspectDesignDocument(document({ memory: [{ id: 'm1', fields: { value: 'x' } }] })).status).toBe('invalid');
    const fields = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`f${index}`.padEnd(32, 'k'), 'v'.repeat(32)]));
    const memory = Array.from({ length: 60 }, (_, index) => ({ id: `m${index}`, element: 'beam', code: 'ntc-2023', savedAt: '2026-10-09', fields }));
    expect(JSON.stringify(memory).length).toBeLessThan(180_000);
    expect(inspectDesignDocument(document({ memory })).status).toBe('supported');
    const oversizedFields = Object.fromEntries(Array.from({ length: 42 }, (_, index) => [`f${index}`.padEnd(32, 'k'), 'v'.repeat(32)]));
    const oversizedMemory = Array.from({ length: 60 }, (_, index) => ({ id: `m${index}`, element: 'beam', code: 'ntc-2023', savedAt: '2026-10-09', fields: oversizedFields }));
    expect(JSON.stringify(oversizedMemory).length).toBeGreaterThan(180_000);
    expect(inspectDesignDocument(document({ memory: oversizedMemory })).status).toBe('invalid');
  });

  it('keeps unknown future versions opaque with their schema version', () => {
    expect(inspectDesignDocument(document({ future: { nested: [1, true] } }, 12))).toMatchObject({
      status: 'future', schemaVersion: 12, entries: null,
    });
  });

  it('validates linked origins and rejects non-finite actions and oversized bases atomically', () => {
    const origin = { version: 1, snapshot: {
      version: 1, source: { kind: 'model3d', projectId: 'p1', revision: 'r1', memberId: 'C1', axisId: 'x:0' },
      target: { id: 'LC1', label: 'LC1', kind: 'combination', factors: [{ caseId: 'D', factor: 1 }] },
      station: { xM: 1, side: 'right', lengthM: 3 }, units: 'kN-m',
      axes: { convention: 'local', localBasis: [[0, 1, 0], [0, 0, 1], [1, 0, 0]] },
      actions: { nKn: -200, vyKn: 5, vzKn: 10, torsionKnm: 4, myKnm: -20, mzKnm: 10 },
      member: { id: 'C1', label: 'C1', family: 'column', levelId: 'L1', axisIds: ['x:0'], lengthM: 3,
        section: { shape: 'rectangular', widthMm: 300, depthMm: 500, fcMpa: 25, materialLabel: 'Concreto' }, start: [0, 0, 0], end: [0, 3, 0] },
    }, copiedFields: { axial: '200' } };
    expect(inspectDesignDocument(document({ 'piece-origin': { version: 1, byElement: { column: origin } } })).status).toBe('supported');
    const nanOrigin = structuredClone(origin) as typeof origin;
    nanOrigin.snapshot.actions.nKn = Number.NaN;
    expect(inspectDesignDocument(document({ 'piece-origin': { version: 1, byElement: { column: nanOrigin } } })).status).toBe('invalid');
    const longBasis = structuredClone(origin) as typeof origin;
    longBasis.snapshot.axes.localBasis.push([1, 0, 0]);
    expect(inspectDesignDocument(document({ 'piece-origin': { version: 1, byElement: { column: longBasis } } })).status).toBe('invalid');
  });
});
