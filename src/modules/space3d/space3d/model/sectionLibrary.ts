/**
 * Biblioteca de materiales, secciones estándar y calculadoras paramétricas
 * para marcos espaciales 3D.
 *
 * Todas las propiedades están en las unidades canónicas del dominio espacial:
 * - Longitud: metros (m)
 * - Módulos E, G: kPa (kN/m²)
 * - Área A: m²
 * - Inercias Iy, Iz, Torsión J: m⁴
 */

interface Space3DMaterialPreset {
  readonly id: string;
  readonly name: string;
  readonly category: 'steel' | 'concrete' | 'timber' | 'aluminum';
  /** Módulo de elasticidad longitudinal en kPa (kN/m²) */
  readonly E: number;
  /** Módulo de elasticidad transversal en kPa (kN/m²) */
  readonly G: number;
  /** Densidad de masa en kg/m³. Es la unidad consumida por el análisis modal. */
  readonly massDensityKgPerM3: number;
}

interface Space3DSectionProperties {
  readonly name: string;
  readonly materialId: string;
  readonly A: number;
  readonly Iy: number;
  readonly Iz: number;
  readonly J: number;
  readonly depth?: number;
  readonly width?: number;
}

export const SPACE3D_MATERIALS: readonly Space3DMaterialPreset[] = Object.freeze([
  { id: 'steel-a36', name: 'Acero ASTM A36 (preset elástico)', category: 'steel', E: 200_000_000, G: 77_000_000, massDensityKgPerM3: 7850 },
  { id: 'steel-gr50', name: 'Acero Grado 50 (preset elástico)', category: 'steel', E: 210_000_000, G: 81_000_000, massDensityKgPerM3: 7850 },
  { id: 'concrete-fc25', name: 'Concreto f\'c 25 MPa', category: 'concrete', E: 23_500_000, G: 9_800_000, massDensityKgPerM3: 2400 },
  { id: 'concrete-fc30', name: 'Concreto f\'c 30 MPa', category: 'concrete', E: 26_500_000, G: 11_000_000, massDensityKgPerM3: 2400 },
  { id: 'timber-c24', name: 'Madera Estructural C24', category: 'timber', E: 11_000_000, G: 690_000, massDensityKgPerM3: 420 },
  { id: 'aluminum-6061', name: 'Aluminio 6061-T6', category: 'aluminum', E: 69_000_000, G: 26_000_000, massDensityKgPerM3: 2700 },
]);

export const SPACE3D_SECTION_CATALOG: readonly Space3DSectionProperties[] = Object.freeze([
  // Perfiles IPE (Acero)
  { name: 'IPE 140', materialId: 'steel-a36', A: 0.00164, Iy: 4.49e-7, Iz: 5.41e-6, J: 2.45e-8, depth: 0.14, width: 0.073 },
  { name: 'IPE 160', materialId: 'steel-a36', A: 0.00201, Iy: 6.83e-7, Iz: 8.69e-6, J: 3.60e-8, depth: 0.16, width: 0.082 },
  { name: 'IPE 200', materialId: 'steel-a36', A: 0.00285, Iy: 1.42e-6, Iz: 1.94e-5, J: 6.98e-8, depth: 0.20, width: 0.100 },
  { name: 'IPE 240', materialId: 'steel-a36', A: 0.00391, Iy: 2.84e-6, Iz: 3.89e-5, J: 1.29e-7, depth: 0.24, width: 0.120 },
  { name: 'IPE 300', materialId: 'steel-a36', A: 0.00538, Iy: 6.04e-6, Iz: 8.36e-5, J: 2.01e-7, depth: 0.30, width: 0.150 },
  { name: 'IPE 360', materialId: 'steel-a36', A: 0.00727, Iy: 1.04e-5, Iz: 1.63e-4, J: 3.73e-7, depth: 0.36, width: 0.170 },

  // Perfiles HEB (Columnas Acero)
  { name: 'HEB 160', materialId: 'steel-a36', A: 0.00543, Iy: 8.89e-6, Iz: 2.49e-5, J: 3.12e-7, depth: 0.16, width: 0.16 },
  { name: 'HEB 200', materialId: 'steel-a36', A: 0.00781, Iy: 2.00e-5, Iz: 5.70e-5, J: 5.93e-7, depth: 0.20, width: 0.20 },
  { name: 'HEB 240', materialId: 'steel-a36', A: 0.01060, Iy: 3.92e-5, Iz: 1.13e-4, J: 1.03e-6, depth: 0.24, width: 0.24 },

  // Tubulares Cuadrados HSS (Acero)
  { name: 'HSS 100x100x4', materialId: 'steel-a36', A: 0.00150, Iy: 2.30e-6, Iz: 2.30e-6, J: 3.56e-6, depth: 0.10, width: 0.10 },
  { name: 'HSS 150x150x6', materialId: 'steel-a36', A: 0.00340, Iy: 1.18e-5, Iz: 1.18e-5, J: 1.84e-5, depth: 0.15, width: 0.15 },
  { name: 'HSS 200x200x8', materialId: 'steel-a36', A: 0.00595, Iy: 3.65e-5, Iz: 3.65e-5, J: 5.75e-5, depth: 0.20, width: 0.20 },

  // Tubulares Circulares CHS (Acero)
  { name: 'Tubo Ø 88.9x3.2', materialId: 'steel-a36', A: 0.00086, Iy: 7.95e-7, Iz: 7.95e-7, J: 1.59e-6, depth: 0.0889, width: 0.0889 },
  { name: 'Tubo Ø 114.3x4.5', materialId: 'steel-a36', A: 0.00155, Iy: 2.34e-6, Iz: 2.34e-6, J: 4.68e-6, depth: 0.1143, width: 0.1143 },
  { name: 'Tubo Ø 168.3x6.3', materialId: 'steel-a36', A: 0.00321, Iy: 1.04e-5, Iz: 1.04e-5, J: 2.08e-5, depth: 0.1683, width: 0.1683 },

  // Concreto Rectangular
  { name: 'Concreto 30x30 cm', materialId: 'concrete-fc25', A: 0.09, Iy: 0.000675, Iz: 0.000675, J: 0.00114, depth: 0.30, width: 0.30 },
  { name: 'Concreto 30x40 cm', materialId: 'concrete-fc25', A: 0.12, Iy: 0.0009, Iz: 0.0016, J: 0.00185, depth: 0.40, width: 0.30 },
  { name: 'Concreto 40x40 cm', materialId: 'concrete-fc25', A: 0.16, Iy: 0.00213, Iz: 0.00213, J: 0.00360, depth: 0.40, width: 0.40 },
  { name: 'Concreto 30x50 cm', materialId: 'concrete-fc25', A: 0.15, Iy: 0.001125, Iz: 0.003125, J: 0.00300, depth: 0.50, width: 0.30 },
]);

