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
  onDefine: vi.fn(), tool: 'select', onTool: vi.fn(), hasNodes: true, selectedMembers: 0, selectedNodes: 0, onAssign: vi.fn(),
  resultsReady: false, animate: false, onAnimate: vi.fn(), extruded: false, onExtruded: vi.fn(), labels: true, onLabels: vi.fn(),
  split: false, onSplit: vi.fn(), explorer: true, onExplorer: vi.fn(),
  ...overrides,
});

it('shows one tab of commands at a time and moves between tabs with the arrow keys', async () => {
  const user = userEvent.setup();
  render(<Space3DRibbon {...props()} />);
  expect(screen.getByRole('tab', { name: 'Dibujar' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('button', { name: 'Nuevo nudo' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Rejilla' })).toBeNull();

  screen.getByRole('tab', { name: 'Dibujar' }).focus();
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('tab', { name: 'Definir' }).getAttribute('aria-selected')).toBe('true');
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Definir' }));
  expect(screen.getByRole('button', { name: 'Rejilla' })).toBeTruthy();
});

it('announces the selection on the Assign tab and enables what the selection allows', async () => {
  const user = userEvent.setup();
  const onAssign = vi.fn();
  render(<Space3DRibbon {...props({ selectedMembers: 3, onAssign })} />);
  const assign = screen.getByRole('tab', { name: /Asignar/ });
  expect(assign.textContent).toContain('3');
  await user.click(assign);
  await user.click(screen.getByRole('button', { name: 'Carga barra' }));
  expect(onAssign).toHaveBeenCalledWith('member-load');
  expect(screen.getByRole('button', { name: 'Apoyo' })).toHaveProperty('disabled', true);
});
