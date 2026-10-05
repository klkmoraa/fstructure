// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { ResultsPanel } from './ResultsPanel';
import type { SurfaceStatus } from '../workspace/surfacePresentation';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

const montar = (status: SurfaceStatus) => {
  const { container } = render(<ProjectProvider><div className="app-shell"><ResultsPanel status={status} /></div></ProjectProvider>);
  return container.querySelector<HTMLElement>('.app-shell')!;
};

describe('banda que el panel de Resultados publica en el shell', () => {
  it('la publica mientras está activo', () => {
    expect(montar('active').style.getPropertyValue('--results-band')).toMatch(/px$/);
  });

  /**
   * La regresión que esto guarda: un panel no activo se monta con `hidden`, y
   * un elemento oculto mide 0 en todo, así que su techo cae en y=0 y la banda
   * salía igual a la VENTANA ENTERA. El riel flotante de herramientas se apoya
   * en ella, de modo que abrir Vista o Detalle con Resultados abierto —lo que
   * suspende Resultados— mandaba el riel por encima del área de trabajo y
   * dejaba al usuario sin herramientas de modelado. Medido antes del arreglo:
   * banda 900px y el riel en y=-72.
   */
  it('no publica nada cuando está suspendido o cerrado, por muy oculto que mida cero', () => {
    for (const status of ['suspended', 'closed'] as const) {
      expect(montar(status).style.getPropertyValue('--results-band'), status).toBe('');
      cleanup();
    }
  });

  it('la retira al desmontarse, para no dejar al riel apoyado en un fantasma', () => {
    const { container, unmount } = render(
      <ProjectProvider><div className="app-shell"><ResultsPanel status="active" /></div></ProjectProvider>,
    );
    const shell = container.querySelector<HTMLElement>('.app-shell')!;
    expect(shell.style.getPropertyValue('--results-band')).toMatch(/px$/);

    unmount();
    expect(shell.style.getPropertyValue('--results-band')).toBe('');
  });
});
