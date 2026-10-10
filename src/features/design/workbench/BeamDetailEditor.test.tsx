// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_BEAM_DETAILS } from './beamDetailDraft';
import { BeamDetailEditor } from './BeamDetailEditor';
import { DEFAULT_SPANS } from './beamModel';

afterEach(cleanup);

describe('BeamDetailEditor', () => {
  it('preserves incomplete raw rows and exposes precise keyboard-editable regions', async () => {
    const user = userEvent.setup();
    const activated = vi.fn();
    function Harness() {
      const [details, setDetails] = useState(EMPTY_BEAM_DETAILS);
      const onChange = (next: typeof EMPTY_BEAM_DETAILS, activateOwn?: 'bastion' | 'zone') => { setDetails(next); if (activateOwn) activated(activateOwn); return true; };
      return <BeamDetailEditor details={details} spans={DEFAULT_SPANS.slice(0, 1)} onChange={onChange} />;
    }
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Agregar carga' }));
    expect((screen.getByRole('textbox', { name: 'Inicio (m)' }) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('list', { name: 'Errores de regiones' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Agregar bastón' }));
    expect(activated).toHaveBeenCalledWith('bastion');
    const start = screen.getAllByRole('textbox', { name: 'Inicio x (m)' })[0]!;
    const end = screen.getAllByRole('textbox', { name: 'Fin x (m)' })[0]!;
    await user.type(start, '1');
    await user.type(end, '2');
    expect(screen.getByRole('button', { name: 'Bastón superior de 1 a 2 m' })).toBeTruthy();
    expect(screen.getByText(/Origen en el extremo izquierdo/)).toBeTruthy();
  });
});
