import type { AnalysisResult, DiagramQuantity, MemberModel, NodeModel, ProjectModel } from '../../types';
import type { ResultTab } from '../../store/ProjectContext';
import type { CanvasCamera } from './canvasInteraction';
import { memberAxis } from '../../graphics/structureGeometry';
import { toDisplay } from '../../foundation/units';
import { formatFixed } from '../../utils/numberFormat';
import { smartLabelRectsOverlap, type SmartLabelRect } from './labelLayout';

type MemberResult = AnalysisResult['memberResults'][number];
type CriticalPoint = MemberResult['criticalPoints'][number];
type Units = ProjectModel['settings']['units'];

/**
 * Geometría de los sellos de extremo (Mmax/Mmin, Vmax/Vmin).
 *
 * Vive fuera del componente que los dibuja porque hay DOS superficies que
 * necesitan las mismas cajas: la que las pinta y la que coloca las etiquetas
 * del lienzo. Mientras cada una calculaba su versión, los sellos y las
 * etiquetas se ignoraban y acababan una encima de otra sobre el pico, que es
 * justo la cifra que hay que poder leer.
 *
 * Es una función pura de presentación: no toca el modelo y no recalcula el
 * análisis. Los valores y sus estaciones vienen resueltos en `criticalPoints`.
 */

/**
 * Un extremo sólo se sella si vale al menos esta fracción del máximo global del
 * diagrama. Sin el filtro, una estructura de treinta barras se cubre de
 * etiquetas —incluidas las de los tramos que apenas trabajan— y el sello deja
 * de señalar nada. Con él quedan los picos que de verdad gobiernan.
 */
export const CRITICAL_MARKER_MIN_SHARE = 0.15;

/** Alto del sello, en píxeles de pantalla. */
const STAMP_HEIGHT = 25;

/**
 * Anchos de avance del monoespaciado en los dos tamaños del sello. El valor va
 * a 9px y la estación a 8px (`phase2.css`); estimar las dos líneas con el mismo
 * factor dejaba la primera fuera de la caja y el sello aparecía recortado
 * contra el borde del lienzo.
 */
const VALUE_ADVANCE = 5.5;
const STATION_ADVANCE = 4.9;

/** Desplazamientos que prueba un sello cuando su sitio natural está ocupado. */
const RELIEF_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 0, y: -(STAMP_HEIGHT + 6) },
  { x: 0, y: STAMP_HEIGHT + 6 },
  { x: 0, y: -2 * (STAMP_HEIGHT + 6) },
  { x: 0, y: 2 * (STAMP_HEIGHT + 6) },
  { x: -70, y: -(STAMP_HEIGHT + 6) },
  { x: 70, y: -(STAMP_HEIGHT + 6) },
  { x: -70, y: STAMP_HEIGHT + 6 },
  { x: 70, y: STAMP_HEIGHT + 6 },
];

/** Superficie compartida por dos cajas, para elegir el mal menor. */
const overlapArea = (first: SmartLabelRect, second: SmartLabelRect): number => {
  const width = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  const height = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
  return width > 0 && height > 0 ? width * height : 0;
};

/** Extremos M/V ya resueltos por el análisis, listos para sellar sobre la barra. */
export const criticalExtremesFor = (
  points: ReadonlyArray<CriticalPoint>,
  quantity: DiagramQuantity,
  floor: number,
): Array<{ point: CriticalPoint; extreme: 'max' | 'min' }> => {
  const candidates = points.filter((point) => point.quantity === quantity);
  if (candidates.length === 0) return [];
  const highest = candidates.reduce((best, point) => (point.value > best.value ? point : best));
  const lowest = candidates.reduce((best, point) => (point.value < best.value ? point : best));
  const marks: Array<{ point: CriticalPoint; extreme: 'max' | 'min' }> = [];
  if (Math.abs(highest.value) >= floor) marks.push({ point: highest, extreme: 'max' });
  // Un diagrama de signo constante tiene un solo extremo interesante: sellarlo
  // dos veces apilaría dos etiquetas idénticas sobre el mismo punto.
  if (Math.abs(lowest.value) >= floor && Math.abs(lowest.value - highest.value) > 1e-9) {
    marks.push({ point: lowest, extreme: 'min' });
  }
  return marks;
};

export interface CriticalStamp {
  key: string;
  memberId: string;
  extreme: 'max' | 'min';
  /** Punto sobre la barra del que sale el tallo. */
  base: { x: number; y: number };
  /** Punta del tallo, sobre la curva del diagrama. */
  tip: { x: number; y: number };
  /** Caja del sello en coordenadas de pantalla. */
  rect: SmartLabelRect;
  value: string;
  station: string;
}

