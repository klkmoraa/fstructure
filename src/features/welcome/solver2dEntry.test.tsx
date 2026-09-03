// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectRepository } from '../../storage/projectRepository';

/**
 * Cuántas acciones separan la portada de un lienzo utilizable.
 *
 * La auditoría lo midió así: «Abrir Solver 2D» llevaba SIEMPRE a la bienvenida
 * del módulo y exigía un segundo clic en «Continuar», también a quien ya tenía
 * proyectos guardados y sólo quería seguir donde lo dejó. La decisión correcta
 * ya estaba escrita —`welcomeEntry.ts`, con `readWelcomeEntry` y
 * `shouldResumeDirectly`— y no la usaba nadie: el módulo entero estaba sin
 * cablear, que es la clase de fallo que ninguna prueba veía porque no había
 * ninguna que lo llamara.
 *
 * Estas dos pruebas son las dos ramas de esa decisión, y sólo eso: no fijan qué
 * pantalla es «mejor», fijan que la respuesta dependa del inventario real.
 */

const repositorio = (projects: number, recoveries: number): ProjectRepository => ({
  listProjects: async () => Array.from({ length: projects }, (_, index) => ({ id: `p${index}` })),
  listRecoveries: async () => Array.from({ length: recoveries }, (_, index) => ({ id: `r${index}` })),
} as unknown as ProjectRepository);

let inventario = repositorio(0, 0);

vi.mock('../../storage/projectRepository', () => ({
  getProjectRepository: () => inventario,
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  // `readWelcomeEntry` no pregunta al repositorio si el entorno no tiene
  // IndexedDB —y jsdom no lo tiene—, así que sin esto la lectura devolvería
  // siempre «usuario nuevo» y la prueba de la rama de vuelta no probaría nada.
  Object.defineProperty(globalThis, 'indexedDB', { value: {}, configurable: true, writable: true });
});

afterEach(() => {
  cleanup();
  vi.resetModules();
});

const abrirSolver2D = async () => {
  const { default: App } = await import('../../App');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByTestId('platform-landing');
  const cta = screen.getByRole('button', { name: 'Abrir Solver 2D' });
  // La lectura del inventario es asíncrona: pulsar antes de que resuelva
  // mediría la decisión con datos que todavía no han llegado.
  await waitFor(() => expect(cta).toBeTruthy());
  await user.click(cta);
};

describe('una sola acción desde la portada hasta el lienzo', () => {
  it('quien vuelve con trabajo guardado entra directo al proyecto', async () => {
    inventario = repositorio(2, 0);
    await abrirSolver2D();

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('surface')).toBe('workspace2d');
    });
    expect(screen.queryByTestId('solver2d-welcome')).toBeNull();
  });

  it('quien no tiene nada guardado entra a la bienvenida, donde crear y elegir son el mismo paso', async () => {
    inventario = repositorio(0, 0);
    await abrirSolver2D();

    expect(await screen.findByTestId('solver2d-welcome')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Por dónde empezar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy();
  });

  /**
   * Una copia de recuperación pendiente es un mecanismo de seguridad de datos:
   * vive en la bienvenida, así que saltársela dejaría el trabajo protegido
   * fuera de la vista. Tener proyectos guardados no basta para entrar directo.
   */
  it('con una copia de recuperación pendiente, la bienvenida se ve aunque haya proyectos', async () => {
    inventario = repositorio(3, 1);
    await abrirSolver2D();

    expect(await screen.findByTestId('solver2d-welcome')).toBeTruthy();
  });
});
