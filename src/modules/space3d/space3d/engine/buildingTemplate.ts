/**
 * Plantilla rápida de edificio, como «New Model → Quick Templates» de ETABS.
 *
 * A partir de una rejilla (vanos en X y Z, alturas de piso) genera columnas y
 * vigas con secciones de catálogo, apoyos en la base y un juego de cargas de
 * edificio listo para analizar:
 *
 *   · DEAD: peso propio de las barras (multiplicador 1) más la carga muerta
 *     sobreimpuesta de losa;
 *   · LIVE: carga viva de losa;
 *   · SX (opcional): fuerzas laterales estáticas en +X, repartidas por piso
 *     con la ley triangular inversa `Fᵢ = V·wᵢhᵢ / Σ wⱼhⱼ`;
 *   · combinaciones de servicio y de resistencia genéricas, marcadas como
 *     ejemplo: no sustituyen las de la norma que aplique.
 *
 * La carga de losa llega a las vigas por áreas tributarias a 45° de cada
 * paño (reparto de losa en dos direcciones): trapecios en los lados largos y
 * triángulos en los cortos, con la resultante exacta `q·a·b` por paño.
 */
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  fixedSpace3DRestraints,
  freeSpace3DRestraints,
  type Space3DFrameMember,
  type Space3DLoadCombination,
  type Space3DMemberLoad,
  type Space3DNodalLoad,
  type Space3DNode,
  type Space3DProjectV1,
  type Space3DRestraints,
} from '../model/types';
import { SPACE3D_MATERIALS, SPACE3D_SECTION_CATALOG } from '../model/sectionLibrary';
import { createSpace3DGrid } from '../model/grid';
import { validateSpace3DProject } from '../model/validation';
import { estimateSpace3DStaticBytes } from './solver';
import { assessAnalysisAdmission, createAutomaticAnalysisBudget } from '../../../../numeric/admission';
import { SPACE3D_GRAVITY } from './memberLoading';

export interface Space3DBuildingTemplateOptions {
  readonly id?: string;
  readonly name?: string;
  /** Separaciones de los ejes en X (A, B, C…), m. */
  readonly xSpacings: readonly number[];
  /** Separaciones de los ejes en Z (1, 2, 3…), m. */
  readonly zSpacings: readonly number[];
  /** Alturas de piso de abajo arriba, m. */
  readonly storyHeights: readonly number[];
  readonly baseSupport?: 'fixed' | 'pinned';
  /** Nombre de catálogo de la sección de columnas. */
  readonly columnSection?: string;
  /** Nombre de catálogo de la sección de vigas. */
  readonly beamSection?: string;
  /** Carga muerta sobreimpuesta de losa, kN/m². */
  readonly superDeadLoad?: number;
  /** Carga viva de losa, kN/m². */
  readonly liveLoad?: number;
  /** Coeficiente de cortante basal en +X (0 lo omite). */
  readonly lateralCoefficient?: number;
}

const pinned = (): Space3DRestraints => ({ ux: true, uy: true, uz: true, rx: false, ry: false, rz: false });

const finitePositive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} debe ser un número finito mayor que cero`);
  return value;
};

const finiteNonNegative = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} debe ser un número finito no negativo`);
  return value;
};

const sectionMember = (sectionName: string) => {
  const section = SPACE3D_SECTION_CATALOG.find((item) => item.name === sectionName);
  if (!section) throw new RangeError(`La sección «${sectionName}» no está en el catálogo`);
  const material = SPACE3D_MATERIALS.find((item) => item.id === section.materialId)!;
  return {
    E: material.E, G: material.G, A: section.A, Iy: section.Iy, Iz: section.Iz, J: section.J,
    type: 'frame' as const,
    materialId: material.id, materialOrigin: 'catalog' as const,
    sectionId: section.name, sectionOrigin: 'catalog' as const,
    density: material.massDensityKgPerM3,
  };
};

/**
 * Cargas de un paño a×b sobre una de sus vigas de borde, en posiciones
 * relativas. `span` es la longitud de esa viga y `other` la del lado
 * perpendicular. Devuelve tramos lineales (inicio, fin, q inicio, q fin).
 */
const panelEdgeSegments = (span: number, other: number, pressure: number): [number, number, number, number][] => {
  const half = Math.min(span, other) / 2;
  const peak = pressure * half;
  if (other >= span) {
    // Lado corto: triángulo con pico q·a/2 en el centro.
    return [[0, 0.5, 0, peak], [0.5, 1, peak, 0]];
  }
  const ramp = half / span;
  return [[0, ramp, 0, peak], [ramp, 1 - ramp, peak, peak], [1 - ramp, 1, peak, 0]];
};