export interface CriticalStampInput {
  project: ProjectModel;
  resultTab: ResultTab;
  diagramSide: 'positive' | 'negative';
  camera: CanvasCamera;
  toScreen: (x: number, y: number) => { x: number; y: number };
  nodeMap: Map<string, NodeModel>;
  resultMap: Map<string, MemberResult>;
  globalDiagramMax: number;
  diagramPixelScaleFor: (result: MemberResult) => number;
  units: Units;
  lengthLabel: string;
  forceLabel: string;
  momentLabel: string;
  size: { width: number; height: number };
}

/**
 * Sellos que corresponden a la pestaña de resultado activa. Sólo cortante y
 * momento los tienen: son las dos magnitudes cuyo pico gobierna una decisión y
 * cuya estación hay que poder leer sin mover el cursor por la curva.
 */
export const criticalStampsFor = ({
  project, resultTab, diagramSide, camera, toScreen, nodeMap, resultMap,
  globalDiagramMax, diagramPixelScaleFor, units, lengthLabel, forceLabel, momentLabel, size,
}: CriticalStampInput): CriticalStamp[] => {
  if (resultTab !== 'shear' && resultTab !== 'moment') return [];
  const quantity = resultTab as DiagramQuantity;
  const symbol = quantity === 'shear' ? 'V' : 'M';
  const displayQuantity = quantity === 'moment' ? 'moment' as const : 'force' as const;
  const valueUnit = quantity === 'moment' ? momentLabel : forceLabel;
  const floor = Math.max(globalDiagramMax * CRITICAL_MARKER_MIN_SHARE, 1e-9);
  const side = diagramSide === 'negative' ? -1 : 1;

  const placed: SmartLabelRect[] = [];
  const settle = (natural: SmartLabelRect): SmartLabelRect => {
    let leastCrowded: { rect: SmartLabelRect; area: number } | null = null;
    for (const offset of RELIEF_OFFSETS) {
      const rect: SmartLabelRect = {
        ...natural,
        x: Math.min(Math.max(natural.x + offset.x, 4), Math.max(size.width - natural.width - 4, 4)),
        y: Math.min(Math.max(natural.y + offset.y, 4), Math.max(size.height - natural.height - 4, 4)),
      };
      const collisions = placed.filter((other) => smartLabelRectsOverlap(rect, other, 4));
      if (collisions.length === 0) return rect;
      const area = collisions.reduce((total, other) => total + overlapArea(rect, other), 0);
      if (!leastCrowded || area < leastCrowded.area) leastCrowded = { rect, area };
    }
    return leastCrowded?.rect ?? natural;
  };

  return project.members.flatMap<CriticalStamp>((member: MemberModel) => {
    const result = resultMap.get(member.id);
    const ni = nodeMap.get(member.i);
    const nj = nodeMap.get(member.j);
    if (!result || !ni || !nj || !result.criticalPoints.length) return [];
    const axis = memberAxis(member, ni, nj);
    if (axis.length <= 1e-12) return [];
    const nx = axis.normal.x * side;
    const ny = axis.normal.y * side;
    const diagramPixelScale = diagramPixelScaleFor(result);

    return criticalExtremesFor(result.criticalPoints, quantity, floor).map(({ point, extreme }) => {
      const grossX = (result.startOffset ?? 0) + point.x;
      const baseX = ni.x + axis.c * grossX;
      const baseY = ni.y + axis.s * grossX;
      const offsetModel = (point.value * diagramPixelScale) / camera.scale;
      const base = toScreen(baseX, baseY);
      const tip = toScreen(baseX + nx * offsetModel, baseY + ny * offsetModel);
      const value = `${symbol}${extreme === 'max' ? 'max' : 'min'} ${formatFixed(toDisplay(point.value, units, displayQuantity), 2)} ${valueUnit}`;
      const station = `x ${formatFixed(toDisplay(point.x, units, 'length'), 2)} ${lengthLabel}`;
      // El sello se aparta hacia el lado libre del diagrama, nunca hacia la
      // barra: ahí es donde ya hay geometría y etiquetas de modelo.
      const away = Math.sign(offsetModel) || 1;
      const width = Math.max(value.length * VALUE_ADVANCE, station.length * STATION_ADVANCE) + 12;
      const natural: SmartLabelRect = {
        x: Math.min(Math.max(tip.x + nx * away * 9, 4), Math.max(size.width - width - 4, 4)),
        y: Math.min(Math.max(tip.y + ny * away * 9 - 11, 4), Math.max(size.height - STAMP_HEIGHT - 4, 4)),
        width,
        height: STAMP_HEIGHT,
      };
      // Dos picos vecinos con la misma magnitud caen en el mismo sitio: el
      // sello se aparta al hueco libre más cercano antes de dibujarse.
      const rect = settle(natural);
      placed.push(rect);
      return {
        key: `${member.id}-${quantity}-${extreme}`,
        memberId: member.id,
        extreme,
        base,
        tip,
        rect,
        value,
        station,
      };
    });
  });
};
