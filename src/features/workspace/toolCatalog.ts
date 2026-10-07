import type { ToolId } from '../../shared/contracts';

type Language = 'es' | 'en';
type Localized = Record<Language, string>;
type ToolStatus = 'disponible' | 'experimental';

/**
 * Identidad pública de cada herramienta, según el brandbook de FusionStructure.
 *
 * Pertenecen a la familia Análisis (FS-A0x). El código y el nombre son los del
 * catálogo del brandbook; el estado es el del código de este repositorio. Es
 * la única fuente que leen el Inicio y la barra de cada herramienta. El Solver
 * 3D (antes FS-A02) y Diseño (antes FS-A04) viven dentro de FStructure como sus
 * modos «3D» y «Diseño»: modelar en 2D, en 3D y diseñar son la misma mesa.
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

const TOOL_CATALOG: readonly ToolIdentity[] = [
  {
    id: 'model2d',
    code: 'FS-A01',
    name: { es: 'FStructure', en: 'FStructure' },
    role: { es: 'Modelo 2D, modelo 3D y diseño de concreto en una sola mesa', en: '2D model, 3D model, and concrete design on one workbench' },
    status: 'disponible',
    scene: scene('model2d'),
  },
];

export const toolIdentity = (id: ToolId): ToolIdentity => TOOL_CATALOG.find((tool) => tool.id === id) ?? TOOL_CATALOG[0]!;