/**
 * Calcula propiedades geométricas de sección rectangular maciza (base b, peralte h en metros).
 */
export function calculateRectangularSection(b: number, h: number): { A: number; Iy: number; Iz: number; J: number } {
  const base = Math.max(0.01, b);
  const height = Math.max(0.01, h);
  const A = base * height;
  const Iz = (base * Math.pow(height, 3)) / 12; // Eje fuerte (flexión en plano Y)
  const Iy = (height * Math.pow(base, 3)) / 12; // Eje débil (flexión en plano Z)

  // Aproximación de St. Venant para torsión en rectángulo:
  const longer = Math.max(base, height);
  const shorter = Math.min(base, height);
  const ratio = shorter / longer;
  const beta = (1 / 3) * (1 - 0.63 * ratio * (1 - Math.pow(ratio, 4) / 12));
  const J = beta * longer * Math.pow(shorter, 3);

  return { A, Iy, Iz, J };
}

/**
 * Calcula propiedades geométricas de sección circular maciza (diámetro d en metros).
 */
export function calculateCircularSection(d: number): { A: number; Iy: number; Iz: number; J: number } {
  const dia = Math.max(0.01, d);
  const A = (Math.PI * Math.pow(dia, 2)) / 4;
  const I = (Math.PI * Math.pow(dia, 4)) / 64;
  const J = (Math.PI * Math.pow(dia, 4)) / 32;
  return { A, Iy: I, Iz: I, J };
}

/**
 * Calcula propiedades geométricas de tubo circular (diámetro externo D, espesor t en metros).
 */
export function calculateCircularTubeSection(outerDiameter: number, thickness: number): { A: number; Iy: number; Iz: number; J: number } {
  const D = Math.max(0.01, outerDiameter);
  const t = Math.max(0.001, Math.min(thickness, D / 2 - 0.001));
  const d = D - 2 * t;
  const A = (Math.PI * (Math.pow(D, 2) - Math.pow(d, 2))) / 4;
  const I = (Math.PI * (Math.pow(D, 4) - Math.pow(d, 4))) / 64;
  const J = 2 * I;
  return { A, Iy: I, Iz: I, J };
}

/**
 * Calcula propiedades de tubo rectangular/cajón (ancho B, alto H, espesor t en metros).
 */
export function calculateBoxSection(outerWidth: number, outerHeight: number, thickness: number): { A: number; Iy: number; Iz: number; J: number } {
  const B = Math.max(0.02, outerWidth);
  const H = Math.max(0.02, outerHeight);
  const t = Math.max(0.001, Math.min(thickness, Math.min(B, H) / 2 - 0.001));
  const bi = B - 2 * t;
  const hi = H - 2 * t;
  const A = B * H - bi * hi;
  const Iz = (B * Math.pow(H, 3) - bi * Math.pow(hi, 3)) / 12;
  const Iy = (H * Math.pow(B, 3) - hi * Math.pow(bi, 3)) / 12;

  // Fórmula de Bredt para sección cerrada de pared delgada: J = 4 * Am² / ∮ (ds/t)
  const Am = (B - t) * (H - t);
  const perimeter = 2 * ((B - t) + (H - t));
  const J = (4 * Math.pow(Am, 2) * t) / perimeter;

  return { A, Iy, Iz, J };
}

/**
 * Filtra secciones del catálogo estándar según su categoría de material.
 */
export function getSectionsByCategory(
  category: 'all' | 'steel' | 'concrete' | 'timber' | 'aluminum',
): readonly Space3DSectionProperties[] {
  if (category === 'all') return SPACE3D_SECTION_CATALOG;
  return SPACE3D_SECTION_CATALOG.filter((sec) => {
    const mat = SPACE3D_MATERIALS.find((m) => m.id === sec.materialId);
    return mat?.category === category;
  });
}
