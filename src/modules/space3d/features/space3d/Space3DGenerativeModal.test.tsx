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
  expect(screen.getByText(/cúpula reticular 3d/i)).toBeDefined();
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

it('keeps unsupported truss disabled and ignores unrecognized prompts', async () => {
  const user = userEvent.setup();
  render(
    <Space3DGenerativeModal
      open={true}
      onClose={vi.fn()}
      onApply={vi.fn()}
      t={(key, vars) => translate('es', key, vars)}
    />,
  );

  const truss = screen.getByRole('button', { name: /celosía 3d/i }) as HTMLButtonElement;
  expect(truss.disabled).toBe(true);

  const prompt = screen.getByPlaceholderText(/describe tu estructura/i);
  await user.type(prompt, 'algo de 5 metros');
  await user.keyboard('{Enter}');

  expect(screen.getByRole('status').textContent).toMatch(/no se reconoció/i);
  expect(screen.getByRole('button', { name: /pórtico 3d/i }).getAttribute('aria-pressed')).toBe('true');
});

it('applies parsed bay size to frame geometry', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();

  render(
    <Space3DGenerativeModal
      open={true}
      onClose={vi.fn()}
      onApply={onApply}
      t={(key, vars) => translate('es', key, vars)}
    />,
  );

  await user.click(screen.getByRole('button', { name: /pórtico 3 pisos/i }));
  await user.click(screen.getByRole('button', { name: /generar estructura/i }));

  const generated = onApply.mock.calls[0][0];
  const maxX = Math.max(...generated.nodes.map((node: { x: number }) => node.x));
  expect(maxX).toBe(10);
});

// Se abre para describir la estructura. Si el foco inicial iba a «Cerrar» un
// fotograma después, lo que la persona ya tecleaba acababa en ese botón.
it('puts the initial focus on the description field', async () => {
  render(<Space3DGenerativeModal open onClose={vi.fn()} onApply={vi.fn()} t={(key, vars) => translate('es', key, vars)} />);
  const input = screen.getByLabelText('Descripción de la estructura a generar');
  await waitFor(() => expect(document.activeElement).toBe(input));
});
