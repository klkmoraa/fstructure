// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import { Space3DGenerativeModal } from './Space3DGenerativeModal';

afterEach(cleanup);

it('renders generative modal with archetype controls and emits generated project on apply', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  const onClose = vi.fn();

  render(
    <Space3DGenerativeModal
      open={true}
      onClose={onClose}
      onApply={onApply}
      t={(key, vars) => translate('es', key, vars)}
    />,
  );

  // Checks title and archetype controls
  expect(screen.getByText(/generador de estructuras 3d/i)).toBeDefined();
  expect(screen.getByText('Pórtico 3D')).toBeDefined();
  expect(screen.getByText('Celosía 3D')).toBeDefined();
  expect(screen.getByText('Torre 3D')).toBeDefined();
  expect(screen.getByText('Cúpula 3D')).toBeDefined();
  expect(screen.getByText('Puente 3D')).toBeDefined();
  expect(screen.getByText('Nave Ind.')).toBeDefined();

  // Switch to Bridge
  const bridgeTab = screen.getByRole('button', { name: /puente 3d/i });
  await user.click(bridgeTab);
  expect(bridgeTab.getAttribute('aria-pressed')).toBe('true');

  // Click apply button
  const applyButton = screen.getByRole('button', { name: /generar estructura/i });
  await user.click(applyButton);

  expect(onApply).toHaveBeenCalledTimes(1);
  const generatedProject = onApply.mock.calls[0][0];
  expect(generatedProject.analysisSpace).toBe('space-3d');
  expect(generatedProject.name).toContain('Puente');
  expect(generatedProject.nodes.length).toBeGreaterThan(0);
  expect(generatedProject.members.length).toBeGreaterThan(0);
});

it('interprets natural language prompt and switches archetype', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  const onClose = vi.fn();

  render(
    <Space3DGenerativeModal
      open={true}
      onClose={onClose}
      onApply={onApply}
      t={(key, vars) => translate('es', key, vars)}
    />,
  );

  // Click on the Tower suggestion chip
  const towerChip = screen.getByRole('button', { name: /torre antena 18m/i });
  await user.click(towerChip);

  // The tower control should be active
  await waitFor(() => {
    const towerTab = screen.getByRole('button', { name: /torre 3d/i });
    expect(towerTab.getAttribute('aria-pressed')).toBe('true');
  });
});
