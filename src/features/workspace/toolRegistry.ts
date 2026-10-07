import type { ToolModuleDescriptor } from '../../shared/contracts';

/** Capability names describe executable behavior exposed by each lazy surface. */
export const toolRegistry: readonly ToolModuleDescriptor[] = [
  {
    id: 'model2d', labelKey: 'navigation.model2d', maturity: 'experimental',
    // Los modos 3D (`adapters/Space3DSurface`) y Diseño (`adapters/DesignSurface`) son parte de la misma mesa.
    capabilities: ['planar-model-editing', 'planar-linear-analysis', 'spatial-model-editing', 'planar-handoff-review',
      'concrete-beam-column-footing-design', 'concrete-section-philosophies', 'concrete-reinforcement-takeoff'],
    load: () => import('./adapters/Model2DSurface').then((module) => module.default),
  },
];
