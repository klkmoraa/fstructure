import type { ParametricSectionDefinition } from './personalSections';
export const defaultParametricDefinition = (family: ParametricSectionDefinition['family']): ParametricSectionDefinition => {
  if (family === 'circle') return { family, diameter: .3 };
  if (family === 'circular-tube') return { family, outerDiameter: .3, thickness: .01 };
  if (family === 'symmetric-i' || family === 'channel') return { family, width: .2, depth: .3, webThickness: .008, flangeThickness: .012 };
  if (family === 'angle' || family === 'rectangular-box') return { family, width: .2, depth: .3, thickness: .01 };
  return { family, width: .3, depth: .5 };
};
