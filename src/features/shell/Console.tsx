import { Layers3, Moon, Play, Search, SlidersHorizontal, Sun } from 'lucide-react';
import { ToolRail } from '../canvas/ToolRail';
import { useI18n } from '../../i18n/useI18n';
import { useProjectAnalysis, useProjectModel, useWorkspaceUI } from '../../store/ProjectContext';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import './console.css';

export interface ConsoleLayoutActions {
  inspectorCollapsed: boolean;
  fullCanvas: boolean;
  toolDockPosition: 'bottom' | 'left';
  onToggleInspector: (trigger?: HTMLElement | null) => void;
  onToggleFullCanvas: () => void;
  onToolDockPositionChange: (position: 'bottom' | 'left') => void;
  onOpenAnalysisSetup: () => void;
  onOpenViewSettings: () => void;
}

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

  return <aside className="console" aria-label={t('toolbar.primary')}>
    <div className="console__head">
      <button type="button" className="console__brand" onClick={onOpenHome} aria-label={t('navigation.home')}>FS</button>
      <button type="button" className="console__project" onClick={() => emitWorkspaceCommand('open-command-palette')} aria-label={t('topbar.currentProject')}>
        <span>{project.name}</span>
      </button>
      <button type="button" className="console__key" onClick={() => emitWorkspaceCommand('open-command-palette')} aria-label={t('palette.open')}><Search size={18} /><span>{t('palette.open')}</span></button>
    </div>
    <div className="console__body">
      <div className="console__surfaces">
        <button type="button" className={resultsOpen ? 'is-active' : ''} onClick={(event) => emitWorkspaceCommand('toggle-results', { trigger: event.currentTarget })} aria-label={t('results.outputs')}><Layers3 size={18} /><span>{t('results.outputs')}</span></button>
        <button type="button" onClick={layoutActions.onOpenAnalysisSetup} aria-label={t('inspector.analysisSetupLauncher')}><SlidersHorizontal size={18} /><span>{t('inspector.analysisSetupLauncher')}</span></button>
        <button type="button" onClick={layoutActions.onOpenViewSettings} aria-label={t('inspector.viewTab')}><Layers3 size={18} /><span>{t('inspector.viewTab')}</span></button>
      </div>
      <div className="console__tools"><ToolRail /></div>
    </div>
    <div className="console__foot">
      <button type="button" className="console__analyze" disabled={isAnalyzing} onClick={analyze} aria-label={t('analysis.run')}><Play size={18} fill="currentColor" /><span>{isAnalyzing ? t('analysis.running') : t('analysis.run')}</span></button>
      <button type="button" onClick={() => layoutActions.onToggleInspector()} aria-label={t('shell.showInspector')}><SlidersHorizontal size={18} /><span>{t('shell.showInspector')}</span></button>
      <button type="button" onClick={layoutActions.onToggleFullCanvas} aria-label={layoutActions.fullCanvas ? t('shell.exitFullCanvas') : t('shell.fullCanvas')}><Layers3 size={18} /><span>{layoutActions.fullCanvas ? t('shell.exitFullCanvas') : t('shell.fullCanvas')}</span></button>
      <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={themeLabel}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}<span>{themeLabel}</span></button>
    </div>
  </aside>;
};
