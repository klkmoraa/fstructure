import type { ToolId } from '../contracts';

/**
 * `welcome` es el Inicio de FusionStructure; `tool-home`, la bienvenida propia
 * de una herramienta; `workspace`, su mesa de trabajo.
 */
export interface ProjectUrlState {
  surface: 'welcome' | 'tool-home' | 'workspace';
  projectId: string;
  tool: ToolId;
}

const legacyTools = new Map<string, ToolId>([
  ['workspace2d', 'model2d'], ['design', 'design'], ['workspace3d', 'space3d'], ['fem', 'fem'],
]);

export function isToolId(value: unknown): value is ToolId {
  return value === 'model2d' || value === 'design' || value === 'space3d' || value === 'fem';
}

export function readProjectUrl(href: string, activeProjectId: string): ProjectUrlState {
  const params = new URL(href).searchParams;
  const requested = params.get('project');
  const projectId = requested?.trim() ? requested : activeProjectId;
  const legacy = legacyTools.get(params.get('surface') ?? '');
  const canonical = params.get('tool');
  const tool = params.has('tool') ? (isToolId(canonical) ? canonical : 'model2d') : legacy ?? 'model2d';
  const surface = params.get('surface');
  if (surface === 'home') return { surface: 'tool-home', projectId, tool };
  // Enlaces antiguos a las vistas del Inicio 2D (plantillas, aula…) abren la bienvenida de FStructure.
  if (surface === 'welcome' && params.has('view')) return { surface: 'tool-home', projectId, tool: 'model2d' };
  const workspace = params.has('tool') || legacy !== undefined || (params.has('project') && surface !== 'welcome');
  return { surface: workspace ? 'workspace' : 'welcome', projectId, tool };
}

export function writeProjectUrl(browser: Pick<Window, 'location' | 'history'>, route: ProjectUrlState, mode: 'push' | 'replace'): void {
  const url = new URL(browser.location.href);
  url.searchParams.delete('surface');
  url.searchParams.delete('project');
  url.searchParams.delete('tool');
  if (route.surface !== 'tool-home') url.searchParams.delete('view');
  if (route.surface === 'welcome') {
    url.searchParams.set('surface', 'welcome');
  } else if (route.surface === 'tool-home') {
    url.searchParams.set('surface', 'home');
    url.searchParams.set('project', route.projectId);
    url.searchParams.set('tool', route.tool);
  } else {
    url.searchParams.set('project', route.projectId);
    url.searchParams.set('tool', route.tool);
  }
  url.hash = '';
  if (url.href === browser.location.href) return;
  if (mode === 'push') browser.history.pushState(null, '', url);
  else browser.history.replaceState(browser.history.state, '', url);
}
