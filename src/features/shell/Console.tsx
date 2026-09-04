import { ChartNoAxesCombined, Eye, Maximize2, Minimize2, Moon, PanelRight, Play, Search, SlidersHorizontal, Sparkles, Sun } from 'lucide-react';
import { ToolRail } from '../canvas/ToolRail';
import { Solver2DMark } from '../../design-system/brand';
import { SOLVER_2D } from '../../design-system/moduleIdentity';
import { useI18n } from '../../i18n/useI18n';
import { useProjectAnalysis, useProjectModel, useWorkspaceUI } from '../../store/ProjectContext';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import './console.css';

export interface ConsoleLayoutActions {
  inspectorCollapsed: boolean;
  fullCanvas: boolean;
  onToggleInspector: (trigger?: HTMLElement | null) => void;
  onToggleFullCanvas: () => void;
  onOpenAnalysisSetup: () => void;
  onOpenViewSettings: () => void;
}

/**
 * Etiqueta de una acción de la consola.
 *
 * Es un elemento propio y no un `span` cualquiera por una razón concreta: la
 * consola aloja el riel de herramientas completo, y una regla que apunte a
 * `.console button span` alcanza también el icono de cada herramienta. Esa
 * fuga dejaba invisible el riel entero. La etiqueta se nombra; el resto no se
 * toca.
 */
const Label = ({ children }: { children: string }) => <span className="console__label">{children}</span>;

export const Console = ({ onOpenHome, onOpenSpace3D: _onOpenSpace3D, layoutActions, resultsOpen = false }: {
  onOpenHome: () => void;
  onOpenSpace3D?: () => void;
  layoutActions: ConsoleLayoutActions;
  resultsOpen?: boolean;
}) => {
  const { project } = useProjectModel();
  const { analyze, isAnalyzing } = useProjectAnalysis();
  const { theme, setTheme } = useWorkspaceUI();
  const { t } = useI18n();
  const themeLabel = theme === 'dark' ? t('theme.light') : t('theme.dark');
  const canvasLabel = layoutActions.fullCanvas ? t('shell.exitFullCanvas') : t('shell.fullCanvas');

  return <aside className="console" aria-label={t('toolbar.primary')}>
    <div className="console__head">
      <button type="button" className="console__brand" onClick={onOpenHome} aria-label={t('navigation.home')} title={t('navigation.home')}>
        <Solver2DMark size={22} />
        <Label>{SOLVER_2D.name}</Label>
      </button>
      <button type="button" className="console__project" onClick={() => emitWorkspaceCommand('open-command-palette')} aria-label={`${t('topbar.currentProject')}: ${project.name}`} title={project.name}>
        <span className="console__project-name">{project.name}</span>
      </button>
      <button type="button" className="console__key" onClick={() => emitWorkspaceCommand('open-command-palette')} aria-label={t('palette.open')} title={t('palette.open')}>
        <Search size={18} /><Label>{t('palette.open')}</Label>
      </button>
    </div>
    <div className="console__body">
      <div className="console__surfaces" role="group" aria-label={t('shell.surfaces')}>
        <button type="button" className={`console__results${resultsOpen ? ' is-active' : ''}`} onClick={(event) => emitWorkspaceCommand('toggle-results', { trigger: event.currentTarget })} aria-label={t('results.outputs')} aria-pressed={resultsOpen} title={t('results.outputs')}>
          <ChartNoAxesCombined size={18} /><Label>{t('results.outputs')}</Label>
        </button>
        <button type="button" onClick={layoutActions.onOpenAnalysisSetup} aria-label={t('inspector.analysisSetupLauncher')} title={t('inspector.analysisSetupLauncher')}>
          <SlidersHorizontal size={18} /><Label>{t('inspector.analysisSetupLauncher')}</Label>
        </button>
        <button type="button" onClick={layoutActions.onOpenViewSettings} aria-label={t('inspector.viewTab')} title={t('inspector.viewTab')}>
          <Eye size={18} /><Label>{t('inspector.viewTab')}</Label>
        </button>
        <button type="button" onClick={(event) => emitWorkspaceCommand('open-local-assistant', { trigger: event.currentTarget })} aria-label={t('assistant.localLabel')} title={t('assistant.localLabel')}>
          <Sparkles size={18} /><Label>{t('assistant.localLabel')}</Label>
        </button>
      </div>
      <div className="console__tools"><ToolRail /></div>
    </div>
    <div className="console__foot">
      <button type="button" className="console__analyze" disabled={isAnalyzing} onClick={analyze} aria-label={t('analysis.run')} title={t('analysis.run')}>
        <Play size={18} fill="currentColor" /><Label>{isAnalyzing ? t('analysis.running') : t('analysis.run')}</Label>
      </button>
      <button type="button" className={layoutActions.inspectorCollapsed ? '' : 'is-active'} onClick={() => layoutActions.onToggleInspector()} aria-label={t('shell.showInspector')} aria-pressed={!layoutActions.inspectorCollapsed} title={t('shell.showInspector')}>
        <PanelRight size={18} /><Label>{t('shell.showInspector')}</Label>
      </button>
      <button type="button" className="console__canvas-toggle" onClick={layoutActions.onToggleFullCanvas} aria-label={canvasLabel} aria-pressed={layoutActions.fullCanvas} title={canvasLabel}>
        {layoutActions.fullCanvas ? <Minimize2 size={18} /> : <Maximize2 size={18} />}<Label>{canvasLabel}</Label>
      </button>
      <button type="button" className="console__theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={themeLabel} title={themeLabel}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}<Label>{themeLabel}</Label>
      </button>
    </div>
  </aside>;
};
