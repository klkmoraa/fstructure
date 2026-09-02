// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../App';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(cleanup);

describe('navegación por herramienta', () => {
  it('separa la landing general de las bienvenidas 2D y 3D', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByTestId('platform-landing')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Navegación de FStructure' })).toBeNull();
    expect(screen.queryByText('Proyectos recientes')).toBeNull();

    expect(screen.getByRole('link', { name: 'Explorar herramientas' }).getAttribute('href')).toBe('#fusion-tools');
    await user.click(screen.getByRole('button', { name: 'Abrir Solver 2D' }));

    expect(screen.getByTestId('solver2d-welcome')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Navegación de FStructure' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'FStructure' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Por dónde empezar' })).toBeTruthy();
    expect(screen.queryByRole('application', { name: 'Área de trabajo estructural interactiva' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Volver a la plataforma' }));
    await user.click(screen.getByRole('button', { name: 'Abrir Solver 3D' }));

    expect(screen.getByTestId('solver3d-welcome')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Navegación de FStructure' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir Space 3D' })).toBeTruthy();
  });

  it('restaura la bienvenida indicada por la URL sin forzar el canvas 2D', async () => {
    window.history.replaceState(null, '', '/?surface=solver2d');
    render(<App />);

    expect(await screen.findByTestId('solver2d-welcome')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy();
    expect(screen.queryByRole('application', { name: 'Área de trabajo estructural interactiva' })).toBeNull();
  });

  it('separa herramientas disponibles de módulos futuros', async () => {
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Abrir Solver 2D' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir Solver 3D' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir Aula estructural' })).toBeTruthy();

    const planned = screen.getAllByRole('button', { name: /En preparación$/ });
    expect(planned).toHaveLength(4);
    planned.forEach((button) => expect((button as HTMLButtonElement).disabled).toBe(true));
  });
});
