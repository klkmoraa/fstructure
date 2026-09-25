/**
 * Rejilla de ejes y pisos al modo de ETABS.
 *
 * La rejilla es geometría de trabajo: fija las plantas y los alzados que la
 * interfaz ofrece y los puntos donde se dibuja. El cálculo no la lee; sólo
 * la respuesta por piso (derivas, cortantes) agrupa resultados con ella.
 *
 * Un proyecto anterior al esquema 3, o uno importado sin rejilla, sigue
 * teniendo plantas y alzados: se derivan de las coordenadas de sus nudos y se
 * marcan como automáticos, sin guardarse hasta que la persona los edite.
 */
import type { Space3DGridLine, Space3DGridSystem, Space3DProjectV1, Space3DStory } from './types';

/** Tolerancia para agrupar coordenadas en un mismo eje o nivel, m. */
export const SPACE3D_GRID_TOLERANCE = 1e-3;
/** Más ejes que esto en una rejilla automática ya no ayuda a leer el modelo. */
const MAX_AUTOMATIC_LINES = 40;

/** A, B, …, Z, AA, AB, … */
export const space3DLetterLabel = (index: number): string => {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};

export const space3DStoryLabel = (index: number): string => (index === 0 ? 'Base' : `Piso ${index}`);

const round = (value: number) => Number(value.toFixed(6));

/** Coordenadas agrupadas por tolerancia, ordenadas. */
const clusterCoordinates = (values: readonly number[], tolerance = SPACE3D_GRID_TOLERANCE): number[] => {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const value of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && value - last[last.length - 1] <= tolerance) last.push(value);
    else clusters.push([value]);
  }
  return clusters.map((cluster) => round(cluster.reduce((sum, value) => sum + value, 0) / cluster.length));
};

interface Space3DGridFromSpacings {
  /** Separaciones sucesivas en X, m. */
  readonly xSpacings: readonly number[];
  readonly zSpacings: readonly number[];
  /** Alturas de piso sucesivas, m. */
  readonly storyHeights: readonly number[];
  readonly origin?: readonly [number, number, number];
}

/** Rejilla regular a partir de separaciones, como la plantilla rápida de ETABS. */
export const createSpace3DGrid = ({ xSpacings, zSpacings, storyHeights, origin = [0, 0, 0] }: Space3DGridFromSpacings): Space3DGridSystem => {
  const accumulate = (start: number, steps: readonly number[]) => steps.reduce<number[]>((acc, step) => [...acc, round(acc[acc.length - 1] + step)], [round(start)]);
  const xs = accumulate(origin[0], xSpacings);
  const zs = accumulate(origin[2], zSpacings);
  const ys = accumulate(origin[1], storyHeights);
  return {
    xLines: xs.map((coordinate, index) => ({ id: space3DLetterLabel(index), coordinate })),
    zLines: zs.map((coordinate, index) => ({ id: String(index + 1), coordinate })),
    stories: ys.map((elevation, index) => ({ id: index === 0 ? 'BASE' : `S${index}`, name: space3DStoryLabel(index), elevation })),
  };
};

/** Rejilla implícita en las coordenadas de los nudos. */
export const deriveAutomaticSpace3DGrid = (project: Pick<Space3DProjectV1, 'nodes'>): Space3DGridSystem => {
  const xs = clusterCoordinates(project.nodes.map((node) => node.x));
  const zs = clusterCoordinates(project.nodes.map((node) => node.z));
  const ys = clusterCoordinates(project.nodes.map((node) => node.y));
  const limit = <T>(items: readonly T[]) => (items.length <= MAX_AUTOMATIC_LINES ? [...items] : []);
  return {
    xLines: limit(xs).map((coordinate, index) => ({ id: space3DLetterLabel(index), coordinate })),
    zLines: limit(zs).map((coordinate, index) => ({ id: String(index + 1), coordinate })),
    stories: limit(ys).map((elevation, index) => ({ id: index === 0 ? 'BASE' : `S${index}`, name: space3DStoryLabel(index), elevation })),
  };
};

export interface Space3DResolvedGrid extends Space3DGridSystem {
  /** `true` si se dedujo de los nudos y no está guardada en el proyecto. */
  readonly automatic: boolean;
}

const sortLines = (lines: readonly Space3DGridLine[]) => [...lines].sort((a, b) => a.coordinate - b.coordinate);
const sortStories = (stories: readonly Space3DStory[]) => [...stories].sort((a, b) => a.elevation - b.elevation);

/** La rejilla del proyecto, o la automática si no tiene. Siempre ordenada. */
export const resolveSpace3DGrid = (project: Pick<Space3DProjectV1, 'nodes' | 'grid'>): Space3DResolvedGrid => {
  const source = project.grid ?? deriveAutomaticSpace3DGrid(project);
  return {
    xLines: sortLines(source.xLines),
    zLines: sortLines(source.zLines),
    stories: sortStories(source.stories),
    automatic: project.grid === undefined,
  };
};

/** Piso cuya elevación coincide con `y`, si lo hay. */
export const space3DStoryAt = (grid: Space3DGridSystem, y: number, tolerance = SPACE3D_GRID_TOLERANCE): Space3DStory | undefined =>
  grid.stories.find((story) => Math.abs(story.elevation - y) <= tolerance);

/** Intersecciones de la rejilla en un piso: los puntos donde se dibuja en planta. */
export const space3DGridPointsAt = (grid: Space3DGridSystem, elevation: number): [number, number, number][] =>
  grid.xLines.flatMap((x) => grid.zLines.map((z) => [x.coordinate, elevation, z.coordinate] as [number, number, number]));

/** Separaciones sucesivas de una lista de coordenadas (para editar la rejilla). */
export const space3DSpacings = (coordinates: readonly number[]): number[] =>
  coordinates.slice(1).map((value, index) => round(value - coordinates[index]));
