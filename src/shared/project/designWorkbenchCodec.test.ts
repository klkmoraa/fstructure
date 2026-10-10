import { describe, expect, it } from 'vitest';
import {
  DESIGN_WORKBENCH_SCHEMA_VERSION,
  inspectDesignDocument,
} from './designWorkbenchCodec';

const document = (entries: Record<string, unknown>, schemaVersion = 7) => ({
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
    expect(DESIGN_WORKBENCH_SCHEMA_VERSION).toBe(7);
    for (let version = 1; version <= 7; version += 1) {
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
});
