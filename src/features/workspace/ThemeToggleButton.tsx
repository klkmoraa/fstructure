import { Moon, Sun } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';

/**
 * Día / Noche de la barra superior.
 *
 * Las cuatro mesas lo ponen en el mismo sitio —junto a la acción primaria— para
 * que cambiar de herramienta no obligue a buscarlo otra vez. Es del shell, no de
 * ninguna herramienta: ninguna lo monta por su cuenta.
 */
export const ThemeToggleButton = () => {
  const { t } = useI18n();
  const { theme, setTheme } = useWorkspaceUI();
  const label = t(theme === 'dark' ? 'theme.light' : 'theme.dark');
  return <button
    type="button"
    className="workspace-topbar__icon-button workspace-topbar__theme-button"
    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    aria-label={label}
    title={label}
  >{theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}</button>;
};
