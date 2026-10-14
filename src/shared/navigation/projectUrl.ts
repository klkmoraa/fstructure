import type { ToolId } from '../contracts';

/**
 * `welcome` es la Home (la única portada de la app); `workspace`, la mesa de
 * FStructure. Las portadas que hubo antes (`surface=home`, el Inicio de
 * FusionStructure y la bienvenida de FEM) abren hoy la misma Home.
 */
export interface ProjectUrlState {
  surface: 'welcome' | 'workspace';
  projectId: string;
  tool: ToolId;
  /** Modo de la mesa de FStructure: modelo 2D (por omisión), modelo 3D o diseño. */
  mode?: MesaMode;
}

export type MesaMode = 'model' | '3d' | 'design';

const legacyTools = new Map<string, ToolId>([
  ['workspace2d', 'model2d'], ['design', 'model2d'], ['workspace3d', 'model2d'],
]);

function isToolId(value: unknown): value is ToolId {
  return value === 'model2d';
}

/**
 * Diseño y el Solver 3D fueron herramientas propias (`tool=design`,
 * `tool=space3d`); sus enlaces abren el modo correspondiente de FStructure.
 */
const legacyMode = (params: URLSearchParams): MesaMode | null => {
  const tool = params.get('tool');
  const surface = params.get('surface');
  if (tool === 'design' || (!params.has('tool') && surface === 'design')) return 'design';
  if (tool === 'space3d' || (!params.has('tool') && surface === 'workspace3d')) return '3d';
  return null;
};

const isMesaMode = (value: string | null): value is Exclude<MesaMode, 'model'> => value === '3d' || value === 'design';

export const sameRoute = (a: ProjectUrlState, b: ProjectUrlState) =>
  a.surface === b.surface && a.projectId === b.projectId && a.tool === b.tool && (a.mode ?? 'model') === (b.mode ?? 'model');

export function readProjectUrl(href: string, activeProjectId: string): ProjectUrlState {
  const params = new URL(href).searchParams;
  const requested = params.get('project');
  const projectId = requested?.trim() ? requested : activeProjectId;
  const legacy = legacyTools.get(params.get('surface') ?? '');
  const canonical = params.get('tool');
  const tool = params.has('tool') ? (isToolId(canonical) ? canonical : 'model2d') : legacy ?? 'model2d';
  const surface = params.get('surface');
  // La bienvenida de una herramienta (`surface=home`) y el Inicio son hoy la misma Home.
  // FEM se retiró: sus enlaces (`tool=fem`, `surface=fem`) abren la Home.
  if (surface === 'home' || surface === 'welcome' || surface === 'fem' || canonical === 'fem') return { surface: 'welcome', projectId, tool };
  const workspace = params.has('tool') || legacy !== undefined || (params.has('project') && surface !== 'welcome');
  if (!workspace) return { surface: 'welcome', projectId, tool };
  const requestedMode = params.get('mode');
  const mode = tool === 'model2d' ? legacyMode(params) ?? (isMesaMode(requestedMode) ? requestedMode : null) : null;
  return mode && mode !== 'model' ? { surface: 'workspace', projectId, tool, mode } : { surface: 'workspace', projectId, tool };
}

export function writeProjectUrl(browser: Pick<Window, 'location' | 'history'>, route: ProjectUrlState, mode: 'push' | 'replace'): void {
  const url = new URL(browser.location.href);
  url.searchParams.delete('surface');
  url.searchParams.delete('project');
  url.searchParams.delete('tool');
  url.searchParams.delete('mode');
  if (route.surface === 'welcome') {
    // La sección abierta de la Home (`view`) es suya: se conserva al recargar.
    url.searchParams.set('surface', 'welcome');
  } else {
    url.searchParams.delete('view');
    url.searchParams.set('project', route.projectId);
    url.searchParams.set('tool', route.tool);
    if (route.tool === 'model2d' && route.mode && route.mode !== 'model') url.searchParams.set('mode', route.mode);
  }
  url.hash = '';
  if (url.href === browser.location.href) return;
  if (mode === 'push') browser.history.pushState(null, '', url);
  else browser.history.replaceState(browser.history.state, '', url);
}
