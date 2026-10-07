// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MesaModeSwitch } from './MesaModeSwitch';

afterEach(() => cleanup());

describe('MesaModeSwitch', () => {
  it('marca el modo actual y cambia sólo al elegir otro', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MesaModeSwitch mode="3d" onChange={onChange} language="es" />);
    expect(screen.getByRole('button', { name: 'Modelo 3D' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Modelo 2D' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Modelo 3D' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Diseño' }));
    expect(onChange).toHaveBeenCalledWith('design');
  });

  it('Alt+Mayús+1/2/3 cambia de modo, salvo escribiendo en un campo', () => {
    const onChange = vi.fn();
    render(<><input aria-label="campo" /><MesaModeSwitch mode="model" onChange={onChange} language="es" /></>);
    fireEvent.keyDown(window, { code: 'Digit3', altKey: true, shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith('design');
    fireEvent.keyDown(window, { code: 'Digit1', altKey: true, shiftKey: true });
    expect(onChange).toHaveBeenCalledTimes(1); // ya está en 2D: no repite
    onChange.mockClear();
    fireEvent.keyDown(screen.getByLabelText('campo'), { code: 'Digit2', altKey: true, shiftKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });
});
