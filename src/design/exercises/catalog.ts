import { developmentLength } from './anchorage';
import { cantileverBeam, simpleBeam } from './beams';
import { columnAxial, columnInteraction } from './column';
import { doublyReinforcedCheck, rectangularCheck, rectangularDesign, rectangularSizing, tBeamCheck } from './flexure';
import { isolatedFooting } from './footing';
import { shearCheck, shearDesign } from './shear';
import type { ExerciseTopic } from './types';

/**
 * Índice del cuaderno, ordenado como un libro de concreto reforzado: primero
 * el análisis de la viga, luego flexión, cortante, columnas, cimentación y
 * anclaje. Cada tema ofrece sus incógnitas («¿Qué buscas?»).
 */
export const EXERCISE_TOPICS: readonly ExerciseTopic[] = [
  { id: 'beam-simple', chapter: 'Análisis', title: 'Viga simplemente apoyada', summary: 'Reacciones, cortante, momento y flecha con carga uniforme y puntual.', problems: [simpleBeam] },
  { id: 'beam-cantilever', chapter: 'Análisis', title: 'Voladizo', summary: 'Reacciones, diagramas y flecha de una viga en voladizo.', problems: [cantileverBeam] },
  { id: 'flexure-rect', chapter: 'Flexión', title: 'Sección rectangular', summary: 'Revisar el momento resistente, calcular el acero o dimensionar la sección.', problems: [rectangularCheck, rectangularDesign, rectangularSizing], piece: 'flexure' },
  { id: 'flexure-double', chapter: 'Flexión', title: 'Doblemente armada', summary: 'Momento resistente con acero de compresión, fluya o no.', problems: [doublyReinforcedCheck], piece: 'beam' },
  { id: 'flexure-t', chapter: 'Flexión', title: 'Viga T', summary: 'Bloque de compresión en el patín o en el alma.', problems: [tBeamCheck], piece: 'beam' },
  { id: 'shear-beam', chapter: 'Cortante', title: 'Estribos en vigas', summary: 'Separación de estribos para un cortante, o resistencia de un armado dado.', problems: [shearDesign, shearCheck], piece: 'beam' },
  { id: 'column-axial', chapter: 'Columnas', title: 'Carga axial', summary: 'Resistencia de una columna corta a compresión pura.', problems: [columnAxial], piece: 'column' },
  { id: 'column-interaction', chapter: 'Columnas', title: 'Flexocompresión', summary: 'Diagrama de interacción y revisión de un punto (Mu, Pu).', problems: [columnInteraction], piece: 'column' },
  { id: 'footing-isolated', chapter: 'Cimentación', title: 'Zapata aislada', summary: 'Lado por el suelo, peralte por cortante y parrilla por flexión.', problems: [isolatedFooting], piece: 'footing' },
  { id: 'anchorage', chapter: 'Anclaje', title: 'Desarrollo y traslape', summary: 'Longitud recta, con gancho y de traslape de una barra.', problems: [developmentLength] },
];

export const EXERCISE_CHAPTERS: readonly string[] = [...new Set(EXERCISE_TOPICS.map((topic) => topic.chapter))];

export const exerciseTopic = (id: string | null | undefined): ExerciseTopic | undefined => EXERCISE_TOPICS.find((topic) => topic.id === id);