export const generateSpace3DBuilding = (options: Space3DBuildingTemplateOptions): Space3DProjectV1 => {
  const xSpacings = options.xSpacings.map((value, index) => finitePositive(value, `xSpacings[${index}]`));
  const zSpacings = options.zSpacings.map((value, index) => finitePositive(value, `zSpacings[${index}]`));
  const storyHeights = options.storyHeights.map((value, index) => finitePositive(value, `storyHeights[${index}]`));
  if (xSpacings.length === 0 || zSpacings.length === 0 || storyHeights.length === 0) {
    throw new RangeError('La plantilla necesita al menos un vano en X, uno en Z y un piso');
  }
  const superDead = finiteNonNegative(options.superDeadLoad ?? 2, 'superDeadLoad');
  const live = finiteNonNegative(options.liveLoad ?? 2, 'liveLoad');
  const lateral = finiteNonNegative(options.lateralCoefficient ?? 0, 'lateralCoefficient');

  const nx = xSpacings.length + 1;
  const nz = zSpacings.length + 1;
  const ny = storyHeights.length + 1;
  const nodeCount = nx * nz * ny;
  const memberCount = (ny - 1) * (nx * nz + (nx - 1) * nz + nx * (nz - 1));
  const admission = assessAnalysisAdmission(estimateSpace3DStaticBytes(nodeCount, memberCount), createAutomaticAnalysisBudget());
  if (!admission.accepted) {
    throw new RangeError(`La geometría solicitada excede el presupuesto de análisis seguro (${nodeCount} nudos, ${memberCount} barras)`);
  }

  const grid = createSpace3DGrid({ xSpacings, zSpacings, storyHeights });
  const column = sectionMember(options.columnSection ?? 'HEB 240');
  const beam = sectionMember(options.beamSection ?? 'IPE 300');
  const nodeId = (ix: number, iy: number, iz: number) => `${grid.xLines[ix].id}${grid.zLines[iz].id}-${iy}`;

  const nodes: Space3DNode[] = [];
  for (let iy = 0; iy < ny; iy += 1) {
    const restraints = iy === 0 ? (options.baseSupport === 'pinned' ? pinned() : fixedSpace3DRestraints()) : freeSpace3DRestraints();
    for (let iz = 0; iz < nz; iz += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        nodes.push({ id: nodeId(ix, iy, iz), x: grid.xLines[ix].coordinate, y: grid.stories[iy].elevation, z: grid.zLines[iz].coordinate, restraints: { ...restraints } });
      }
    }
  }

  const members: Space3DFrameMember[] = [];
  let columnCount = 0;
  let beamCount = 0;
  for (let iy = 0; iy < ny - 1; iy += 1) {
    for (let iz = 0; iz < nz; iz += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        columnCount += 1;
        members.push({
          id: `C${columnCount}`, i: nodeId(ix, iy, iz), j: nodeId(ix, iy + 1, iz), ...column,
          orientation: { localYReferenceGlobal: [1, 0, 0], rollRadians: 0 },
        });
      }
    }
  }
  const beamX = new Map<string, string>();
  const beamZ = new Map<string, string>();
  for (let iy = 1; iy < ny; iy += 1) {
    for (let iz = 0; iz < nz; iz += 1) {
      for (let ix = 0; ix < nx - 1; ix += 1) {
        beamCount += 1;
        const id = `B${beamCount}`;
        beamX.set(`${ix}:${iy}:${iz}`, id);
        members.push({ id, i: nodeId(ix, iy, iz), j: nodeId(ix + 1, iy, iz), ...beam, orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 } });
      }
    }
    for (let ix = 0; ix < nx; ix += 1) {
      for (let iz = 0; iz < nz - 1; iz += 1) {
        beamCount += 1;
        const id = `B${beamCount}`;
        beamZ.set(`${ix}:${iy}:${iz}`, id);
        members.push({ id, i: nodeId(ix, iy, iz), j: nodeId(ix, iy, iz + 1), ...beam, orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 } });
      }
    }
  }

  // Losa: cada paño reparte a sus cuatro vigas de borde.
  const memberLoads: Space3DMemberLoad[] = [];
  let loadCount = 0;
  const addPanelLoads = (caseId: string, pressure: number) => {
    if (pressure <= 0) return;
    for (let iy = 1; iy < ny; iy += 1) {
      for (let iz = 0; iz < nz - 1; iz += 1) {
        for (let ix = 0; ix < nx - 1; ix += 1) {
          const a = xSpacings[ix];
          const b = zSpacings[iz];
          const edges: [string, number, number][] = [
            [beamX.get(`${ix}:${iy}:${iz}`)!, a, b],
            [beamX.get(`${ix}:${iy}:${iz + 1}`)!, a, b],
            [beamZ.get(`${ix}:${iy}:${iz}`)!, b, a],
            [beamZ.get(`${ix + 1}:${iy}:${iz}`)!, b, a],
          ];
          for (const [memberId, span, other] of edges) {
            for (const [start, end, qStart, qEnd] of panelEdgeSegments(span, other, pressure)) {
              loadCount += 1;
              memberLoads.push({
                id: `W${loadCount}`, memberId, caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
                start: Number(start.toFixed(9)), end: Number(end.toFixed(9)), qyStart: -qStart, qyEnd: -qEnd,
              });
            }
          }
        }
      }
    }
  };
  addPanelLoads('DEAD', superDead);
  addPanelLoads('LIVE', live);

  const nodalLoads: Space3DNodalLoad[] = [];
  const totalX = xSpacings.reduce((sum, value) => sum + value, 0);
  const totalZ = zSpacings.reduce((sum, value) => sum + value, 0);
  if (lateral > 0) {
    // Peso sísmico por piso: losa (muerta + 25 % de viva) y medio tramo de
    // barras por encima y por debajo del nivel.
    const area = totalX * totalZ;
    const beamWeight = (beam.density * SPACE3D_GRAVITY * beam.A / 1000) * (totalX * nz + totalZ * nx);
    const columnWeightPerMetre = (column.density * SPACE3D_GRAVITY * column.A / 1000) * nx * nz;
    const weights = storyHeights.map((height, index) => {
      const above = storyHeights[index + 1] ?? 0;
      return area * (superDead + 0.25 * live) + beamWeight + columnWeightPerMetre * (height + above) / 2;
    });
    const heights = storyHeights.map((_, index) => grid.stories[index + 1].elevation - grid.stories[0].elevation);
    const baseShear = lateral * weights.reduce((sum, value) => sum + value, 0);
    const denominator = weights.reduce((sum, value, index) => sum + value * heights[index], 0);
    let lateralCount = 0;
    weights.forEach((weight, index) => {
      const storyForce = denominator > 0 ? baseShear * weight * heights[index] / denominator : 0;
      const perNode = storyForce / (nx * nz);
      for (let iz = 0; iz < nz; iz += 1) {
        for (let ix = 0; ix < nx; ix += 1) {
          lateralCount += 1;
          nodalLoads.push({ id: `SX${lateralCount}`, caseId: 'SX', nodeId: nodeId(ix, index + 1, iz), fx: Number(perNode.toPrecision(12)), fy: 0, fz: 0, mx: 0, my: 0, mz: 0 });
        }
      }
    });
  }

  const loadCombinations: Space3DLoadCombination[] = [
    { id: 'SERV', name: 'D + L', terms: [{ caseId: 'DEAD', factor: 1 }, { caseId: 'LIVE', factor: 1 }], stateLimit: 'service', source: 'Ejemplo genérico; usa las de tu norma' },
    { id: 'U1', name: '1.4D', terms: [{ caseId: 'DEAD', factor: 1.4 }], stateLimit: 'ultimate', source: 'Ejemplo genérico; usa las de tu norma' },
    { id: 'U2', name: '1.2D + 1.6L', terms: [{ caseId: 'DEAD', factor: 1.2 }, { caseId: 'LIVE', factor: 1.6 }], stateLimit: 'ultimate', source: 'Ejemplo genérico; usa las de tu norma' },
    ...(lateral > 0 ? [{ id: 'U3', name: '1.2D + L + SX', terms: [{ caseId: 'DEAD', factor: 1.2 }, { caseId: 'LIVE', factor: 1 }, { caseId: 'SX', factor: 1 }], stateLimit: 'ultimate' as const, source: 'Ejemplo genérico; usa las de tu norma' }] : []),
  ];

  const project: Space3DProjectV1 = {
    analysisSpace: SPACE3D_ANALYSIS_SPACE,
    schemaVersion: SPACE3D_SCHEMA_VERSION,
    id: options.id ?? `space3d-building-${Date.now()}`,
    name: options.name ?? `Edificio ${xSpacings.length}×${zSpacings.length} vanos, ${storyHeights.length} pisos`,
    units: 'kN-m',
    nodes,
    members,
    nodalLoads,
    loadCases: [
      { id: 'DEAD', name: 'Muerta', category: 'permanent', selfWeightFactor: 1 },
      { id: 'LIVE', name: 'Viva', category: 'variable' },
      ...(lateral > 0 ? [{ id: 'SX', name: 'Sismo X (estático)', category: 'accidental' as const }] : []),
    ],
    loadCombinations,
    prescribedDisplacements: [],
    memberLoads,
    memberInitialEffects: [],
    nodeLinks: [],
    multiPointConstraints: [],
    nodalMasses: [],
    generatedLoadSources: [],
    movingLoadCases: [],
    grid,
  };
  const issues = validateSpace3DProject(project);
  if (issues.length > 0) {
    const first = issues[0];
    throw new Error(`Proyecto generado inválido: ${first.entityKind}:${first.entityId}:${first.code}:${first.field}`);
  }
  return project;
};
