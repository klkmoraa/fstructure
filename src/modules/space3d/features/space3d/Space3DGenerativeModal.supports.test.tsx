// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../../i18n/catalogs';
import type { Space3DProjectV1 } from '../../space3d/model/types';
import { Space3DGenerativeModal } from './Space3DGenerativeModal';

afterEach(cleanup);

const renderModal = () => {
  const onApply = vi.fn((_project: Space3DProjectV1) => undefined);
  render(
    <Space3DGenerativeModal open onClose={vi.fn()} onApply={onApply} t={(key, vars) => translate('es', key, vars)} />,
  );
  return onApply;
};

const interpret = async (user: ReturnType<typeof userEvent.setup>, prompt: string) => {
  const input = screen.getByLabelText('Descripción de la estructura a generar');
  await user.clear(input);
  await user.type(input, `${prompt}{Enter}`);
};

/** Nudos con alguna restricción: los de la base. */
const supportedNodes = (project: Space3DProjectV1) =>
  project.nodes.filter((node) => Object.values(node.restraints).some(Boolean));

describe('Space3DGenerativeModal · tipo de apoyo leído del prompt', () => {
  // El generador de la nave admite articulado, pero el modal no se lo pasaba:
  // "apoyos articulados" terminaba empotrado y cambiaba los GDL del análisis.
  it('applies pinned supports to an industrial shed and shows them in the form', async () => {
    const user = userEvent.setup();
    const onApply = renderModal();

    await interpret(user, 'nave industrial con apoyos articulados');
    expect((document.getElementById('gen-shed-sup') as HTMLSelectElement).value).toBe('pinned');

    await user.click(screen.getByRole('button', { name: /generar estructura/i }));
    const project = onApply.mock.calls[0]![0];
    const bases = supportedNodes(project);
    expect(bases.length).toBeGreaterThan(0);
    for (const node of bases) {
      expect(node.restraints).toMatchObject({ ux: true, uy: true, uz: true, rx: false, ry: false, rz: false });
    }
  });

  // Torre, cúpula y puente no admiten otro tipo de apoyo. Descartarlo sin
  // decirlo era aceptar una condición de contorno que no se iba a generar.
  it('says so when the archetype cannot honour the requested support', async () => {
    const user = userEvent.setup();
    renderModal();

    await interpret(user, 'torre de 18 m articulada');
    expect(screen.getByRole('status').textContent).toMatch(/no se aplicó/i);
  });

  it('does not add that notice when no support type was requested', async () => {
    const user = userEvent.setup();
    renderModal();

    await interpret(user, 'torre de 18 m');
    expect(screen.getByRole('status').textContent).not.toMatch(/no se aplicó/i);
  });
});
