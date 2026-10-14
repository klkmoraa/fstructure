export type ProposalId = 'home' | 'start' | 'beam' | 'pratt' | 'review' | 'projects' | 'footing' | 'mobile' | 'column';
export type Theme = 'light' | 'dark';

export const PROPOSALS: readonly { id: ProposalId; name: string; title: string; intent: string; source: string }[] = [
  { id: 'home', name: 'Inicio', title: 'Una entrada, dos formas de trabajar', intent: 'Elegir entre un cálculo individual y un proyecto enlazado sin perder la jerarquía de la Home.', source: 'HomePage · home.css · escenas oficiales' },
  { id: 'start', name: 'Arranque 2D', title: 'El primer modelo, a una elección', intent: 'Cinco geometrías reconocibles y un camino directo al dibujo libre.', source: 'ModelStartCard · modelStarts · mesaChrome' },
  { id: 'beam', name: 'Viga continua', title: 'Cargas y resultados, en la misma lectura', intent: 'DCL y momento alineados; extremos fuera de la curva y cursor compartido.', source: 'CanvasDiagramStack · diagramBands · StructuralCanvas' },
  { id: 'pratt', name: 'Axial Pratt', title: 'La fuerza se lee sobre la estructura', intent: 'Pratt simétrica, color de señal y etiquetas con su propio espacio.', source: 'modelStarts · labelLayout · señales N/M/V' },
  { id: 'review', name: 'Tres estados', title: 'Una revisión con alcance visible', intent: 'El estado se distingue de la utilización. Los datos faltantes están al mismo nivel que el resultado.', source: 'Verdict · ReviewList · ChecksList' },
  { id: 'projects', name: 'Proyectos', title: 'Un vacío que conserva el contexto', intent: 'Mantener filtros y altura de lista; recuperar resultados con una acción clara.', source: 'ProjectHub · projectHub.css' },
  { id: 'footing', name: 'Corte de zapata', title: 'Cada sección junto a su referencia', intent: 'Separar M, d/2 y d desde la cara del pedestal, con cotas y presión legibles.', source: 'FootingDrawings · FootingWorkbench · WorkbenchLayout' },
  { id: 'mobile', name: 'Mesa móvil', title: 'La mesa deja espacio al dibujo', intent: 'Una acción en cabecera, cuatro herramientas accesibles y contexto de la selección.', source: 'Space3DDock · ShellToolSlots · mesaChrome' },
  { id: 'column', name: 'Columna', title: 'La sección y sus entradas se entienden juntas', intent: 'Encabezado compacto, acción sin salto de línea y forma vinculada a base y peralte.', source: 'ColumnWorkbench · ColumnDrawings · Field' },
];

export function readPreviewLocation(): { id: ProposalId; theme: Theme } {
  const query = new URLSearchParams(window.location.hash.slice(1));
  const id = query.get('view');
  return {
    id: PROPOSALS.find((item) => item.id === id)?.id ?? 'home',
    theme: query.get('theme') === 'dark' ? 'dark' : 'light',
  };
}
