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
  it('usa entidades 3D aunque el modelo 2D esté vacío', () => {
    const value = recentProjectPresentation('space3d', bundle({
      space3d: { sourceProjectId: base.id, sourceVersion: 's3d', model: {
        schemaVersion: 4,
        id: 'space',
        name: 'Nave',
        units: 'SI',
        nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
        members: [{ id: 'm1' }, { id: 'm2' }],
      } },
    }), 'es');
    expect(value.meta).toBe('2 barras · 3 nodos');
    expect(value.preview).toBe('tool');
  });

  it('resume la malla FEM guardada, no el modelo 2D', () => {
    const value = recentProjectPresentation('fem', bundle({
      fem: [{ document: { kind: 'fem-document', schemaVersion: 1, id: 'study', nodes: [{}, {}, {}, {}], elements: [{}, {}, {}] } }],
    }), 'es');
    expect(value.meta).toBe('4 nodos · 3 elementos');
    expect(value.preview).toBe('tool');
  });

  it('ignora un snapshot FEM ajeno al final y usa el último estudio FEM reconocible', () => {
    const value = recentProjectPresentation('fem', bundle({
      fem: [
        { document: { kind: 'fem-document', schemaVersion: 1, id: 'study', nodes: [{}, {}], elements: [{}] } },
        { foreign: true },
      ],
    }), 'es');
    expect(value.meta).toBe('2 nodos · 1 elementos');
    expect(value.preview).toBe('tool');
  });

  it('lee elemento y norma desde el documento real del taller de Diseño', () => {
    const value = recentProjectPresentation('design', bundle({
      design: {
        kind: 'fstructure-design-workbench',
        schemaVersion: 2,
        entries: { element: 'column', code: 'ntc-2023' },
      },
    }), 'es');
    expect(value.meta).toBe('Columna · NTC-CDMX 2023');
    expect(value.preview).toBe('tool');
  });
});
