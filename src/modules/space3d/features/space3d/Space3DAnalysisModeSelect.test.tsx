// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import { Space3DAnalysisModeSelect } from './Space3DAnalysisModeSelect';

afterEach(cleanup);

it('exposes all supported 3D study modes in the existing contextual control', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Space3DAnalysisModeSelect value="linear" onChange={onChange} t={(key) => translate('es', key)} />);

  const select = screen.getByRole('combobox', { name: 'Modo de análisis 3D' });
  expect([...select.querySelectorAll('option')].map((option) => option.value)).toEqual([
    'linear', 'pdelta', 'modal', 'buckling', 'influence',
  ]);
  await user.selectOptions(select, 'buckling');
  expect(onChange).toHaveBeenCalledWith('buckling');
});
