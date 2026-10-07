import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import type { UnifiedProjectBundleV1 } from '../../shared/project/unifiedProjectBundle';
import { recentProjectPresentation } from './recentProjectPresentation';

const base = createBlankProject();
const bundle = (overrides: Partial<UnifiedProjectBundleV1>): UnifiedProjectBundleV1 => ({
  manifest: { schemaVersion: 1, projectId: base.id, sourceVersion: 'test', authoritativeModel: 'model2d' },
  model2d: base,
  space3d: null,
  design: {},
  fem: [],
  ...overrides,
});

describe('recentProjectPresentation', () => {
  it('muestra la filosofía experimental de una sección v3 guardada', () => {
    const value = recentProjectPresentation('model2d', bundle({ design: {
      kind: 'fstructure-design-workbench', schemaVersion: 3,
      entries: { element: 'section', code: 'ntc-2023', section: { philosophy: 'allowable' } },
    } }), 'es');
    expect(value).toEqual({ meta: '', preview: 'model2d', design: 'Sección · Esfuerzos admisibles' });
  });

  it('suma el modelo 3D del proyecto a la tarjeta de FStructure', () => {
    const value = recentProjectPresentation('model2d', bundle({
      space3d: { sourceProjectId: base.id, sourceVersion: 's3d', model: {
        schemaVersion: 4,
        id: 'space',
        name: 'Nave',
        units: 'SI',
        nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
        members: [{ id: 'm1' }, { id: 'm2' }],
      } },
    }), 'es');
    expect(value.space3d).toBe('2 barras · 3 nodos');
    expect(value.preview).toBe('model2d');
  });

  it('lee elemento y norma del modo Diseño desde el documento real del taller', () => {
    const value = recentProjectPresentation('model2d', bundle({
      design: {
        kind: 'fstructure-design-workbench',
        schemaVersion: 2,
        entries: { element: 'column', code: 'ntc-2023' },
      },
    }), 'es');
    expect(value.design).toBe('Columna · NTC-CDMX 2023');
    expect(value.preview).toBe('model2d');
  });
});
