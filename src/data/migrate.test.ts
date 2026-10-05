import { describe, expect, it } from 'vitest';
import { createDefaultProject, CURRENT_SCHEMA_VERSION } from './defaultProject';
import { normalizeProject } from './migrate';

/**
 * Pruebas mínimas: `normalizeProject` es el único portal por el que entra
 * cualquier dato ajeno (un archivo abierto, un enlace compartido, la copia de
 * respaldo local). Estos cuatro casos son los que, si se rompen, o pierden un
 * proyecto real en silencio o dejan pasar uno que no debería aceptarse.
 */
describe('normalizeProject', () => {
  it('conserva un proyecto en el esquema actual sin pérdidas', () => {
    const source = createDefaultProject();
    const normalized = normalizeProject(JSON.parse(JSON.stringify(source)));
    expect(normalized).toEqual(source);
  });

  it('migra un esquema antiguo al actual', () => {
    const source = createDefaultProject();
    const legacy = { ...source, schemaVersion: 2 };
    const normalized = normalizeProject(legacy);
    expect(normalized.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('preserva una identidad personalizada válida al migrar un proyecto persistido', () => {
    const source = createDefaultProject();
    const legacy = {
      ...source,
      schemaVersion: 2,
      settings: { ...source.settings, units: 'custom:T%20%2F%20M:t:m' },
    };

    expect(normalizeProject(legacy).settings.units).toBe('custom:T%20%2F%20M:t:m');
  });

  it('rechaza un esquema más nuevo que el que la aplicación conoce', () => {
    expect(() => normalizeProject({
      ...createDefaultProject(),
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    })).toThrow(/más nueva/);
  });

  it('rechaza valores no finitos y referencias rotas señalando el campo', () => {
    const nonFinite = createDefaultProject();
    nonFinite.nodes[0].x = Number.NaN;
    expect(() => normalizeProject(nonFinite)).toThrow(/nodes\[0\]\.x/);

    const brokenRef = createDefaultProject();
    brokenRef.members[0].i = 'DOES-NOT-EXIST';
    expect(() => normalizeProject(brokenRef)).toThrow(/members\[0\]\.i/);
  });
});
