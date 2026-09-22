/**
 * Motor generador de estructuras espaciales 3D paramétricas.
 *
 * No depende de React ni de Three.js. La geometría y las cargas dependen sólo
 * de las opciones de entrada; la identidad del proyecto usa un timestamp cuando
 * el caller no suministra `id`, por lo que la función completa no se describe
 * como pura.
 */
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  type Space3DFrameMember,
  type Space3DLoadCase,
  type Space3DLoadCombination,
  type Space3DNodalLoad,
  type Space3DNode,
  type Space3DProjectV1,
  type Space3DRestraints,
} from '../model/types';
import { fixedSpace3DRestraints, freeSpace3DRestraints } from '../model/types';
import { validateSpace3DProject } from '../model/validation';
import { assessAnalysisAdmission, createAutomaticAnalysisBudget, estimateSparseLinearSystemBytes } from '../../../../numeric/admission';

const buildProjectSkeleton = (
  id: string,
  name: string,
  nodes: Space3DNode[],
  members: Space3DFrameMember[],
  nodalLoads: Space3DNodalLoad[],
  loadCases: readonly Space3DLoadCase[] = [{ id: 'LC1', name: 'Carga principal', category: 'other' }],
  loadCombinations: readonly Space3DLoadCombination[] = [],
): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id,
  name,
  units: 'kN-m',
  nodes,
  members,
  nodalLoads,
  loadCases,
  loadCombinations,
  prescribedDisplacements: [],
  memberLoads: [],
  memberInitialEffects: [],
  nodeLinks: [],
  multiPointConstraints: [],
  nodalMasses: [],
  generatedLoadSources: [],
  movingLoadCases: [],
});

type CoordPoint = { readonly x: number; readonly y: number; readonly z: number } | readonly [number, number, number];

const toCoord = (p: CoordPoint): { x: number; y: number; z: number } => {
  if ('x' in p) return { x: p.x, y: p.y, z: p.z };
  return { x: p[0], y: p[1], z: p[2] };
};

export function chooseReferenceVector(
  start: CoordPoint,
  end: CoordPoint,
): readonly [number, number, number] {
  const p1 = toCoord(start);
  const p2 = toCoord(end);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return [0, 1, 0];
  const ny = Math.abs(dy / len);
  return ny > 0.85 ? [0, 0, 1] : [0, 1, 0];
}

export interface Space3DFrameGeneratorOptions {
  readonly id?: string;
  readonly name?: string;
  /** Número de vanos en dirección X (mínimo 1) */
  readonly baysX: number;
  /** Longitud de cada vano en X en metros */
  readonly bayWidthX: number;
  /** Número de pisos/niveles en dirección Y (mínimo 1) */
  readonly storiesY: number;
  /** Altura de cada piso en Y en metros */
  readonly storyHeightY: number;
  /** Número de vanos en dirección Z (mínimo 1) */
  readonly baysZ: number;
  /** Profundidad de cada vano en Z en metros */
  readonly bayDepthZ: number;
  /** Tipo de apoyo en la base (por defecto: 'fixed') */
  readonly baseSupport?: 'fixed' | 'pinned';
  /** Carga gravitatoria vertical por nudo de techo/piso en kN (hacia abajo, -Fy) */
  readonly gravityLoadPerNode?: number;
  /** Propiedades mecánicas por defecto */
  readonly E?: number;
  readonly G?: number;
  readonly A?: number;
  readonly Iy?: number;
  readonly Iz?: number;
  readonly J?: number;
}

export interface Space3DTrussGeneratorOptions {
  readonly id?: string;
  readonly name?: string;
  /** Longitud total en X (m) */
  readonly spanX: number;
  /** Altura de la celosía en Y (m) */
  readonly heightY: number;
  /** Ancho transversal en Z (m) */
  readonly widthZ: number;
  /** Número de divisiones/paneles a lo largo de X (mínimo 2) */
  readonly panels: number;
  /** Patrón de diagonales */
  readonly pattern?: 'warren' | 'pratt';
  /** Carga puntual en nudos del cordón superior (kN) */
  readonly loadAtTopNodes?: number;
  readonly E?: number;
  readonly A?: number;
}

export interface Space3DTowerGeneratorOptions {
  readonly id?: string;
  readonly name?: string;
  /** Altura total (m) */
  readonly totalHeight: number;
  /** Ancho de la base cuadrada (m) */
  readonly baseWidth: number;
  /** Ancho de la cúspide cuadrada (m) */
  readonly topWidth: number;
  /** Número de tramos o niveles verticales (mínimo 2) */
  readonly tiers: number;
  /** Carga horizontal en la cima (viento/sismo) en kN (Fx) */
  readonly topWindLoad?: number;
}

export interface Space3DDomeGeneratorOptions {
  readonly id?: string;
  readonly name?: string;
  /** Radio de la base del domo (m) */
  readonly radius: number;
  /** Altura máxima en la cúspide (m) */
  readonly height: number;
  /** Número de sectores / meridianos (mínimo 4) */
  readonly sectors: number;
  /** Número de anillos horizontales de elevación (mínimo 2) */
  readonly rings: number;
  /** Carga vertical en nudos de cúpula en kN */
  readonly verticalLoad?: number;
}

const DEFAULT_E = 200_000_000; // 200 GPa en kPa (kN/m²)
const DEFAULT_G = 77_000_000;  // 77 GPa en kPa
const DEFAULT_A = 0.0076;      // m² (~IPE 300)
const DEFAULT_IY = 4.5e-5;     // m⁴
const DEFAULT_IZ = 1.36e-4;    // m⁴
const DEFAULT_J = 4e-7;        // m⁴

