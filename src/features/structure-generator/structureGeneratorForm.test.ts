import { describe, expect, it } from 'vitest';
import { applyPreparedStructureGeneration, prepareStructureGeneration } from '../../commands/structureGeneration';
import { createBlankProject } from '../../data/defaultProject';
import { analyzeProject } from '../../engine/solver';
import type { ProjectModel } from '../../types';
import {
  DEFAULT_GENERATOR_FORM,
  GENERATOR_FAMILIES,
  GENERATOR_FAMILY_SUPPORT,
  buildGeneratorParams,
  withGeneratorFamily,
  withGeneratorSupport,
} from './structureGeneratorForm';

const generated = (form: typeof DEFAULT_GENERATOR_FORM): ProjectModel => {
  const built = buildGeneratorParams(form, 'kN-m');
  if (!built.ok) throw new Error(JSON.stringify(built.errors));
  const project = createBlankProject();
  return applyPreparedStructureGeneration(project, prepareStructureGeneration(project, built.params));
};

describe('apoyos por omisión del generador avanzado', () => {
  it.each(GENERATOR_FAMILIES.filter((family) => family !== 'circular-ring'))('%s nace con el apoyo usual y se calcula sin completarlo', (family) => {
    const form = withGeneratorFamily(DEFAULT_GENERATOR_FORM, family);
    expect(form.support).toBe(GENERATOR_FAMILY_SUPPORT[family]);
    expect(form.support).not.toBe('none');
    const model = generated(form);
    const supported = model.nodes.filter((node) => node.support.type !== 'none');
    expect(supported.length).toBeGreaterThanOrEqual(2);
    // Una carga cualquiera (en un nudo libre o, si todos son apoyos, a media
    // barra): lo generado es estable tal cual.
    const free = model.nodes.find((node) => node.support.type === 'none');
    const loaded: ProjectModel = {
      ...model,
      loadCases: [{ id: 'P', name: 'Prueba', category: 'permanent', active: true, selfWeightFactor: 0 }],
      combinations: [],
      memberLoads: free ? [] : [{ id: 'p', memberId: model.members[0]!.id, caseId: 'P', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 0.5, px: 1, py: -1 }],
      nodalLoads: free ? [{ id: 'p', nodeId: free.id, caseId: 'P', fx: 1, fy: -1, mz: 0 }] : [],
    };
    const result = analyzeProject(loaded, { id: 'c', name: 'c', factors: { P: 1 } }, { includeEducationTrace: false });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.success).toBe(true);
    // Equilibrio: las reacciones devuelven la carga aplicada.
    expect(result.nodeResults.reduce((sum, node) => sum + node.rx, 0)).toBeCloseTo(-1, 6);
    expect(result.nodeResults.reduce((sum, node) => sum + node.ry, 0)).toBeCloseTo(1, 6);
  });

  it('el apoyo sigue a la familia hasta que la persona lo elige; después se respeta', () => {
    expect(DEFAULT_GENERATOR_FORM.support).toBe('pin');
    const portal = withGeneratorFamily(DEFAULT_GENERATOR_FORM, 'portal-frame');
    expect(portal.support).toBe('fixed');
    expect(withGeneratorFamily(portal, 'circular-arch').support).toBe('pin');

    const none = withGeneratorFamily(withGeneratorSupport(DEFAULT_GENERATOR_FORM, 'none'), 'portal-frame');
    expect(none.support).toBe('none');
    const built = buildGeneratorParams(none, 'kN-m');
    if (!built.ok) throw new Error('parámetros inválidos');
    expect(built.params.baseSupport).toBeUndefined();
    expect(withGeneratorFamily(withGeneratorSupport(portal, 'roller'), 'truss').support).toBe('roller');
  });
});
