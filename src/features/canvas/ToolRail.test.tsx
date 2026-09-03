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
import { isPrimaryRailTool, PRIMARY_RAIL_TOOLS } from './toolRegistry';

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

  /**
   * Las seis que el riel nombra son las que la propuesta fija, ni una más.
   *
   * La conducta —que se vean sin hover y que el riel no se salga— la mide
   * `npm run ui:layout` en un navegador, porque es geometría. Lo que esta
   * prueba sostiene desde CI es la LISTA: cambiarla en silencio cambiaría qué
   * herramientas son legibles sin apuntar, que es el criterio de aceptación.
   */
  it('nombra exactamente las seis herramientas principales del plan', () => {
    expect([...PRIMARY_RAIL_TOOLS]).toEqual(['select', 'node', 'member', 'support', 'pointLoad', 'dimension']);
    expect(PRIMARY_RAIL_TOOLS.every(isPrimaryRailTool)).toBe(true);
    // Las secundarias siguen siendo secundarias: si una se colara, el riel
    // pediría más ancho del que su presupuesto tiene medido.
    expect(isPrimaryRailTool('pan')).toBe(false);
    expect(isPrimaryRailTool('delete')).toBe(false);
  });
});
