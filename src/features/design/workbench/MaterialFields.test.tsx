// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BEAM_DEFAULTS, DEFAULT_SPANS, beamToInput } from './beamModel';
import { MaterialFields } from './MaterialFields';
import { BarSelect, NumberField } from './common';

afterEach(cleanup);

describe('MaterialFields', () => {
  it('aplica un valor sugerido al campo numérico editable y conserva su conversión al motor', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [draft, setDraft] = useState({ ...BEAM_DEFAULTS });
      const update = (field: 'fc' | 'fy' | 'fyv') => (value: string) => setDraft((current) => ({ ...current, [field]: value }));
      return <><MaterialFields fc={draft.fc} onFcChange={update('fc')} fy={draft.fy} onFyChange={update('fy')} fyv={draft.fyv} onFyvChange={update('fyv')} /><output>{beamToInput('ntc-2023', draft, DEFAULT_SPANS).fcMpa}</output></>;
    }
    render(<Harness />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'f′c sugerido' }), '300');
    expect((screen.getByRole('textbox', { name: 'f′c' }) as HTMLInputElement).value).toBe('300');
    expect(Number(screen.getByText(/^[0-9.]+$/).textContent)).toBeCloseTo(300 * 0.0980665, 5);
    await user.selectOptions(screen.getByRole('combobox', { name: 'fy estribos sugerido' }), '5000');
    expect((screen.getByRole('textbox', { name: 'fy estribos' }) as HTMLInputElement).value).toBe('5000');
  });

  it('ofrece #2 sólo a los selectores transversales', () => {
    render(<><BarSelect label="Varilla" value="12.7" onChange={() => {}} /><BarSelect label="Estribo" value="6.4" onChange={() => {}} usage="transverse" /></>);
    const longitudinal = screen.getByRole('combobox', { name: 'Varilla' }) as HTMLSelectElement;
    const transverse = screen.getByRole('combobox', { name: 'Estribo' }) as HTMLSelectElement;
    expect([...longitudinal.options].some((option) => option.textContent?.startsWith('#2 ·'))).toBe(false);
    expect([...transverse.options].some((option) => option.textContent?.startsWith('#2 ·'))).toBe(true);
  });

  it('mantiene visible el valor crudo heredado fuera del filtro del catálogo', async () => {
    const user = userEvent.setup();
    function Harness({ initial }: { initial: string }) {
      const [value, setValue] = useState(initial);
      return <BarSelect label="Diámetro arriba" value={value} onChange={setValue} minimumDiameterMm={12.7} />;
    }
    const { rerender } = render(<Harness initial="7.9" />);
    const select = screen.getByRole('combobox', { name: 'Diámetro arriba' }) as HTMLSelectElement;
    expect(select.value).toBe('7.9');
    expect([...select.options].some((option) => option.value === '7.9' && /guardado/.test(option.textContent ?? ''))).toBe(true);
    expect([...select.options].some((option) => option.value === '12.7')).toBe(true);
    await user.selectOptions(select, '12.7');
    expect(select.value).toBe('12.7');

    rerender(<Harness key="incomplete" initial="incompleto" />);
    const incomplete = screen.getByRole('combobox', { name: 'Diámetro arriba' }) as HTMLSelectElement;
    expect(incomplete.value).toBe('incompleto');
    expect([...incomplete.options].some((option) => option.value === 'incompleto' && /guardado/.test(option.textContent ?? ''))).toBe(true);
  });

  it('aplica el rango visible de los grupos de refuerzo propios', () => {
    render(<><NumberField label="Barras por esquina" value="1" unit="pzas" min={1} max={3} onChange={() => {}} /></>);
    expect((screen.getByRole('textbox', { name: 'Barras por esquina' }) as HTMLInputElement).max).toBe('3');
  });
});
