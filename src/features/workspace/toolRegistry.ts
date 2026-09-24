import type { ToolModuleDescriptor } from '../../shared/contracts';

/** Capability names describe executable behavior exposed by each lazy surface. */
export const toolRegistry: readonly ToolModuleDescriptor[] = [
  {
    id: 'model2d', labelKey: 'navigation.model2d', maturity: 'experimental',
    capabilities: ['planar-model-editing', 'planar-linear-analysis'],
    load: () => import('./adapters/Model2DSurface').then((module) => module.default),
  },
  {
    id: 'design', labelKey: 'design.title', maturity: 'experimental',
    capabilities: ['concrete-beam-column-footing-design'],
    load: () => import('./adapters/DesignSurface').then((module) => module.default),
  },
  {
    id: 'space3d', labelKey: 'space3d.title', maturity: 'experimental',
    capabilities: ['spatial-model-editing', 'planar-handoff-review'],
    load: () => import('./adapters/Space3DSurface').then((module) => module.default),
  },
  {
    id: 'fem', labelKey: 'navigation.fem', maturity: 'experimental',
    capabilities: ['fem-linear-elasticity', 'fem-tri3-quad4', 'fem-gmsh41-import', 'fem-quality-fields'],
    load: () => import('../../modules/fem/FemSurface').then((module) => module.FemSurface),
  },
];
