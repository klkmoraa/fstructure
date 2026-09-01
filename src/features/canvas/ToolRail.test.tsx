// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useContext } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { SurfacePresentationContext } from '../workspace/SurfacePresentationContext';
import { SurfacePresentationProvider } from '../workspace/SurfacePresentationProvider';
import { ShellCompositionContext } from '../workspace/useShellComposition';
import { ToolRail } from './ToolRail';

const GeneratorStateHarness = () => {
  const { activeTool, setActiveTool } = useProject();
  const surfacePresentation = useContext(SurfacePresentationContext);
  const generatorOpen = surfacePresentation?.stateFor('generator').open ?? false;

  return <>
    <button type="button" data-testid="activate-node" onClick={() => setActiveTool('node')}>activar Nodo</button>
    <button type="button" data-testid="open-generator" onClick={() => surfacePresentation?.openSurface('generator')}>abrir generador</button>
    <button type="button" data-testid="close-generator" onClick={() => surfacePresentation?.closeSurface('generator')}>cerrar generador</button>
    <output data-testid="generator-state">{generatorOpen ? 'open' : 'closed'}</output>
    <output aria-label="herramienta activa">{activeTool}</output>
  </>;
};

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ToolRail surface handoff', () => {
  it('returns to Seleccionar when the structure generator closes', async () => {
    const user = userEvent.setup();
    const backgroundRef = createRef<HTMLDivElement>();

    render(
      <ShellCompositionContext.Provider value={{ shellClass: 'X2', phone: false }}>
        <ProjectProvider>
          <SurfacePresentationProvider shellClass="X2" backgroundRef={backgroundRef}>
            <div ref={backgroundRef}>
              <ToolRail />
              <GeneratorStateHarness />
            </div>
          </SurfacePresentationProvider>
        </ProjectProvider>
      </ShellCompositionContext.Provider>,
    );

    await user.click(screen.getByTestId('activate-node'));
    expect(screen.getByLabelText('herramienta activa').textContent).toBe('node');

    await user.click(screen.getByTestId('open-generator'));
    await waitFor(() => expect(screen.getByTestId('generator-state').textContent).toBe('open'));
    await user.click(screen.getByTestId('close-generator'));

    await waitFor(() => expect(screen.getByLabelText('herramienta activa').textContent).toBe('select'));
  });
});
