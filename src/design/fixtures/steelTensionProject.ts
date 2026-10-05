import { createBlankProject } from '../../data/defaultProject';
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { ProjectModel } from '../../types';

/** Demanda sintética para comprobar el motor existente; no es una plantilla normativa. */
export function steelTensionProject(inclined = false): ProjectModel {
  const steel = findStandardMaterial('steel-a992')!, section = findStandardSection('w6x9')!;
  const dy = inclined ? 2 : 0, length = Math.hypot(5, dy);
  return { ...createBlankProject(), name: 'Acero · prueba analítica de tensión',
    nodes: [{ id: 'A', x: 0, y: 0, support: { type: 'pin' } }, { id: 'B', x: 5, y: dy, support: { type: 'roller', angleDeg: 90 } }],
    members: [{ id: 'T1', i: 'A', j: 'B', type: 'truss', E: steel.elasticModulus, A: section.area, I: section.inertiaX, materialId: steel.id, sectionId: section.id, materialOrigin: 'catalog', sectionOrigin: 'catalog' }],
    loadCases: [{ id: 'P', name: 'Demanda sintética', category: 'permanent', active: true, selfWeightFactor: 0 }],
    nodalLoads: [{ id: 'F', nodeId: 'B', caseId: 'P', fx: 100 * 5 / length, fy: 100 * dy / length, mz: 0 }],
    combinations: [{ id: 'U', name: 'Verificación analítica · 100 kN', factors: { P: 1 }, stateLimit: 'ultimate', edition: '2023', jurisdiction: 'Ciudad de México',
      source: 'Demanda sintética de verificación. Factor 1 capturado; no es una combinación normativa recomendada.',
      sourceUrl: 'https://www.obras.cdmx.gob.mx/storage/app/media/Normas%20tecnicas/NTC-2023.pdf' }],
  };
}
