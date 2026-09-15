import type { ToolModuleDescriptor } from '../../shared/contracts';

/** Capability names describe executable behavior; FEM currently has no engine. */
export const toolRegistry: readonly ToolModuleDescriptor[] = [
  {
    id: 'model2d', labelKey: 'navigation.model2d', maturity: 'experimental',
    capabilities: ['planar-model-editing', 'planar-linear-analysis'],
    load: () => import('./adapters/Model2DSurface').then((module) => module.default),
  },
  {
    id: 'design', labelKey: 'design.title', maturity: 'experimental',
    capabilities: ['ntc-cdmx-2023-concrete-beam-design'],
    load: () => import('./adapters/DesignSurface').then((module) => module.default),
  },
  {
    id: 'space3d', labelKey: 'space3d.title', maturity: 'experimental',
    capabilities: ['spatial-model-editing', 'planar-handoff-review'],
    load: () => import('./adapters/Space3DSurface').then((module) => module.default),
  },
  {
    id: 'fem', labelKey: 'navigation.fem', maturity: 'experimental', capabilities: [],
    load: () => import('../../modules/fem/FemSurface').then((module) => module.FemSurface),
  },
];
