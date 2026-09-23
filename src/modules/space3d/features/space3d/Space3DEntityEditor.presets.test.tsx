// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import type { Space3DCommand } from '../../space3d/data/commands';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';
import { Space3DEntityEditor } from './Space3DEntityEditor';

afterEach(cleanup);

const renderMemberEditor = () => {
  const project = generateSpace3DFrame({
    baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4,
  });
  const onSubmit = vi.fn((_command: Space3DCommand) => true);
  render(
    <Space3DEntityEditor
      project={project}
      target={{ kind: 'member', id: project.members[0].id }}
      t={(key, vars) => translate('es', key, vars)}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  );
  return { project, onSubmit };
};

/**
 * `onSubmit` recibe la unión `Space3DCommand`; `expect(...).toBe` no la estrecha.
 * Este helper afirma la variante y devuelve el comando ya tipado.
 */
const expectMemberUpdate = (
  command: Space3DCommand,
): Extract<Space3DCommand, { kind: 'update-member' }> => {
  expect(command.kind).toBe('update-member');
  if (command.kind !== 'update-member') {
    throw new Error(`Se esperaba update-member y se recibió ${command.kind}`);
  }
  return command;
};

it('keeps a selected catalog section visible and persists its provenance', async () => {
  const user = userEvent.setup();
  const { onSubmit } = renderMemberEditor();

  const section = screen.getByLabelText(/perfil estándar/i) as HTMLSelectElement;
  const material = screen.getByLabelText(/material de referencia/i) as HTMLSelectElement;
  await user.selectOptions(section, 'IPE 300');

  expect(section.value).toBe('IPE 300');
  expect(material.value).toBe('steel-a36');

  await user.click(screen.getByRole('button', { name: /guardar barra/i }));
  const command = expectMemberUpdate(onSubmit.mock.calls[0]![0]);
  expect(command.changes.sectionId).toBe('IPE 300');
  expect(command.changes.sectionOrigin).toBe('catalog');
  expect(command.changes.materialId).toBe('steel-a36');
  expect(command.changes.materialOrigin).toBe('catalog');
  expect(command.changes.density).toBe(7850);
});

it('clears catalog section identity after applying custom geometry', async () => {
  const user = userEvent.setup();
  const { onSubmit } = renderMemberEditor();

  const section = screen.getByLabelText(/perfil estándar/i) as HTMLSelectElement;
  await user.selectOptions(section, 'IPE 300');
  await user.click(screen.getByRole('button', { name: /aplicar rectangular/i }));

  expect(section.value).toBe('');

  await user.click(screen.getByRole('button', { name: /guardar barra/i }));
  const command = expectMemberUpdate(onSubmit.mock.calls[0]![0]);
  expect(command.changes.sectionId).toBeUndefined();
  expect(command.changes.sectionOrigin).toBe('custom');
  expect(command.changes.materialId).toBe('steel-a36');
});

// Cambiar E rompe la identidad de catálogo, pero la masa es otra propiedad: si
// la densidad se borraba, la barra salía del ensamblaje modal sin aviso y el
// editor no ofrece campo para volver a escribirla.
it('keeps the density when the elastic modulus is edited', async () => {
  const user = userEvent.setup();
  const { onSubmit } = renderMemberEditor();

  await user.selectOptions(screen.getByLabelText(/perfil estándar/i), 'IPE 300');
  const modulus = screen.getByLabelText('Módulo E') as HTMLInputElement;
  await user.clear(modulus);
  await user.type(modulus, '210000000');

  await user.click(screen.getByRole('button', { name: /guardar barra/i }));
  const command = expectMemberUpdate(onSubmit.mock.calls[0]![0]);
  expect(command.changes.E).toBe(210000000);
  expect(command.changes.density).toBe(7850);
  // La identidad de catálogo sí se retira: ya no es el acero A36 de la tabla.
  expect(command.changes.materialId).toBeUndefined();
  expect(command.changes.materialOrigin).toBe('custom');
});

// Los chips de categoría son un filtro excluyente. Con el estado sólo en una
// clase CSS, un lector de pantalla no podía saber cuál estaba activo.
it('exposes which section category filter is active', async () => {
  const user = userEvent.setup();
  renderMemberEditor();
  const group = screen.getByRole('group', { name: 'Filtrar por material' });
  const chips = within(group).getAllByRole('button');
  expect(chips.filter((chip) => chip.getAttribute('aria-pressed') === 'true')).toHaveLength(1);

  const concrete = within(group).getByRole('button', { name: /concreto/i });
  await user.click(concrete);
  expect(concrete.getAttribute('aria-pressed')).toBe('true');
  expect(chips.filter((chip) => chip.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
});
