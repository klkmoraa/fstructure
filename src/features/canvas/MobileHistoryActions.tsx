import { Redo2, Undo2 } from 'lucide-react';
import { useProject } from '../../store/ProjectContext';
import { useI18n } from '../../i18n/useI18n';

/** Acts on the current history, not a stale deletion snapshot or a timed callback. */
export function MobileHistoryActions() {
  const { canUndo, canRedo, undo, redo } = useProject();
  const { language } = useI18n();
  return <>
    <button type="button" className="mdock__history-action" disabled={!canUndo} onClick={undo}>
      <Undo2 size={18} aria-hidden="true" /><span>{language === 'en' ? 'Undo' : 'Deshacer'}</span>
    </button>
    <button type="button" className="mdock__history-action" disabled={!canRedo} onClick={redo}>
      <Redo2 size={18} aria-hidden="true" /><span>{language === 'en' ? 'Redo' : 'Rehacer'}</span>
    </button>
  </>;
}
