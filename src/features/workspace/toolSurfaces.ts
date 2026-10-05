import { lazy } from 'react';
import type { ToolId } from '../../shared/contracts';
import { toolRegistry } from './toolRegistry';

const surface = (id: ToolId) => lazy(async () => ({ default: await toolRegistry.find((tool) => tool.id === id)!.load() }));

export const Model2DTool = surface('model2d');
export const DesignTool = surface('design');
export const Space3DTool = surface('space3d');
export const FemTool = surface('fem');
