// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import { Space3DGenerativeModal } from './Space3DGenerativeModal';

afterEach(cleanup);

const interpret = async (prompt: string) => {
  const user = userEvent.setup();
  render(<Space3DGenerativeModal open onClose={vi.fn()} onApply={vi.fn()} t={(key, vars) => translate('es', key, vars)} />);
  const input = screen.getByLabelText('Descripción de la estructura a generar');
  await user.clear(input);
  await user.type(input, `${prompt}{Enter}`);
};
const field = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);

describe('Space3DGenerativeModal · enrutado de lo leído a los controles', () => {
  // La altura leída es la del edificio, como en los demás arquetipos y como la
  // muestra el resumen. Aplicarla a la altura de planta construía 27 m.
  it('splits a frame total height across its storeys', async () => {
    await interpret('Edificio de 3 pisos y 9 m de altura');
    expect(field('gen-frame-sy')).toBe(3);
    expect(field('gen-frame-hy')).toBe(3);
  });

  // `luz` es la total; los vanos se reparten. Por vano ("2 vanos de 5 m") no se toca.
  it('splits a frame total span across its bays but keeps an explicit bay size', async () => {
    await interpret('pórtico de 2 vanos con luz de 10 m');
    expect(field('gen-frame-bx')).toBe(2);
    expect(field('gen-frame-wx')).toBe(5);
    cleanup();

    await interpret('Edificio 3 pisos 2 vanos de 5m');
    expect(field('gen-frame-wx')).toBe(5);
  });

  // "tramos" de una torre son sus niveles: el resumen los anunciaba y se perdían.
  it('routes the parsed tier count to the tower', async () => {
    await interpret('Torre de 18 m con 6 tramos');
    expect(field('gen-tower-h')).toBe(18);
    expect(field('gen-tower-tiers')).toBe(6);
  });
});
