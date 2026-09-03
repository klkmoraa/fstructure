// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { CanvasChrome } from './CanvasChrome';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

const renderChrome = (
  onFit = () => undefined,
  overrides: { analysisAvailable?: boolean; dispatchLayers?: () => void } = {},
) => render(<ProjectProvider><CanvasChrome
  modeLabel="Seleccionar"
  placementInstruction={null}
  showHelp={false}
  layers={{ model: true, loads: true, dimensions: false, ids: false, results: false, labels: true, help: false, diagnostics: true, heatmap: false }}
  dispatchLayers={overrides.dispatchLayers ?? (() => undefined)}
  resultTab="moment"
  setResultTab={() => undefined}
  analysisAvailable={overrides.analysisAvailable ?? false}
  snapEnabled
  gridEnabled
  coordinateReadoutRef={{ current: null }}
  lengthLabel="m"
  scale={85}
  onCancelPlacement={() => undefined}
  onZoomIn={() => undefined}
  onZoomOut={() => undefined}
  onFit={onFit}
  coordinateEntryOpen={false}
  onToggleCoordinateEntry={() => undefined}
/></ProjectProvider>);

describe('CanvasChrome', () => {
  it('mantiene el modo actual y el estado de cámara como chrome visible', () => {
    const { container } = renderChrome();

    expect(container.querySelector('.canvas-mode-badge strong')).toBeTruthy();
    expect(container.querySelector('.canvas-mode-badge')?.classList.contains('has-context')).toBe(false);
    expect(container.querySelector('[data-canvas-chrome="coordinates"]')).toBeTruthy();
  });

  it('publica la fluencia como una evidencia más del riel', async () => {
    // El mapa de demanda —la única lectura que dice si una barra alcanza su Fy—
    // estaba excluido del riel a mano y sólo se encendía desde el menú de capas.
    const user = userEvent.setup();
    const dispatchLayers = vi.fn();
    renderChrome(() => undefined, { analysisAvailable: true, dispatchLayers });

    const chip = screen.getByRole('button', { name: 'Mapa de demanda' });
    expect(chip.textContent).toBe('Fluencia');
    expect(chip.getAttribute('data-evidence-layer')).toBe('heatmap');

    await user.click(chip);

    expect(dispatchLayers).toHaveBeenCalledWith({ type: 'toggle', layer: 'heatmap' });
  });

  it('no entrega el evento del botón como reserva al ajuste de cámara', async () => {
    const user = userEvent.setup();
    const onFit = vi.fn();
    renderChrome(onFit);

    await user.click(screen.getByRole('button', { name: 'Ajustar modelo a la vista' }));

    expect(onFit).toHaveBeenCalledWith();
  });
});
