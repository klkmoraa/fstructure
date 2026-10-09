// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { designStrapFooting } from '../../../design/elements/strapFooting';
import { designStripFooting } from '../../../design/elements/stripFooting';
import { StripFootingSection } from './FootingTypeDrawings';
import { FOOTING_DEFAULTS, strapReinforcementRows, strapToInput, stripToInput } from './footingModel';

afterEach(cleanup);

it('etiqueta como #2 el refuerzo transversal del corte de zapata corrida', () => {
  const result = designStripFooting(stripToInput('ntc-2023', { ...FOOTING_DEFAULTS, type: 'strip', bar: '6.4' }));
  if (!result.ok) throw new Error(result.errors.join('; '));

  render(<StripFootingSection result={result} />);

  expect(screen.getByText(/#2 @ .* · .* #3 long\./)).toBeTruthy();
});

it('etiqueta como #2 el refuerzo transversal de la zapata 1 en memoria de lindero', () => {
  const draft = { ...FOOTING_DEFAULTS, type: 'strap', bar: '6.4' };
  const result = designStrapFooting(strapToInput('ntc-2023', draft));
  if (!result.ok) throw new Error(result.errors.join('; '));

  const transverse = strapReinforcementRows(result).find((row) => row.label.startsWith('Zapata 1'))!;
  expect(transverse.label).toMatch(/^Zapata 1 #2 @/);
  expect(transverse.value).toMatch(/Transversal a la contratrabe · .* Ø6\.4 a lo largo/);
});
