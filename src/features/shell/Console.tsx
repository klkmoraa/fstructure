import { Maximize2, Minimize2, PanelRight } from 'lucide-react';
import { ToolRail } from '../canvas/ToolRail';
import { useI18n } from '../../i18n/useI18n';
import './console.css';

interface ConsoleLayoutActions {
  inspectorCollapsed: boolean;
  fullCanvas: boolean;
  onToggleInspector: (trigger?: HTMLElement | null) => void;
  onToggleFullCanvas: () => void;
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

export const Console = ({ layoutActions }: {
  layoutActions: ConsoleLayoutActions;
}) => {
  const { t } = useI18n();
  const canvasLabel = layoutActions.fullCanvas ? t('shell.exitFullCanvas') : t('shell.fullCanvas');

  return <aside className="console" aria-label={t('toolbar.primary')}>
    <div className="console__body">
      <div className="console__tools"><ToolRail /></div>
    </div>
    <div className="console__foot">
      {/* En escritorio el panel y el tema viven en la barra superior, como en las
          demás mesas; aquí queda el interruptor del panel para el dock del teléfono. */}
      <button type="button" className={'console__inspector-toggle' + (layoutActions.inspectorCollapsed ? '' : ' is-active')} onClick={() => layoutActions.onToggleInspector()} aria-label={t('shell.showInspector')} aria-pressed={!layoutActions.inspectorCollapsed} title={t('shell.showInspector')}>
        <PanelRight size={18} /><Label>{t('shell.showInspector')}</Label>
      </button>
      <button type="button" className="console__canvas-toggle" onClick={layoutActions.onToggleFullCanvas} aria-label={canvasLabel} aria-pressed={layoutActions.fullCanvas} title={canvasLabel}>
        {layoutActions.fullCanvas ? <Minimize2 size={18} /> : <Maximize2 size={18} />}<Label>{canvasLabel}</Label>
      </button>
    </div>
  </aside>;
};
