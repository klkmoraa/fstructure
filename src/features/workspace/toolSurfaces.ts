import { lazy } from 'react';
import type { ToolId } from '../../shared/contracts';
import { toolRegistry } from './toolRegistry';

const surface = (id: ToolId) => lazy(async () => ({ default: await toolRegistry.find((tool) => tool.id === id)!.load() }));

export const Model2DTool = surface('model2d');
const loadDesignMode = () => import('./adapters/DesignSurface');
const loadSpace3DMode = () => import('./adapters/Space3DSurface');

/** Modo Diseño de la mesa de FStructure: el taller de concreto sobre el mismo proyecto. */
export const DesignModeTool = lazy(loadDesignMode);
/** Modo 3D de la mesa de FStructure: el modelo espacial del mismo proyecto. */
export const Space3DModeTool = lazy(loadSpace3DMode);

/**
 * Descarga el código de un modo antes de entrar: al pasar el puntero por su
 * botón, o al iniciar la transición. Así la animación encuentra la mesa lista.
 */
export const preloadMesaMode = (mode: 'model' | '3d' | 'design'): Promise<unknown> =>
  (mode === '3d' ? loadSpace3DMode() : mode === 'design' ? loadDesignMode() : Promise.resolve()).catch(() => undefined);
export const FemTool = surface('fem');
