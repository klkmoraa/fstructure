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

const renderChrome = (onFit = () => undefined) => render(<ProjectProvider><CanvasChrome
  modeLabel="Seleccionar"
  placementInstruction={null}
  showHelp={false}
  layers={{ model: true, loads: true, dimensions: false, ids: false, results: false, labels: true, help: false, diagnostics: true, heatmap: false }}
  dispatchLayers={() => undefined}
  resultTab="moment"
  setResultTab={() => undefined}
  analysisAvailable={false}
  snapEnabled
  gridEnabled
  coordinateReadoutRef={{ current: null }}
  lengthLabel="m"
  scale={85}
  onCancelPlacement={() => undefined}
  onZoomIn={() => undefined}
  onZoomOut={() => undefined}
  onFit={onFit}
/></ProjectProvider>);

describe('CanvasChrome', () => {
  it('mantiene el modo actual y el estado de cámara como chrome visible', () => {
    const { container } = renderChrome();

    expect(container.querySelector('.canvas-mode-badge strong')).toBeTruthy();
    expect(container.querySelector('.canvas-mode-badge')?.classList.contains('has-context')).toBe(false);
    expect(container.querySelector('[data-canvas-chrome="coordinates"]')).toBeTruthy();
  });

  it('no entrega el evento del botón como reserva al ajuste de cámara', async () => {
    const user = userEvent.setup();
    const onFit = vi.fn();
    renderChrome(onFit);

    await user.click(screen.getByRole('button', { name: 'Ajustar modelo a la vista' }));

    expect(onFit).toHaveBeenCalledWith();
  });
});
