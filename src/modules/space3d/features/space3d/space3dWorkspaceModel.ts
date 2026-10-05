import type { Space3DAnalysisState } from '../../space3d/store/Space3DProjectContext';

type Space3DWorkspaceMode = 'select' | 'node' | 'member' | 'support' | 'load' | 'results';
type Space3DProductStatus = 'Disponible' | 'Experimental' | 'Planeado' | 'No comprometido';

/**
 * Estudios que se pueden solicitar desde la única bandeja de análisis 3D.
 * Cada opción tiene un runner real; la superficie decide después qué parte
 * del resultado puede publicar sin sustituir el análisis lineal compartido.
 */
export type Space3DAnalysisMode = 'linear' | 'pdelta' | 'modal' | 'spectrum' | 'buckling' | 'influence';

interface Space3DAnalysisModeDefinition {
  readonly id: Space3DAnalysisMode;
  readonly labelKey:
    | 'space3d.analysisModeLinear'
    | 'space3d.analysisModePDelta'
    | 'space3d.analysisModeModal'
    | 'space3d.analysisModeBuckling'
    | 'space3d.analysisModeInfluence'
    | 'space3d.analysisModeSpectrum';
  readonly status: Space3DProductStatus;
}

export const SPACE3D_ANALYSIS_MODES: readonly Space3DAnalysisModeDefinition[] = Object.freeze([
  { id: 'linear', labelKey: 'space3d.analysisModeLinear', status: 'Disponible' },
  { id: 'pdelta', labelKey: 'space3d.analysisModePDelta', status: 'Experimental' },
  { id: 'modal', labelKey: 'space3d.analysisModeModal', status: 'Experimental' },
  { id: 'spectrum', labelKey: 'space3d.analysisModeSpectrum', status: 'Experimental' },
  { id: 'buckling', labelKey: 'space3d.analysisModeBuckling', status: 'Experimental' },
  { id: 'influence', labelKey: 'space3d.analysisModeInfluence', status: 'Experimental' },
]);

interface Space3DWorkspaceModeDefinition {
  readonly id: Space3DWorkspaceMode;
  readonly label: string;
  readonly shortcut: string;
  readonly status: Space3DProductStatus;
}

export const SPACE3D_WORKSPACE_MODES: readonly Space3DWorkspaceModeDefinition[] = Object.freeze([
  { id: 'select', label: 'Seleccionar', shortcut: 'V', status: 'Disponible' },
  { id: 'node', label: 'Nudo', shortcut: 'N', status: 'Disponible' },
  { id: 'member', label: 'Barra', shortcut: 'B', status: 'Disponible' },
  { id: 'support', label: 'Apoyo', shortcut: 'A', status: 'Disponible' },
  { id: 'load', label: 'Carga', shortcut: 'C', status: 'Disponible' },
  { id: 'results', label: 'Resultados', shortcut: 'R', status: 'Disponible' },
]);

export const getSpace3DModeAvailability = (
  mode: Space3DWorkspaceMode,
  analysisState: Space3DAnalysisState,
): { readonly enabled: boolean; readonly status: Space3DProductStatus } => ({
  enabled: mode !== 'results' || analysisState === 'ready',
  status: SPACE3D_WORKSPACE_MODES.find((item) => item.id === mode)?.status ?? 'No comprometido',
});

interface Space3DMoreCommand {
  readonly id: string;
  readonly label: string;
  readonly status: Space3DProductStatus;
  readonly enabled: boolean;
}

export const getSpace3DMoreCommands = (): readonly Space3DMoreCommand[] => Object.freeze([
  { id: 'section-library', label: 'Biblioteca de secciones', status: 'Planeado', enabled: false },
  { id: 'distributed-loads', label: 'Cargas distribuidas', status: 'Planeado', enabled: false },
  { id: 'design-checks', label: 'Comprobaciones de diseño', status: 'Planeado', enabled: false },
]);
