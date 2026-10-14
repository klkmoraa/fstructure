// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { CalcPage } from './CalcPage';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '?surface=calc&topic=flexure-rect');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderCalc = () => render(<ProjectProvider><CalcPage onOpenHome={vi.fn()} /></ProjectProvider>);

describe('Cálculo', () => {
  it('resuelve el ejemplo y cambia de incógnita sin tocar el proyecto', async () => {
    const user = userEvent.setup();
    renderCalc();
    expect(screen.getByRole('heading', { name: 'Sección rectangular' })).toBeTruthy();
    // El primer ejemplo viene cargado: 3 #8 en 30 × 60 con d = 55 cm → MR = 28.73 t·m.
    expect(screen.getAllByText('28.73 t·m').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('radio', { name: /Acero de tensión/ }));
    expect(new URL(window.location.href).searchParams.get('find')).toBe('rect-design');
    expect(screen.getByRole('heading', { name: /Acero requerido/ })).toBeTruthy();
  });

  it('pide los datos que faltan y guarda el borrador en el navegador', async () => {
    const user = userEvent.setup();
    renderCalc();
    await user.click(screen.getByRole('button', { name: /Datos en blanco/ }));
    expect(screen.getByText(/Faltan 7 datos/)).toBeTruthy();
    const width = screen.getByLabelText(/Ancho/);
    await user.type(width, '30');
    expect(screen.getByText(/Faltan 6 datos/)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('fstructure.calc.v1')!);
    expect(saved.drafts['rect-check'].b).toBe(300);
  });

  it('cambia a SI sin cambiar el resultado interno', async () => {
    const user = userEvent.setup();
    renderCalc();
    await user.click(within(screen.getByRole('group', { name: 'Unidades' })).getByRole('button', { name: 'SI' }));
    expect(screen.getAllByText('281.7 kN·m').length).toBeGreaterThan(0);
  });

  it('conserva un guardado de otra versión sin sobrescribirlo', async () => {
    localStorage.setItem('fstructure.calc.v1', JSON.stringify({ version: 9, future: true }));
    const user = userEvent.setup();
    renderCalc();
    await user.click(within(screen.getByRole('group', { name: 'Unidades' })).getByRole('button', { name: 'SI' }));
    expect(JSON.parse(localStorage.getItem('fstructure.calc.v1')!)).toEqual({ version: 9, future: true });
    expect(screen.getByRole('status').textContent).toMatch(/no se guardan/);
  });
});
