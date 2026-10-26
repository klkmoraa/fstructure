// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CandidatePicker } from './CanvasCandidatePicker';
import { activeCandidate, createCandidatePickerState, cycleCandidatePicker } from './candidatePicker';

const Harness = () => {
  const [state, setState] = useState(createCandidatePickerState([
    { kind: 'node', id: 'N1' }, { kind: 'member', id: 'M1' }, { kind: 'member', id: 'M2' },
  ], { kind: 'node', id: 'N1' }, { x: 16, y: 20 })!);
  const [selection, setSelection] = useState('N1');
  const [open, setOpen] = useState(true);
  return <>
    <output aria-label="selection">{selection}</output>
    {open ? <CandidatePicker
      state={state}
      presentation="sheet"
      onCycle={(direction) => setState((current) => cycleCandidatePicker(current, direction))}
      onSetActive={(activeIndex) => setState((current) => ({ ...current, activeIndex }))}
      onConfirm={() => { setSelection(activeCandidate(state).id); setOpen(false); }}
      onCancel={() => setOpen(false)}
    /> : null}
  </>;
};

afterEach(cleanup);

describe('selector de objetos superpuestos', () => {
  it('Tab lleva de la lista a las acciones sin recorrer cada candidato', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(document.activeElement).toBe(screen.getByRole('listbox'));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Seleccionar' }));
  });

  it('Escape desde las acciones cierra conservando la selección original', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('option', { name: 'Miembro M2' }));
    screen.getByRole('button', { name: 'Seleccionar' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByLabelText('selection').textContent).toBe('N1');
  });

  it('End previsualiza el último candidato y Enter confirma esa identidad', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard('{End}');
    expect(screen.getByRole('option', { name: 'Miembro M2' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('selection').textContent).toBe('N1');
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('selection').textContent).toBe('M2');
  });
});
