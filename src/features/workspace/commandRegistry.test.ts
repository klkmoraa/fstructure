import { describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { buildCommands, type CommandContext } from './commandRegistry';

const contextoDe = (theme: 'light' | 'dark', setTheme: (next: 'light' | 'dark') => void): CommandContext => ({
  t: ((key: string) => key) as CommandContext['t'],
  project: createDefaultProject(),
  hasAnalysis: false,
  isAnalyzing: false,
  canUndo: false,
  canRedo: false,
  classroomMode: false,
  selection: null,
  theme,
  setActiveTool: () => undefined,
  setSelection: () => undefined,
  setResultTab: () => undefined,
  setTheme,
  updateProjectView: () => undefined,
  dispatchLayers: () => undefined,
  analyze: () => undefined,
  undo: () => undefined,
  redo: () => undefined,
});

describe('comando de tema', () => {
  /**
   * `theme` y `setTheme` llevaban en el contexto desde el principio, y el
   * comentario de `iconFor` nombra «el conmutador de tema» como su razón de
   * existir, pero el comando nunca se escribió. Sin él, un teléfono sólo podía
   * cambiar de tema desde la banda inferior, que es donde menos sitio sobra.
   */
  it('existe y conmuta al tema contrario', () => {
    const setTheme = vi.fn();
    const enDia = buildCommands(contextoDe('light', setTheme)).find((command) => command.id === 'view:theme');

    expect(enDia).toBeTruthy();
    enDia!.run();
    expect(setTheme).toHaveBeenCalledWith('dark');

    const setThemeNoche = vi.fn();
    buildCommands(contextoDe('dark', setThemeNoche)).find((command) => command.id === 'view:theme')!.run();
    expect(setThemeNoche).toHaveBeenCalledWith('light');
  });

  it('se nombra y se ilustra según el tema en curso, no de forma fija', () => {
    const dia = buildCommands(contextoDe('light', () => undefined)).find((command) => command.id === 'view:theme')!;
    const noche = buildCommands(contextoDe('dark', () => undefined)).find((command) => command.id === 'view:theme')!;

    expect(dia.label).toBe('theme.dark');
    expect(noche.label).toBe('theme.light');
    expect(dia.icon).not.toBe(noche.icon);
  });

  it('se encuentra buscando «tema» en español y «theme» en inglés', () => {
    const command = buildCommands(contextoDe('light', () => undefined)).find((item) => item.id === 'view:theme')!;

    expect(command.aliases).toContain('tema');
    expect(command.aliases).toContain('theme');
  });
});
