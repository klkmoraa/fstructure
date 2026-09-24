import type { ToolId } from '../../shared/contracts';

type Language = 'es' | 'en';
type Localized = Record<Language, string>;
type ToolStatus = 'disponible' | 'experimental';

/**
 * Identidad pública de cada herramienta, según el brandbook de FusionStructure.
 *
 * Las cuatro pertenecen a la familia Análisis (FS-A0x). El código y el nombre
 * son los del catálogo del brandbook; el estado es el del código de este
 * repositorio. Es la única fuente que leen el Inicio y la barra de cada
 * herramienta.
 */
interface ToolIdentity {
  id: ToolId;
  code: string;
  name: Localized;
  role: Localized;
  status: ToolStatus;
  /** Escena en arcilla, misma luz y cámara que el pórtico, una por tema. */
  scene: { day: string; night: string };
}

const scene = (file: string) => ({ day: `./assets/suite/${file}-day.png`, night: `./assets/suite/${file}-night.png` });

export const TOOL_CATALOG: readonly ToolIdentity[] = [
  {
    id: 'model2d',
    code: 'FS-A01',
    name: { es: 'FStructure', en: 'FStructure' },
    role: { es: 'Modelo 2D · marcos, vigas y armaduras', en: '2D model · frames, beams, and trusses' },
    status: 'disponible',
    scene: scene('model2d'),
  },
  {
    id: 'space3d',
    code: 'FS-A02',
    name: { es: 'Solver 3D', en: '3D solver' },
    role: { es: 'Marcos espaciales, seis grados de libertad por nudo', en: 'Space frames, six degrees of freedom per node' },
    status: 'experimental',
    scene: scene('space3d'),
  },
  {
    id: 'fem',
    code: 'FS-A03',
    name: { es: 'Elementos finitos', en: 'Finite elements' },
    role: { es: 'Placas y muros con TRI3 y QUAD4', en: 'Plates and walls with TRI3 and QUAD4' },
    status: 'experimental',
    scene: scene('fem'),
  },
  {
    id: 'design',
    code: 'FS-A04',
    name: { es: 'Diseño', en: 'Design' },
    role: { es: 'Vigas, columnas y zapatas de concreto reforzado', en: 'Reinforced concrete beams, columns, and footings' },
    status: 'experimental',
    scene: scene('design'),
  },
];

export const toolIdentity = (id: ToolId): ToolIdentity => TOOL_CATALOG.find((tool) => tool.id === id) ?? TOOL_CATALOG[0]!;
