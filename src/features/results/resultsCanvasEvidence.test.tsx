// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { ResultsPanel } from './ResultsPanel';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';
import { createEditorLayerState, editorLayerReducer, type EditorLayerState } from '../canvas/editorLayers';
import { activateEvidenceLayer, isEvidenceLayerActive } from '../canvas/evidenceLayers';
import type { ResultTab } from '../../store/WorkspaceUIContext';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

/**
 * El defecto que esta prueba guarda: elegir «Cortante» en el Centro analítico
 * movía `resultTab` y nada más. La capa `results` del lienzo nace apagada, así
 * que el dibujo NO cambiaba y sólo las fichas del riel del lienzo encendían el
 * diagrama: la elección se veía en el panel y no en el modelo.
 */
describe('elegir una magnitud en Resultados enciende esa capa en el lienzo', () => {
  it('publica la intención de evidencia para N, V, M y la deformada', () => {
    const received: string[] = [];
    const stop = onWorkspaceCommand('activate-evidence-layer', ({ layer }) => received.push(layer));
    const { container } = render(<ProjectProvider><div className="app-shell"><ResultsPanel status="active" defaultDesktopExpanded /></div></ProjectProvider>);

    for (const tab of ['axial', 'shear', 'moment', 'deformed'] as const) {
      act(() => { container.querySelector<HTMLButtonElement>(`[data-result-tab="${tab}"]`)!.click(); });
    }
    stop();

    expect(received).toEqual(['axial', 'shear', 'moment', 'deformed']);
  });

  it('el resumen no enciende ninguna capa: no es una lectura del dibujo', () => {
    const received: string[] = [];
    const stop = onWorkspaceCommand('activate-evidence-layer', ({ layer }) => received.push(layer));
    const { container } = render(<ProjectProvider><div className="app-shell"><ResultsPanel status="active" defaultDesktopExpanded /></div></ProjectProvider>);

    act(() => { container.querySelector<HTMLButtonElement>('[data-result-tab="summary"]')!.click(); });
    stop();

    expect(received).toEqual([]);
  });

  /** El shell aplica la intención sobre los mismos dos mandos que el riel. */
  it('aplicarla deja la capa encendida aunque el lienzo abriera con resultados apagados', () => {
    let layers: EditorLayerState = createEditorLayerState();
    let resultTab: ResultTab = 'summary';
    expect(layers.results).toBe(false);

    activateEvidenceLayer('shear', {
      setResultTab: (tab) => { resultTab = tab; },
      dispatchLayers: vi.fn((action) => { layers = editorLayerReducer(layers, action); }),
    });

    expect(resultTab).toBe('shear');
    expect(isEvidenceLayerActive('shear', resultTab, layers)).toBe(true);
  });
});
