// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import { Space3DRibbon } from './Space3DRibbon';

afterEach(cleanup);

const props = (overrides: Partial<Parameters<typeof Space3DRibbon>[0]> = {}): Parameters<typeof Space3DRibbon>[0] => ({
  t: (key, vars) => translate('es', key, vars),
  file: { onNewBuilding: vi.fn(), onGenerator: vi.fn(), onLoadExample: vi.fn(), onResetBlank: vi.fn(), onImport: vi.fn(), onExport: vi.fn() },
  onDefine: vi.fn(), selectedMembers: 0, selectedNodes: 0, onAssign: vi.fn(),
  resultsReady: false, animate: false, onAnimate: vi.fn(), extruded: false, onExtruded: vi.fn(), labels: true, onLabels: vi.fn(),
  split: false, onSplit: vi.fn(), explorer: true, onExplorer: vi.fn(),
  ...overrides,
});

it('starts folded, opens one menu at a time and folds again with Escape', async () => {
  const user = userEvent.setup();
  const onDefine = vi.fn();
  render(<Space3DRibbon {...props({ onDefine })} />);
  expect(screen.queryByRole('button', { name: 'Rejilla' })).toBeNull();

  const define = screen.getByRole('button', { name: 'Definir' });
  await user.click(define);
  expect(define.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('button', { name: 'Rejilla' })).toBeTruthy();

  // Las flechas pasan al menú vecino sin cerrarlo.
  await user.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Asignar' }));
  expect(screen.getByRole('button', { name: 'Asignar' }).getAttribute('aria-expanded')).toBe('true');

  await user.keyboard('{Escape}');
  expect(screen.queryByRole('group')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Asignar' }));

  // Un comando que abre un diálogo pliega el menú.
  await user.click(define);
  await user.click(screen.getByRole('button', { name: 'Rejilla' }));
  expect(onDefine).toHaveBeenCalledWith('grid');
  expect(screen.queryByRole('button', { name: 'Rejilla' })).toBeNull();
});

it('announces the selection on the Assign tab and enables what the selection allows', async () => {
  const user = userEvent.setup();
  const onAssign = vi.fn();
  render(<Space3DRibbon {...props({ selectedMembers: 3, onAssign })} />);
  const assign = screen.getByRole('button', { name: /Asignar/ });
  expect(assign.textContent).toContain('3');
  await user.click(assign);
  expect(screen.getByRole('button', { name: 'Apoyo' })).toHaveProperty('disabled', true);
  await user.click(screen.getByRole('button', { name: 'Carga barra' }));
  expect(onAssign).toHaveBeenCalledWith('member-load');
});
