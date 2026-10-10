// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { ModelDemandSnapshot, ModelResultProvider } from '../../../design/elements/modelResultSnapshot';
import type { ExternalStructureSource } from '../../../design/elements/structure';
import { ModelMemberNavigator } from './ModelMemberNavigator';

afterEach(cleanup);
const member = (id: string, family: 'beam' | 'column', levelId: string | null, axisIds: string[]) => ({ id, label: `${family} ${id}`, family, levelId, axisIds, lengthM: 3,
  section: { shape: 'rectangular' as const, widthMm: 300, depthMm: 500, fcMpa: 28, materialLabel: 'Concreto 28' }, start: [0, 0, 0] as [number, number, number], end: [0, 3, 0] as [number, number, number] });

it('usa IDs comunes, muestra sin asignar, filtra y solicita una estación fresca con target y lado', async () => {
  const user = userEvent.setup();
  const members = [member('C1', 'column', 'L1', ['x:0']), member('B1', 'beam', null, [])];
  const snapshot: ModelDemandSnapshot = { version: 1, source: { kind: 'model2d', projectId: 'p', revision: 'r1', memberId: 'C1' },
    target: { id: 'SERV', label: 'Servicio', kind: 'combination', factors: [{ caseId: 'D', factor: 1 }, { caseId: 'L', factor: 1 }] }, station: { xM: 1, side: 'left', lengthM: 3 }, units: 'kN-m',
    axes: { convention: '2D', localBasis: [] }, actions: { nKn: 0, vyKn: 0, vzKn: 0, torsionKnm: 0, myKnm: 0, mzKnm: 12.8 }, member: members[0]! };
  const memberRequest = vi.fn(async () => snapshot);
  const provider: ModelResultProvider = { inventory: { projectId: 'p', kind: 'model2d', revision: 'r1', members, targets: [snapshot.target], supports: [], levels: [] }, member: memberRequest, support: async () => { throw new Error(); } };
  const modelSource = { label: 'Modelo', revision: 'r1', summary: { members: 2, beams: 1, columns: 1, skipped: 0, deadCases: 0, liveCases: 0, lateralCases: 0, ignoredCases: [] }, fcMpa: 28, includesSelfWeight: true, errors: [], resultProvider: provider, create: () => null } as ExternalStructureSource;
  const onCreateLinked = vi.fn(); const onShowMembers = vi.fn();
  const { rerender } = render(<ModelMemberNavigator modelSource={modelSource} onCreateLinked={onCreateLinked} onShowMembers={onShowMembers} />);
  const nav = screen.getByTestId('model-member-navigator');
  expect(within(nav).getAllByText(/Sin asignar/).length).toBeGreaterThan(0);
  await user.selectOptions(within(nav).getByRole('combobox', { name: 'Filtrar por familia' }), 'column');
  await user.click(within(nav).getByRole('button', { name: /Seleccionar column C1/ }));
  await user.selectOptions(within(nav).getByRole('combobox', { name: 'Filtrar por familia' }), 'beam');
  expect(within(nav).getByTestId('member-selection').textContent).toContain('fuera de los filtros');
  await user.selectOptions(within(nav).getByRole('combobox', { name: 'Filtrar por familia' }), 'column');
  await user.click(within(nav).getByRole('button', { name: /Seleccionar column C1/ }));
  await user.selectOptions(within(nav).getByRole('combobox', { name: 'Estado o combinación' }), 'SERV');
  await user.clear(within(nav).getByRole('spinbutton', { name: 'Estación desde i' }));
  await user.type(within(nav).getByRole('spinbutton', { name: 'Estación desde i' }), '1');
  await user.selectOptions(within(nav).getByRole('combobox', { name: 'Lado del salto' }), 'left');
  await user.click(within(nav).getByRole('button', { name: 'Ver en el modelo' }));
  await user.click(within(nav).getByRole('button', { name: 'Crear columna vinculada' }));
  expect(onShowMembers).toHaveBeenCalledWith(['C1'], 'x:0', 'model2d');
  expect(memberRequest).toHaveBeenCalledWith({ memberId: 'C1', targetId: 'SERV', xM: 1, side: 'left', axisId: 'x:0' }, expect.any(AbortSignal));
  expect(onCreateLinked).toHaveBeenCalledWith(snapshot, 'column');
  const updatedProvider: ModelResultProvider = { ...provider, inventory: { ...provider.inventory, revision: 'r2', members: [members[1]!] } };
  rerender(<ModelMemberNavigator modelSource={{ ...modelSource, revision: 'r2', resultProvider: updatedProvider }} onCreateLinked={onCreateLinked} onShowMembers={onShowMembers} />);
  expect(within(screen.getByTestId('model-member-navigator')).queryByTestId('member-selection')).toBeNull();
});
