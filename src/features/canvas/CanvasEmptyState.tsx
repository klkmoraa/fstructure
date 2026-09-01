import { Grid3x3, LayoutTemplate, MousePointerClick } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import type { Tool } from '../../types';

/**
 * Qué se ve cuando el modelo está vacío.
 *
 * Una rejilla en blanco no dice qué hacer, y la herramienta que hay que elegir
 * está en un riel de iconos. Este bloque nombra los dos caminos reales —colocar
 * el primer nudo o generar una familia completa— y los ejecuta. Desaparece en
 * cuanto hay un nudo: no es una pantalla de bienvenida, es el estado vacío de
 * una superficie de trabajo.
 *
 * No captura el puntero salvo en sus propios botones: quien ya sabe lo que hace
 * puede empezar a dibujar encima sin cerrarlo.
 */
export const CanvasEmptyState = ({ onSelectTool }: { onSelectTool: (tool: Tool) => void }) => {
  const { t } = useI18n();

  return <div className="canvas-empty" data-canvas-chrome="empty">
    <div className="canvas-empty__card">
      <h2>{t('canvas.emptyTitle')}</h2>
      <p>{t('canvas.emptyBody')}</p>
      <div className="canvas-empty__actions">
        <button type="button" className="canvas-empty__action" onClick={() => onSelectTool('node')}>
          <MousePointerClick size={17} aria-hidden="true" />
          <span><strong>{t('canvas.emptyPlaceNode')}</strong><small>{t('canvas.emptyPlaceNodeHint')}</small></span>
        </button>
        <button type="button" className="canvas-empty__action" onClick={() => emitWorkspaceCommand('open-structure-generator')} data-structure-generator-command>
          <Grid3x3 size={17} aria-hidden="true" />
          <span><strong>{t('generator.launcher')}</strong><small>{t('canvas.emptyGenerateHint')}</small></span>
        </button>
        <button type="button" className="canvas-empty__action" onClick={() => emitWorkspaceCommand('open-command-palette')}>
          <LayoutTemplate size={17} aria-hidden="true" />
          <span><strong>{t('palette.openShort')}</strong><small>{t('canvas.emptyPaletteHint')}</small></span>
        </button>
      </div>
    </div>
  </div>;
};
