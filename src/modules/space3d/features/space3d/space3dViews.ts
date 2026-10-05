/**
 * Vistas del modelo al modo de ETABS: la 3D, una planta por piso y un alzado
 * por eje. Cada vista es un alcance (qué se enseña) más una cámara.
 */
import type { Space3DResolvedGrid } from '../../space3d/model/grid';
import type { Space3DViewPreset } from '../../space3d/view/cameraModel';
import { SPACE3D_SCOPE_3D, type Space3DViewScope } from '../../space3d/view/sceneModel';

export type Space3DViewId = string;

export interface Space3DViewOption {
  readonly id: Space3DViewId;
  readonly group: '3d' | 'plan' | 'elevation';
  readonly scope: Space3DViewScope;
  readonly preset: Space3DViewPreset;
  /** Nombre del piso o del eje, para el rótulo. */
  readonly name: string;
}

const SPACE3D_VIEW_3D: Space3DViewOption = Object.freeze({ id: '3d', group: '3d', scope: SPACE3D_SCOPE_3D, preset: 'isometric', name: '3D' });

/** Todas las vistas que ofrece la rejilla: 3D, plantas de arriba abajo y alzados. */
export const space3DViewOptions = (grid: Space3DResolvedGrid): Space3DViewOption[] => [
  SPACE3D_VIEW_3D,
  ...[...grid.stories].reverse().map((story): Space3DViewOption => ({
    id: `plan:${story.id}`, group: 'plan', name: story.name, preset: 'top',
    scope: { kind: 'plan', storyId: story.id, elevation: story.elevation },
  })),
  ...grid.xLines.map((line): Space3DViewOption => ({
    id: `elev-x:${line.id}`, group: 'elevation', name: line.id, preset: 'side',
    scope: { kind: 'elevation', axis: 'x', lineId: line.id, coordinate: line.coordinate },
  })),
  ...grid.zLines.map((line): Space3DViewOption => ({
    id: `elev-z:${line.id}`, group: 'elevation', name: line.id, preset: 'front',
    scope: { kind: 'elevation', axis: 'z', lineId: line.id, coordinate: line.coordinate },
  })),
];

/** La vista pedida si todavía existe; si no (piso borrado, rejilla nueva), la 3D. */
export const resolveSpace3DView = (options: readonly Space3DViewOption[], id: Space3DViewId): Space3DViewOption =>
  options.find((option) => option.id === id) ?? SPACE3D_VIEW_3D;

/**
 * Plano de dibujo natural de una vista: en planta, el horizontal del piso; en
 * alzado, el vertical del eje. En 3D no hay uno impuesto.
 */
export const space3DViewWorkPlane = (view: Space3DViewOption): { readonly axis: 'x' | 'y' | 'z'; readonly offset: number } | null => {
  if (view.scope.kind === 'plan') return { axis: 'y', offset: view.scope.elevation };
  if (view.scope.kind === 'elevation') return { axis: view.scope.axis, offset: view.scope.coordinate };
  return null;
};
