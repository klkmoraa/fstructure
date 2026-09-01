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
    expect(screen.queryByRole('navigation', { name: 'Navegación del Solver 2D' })).toBeNull();
    expect(screen.queryByText('Proyectos recientes')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Entrar al workspace' }));

    expect(screen.getByTestId('solver2d-welcome')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Navegación del Solver 2D' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar proyecto' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Accesos rápidos' })).toBeTruthy();
    expect(screen.queryByRole('application', { name: 'Área de trabajo estructural interactiva' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Volver a la plataforma' }));
    await user.click(screen.getByRole('tab', { name: 'Modelo' }));
    await user.click(screen.getByRole('button', { name: 'Explorar espacio 3D' }));

    expect(screen.getByTestId('solver3d-welcome')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Navegación del Solver 2D' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir Space 3D' })).toBeTruthy();
  });

  it('restaura la bienvenida indicada por la URL sin forzar el canvas 2D', async () => {
    window.history.replaceState(null, '', '/?surface=solver2d');
    render(<App />);

    expect(await screen.findByTestId('solver2d-welcome')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar proyecto' })).toBeTruthy();
    expect(screen.queryByRole('application', { name: 'Área de trabajo estructural interactiva' })).toBeNull();
  });

  it('recorre las familias de plataforma con el teclado', async () => {
    const user = userEvent.setup();
    render(<App />);

    const analysis = await screen.findByRole('tab', { name: 'Análisis' });
    const model = screen.getByRole('tab', { name: 'Modelo' });
    analysis.focus();
    await user.keyboard('{ArrowRight}');

    expect(model.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(model);

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Aprendizaje' }).getAttribute('aria-selected')).toBe('true');
  });
});
