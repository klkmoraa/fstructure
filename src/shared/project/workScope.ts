import type { ProjectModel, SingleWorkTool } from '../../types';
import type { MesaMode } from '../navigation/projectUrl';

/**
 * Cálculo individual o proyecto completo.
 *
 * Un archivo individual abre una sola pantalla (el Modelo 2D, el Modelo 3D o
 * una pieza de Diseño) sin interruptor de modos ni enlaces: lo que se calcula
 * ahí no se sincroniza con nada. Sin `workScope` el archivo es un proyecto
 * completo, con 2D, 3D y Diseño enlazados, como todo lo guardado antes.
 */
export const singleWorkTool = (project: Pick<ProjectModel, 'settings'>): SingleWorkTool | null =>
  project.settings.workScope?.kind === 'single' ? project.settings.workScope.tool : null;

/** Modo de la mesa que muestra cada pantalla individual. */
export const singleWorkMode = (tool: SingleWorkTool): MesaMode =>
  tool === 'model2d' ? 'model' : tool === 'space3d' ? '3d' : 'design';

type SingleDesignElement = Exclude<SingleWorkTool, 'model2d' | 'space3d'>;

/** Pieza del taller de Diseño de un archivo individual; `null` en 2D, 3D o en un proyecto. */
export const singleDesignElement = (project: Pick<ProjectModel, 'settings'>): SingleDesignElement | null => {
  const tool = singleWorkTool(project);
  return tool && tool !== 'model2d' && tool !== 'space3d' ? tool : null;
};

export const SINGLE_WORK_LABEL: Readonly<Record<SingleWorkTool, { readonly es: string; readonly en: string }>> = {
  model2d: { es: 'Modelo 2D', en: '2D model' },
  space3d: { es: 'Modelo 3D', en: '3D model' },
  beam: { es: 'Viga', en: 'Beam' },
  column: { es: 'Columna', en: 'Column' },
  footing: { es: 'Zapata', en: 'Footing' },
  flexure: { es: 'Sección a flexión', en: 'Flexural section' },
  section: { es: 'Estudio de sección', en: 'Section study' },
  frame: { es: 'Pórtico', en: 'Frame' },
};