const GENERATOR_ANALYSIS_BUDGET = createAutomaticAnalysisBudget();

const finiteGeneratorValue = (value: number, label: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${label} debe ser un número finito`);
  return value;
};

const assertGenerationCapacity = (nodeCount: number, memberCount: number): void => {
  if (!Number.isSafeInteger(nodeCount) || !Number.isSafeInteger(memberCount) || nodeCount <= 0 || memberCount < 0) {
    throw new RangeError('La geometría solicitada excede el rango seguro del generador');
  }
  const dimension = nodeCount * 6;
  const nonZeros = memberCount * 144 + nodeCount * 36;
  const estimatedBytes = estimateSparseLinearSystemBytes({ dimension, nonZeros, rhsCount: 1 });
  const admission = assessAnalysisAdmission(estimatedBytes, GENERATOR_ANALYSIS_BUDGET);
  if (!admission.accepted) {
    throw new RangeError(`La geometría solicitada excede el presupuesto de análisis seguro (${nodeCount} nudos, ${memberCount} barras)`);
  }
};

const validateGeneratedProject = (project: Space3DProjectV1): Space3DProjectV1 => {
  const issues = validateSpace3DProject(project);
  if (issues.length > 0) {
    const first = issues[0];
    throw new Error(`Proyecto generado inválido: ${first.entityKind}:${first.entityId}:${first.code}:${first.field}`);
  }
  return project;
};

const pinnedRestraints = (): Space3DRestraints => ({
  ux: true, uy: true, uz: true, rx: false, ry: false, rz: false,
});

/**
 * Genera un pórtico tridimensional regular (edificio espacial) de múltiples vanos y niveles.
 */
export function generateSpace3DFrame(options: Space3DFrameGeneratorOptions): Space3DProjectV1 {
  const baysX = Math.max(1, Math.round(finiteGeneratorValue(options.baysX, 'baysX')));
  const baysZ = Math.max(1, Math.round(finiteGeneratorValue(options.baysZ, 'baysZ')));
  const storiesY = Math.max(1, Math.round(finiteGeneratorValue(options.storiesY, 'storiesY')));
  const widthX = Math.max(0.5, finiteGeneratorValue(options.bayWidthX, 'bayWidthX'));
  const heightY = Math.max(0.5, finiteGeneratorValue(options.storyHeightY, 'storyHeightY'));
  const depthZ = Math.max(0.5, finiteGeneratorValue(options.bayDepthZ, 'bayDepthZ'));
  const nodeCount = (baysX + 1) * (storiesY + 1) * (baysZ + 1);
  const estimatedMemberCount = storiesY * (baysX + 1) * (baysZ + 1)
    + storiesY * baysX * (baysZ + 1)
    + storiesY * baysZ * (baysX + 1);
  assertGenerationCapacity(nodeCount, estimatedMemberCount);

  const E = options.E ?? DEFAULT_E;
  const G = options.G ?? DEFAULT_G;
  const A = options.A ?? DEFAULT_A;
  const Iy = options.Iy ?? DEFAULT_IY;
  const Iz = options.Iz ?? DEFAULT_IZ;
  const J = options.J ?? DEFAULT_J;

  const nodes: Space3DNode[] = [];
  const nodeIndex = (ix: number, iy: number, iz: number): string => `N_${ix}_${iy}_${iz}`;

  for (let iy = 0; iy <= storiesY; iy += 1) {
    const y = iy * heightY;
    const isBase = iy === 0;
    const restraints = isBase
      ? (options.baseSupport === 'pinned' ? pinnedRestraints() : fixedSpace3DRestraints())
      : freeSpace3DRestraints();

    for (let iz = 0; iz <= baysZ; iz += 1) {
      const z = iz * depthZ;
      for (let ix = 0; ix <= baysX; ix += 1) {
        const x = ix * widthX;
        nodes.push({
          id: nodeIndex(ix, iy, iz),
          x,
          y,
          z,
          restraints,
        });
      }
    }
  }

  const members: Space3DFrameMember[] = [];
  let memberCount = 1;

  // 1. Columnas (verticales paralelas a Y)
  for (let iy = 0; iy < storiesY; iy += 1) {
    for (let iz = 0; iz <= baysZ; iz += 1) {
      for (let ix = 0; ix <= baysX; ix += 1) {
        members.push({
          id: `M${memberCount++}`,
          i: nodeIndex(ix, iy, iz),
          j: nodeIndex(ix, iy + 1, iz),
          type: 'frame',
          E, G, A, Iy, Iz, J,
          orientation: { localYReferenceGlobal: [1, 0, 0], rollRadians: 0 },
        });
      }
    }
  }

  // 2. Vigas en X (horizontales a lo largo de X en cada piso > 0)
  for (let iy = 1; iy <= storiesY; iy += 1) {
    for (let iz = 0; iz <= baysZ; iz += 1) {
      for (let ix = 0; ix < baysX; ix += 1) {
        members.push({
          id: `M${memberCount++}`,
          i: nodeIndex(ix, iy, iz),
          j: nodeIndex(ix + 1, iy, iz),
          type: 'frame',
          E, G, A, Iy, Iz, J,
          orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
        });
      }
    }
  }

  // 3. Vigas en Z (horizontales a lo largo de Z en cada piso > 0)
  for (let iy = 1; iy <= storiesY; iy += 1) {
    for (let ix = 0; ix <= baysX; ix += 1) {
      for (let iz = 0; iz < baysZ; iz += 1) {
        members.push({
          id: `M${memberCount++}`,
          i: nodeIndex(ix, iy, iz),
          j: nodeIndex(ix, iy, iz + 1),
          type: 'frame',
          E, G, A, Iy, Iz, J,
          orientation: { localYReferenceGlobal: [0, 1, 0], rollRadians: 0 },
        });
      }
    }
  }

  const loads: Space3DNodalLoad[] = [];
  const gravityLoad = options.gravityLoadPerNode ?? 25; // 25 kN por defecto hacia abajo
  if (gravityLoad > 0) {
    let loadCount = 1;
    // Aplicar a los nudos del último piso (cubierta)
    for (let iz = 0; iz <= baysZ; iz += 1) {
      for (let ix = 0; ix <= baysX; ix += 1) {
        loads.push({
          id: `L${loadCount++}`,
          nodeId: nodeIndex(ix, storiesY, iz),
          caseId: 'LC1',
          fx: 0,
          fy: -gravityLoad,
          fz: 0,
          mx: 0,
          my: 0,
          mz: 0,
        });
      }
    }
  }

  const project = buildProjectSkeleton(
    options.id ?? `space3d-frame-${Date.now()}`,
    options.name ?? `Pórtico 3D ${baysX}x${baysZ} (${storiesY} niveles)`,
    nodes,
    members,
    loads,
  );

  return validateGeneratedProject(project);
}

/**
 * El dominio persiste miembros `truss`, pero el solver actual rechaza esa
 * familia porque todavía no implementa su ensamblaje axial. No se sustituye
 * silenciosamente por frames: hacerlo cambiaría el problema físico analizado.
 */
export function generateSpace3DTruss(_options: Space3DTrussGeneratorOptions): Space3DProjectV1 {
  throw new Error(
    'La cercha espacial axial todavía no está soportada por el solver 3D. Usa un pórtico/reticulado de frames o implementa primero el elemento truss.',
  );
}

/**
 * Genera una torre de celosía 3D piramidal/cónica (como torre de transmisión o soporte).
 */
export function generateSpace3DTower(options: Space3DTowerGeneratorOptions): Space3DProjectV1 {
  const tiers = Math.max(2, Math.round(finiteGeneratorValue(options.tiers, 'tiers')));
  const height = Math.max(2, finiteGeneratorValue(options.totalHeight, 'totalHeight'));
  const baseW = Math.max(1, finiteGeneratorValue(options.baseWidth, 'baseWidth'));
  const topW = Math.max(0.5, finiteGeneratorValue(options.topWidth, 'topWidth'));
  assertGenerationCapacity(4 * (tiers + 1), 16 * tiers);

  const tierHeight = height / tiers;
  const nodes: Space3DNode[] = [];
  const members: Space3DFrameMember[] = [];
  let memberCount = 1;

  const nodeName = (tier: number, corner: number) => `T_${tier}_C${corner}`;

  for (let tier = 0; tier <= tiers; tier += 1) {
    const fraction = tier / tiers;
    const y = tier * tierHeight;
    const w = baseW - (baseW - topW) * fraction;
    const half = w / 2;
    const isBase = tier === 0;
    const restraints = isBase ? fixedSpace3DRestraints() : freeSpace3DRestraints();

    // 4 esquinas centradas en el origen horizontal (0, 0)
    // C0: (-half, -half), C1: (half, -half), C2: (half, half), C3: (-half, half)
    const corners = [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ] as const;

    for (let c = 0; c < 4; c += 1) {
      nodes.push({
        id: nodeName(tier, c),
        x: corners[c][0],
        y,
        z: corners[c][1],
        restraints,
      });
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const addBar = (i: string, j: string) => {
    const ni = nodeMap.get(i)!;
    const nj = nodeMap.get(j)!;
    members.push({
      id: `M${memberCount++}`,
      i,
      j,
      type: 'frame',
      E: DEFAULT_E, G: DEFAULT_G, A: DEFAULT_A, Iy: DEFAULT_IY, Iz: DEFAULT_IZ, J: DEFAULT_J,
      orientation: { localYReferenceGlobal: chooseReferenceVector(ni, nj), rollRadians: 0 },
    });
  };

  // Travesaños horizontales en cada nivel > 0
  for (let tier = 1; tier <= tiers; tier += 1) {
    for (let c = 0; c < 4; c += 1) {
      const nextCorner = (c + 1) % 4;
      addBar(nodeName(tier, c), nodeName(tier, nextCorner));
    }
  }

  // Patas principales y diagonales en cruz en cada cara y tramo
  for (let tier = 0; tier < tiers; tier += 1) {
    for (let c = 0; c < 4; c += 1) {
      const nextCorner = (c + 1) % 4;
      // Columna / pata inclinada
      addBar(nodeName(tier, c), nodeName(tier + 1, c));
      // Cruz de San Andrés (X-bracing) en cada cara
      addBar(nodeName(tier, c), nodeName(tier + 1, nextCorner));
      addBar(nodeName(tier, nextCorner), nodeName(tier + 1, c));
    }
  }

  const loads: Space3DNodalLoad[] = [];
  const wind = options.topWindLoad ?? 15;
  if (wind > 0) {
    // Aplicar fuerza lateral en las 4 esquinas de la cúspide
    for (let c = 0; c < 4; c += 1) {
      loads.push({
        id: `L${c + 1}`,
        nodeId: nodeName(tiers, c),
        caseId: 'LC1',
        fx: wind / 4,
        fy: 0,
        fz: 0,
        mx: 0,
        my: 0,
        mz: 0,
      });
    }
  }

  const project = buildProjectSkeleton(
    options.id ?? `space3d-tower-${Date.now()}`,
    options.name ?? `Torre Celosía 3D (H=${height}m)`,
    nodes,
    members,
    loads,
  );

  return validateGeneratedProject(project);
}

/**
 * Genera una cúpula / domo espacial reticular (Ribbed Dome).
 */
export function generateSpace3DDome(options: Space3DDomeGeneratorOptions): Space3DProjectV1 {
  const sectors = Math.max(4, Math.round(finiteGeneratorValue(options.sectors, 'sectors')));
  const rings = Math.max(2, Math.round(finiteGeneratorValue(options.rings, 'rings')));
  const radius = Math.max(1, finiteGeneratorValue(options.radius, 'radius'));
  const height = Math.max(0.5, finiteGeneratorValue(options.height, 'height'));
  assertGenerationCapacity(1 + sectors * rings, sectors * (3 * rings - 1));

  const nodes: Space3DNode[] = [];
  const members: Space3DFrameMember[] = [];
  let memberCount = 1;

  // Nudo ápice (cúspide) en el punto más alto
  const apexId = 'DOME_APEX';
  nodes.push({
    id: apexId,
    x: 0,
    y: height,
    z: 0,
    restraints: freeSpace3DRestraints(),
  });

  const nodeName = (ring: number, sector: number) => `D_${ring}_S${sector}`;

  // Anillos concéntricos desde el anillo superior (1) hasta la base (rings)
  for (let r = 1; r <= rings; r += 1) {
    const ringFraction = r / rings;
    // Perfil parabólico: y = height * (1 - (r/rings)²)
    const y = height * (1 - ringFraction * ringFraction);
    const rRadius = radius * ringFraction;
    const isBase = r === rings;
    const restraints = isBase ? pinnedRestraints() : freeSpace3DRestraints();

    for (let s = 0; s < sectors; s += 1) {
      const angle = (2 * Math.PI * s) / sectors;
      const x = rRadius * Math.cos(angle);
      const z = rRadius * Math.sin(angle);
      nodes.push({
        id: nodeName(r, s),
        x,
        y,
        z,
        restraints,
      });
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const addBar = (i: string, j: string) => {
    const ni = nodeMap.get(i)!;
    const nj = nodeMap.get(j)!;
    members.push({
      id: `M${memberCount++}`,
      i,
      j,
      type: 'frame',
      E: DEFAULT_E, G: DEFAULT_G, A: DEFAULT_A, Iy: DEFAULT_IY, Iz: DEFAULT_IZ, J: DEFAULT_J,
      orientation: { localYReferenceGlobal: chooseReferenceVector(ni, nj), rollRadians: 0 },
    });
  };

  // Barras desde el ápice al primer anillo
  for (let s = 0; s < sectors; s += 1) {
    addBar(apexId, nodeName(1, s));
  }

  // Barras de anillo (horizontales circulares) y meridianos (arcos descendentes)
  for (let r = 1; r <= rings; r += 1) {
    // Conectar el anillo en circunferencia
    for (let s = 0; s < sectors; s += 1) {
      const nextSector = (s + 1) % sectors;
      addBar(nodeName(r, s), nodeName(r, nextSector));
    }

    // Conectar meridianos con el anillo inferior
    if (r < rings) {
      for (let s = 0; s < sectors; s += 1) {
        addBar(nodeName(r, s), nodeName(r + 1, s));
        // Diagonales triangulares para dar rigidez al cascarón
        const nextSector = (s + 1) % sectors;
        addBar(nodeName(r, s), nodeName(r + 1, nextSector));
      }
    }
  }

  const loads: Space3DNodalLoad[] = [];
  const vLoad = options.verticalLoad ?? 10;
  if (vLoad > 0) {
    // Carga vertical en el ápice y en los anillos intermedios
    loads.push({
      id: 'L_APEX',
      nodeId: apexId,
      caseId: 'LC1',
      fx: 0, fy: -vLoad * 2, fz: 0, mx: 0, my: 0, mz: 0,
    });
    let loadCount = 1;
    for (let r = 1; r < rings; r += 1) {
      for (let s = 0; s < sectors; s += 1) {
        loads.push({
          id: `L_${loadCount++}`,
          nodeId: nodeName(r, s),
          caseId: 'LC1',
          fx: 0, fy: -vLoad, fz: 0, mx: 0, my: 0, mz: 0,
        });
      }
    }
  }

  const project = buildProjectSkeleton(
    options.id ?? `space3d-dome-${Date.now()}`,
    options.name ?? `Cúpula Reticular 3D (R=${radius}m, H=${height}m)`,
    nodes,
    members,
    loads,
  );

  return validateGeneratedProject(project);
}

// ============================================================================
// Generador: Puente Espacial Reticulado 3D
// ============================================================================

export interface Space3DBridgeGeneratorOptions {
  readonly id?: string;
  readonly name?: string;
  /** Longitud total del puente en X (m, mínimo 6) */
  readonly spanX: number;
  /** Ancho de calzada / tablero en Z (m, mínimo 2) */
  readonly widthZ: number;
  /** Altura de las cerchas laterales en Y (m, mínimo 1.5) */
  readonly heightY: number;
  /** Número de paneles a lo largo del puente (mínimo 2) */
  readonly panels: number;
  /** Carga gravitatoria por nudo del tablero en kN */
  readonly deckLoad?: number;
  readonly E?: number;
  readonly G?: number;
  readonly A?: number;
  readonly Iy?: number;
  readonly Iz?: number;
  readonly J?: number;
}

export function generateSpace3DBridge(options: Space3DBridgeGeneratorOptions): Space3DProjectV1 {
  const spanX = Math.max(6, finiteGeneratorValue(options.spanX, 'spanX'));
  const widthZ = Math.max(2, finiteGeneratorValue(options.widthZ, 'widthZ'));
  const heightY = Math.max(1.5, finiteGeneratorValue(options.heightY, 'heightY'));
  const panels = Math.max(2, Math.floor(finiteGeneratorValue(options.panels, 'panels')));
  const dx = spanX / panels;
  const halfW = widthZ / 2;
  assertGenerationCapacity(4 * (panels + 1), 13 * panels + 4);

  const DEFAULT_E = options.E ?? 200_000_000;
  const DEFAULT_G = options.G ?? 77_000_000;
  const DEFAULT_A = options.A ?? 0.0076;
  const DEFAULT_IY = options.Iy ?? 4.5e-5;
  const DEFAULT_IZ = options.Iz ?? 1.36e-4;
  const DEFAULT_J = options.J ?? 4e-7;

  const nodes: Space3DNode[] = [];
  const members: Space3DFrameMember[] = [];
  let memberCount = 1;

  // Nudos de cuerda inferior (tablero) y superior en Z=-halfW (Lado A) y Z=+halfW (Lado B)
  for (let p = 0; p <= panels; p += 1) {
    const x = p * dx;

    // Lado A: Z = -halfW
    const restA = p === 0 ? pinnedRestraints() : p === panels ? {
      ux: false, uy: true, uz: true, rx: false, ry: false, rz: false,
    } : freeSpace3DRestraints();

    nodes.push({ id: `BOT_A_${p}`, x, y: 0, z: -halfW, restraints: restA });
    nodes.push({ id: `TOP_A_${p}`, x, y: heightY, z: -halfW, restraints: freeSpace3DRestraints() });

    // Lado B: Z = +halfW
    const restB = p === 0 ? pinnedRestraints() : p === panels ? {
      ux: false, uy: true, uz: true, rx: false, ry: false, rz: false,
    } : freeSpace3DRestraints();

    nodes.push({ id: `BOT_B_${p}`, x, y: 0, z: halfW, restraints: restB });
    nodes.push({ id: `TOP_B_${p}`, x, y: heightY, z: halfW, restraints: freeSpace3DRestraints() });
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const addBar = (i: string, j: string) => {
    const ni = nodeMap.get(i)!;
    const nj = nodeMap.get(j)!;
    members.push({
      id: `M${memberCount++}`,
      i,
      j,
      type: 'frame',
      E: DEFAULT_E, G: DEFAULT_G, A: DEFAULT_A, Iy: DEFAULT_IY, Iz: DEFAULT_IZ, J: DEFAULT_J,
      orientation: { localYReferenceGlobal: chooseReferenceVector(ni, nj), rollRadians: 0 },
    });
  };

  for (let p = 0; p < panels; p += 1) {
    const pNext = p + 1;

    // Cuerdas longitudinales inferiores y superiores
    addBar(`BOT_A_${p}`, `BOT_A_${pNext}`);
    addBar(`BOT_B_${p}`, `BOT_B_${pNext}`);
    addBar(`TOP_A_${p}`, `TOP_A_${pNext}`);
    addBar(`TOP_B_${p}`, `TOP_B_${pNext}`);

    // Montantes verticales en cerchas laterales
    addBar(`BOT_A_${p}`, `TOP_A_${p}`);
    addBar(`BOT_B_${p}`, `TOP_B_${p}`);

    // Diagonales de cerchas laterales (Warren alternada)
    if (p % 2 === 0) {
      addBar(`BOT_A_${p}`, `TOP_A_${pNext}`);
      addBar(`BOT_B_${p}`, `TOP_B_${pNext}`);
    } else {
      addBar(`TOP_A_${p}`, `BOT_A_${pNext}`);
      addBar(`TOP_B_${p}`, `BOT_B_${pNext}`);
    }

    // Vigas transversales de calzada (tablero inferior) y riostras superiores
    addBar(`BOT_A_${p}`, `BOT_B_${p}`);
    addBar(`TOP_A_${p}`, `TOP_B_${p}`);

    // Arriostramiento horizontal en cruz en el plano del tablero inferior
    addBar(`BOT_A_${p}`, `BOT_B_${pNext}`);
    addBar(`BOT_B_${p}`, `BOT_A_${pNext}`);

    // Arriostramiento horizontal superior
    addBar(`TOP_A_${p}`, `TOP_B_${pNext}`);
  }

  // Cerrar montantes del último vano
  addBar(`BOT_A_${panels}`, `TOP_A_${panels}`);
  addBar(`BOT_B_${panels}`, `TOP_B_${panels}`);
  addBar(`BOT_A_${panels}`, `BOT_B_${panels}`);
  addBar(`TOP_A_${panels}`, `TOP_B_${panels}`);

  const loads: Space3DNodalLoad[] = [];
  const deckLoad = options.deckLoad ?? 25;
  if (deckLoad > 0) {
    let loadCount = 1;
    for (let p = 1; p < panels; p += 1) {
      loads.push({
        id: `L_A_${loadCount}`,
        nodeId: `BOT_A_${p}`,
        caseId: 'LC1',
        fx: 0, fy: -deckLoad, fz: 0, mx: 0, my: 0, mz: 0,
      });
      loads.push({
        id: `L_B_${loadCount}`,
        nodeId: `BOT_B_${p}`,
        caseId: 'LC1',
        fx: 0, fy: -deckLoad, fz: 0, mx: 0, my: 0, mz: 0,
      });
      loadCount += 1;
    }
  }

  const project = buildProjectSkeleton(
    options.id ?? `space3d-bridge-${Date.now()}`,
    options.name ?? `Puente Espacial Reticulado 3D (L=${spanX}m, W=${widthZ}m)`,
    nodes,
    members,
    loads,
  );

  return validateGeneratedProject(project);
}

// ============================================================================
// Generador: Nave Industrial 3D a Dos Aguas
// ============================================================================

export interface Space3DIndustrialShedOptions {
  readonly id?: string;
  readonly name?: string;
  /** Luz libre transversal del pórtico en X (m, mínimo 6) */
  readonly spanX: number;
  /** Altura de las columnas / hombro de alero en Y (m, mínimo 3) */
  readonly eaveHeightY: number;
  /** Altura total a la cumbrera en Y (m, debe ser mayor a eaveHeightY) */
  readonly ridgeHeightY: number;
  /** Número de vanos longitudinales en Z (mínimo 1) */
  readonly baysZ: number;
  /** Distancia entre pórticos en Z (m, mínimo 3) */
  readonly baySpacingZ: number;
  /** Tipo de apoyo en la base */
  readonly baseSupport?: 'fixed' | 'pinned';
  /** Carga gravitatoria por nudo de techo en kN */
  readonly roofLoad?: number;
  /** Carga de viento lateral horizontal (+Fx) en alero windward en kN */
  readonly windLoadX?: number;
  readonly E?: number;
  readonly G?: number;
  readonly A?: number;
  readonly Iy?: number;
  readonly Iz?: number;
  readonly J?: number;
}

export function generateSpace3DIndustrialShed(options: Space3DIndustrialShedOptions): Space3DProjectV1 {
  const spanX = Math.max(6, finiteGeneratorValue(options.spanX, 'spanX'));
  const eaveHeightY = Math.max(3, finiteGeneratorValue(options.eaveHeightY, 'eaveHeightY'));
  const ridgeHeightY = Math.max(eaveHeightY + 0.5, finiteGeneratorValue(options.ridgeHeightY, 'ridgeHeightY'));
  const baysZ = Math.max(1, Math.floor(finiteGeneratorValue(options.baysZ, 'baysZ')));
  const baySpacingZ = Math.max(3, finiteGeneratorValue(options.baySpacingZ, 'baySpacingZ'));
  const baseSupport = options.baseSupport ?? 'fixed';
  const bracedBayCount = baysZ === 1 ? 1 : 2;
  assertGenerationCapacity(5 * (baysZ + 1), 4 * (baysZ + 1) + 3 * baysZ + 8 * bracedBayCount);

  const DEFAULT_E = options.E ?? 200_000_000;
  const DEFAULT_G = options.G ?? 77_000_000;
  const DEFAULT_A = options.A ?? 0.0076;
  const DEFAULT_IY = options.Iy ?? 4.5e-5;
  const DEFAULT_IZ = options.Iz ?? 1.36e-4;
  const DEFAULT_J = options.J ?? 4e-7;

  const nodes: Space3DNode[] = [];
  const members: Space3DFrameMember[] = [];
  let memberCount = 1;

  const baseRestraints = baseSupport === 'fixed' ? fixedSpace3DRestraints() : pinnedRestraints();

  // Generar pórticos a lo largo de Z
  for (let bz = 0; bz <= baysZ; bz += 1) {
    const z = bz * baySpacingZ;

    // N1: Base izquierda
    nodes.push({ id: `BASE_L_${bz}`, x: 0, y: 0, z, restraints: baseRestraints });
    // N2: Alero izquierdo
    nodes.push({ id: `EAVE_L_${bz}`, x: 0, y: eaveHeightY, z, restraints: freeSpace3DRestraints() });
    // N3: Cumbrera (ápice)
    nodes.push({ id: `RIDGE_${bz}`, x: spanX / 2, y: ridgeHeightY, z, restraints: freeSpace3DRestraints() });
    // N4: Alero derecho
    nodes.push({ id: `EAVE_R_${bz}`, x: spanX, y: eaveHeightY, z, restraints: freeSpace3DRestraints() });
    // N5: Base derecha
    nodes.push({ id: `BASE_R_${bz}`, x: spanX, y: 0, z, restraints: baseRestraints });
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const addBar = (i: string, j: string) => {
    const ni = nodeMap.get(i)!;
    const nj = nodeMap.get(j)!;
    members.push({
      id: `M${memberCount++}`,
      i,
      j,
      type: 'frame',
      E: DEFAULT_E, G: DEFAULT_G, A: DEFAULT_A, Iy: DEFAULT_IY, Iz: DEFAULT_IZ, J: DEFAULT_J,
      orientation: { localYReferenceGlobal: chooseReferenceVector(ni, nj), rollRadians: 0 },
    });
  };

  // Barras de pórticos transversales
  for (let bz = 0; bz <= baysZ; bz += 1) {
    // Columnas
    addBar(`BASE_L_${bz}`, `EAVE_L_${bz}`);
    addBar(`BASE_R_${bz}`, `EAVE_R_${bz}`);
    // Vigas de techo a dos aguas
    addBar(`EAVE_L_${bz}`, `RIDGE_${bz}`);
    addBar(`RIDGE_${bz}`, `EAVE_R_${bz}`);
  }

  // Correas y vigas longitudinales que unen los pórticos
  for (let bz = 0; bz < baysZ; bz += 1) {
    const nextZ = bz + 1;
    addBar(`EAVE_L_${bz}`, `EAVE_L_${nextZ}`);
    addBar(`RIDGE_${bz}`, `RIDGE_${nextZ}`);
    addBar(`EAVE_R_${bz}`, `EAVE_R_${nextZ}`);

    // Arriostramiento lateral San Andrés en X en el primer y último vano
    if (bz === 0 || bz === baysZ - 1) {
      // Cruz en pared lateral izquierda
      addBar(`BASE_L_${bz}`, `EAVE_L_${nextZ}`);
      addBar(`BASE_L_${nextZ}`, `EAVE_L_${bz}`);
      // Cruz en pared lateral derecha
      addBar(`BASE_R_${bz}`, `EAVE_R_${nextZ}`);
      addBar(`BASE_R_${nextZ}`, `EAVE_R_${bz}`);
      // Cruz en cubierta izquierda
      addBar(`EAVE_L_${bz}`, `RIDGE_${nextZ}`);
      addBar(`EAVE_L_${nextZ}`, `RIDGE_${bz}`);
      // Cruz en cubierta derecha
      addBar(`EAVE_R_${bz}`, `RIDGE_${nextZ}`);
      addBar(`EAVE_R_${nextZ}`, `RIDGE_${bz}`);
    }
  }

  const loads: Space3DNodalLoad[] = [];
  const roofLoad = options.roofLoad ?? 18;
  const windLoadX = options.windLoadX ?? 12;

  let loadCount = 1;
  for (let bz = 0; bz <= baysZ; bz += 1) {
    if (roofLoad > 0) {
      // Carga vertical en aleros y cumbrera
      loads.push({
        id: `L_ROOF_${loadCount++}`,
        nodeId: `RIDGE_${bz}`,
        caseId: 'ROOF',
        fx: 0, fy: -roofLoad, fz: 0, mx: 0, my: 0, mz: 0,
      });
      loads.push({
        id: `L_ROOF_${loadCount++}`,
        nodeId: `EAVE_L_${bz}`,
        caseId: 'ROOF',
        fx: 0, fy: -roofLoad * 0.5, fz: 0, mx: 0, my: 0, mz: 0,
      });
      loads.push({
        id: `L_ROOF_${loadCount++}`,
        nodeId: `EAVE_R_${bz}`,
        caseId: 'ROOF',
        fx: 0, fy: -roofLoad * 0.5, fz: 0, mx: 0, my: 0, mz: 0,
      });
    }

    if (windLoadX > 0) {
      // Viento lateral sobre columnas de barlovento
      loads.push({
        id: `L_WIND_${loadCount++}`,
        nodeId: `EAVE_L_${bz}`,
        caseId: 'WIND_X',
        fx: windLoadX, fy: 0, fz: 0, mx: 0, my: 0, mz: 0,
      });
    }
  }

  const project = buildProjectSkeleton(
    options.id ?? `space3d-shed-${Date.now()}`,
    options.name ?? `Nave Industrial 3D (Luz=${spanX}m, ${baysZ} vanos Z)`,
    nodes,
    members,
    loads,
    [
      { id: 'ROOF', name: 'Cubierta gravitatoria', category: 'permanent' },
      { id: 'WIND_X', name: 'Viento +X', category: 'variable' },
    ],
    [],
  );

  return validateGeneratedProject(project);
}

// ============================================================================
// Parser determinista de descripción estructural
// ============================================================================

export interface ParsedStructuralPrompt {
  readonly archetype: 'frame' | 'truss' | 'tower' | 'dome' | 'bridge' | 'industrial-shed';
  readonly params: Record<string, number | string>;
  /** Hay evidencia textual explícita del arquetipo, no sólo el fallback. */
  readonly recognized: boolean;
  /** Heurística de cobertura del parser; no es una probabilidad estadística. */
  readonly confidence: number;
  readonly summary: string;
}

/**
 * Interpreta una instrucción o descripción en lenguaje natural (español o inglés)
 * y extrae los parámetros estructurales óptimos para generar la geometría.
 */
export function parseNaturalLanguageStructuralPrompt(rawPrompt: string): ParsedStructuralPrompt {
  // El parser es determinista y local. Normalizar coma decimal evita que
  // "4,5 m" se interprete como 45 o se descarte.
  const prompt = rawPrompt.toLowerCase().trim().replace(/(\d),(\d)/g, '$1.$2');

  // 1. Detectar arquetipo con evidencia explícita.
  let archetype: ParsedStructuralPrompt['archetype'] = 'frame';
  let recognized = false;

  if (/(torre residencial|residential tower|edificio|building|portico|pórtico|frame|estructura aporticada)/i.test(prompt)) {
    archetype = 'frame';
    recognized = true;
  } else if (/(puente|bridge|viaducto|viaduct|pasarela)/i.test(prompt)) {
    archetype = 'bridge';
    recognized = true;
  } else if (/(nave|galpon|galpón|bodega|shed|warehouse|industrial|tinglado)/i.test(prompt)) {
    archetype = 'industrial-shed';
    recognized = true;
  } else if (/(torre|tower|antena|mastil|mástil|pilono|pílono|transmission)/i.test(prompt)) {
    archetype = 'tower';
    recognized = true;
  } else if (/(cupula|cúpula|dome|geodesic|geodésica|boveda|bóveda|esfera)/i.test(prompt)) {
    archetype = 'dome';
    recognized = true;
  } else if (/(cercha|truss|reticulado|celosia|celosía|armadura)/i.test(prompt)) {
    archetype = 'truss';
    recognized = true;
  }

  // 2. Extraer parámetros numéricos sin inventar dimensiones ausentes.
  const params: Record<string, number | string> = {};

  const dimensionsMatch = prompt.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m|metros?|meters?)?/i);
  if (dimensionsMatch && archetype === 'industrial-shed') {
    params.span = Number(dimensionsMatch[1]);
    params.lengthZ = Number(dimensionsMatch[2]);
  }

  // Pisos / Niveles / Stories
  const storiesMatch = prompt.match(/(\d+)\s*(?:pisos?|niveles?|stories|floors?|niv)/i);
  if (storiesMatch) params.storiesY = Number(storiesMatch[1]);

  // Vanos / Bays
  // "paneles"/"panels" es como se enuncia el número de tramos de un puente o
  // una celosía; sin ellos, una sugerencia que pide 5 paneles genera los que
  // hubiera en el control.
  const baysMatch = prompt.match(/(\d+)\s*(?:vanos?|bays?|tramos?|crujias?|crujías|paneles?|panels?)/i);
  if (baysMatch) {
    const b = Number(baysMatch[1]);
    params.baysX = b;
    params.baysZ = Math.max(1, Math.min(b, 4));
    params.bays = b;
  }

  // Altura / Height
  // `\b` es obligatorio en las abreviaturas de una letra: sin él, la `h` de
  // "with 30 kN" o la `r` de una palabra cualquiera capturan el número vecino y
  // fabrican una altura/radio que el usuario nunca escribió.
  const heightMatch = prompt.match(/(?:altura|alto|height|\bh)\s*(?:de|=)?\s*(\d+(?:\.\d+)?)\s*m?/i)
    || prompt.match(/(\d+(?:\.\d+)?)\s*(?:m|metros?|meters?)\s*(?:de\s+alto|de\s+altura|high|tall|height)/i)
    || (archetype === 'tower' ? prompt.match(/(?:de|=)?\s*(\d+(?:\.\d+)?)\s*(?:m|metros?)\b/i) : null);
  if (heightMatch) params.height = Number(heightMatch[1]);

  // Longitud / Luz / Span. "ancho/width" se extrae aparte para no confundir
  // la luz longitudinal de un puente con el ancho de tablero.
  const spanMatch = prompt.match(/(?:luz|span|longitud|length)\s*(?:de|=)?\s*(\d+(?:\.\d+)?)\s*m?/i)
    || prompt.match(/(\d+(?:\.\d+)?)\s*(?:m|metros?|meters?)\s*(?:de\s+luz|de\s+largo|de\s+longitud|span)/i)
    || ((archetype === 'bridge' || archetype === 'truss' || archetype === 'industrial-shed')
      && !params.height && !params.span
      ? prompt.match(/(?:de|=)?\s*(\d+(?:\.\d+)?)\s*(?:m|metros?|meters?)\b/i)
      : null);
  if (spanMatch) params.span = Number(spanMatch[1]);

  const widthMatch = prompt.match(/(?:ancho|width)\s*(?:de|=)?\s*(\d+(?:\.\d+)?)\s*m?/i)
    || prompt.match(/(\d+(?:\.\d+)?)\s*(?:m|metros?|meters?)\s*(?:de\s+ancho|wide)/i);
  if (widthMatch) params.width = Number(widthMatch[1]);

  const baySizeMatch = prompt.match(/\d+\s*(?:vanos?|bays?)\s*(?:de|of)\s*(\d+(?:\.\d+)?)\s*(?:m|metros?|meters?)/i);
  if (baySizeMatch) params.baySize = Number(baySizeMatch[1]);

  // Radio / Radius, en ambos órdenes: "radio 8 m" y "8 m de radio".
  const radiusMatch = prompt.match(/(?:radio|radius|\br)\s*(?:de|=)?\s*(\d+(?:\.\d+)?)\s*m?/i)
    || prompt.match(/(\d+(?:\.\d+)?)\s*(?:m|metros?|meters?)\s*(?:de\s+radio|radius)/i);
  if (radiusMatch) params.radius = Number(radiusMatch[1]);

  // Carga / Load (kN)
  const loadMatch = prompt.match(/(?:carga|load|fuerza|peso|viento|wind)\s*(?:de|=)?\s*(\d+(?:\.\d+)?)\s*(?:kn|kilonewtons?)?/i)
    || prompt.match(/(\d+(?:\.\d+)?)\s*(?:kn)\b/i);
  if (loadMatch) params.load = Number(loadMatch[1]);

  // Apoyos (empotrado / articulado)
  if (/(empotrad[oa]s?|fixed)/i.test(prompt)) {
    params.baseSupport = 'fixed';
  } else if (/(articulad[oa]s?|pinned)/i.test(prompt)) {
    params.baseSupport = 'pinned';
  }

  // Construir resumen explicativo
  const summaryParts: string[] = [`Arquetipo: ${archetype}`];
  if (params.storiesY) summaryParts.push(`${params.storiesY} pisos`);
  if (params.baysX) summaryParts.push(`${params.baysX} vanos`);
  if (params.span) summaryParts.push(`Luz: ${params.span}m`);
  if (params.height) summaryParts.push(`Altura: ${params.height}m`);
  if (params.radius) summaryParts.push(`Radio: ${params.radius}m`);
  if (params.load) summaryParts.push(`Carga: ${params.load} kN`);

  const evidenceCount = Object.keys(params).length;
  const confidence = recognized
    ? (evidenceCount > 0 ? 0.9 : 0.6)
    : (evidenceCount > 0 ? 0.4 : 0.15);

  return {
    archetype,
    params,
    recognized,
    confidence,
    summary: summaryParts.join(' · '),
  };
}
