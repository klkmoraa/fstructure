import { lazy } from 'react';
import type { ToolId } from '../../shared/contracts';
import { toolRegistry } from './toolRegistry';

const surface = (id: ToolId) => lazy(async () => ({ default: await toolRegistry.find((tool) => tool.id === id)!.load() }));

export const Model2DTool = surface('model2d');
/** Modo Diseño de la mesa de FStructure: el taller de concreto sobre el mismo proyecto. */
export const DesignModeTool = lazy(() => import('./adapters/DesignSurface'));
export const Space3DTool = surface('space3d');
export const FemTool = surface('fem');
