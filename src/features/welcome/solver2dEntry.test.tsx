// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import type { ProjectModel } from '../../types';
import type { ProjectRepository } from '../../storage/projectRepository';

/**
 * Cuántas acciones separan la portada de un lienzo utilizable, y a cuál.
 *
 * La auditoría lo midió así: «Abrir Solver 2D» llevaba SIEMPRE a la bienvenida
 * del módulo y exigía un segundo clic en «Continuar», también a quien ya tenía
 * proyectos guardados y sólo quería seguir donde lo dejó. La decisión correcta
 * ya estaba escrita —`welcomeEntry.ts`, con `readWelcomeEntry` y
 * `shouldResumeDirectly`— y no la usaba nadie: el módulo entero estaba sin
 * cablear, que es la clase de fallo que ninguna prueba veía porque no había
 * ninguna que lo llamara.
 *
 * Estas pruebas son las ramas de esa decisión, y sólo eso: no fijan qué
 * pantalla es «mejor», fijan que la respuesta dependa del inventario real y que
 * el atajo no lleve nunca a un lienzo que no es el que anuncia.
 */

/** Un repositorio de mentira que sólo sabe lo que la decisión le pregunta. */
const repositorio = (
  projectIds: readonly string[],
  recoveries: number,
  espera?: Promise<void>,
): ProjectRepository => ({
  listProjects: async () => {
    if (espera) await espera;
    return projectIds.map((id) => ({ id }));
  },
  listRecoveries: async () => Array.from({ length: recoveries }, (_, index) => ({ id: `r${index}` })),
} as unknown as ProjectRepository);

let inventario: ProjectRepository = repositorio([], 0);
let abierto: ProjectModel;

vi.mock('../../storage/projectRepository', () => ({
  getProjectRepository: () => inventario,
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  // El proyecto que `ProjectProvider` hidrata: se siembra para conocer su id,
  // que es la mitad de la pregunta que la decisión tiene que contestar.
  abierto = createDefaultProject();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(abierto));
  // `readWelcomeEntry` no pregunta al repositorio si el entorno no tiene
  // IndexedDB —y jsdom no lo tiene—, así que sin esto la lectura devolvería
  // siempre «usuario nuevo» y ninguna rama de vuelta se probaría.
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
  await user.click(screen.getByRole('button', { name: 'Abrir Solver 2D' }));
};

const enElLienzo = async () => {
  await waitFor(() => {
    expect(new URLSearchParams(window.location.search).get('surface')).toBe('workspace2d');
  });
  expect(screen.queryByTestId('solver2d-welcome')).toBeNull();
};

describe('una sola acción desde la portada hasta el lienzo', () => {
  it('quien vuelve con su proyecto guardado entra directo a él', async () => {
    inventario = repositorio([abierto.id, 'otro'], 0);
    await abrirSolver2D();
    await enElLienzo();
  });

  it('quien no tiene nada guardado entra a la bienvenida, donde crear y elegir son el mismo paso', async () => {
    inventario = repositorio([], 0);
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
    inventario = repositorio([abierto.id], 1);
    await abrirSolver2D();

    expect(await screen.findByTestId('solver2d-welcome')).toBeTruthy();
  });

  /**
   * El lienzo al que se entra lo hidrata `ProjectProvider` desde `localStorage`;
   * la biblioteca vive en IndexedDB. Son dos almacenes, y cuando el proyecto
   * abierto no es ninguno de los guardados, saltar la bienvenida abriría un
   * lienzo que no es el que el atajo promete —y sin enseñar antes su nombre,
   * porque la pantalla que lo enseñaba es la que se salta—.
   */
  it('no salta la bienvenida si el proyecto abierto no es ninguno de los guardados', async () => {
    inventario = repositorio(['guardado-a', 'guardado-b'], 0);
    await abrirSolver2D();

    expect(await screen.findByTestId('solver2d-welcome')).toBeTruthy();
  });

  /**
   * La portada se pinta antes de que termine la lectura del inventario, así que
   * un clic rápido la encuentra en `unknown`. Decidir ahí sería contestar
   * «usuario nuevo» a quien no se ha preguntado, y devolver a quien vuelve al
   * camino de dos clics que este cableado quita.
   */
  it('un clic anterior a la lectura del inventario espera la respuesta en vez de suponerla', async () => {
    let soltar = () => {};
    const lectura = new Promise<void>((resolve) => { soltar = resolve; });
    inventario = repositorio([abierto.id], 0, lectura);

    await abrirSolver2D();

    // Todavía sin respuesta: no puede haber decidido nada.
    expect(new URLSearchParams(window.location.search).get('surface')).not.toBe('solver2d');

    soltar();
    await enElLienzo();
  });
});
