import type { ToolId } from '../../shared/contracts';
import { isToolId } from '../../shared/navigation/projectUrl';

const LAST_TOOL_KEY = 'fstructure.last-tool';

/**
 * Última herramienta abierta en este dispositivo. Es una comodidad del Inicio
 * —«Continuar» vuelve a ella—, no un dato del proyecto: si el almacenamiento
 * falla o trae basura, se continúa en el Modelo 2D.
 */
export const readLastTool = (): ToolId => {
  try {
    const stored = localStorage.getItem(LAST_TOOL_KEY);
    return isToolId(stored) ? stored : 'model2d';
  } catch {
    return 'model2d';
  }
};

export const rememberLastTool = (tool: ToolId): void => {
  try { localStorage.setItem(LAST_TOOL_KEY, tool); } catch { /* modo privado: se recuerda sólo en memoria de la sesión */ }
};
