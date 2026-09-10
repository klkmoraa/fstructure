// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InspectorNumericField } from './InspectorNumericField';

afterEach(() => cleanup());

describe('InspectorNumericField', () => {
  it('permite invertir el signo de una carga sin abandonar el teclado decimal móvil', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <InspectorNumericField
        label="Carga vertical"
        value={12}
        unit="kN"
        resetKey="nodal-load-fy"
        signed
        onCommit={onCommit}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Carga vertical' }) as HTMLInputElement;
    await user.click(screen.getByRole('button', { name: 'Cambiar signo' }));
    expect(input.value).toBe('-12');
    expect(onCommit).toHaveBeenCalledWith(-12);
  });
});
