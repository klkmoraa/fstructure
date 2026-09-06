import type { MemberLoad, ProjectModel } from '../../types';

const EPS = 1e-9;

/** Angles follow the active load coordinate system: 0° is +X and -90° is downward. */
export const pointLoadVectorFromPolar = (magnitude: number, angleDeg: number) => {
  const radians = angleDeg * Math.PI / 180;
  return { px: magnitude * Math.cos(radians), py: magnitude * Math.sin(radians) };
};

export const pointLoadPolarFromVector = (px: number, py: number) => ({
  magnitude: Math.hypot(px, py),
  angleDeg: Math.atan2(py, px) * 180 / Math.PI,
});

export interface PointLoadComponentSplit {
  project: ProjectModel;
  horizontalId?: string;
  verticalId?: string;
}

/** Replaces one diagonal point load with its two equivalent components. */
export const splitPointLoadIntoComponents = (project: ProjectModel, loadId: string): PointLoadComponentSplit => {
  const index = project.memberLoads.findIndex((load) => load.id === loadId);
  const load = project.memberLoads[index];
  if (!load || load.type !== 'point') return { project };
  const px = load.px ?? 0;
  const py = load.py ?? 0;
  if (Math.abs(px) < EPS || Math.abs(py) < EPS) return { project };

  const used = new Set(project.memberLoads.map((item) => item.id));
  const nextId = (prefix: string) => {
    let id = prefix;
    let suffix = 2;
    while (used.has(id)) { id = `${prefix}-${suffix}`; suffix += 1; }
    used.add(id);
    return id;
  };
  const horizontalId = nextId(`${load.id}-H`);
  const verticalId = nextId(`${load.id}-V`);
  const horizontal: MemberLoad = { ...load, id: horizontalId, px, py: 0 };
  const vertical: MemberLoad = { ...load, id: verticalId, px: 0, py };
  return {
    project: { ...project, memberLoads: project.memberLoads.flatMap((item) => item.id === loadId ? [horizontal, vertical] : [item]) },
    horizontalId,
    verticalId,
  };
};
