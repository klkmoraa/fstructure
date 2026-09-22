// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import { generateSpace3DFrame } from '../../space3d/engine/space3dGenerative';
import { Space3DEntityEditor } from './Space3DEntityEditor';

afterEach(cleanup);

const renderMemberEditor = () => {
  const project = generateSpace3DFrame({
    baysX: 1, bayWidthX: 4, storiesY: 1, storyHeightY: 3, baysZ: 1, bayDepthZ: 4,
  });
  const onSubmit = vi.fn(() => true);
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

it('keeps a selected catalog section visible and persists its provenance', async () => {
  const user = userEvent.setup();
  const { onSubmit } = renderMemberEditor();

  const section = screen.getByLabelText(/perfil estándar/i) as HTMLSelectElement;
  const material = screen.getByLabelText(/material de referencia/i) as HTMLSelectElement;
  await user.selectOptions(section, 'IPE 300');

  expect(section.value).toBe('IPE 300');
  expect(material.value).toBe('steel-a36');

  await user.click(screen.getByRole('button', { name: /guardar barra/i }));
  const command = onSubmit.mock.calls[0][0];
  expect(command.kind).toBe('update-member');
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
  const command = onSubmit.mock.calls[0][0];
  expect(command.changes.sectionId).toBeUndefined();
  expect(command.changes.sectionOrigin).toBe('custom');
  expect(command.changes.materialId).toBe('steel-a36');
});
