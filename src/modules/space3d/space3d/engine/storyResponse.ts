/**
 * Respuesta por piso, como las tablas «Story Drifts» y «Story Forces» de
 * ETABS: para cada piso de la rejilla, el mayor desplazamiento horizontal,
 * la mayor deriva entre nudos alineados verticalmente y el cortante de piso
 * (la suma de las fuerzas aplicadas por encima del piso inferior).
 *
 * Trabaja sobre «muestras»: un único estado en el cálculo estático o un
 * estado por modo en el espectral. `combine` reduce los valores de todas las
 * muestras de una magnitud (identidad en estática, CQC en espectro), así que
 * la deriva espectral se combina modo a modo y no se resta de envolventes.
 */
import { resolveSpace3DGrid, SPACE3D_GRID_TOLERANCE } from '../model/grid';
import type { Space3DProjectV1, Space3DStoryResponse } from '../model/types';

const DOF_PER_NODE = 6;

interface StorySamples {
  /** Desplazamientos globales por muestra (6 por nudo). */
  readonly displacements: readonly (readonly number[])[];
  /** Fuerzas aplicadas globales por muestra (6 por nudo). */
  readonly forces: readonly (readonly number[])[];
  /** Masa global por GDL, si hay estudio dinámico. */
  readonly mass?: ArrayLike<number>;
  readonly combine: (values: Float64Array) => number;
}

const largest = (values: readonly number[]): number =>
  values.reduce((best, value) => (Math.abs(value) > Math.abs(best) ? value : best), 0);

export const computeSpace3DStoryResponse = (project: Space3DProjectV1, samples: StorySamples): Space3DStoryResponse[] => {
  const grid = resolveSpace3DGrid(project);
  const levels = grid.stories
    .map((story) => ({
      story,
      nodes: project.nodes.flatMap((node, index) => (Math.abs(node.y - story.elevation) <= SPACE3D_GRID_TOLERANCE ? [index] : [])),
    }))
    .filter((level) => level.nodes.length > 0);
  if (levels.length < 2) return [];
  const count = samples.displacements.length;
  const buffer = new Float64Array(count);
  const combined = (value: (sample: number) => number): number => {
    for (let sample = 0; sample < count; sample += 1) buffer[sample] = value(sample);
    return samples.combine(buffer);
  };

  const rows: Space3DStoryResponse[] = [];
  for (let level = 1; level < levels.length; level += 1) {
    const { story, nodes } = levels[level];
    const below = levels[level - 1];
    const height = story.elevation - below.story.elevation;
    const cut = below.story.elevation + SPACE3D_GRID_TOLERANCE;
    const pairs: [number, number][] = [];
    for (const upper of nodes) {
      const node = project.nodes[upper];
      const lower = below.nodes.find((candidate) => {
        const other = project.nodes[candidate];
        return Math.abs(other.x - node.x) <= SPACE3D_GRID_TOLERANCE && Math.abs(other.z - node.z) <= SPACE3D_GRID_TOLERANCE;
      });
      if (lower !== undefined) pairs.push([upper, lower]);
    }
    const above = project.nodes.flatMap((node, index) => (node.y > cut ? [index] : []));
    const direction = (axis: 0 | 2) => ({
      displacement: largest(nodes.map((node) => combined((sample) => samples.displacements[sample][node * DOF_PER_NODE + axis]))),
      drift: pairs.length > 0 && height > 0
        ? largest(pairs.map(([upper, lower]) => combined((sample) => (
          samples.displacements[sample][upper * DOF_PER_NODE + axis] - samples.displacements[sample][lower * DOF_PER_NODE + axis]
        ) / height)))
        : null,
      shear: combined((sample) => above.reduce((sum, node) => sum + samples.forces[sample][node * DOF_PER_NODE + axis], 0)),
    });
    const x = direction(0);
    const z = direction(2);
    let mass = 0;
    let mx = 0;
    let mz = 0;
    if (samples.mass) {
      for (const node of nodes) {
        const value = samples.mass[node * DOF_PER_NODE];
        mass += value;
        mx += value * project.nodes[node].x;
        mz += value * project.nodes[node].z;
      }
    }
    rows.push(Object.freeze({
      storyId: story.id,
      name: story.name,
      elevation: story.elevation,
      height,
      displacement: Object.freeze([x.displacement, z.displacement]) as readonly [number, number],
      drift: Object.freeze([x.drift, z.drift]) as readonly [number | null, number | null],
      shear: Object.freeze([x.shear, z.shear]) as readonly [number, number],
      ...(samples.mass ? { mass, centerOfMass: mass > 0 ? Object.freeze([mx / mass, mz / mass]) as readonly [number, number] : null } : {}),
    }));
  }
  // De arriba abajo, como las tablas de ETABS.
  return rows.reverse();
};
