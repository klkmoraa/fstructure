// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { ModelDemandSnapshot, ModelResultProvider } from '../../../design/elements/modelResultSnapshot';
import type { ExternalStructureSource } from '../../../design/elements/structure';
import type { ModelSectionsBridge } from './WorkbenchLayout';
import { FRAME_DEFAULTS } from './frameCalculation';
import type { ProposalStep } from './frameProposal';
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

it('vincula los controles de la planta y la tabla mediante el mismo ID de miembro', async () => {
  const user = userEvent.setup();
  const memberA = { ...member('C1', 'column', null, []), start: [1, 0, 2] as [number, number, number], end: [1, 3, 2] as [number, number, number] };
  const memberB = { ...member('C2', 'column', null, []), start: [4, 0, 6] as [number, number, number], end: [4, 3, 6] as [number, number, number] };
  const provider: ModelResultProvider = { inventory: { projectId: 'p', kind: 'model3d', revision: 'r1', members: [memberA, memberB], targets: [], supports: [], levels: [] }, member: async () => { throw new Error(); }, support: async () => { throw new Error(); } };
  const modelAxes = { label: 'Edificio', axes: [], resultProvider: provider } as never;
  render(<ModelMemberNavigator modelAxes={modelAxes} onCreateLinked={() => undefined} />);
  const nav = screen.getByTestId('model-member-navigator');

  await user.click(within(nav).getByRole('button', { name: /C2.*en planta/ }));
  expect(within(nav).getByTestId('member-selection').textContent).toContain('C2');
  expect(within(nav).getByRole('row', { name: /C2/ }).getAttribute('aria-selected')).toBe('true');
});

it('explica en el navegador cuando la memoria llena rechaza la creación sin cerrar la selección', async () => {
  const user = userEvent.setup();
  const item = member('C1', 'column', 'L1', ['x:0']);
  const target = { id: 'U1', label: 'Última resistencia', kind: 'combination' as const, factors: [{ caseId: 'D', factor: 1 }] };
  const snapshot: ModelDemandSnapshot = { version: 1, source: { kind: 'model2d', projectId: 'p', revision: 'r1', memberId: 'C1' }, target,
    station: { xM: 0, side: 'right', lengthM: 3 }, units: 'kN-m', axes: { convention: '2D', localBasis: [] },
    actions: { nKn: 0, vyKn: 0, vzKn: 0, torsionKnm: 0, myKnm: 0, mzKnm: 0 }, member: item };
  const provider: ModelResultProvider = { inventory: { projectId: 'p', kind: 'model2d', revision: 'r1', members: [item], targets: [target], supports: [], levels: [] }, member: async () => snapshot, support: async () => { throw new Error(); } };
  const modelSource = { resultProvider: provider } as ExternalStructureSource;
  render(<ModelMemberNavigator modelSource={modelSource} onCreateLinked={() => ({ ok: false, reason: 'Memoria llena: libera una pieza para crear otra.' })} />);
  const nav = screen.getByTestId('model-member-navigator');
  await user.click(within(nav).getByRole('button', { name: /Seleccionar column C1/ }));
  await user.click(within(nav).getByRole('button', { name: 'Crear columna vinculada' }));

  expect((await within(nav).findByRole('alert')).textContent).toMatch(/Memoria llena/);
  expect(within(nav).getByTestId('member-selection').textContent).toContain('C1');
});

it('previsualiza el conjunto seleccionado y sólo escribe sus IDs tras confirmar', async () => {
  const user = userEvent.setup();
  const members = [member('C1', 'column', 'L1', ['x:0']), member('C2', 'column', 'L1', ['x:0'])];
  const target = { id: 'U1', label: 'U1', kind: 'combination' as const, factors: [] };
  const provider: ModelResultProvider = { inventory: { projectId: 'p', kind: 'model2d', revision: 'r1', members, targets: [target], supports: [], levels: [] }, member: async () => { throw new Error(); }, support: async () => { throw new Error(); } };
  const source = { resultProvider: provider } as ExternalStructureSource;
  const proposal = { beam: { width: 35, height: 50 }, column: { width: 40, height: 40, barsPerFace: 3 }, ratio: .8, volumeM3: 1, trials: 3,
    groups: [{ id: 'columns-L1', label: 'Columnas L1', kind: 'column' as const, memberIds: ['C1', 'C2'], lengthM: 6, width: 40, height: 40 }] };
  const apply = vi.fn();
  const propose = vi.fn((_code, _draft, onStep) => { onStep({ kind: 'done', proposal }); return () => undefined; });
  const bridge = { kind: 'model2d', projectId: 'p', revision: 'r1', groups: [{ id: 'columns-L1', label: 'Columnas L1', kind: 'column', memberIds: ['C1', 'C2'], lengthM: 6, width: 30, height: 50 }],
    propose, apply, beams: 2, columns: 2, beamLengthM: 5, columnLengthM: 6, volumeM3: 1, variant: () => ({}), } as unknown as ModelSectionsBridge;
  render(<ModelMemberNavigator modelSource={source} modelSections={bridge} code="ntc-2023" frameDraft={FRAME_DEFAULTS} onCreateLinked={() => undefined} />);
  const nav = screen.getByTestId('model-member-navigator');
  await user.click(within(nav).getByRole('button', { name: /Seleccionar column C1/ }));
  await user.click(within(nav).getByTestId('propose-linked-group'));
  const preview = await within(nav).findByTestId('group-proposal-preview');
  expect(preview.textContent).toContain('columna 40 × 40 cm');
  expect(preview.textContent).not.toContain('viga 35 × 50 cm');
  expect(preview.textContent).not.toContain('m³');
  expect(preview.textContent).toMatch(/comprobación incluye el modelo completo/);
  expect(preview.textContent).toMatch(/Fuera del conjunto se conservan las secciones actuales/);
  expect(apply).not.toHaveBeenCalled();
  expect(propose).toHaveBeenCalledWith('ntc-2023', FRAME_DEFAULTS, expect.any(Function), ['C1', 'C2']);
  await user.click(within(nav).getByTestId('apply-linked-group'));
  expect(apply).toHaveBeenCalledWith(proposal.beam, proposal.column, proposal.groups, ['C1', 'C2']);
});

it('oculta dimensiones uniformes cuando falla una propuesta de grupo y confirma que no se aplicó', async () => {
  const user = userEvent.setup();
  const item = member('B1', 'beam', 'L1', ['x:0']);
  const provider: ModelResultProvider = { inventory: { projectId: 'p', kind: 'model2d', revision: 'r1', members: [item], targets: [], supports: [], levels: [] }, member: async () => { throw new Error(); }, support: async () => { throw new Error(); } };
  const bridge = { kind: 'model2d', projectId: 'p', revision: 'r1', groups: [{ id: 'beams-L1', label: 'Vigas L1', kind: 'beam', memberIds: ['B1'], lengthM: 3, width: 30, height: 50 }],
    propose: (_code: unknown, _draft: unknown, onStep: (step: unknown) => void) => { onStep({ kind: 'failed', reason: 'Ni con viga 25×35 y columna 120×120 cumple.' }); return () => undefined; },
    apply: vi.fn(), beams: 1, columns: 1, beamLengthM: 3, columnLengthM: 3, volumeM3: 1, variant: () => ({}) } as unknown as ModelSectionsBridge;
  render(<ModelMemberNavigator modelSource={{ resultProvider: provider } as ExternalStructureSource} modelSections={bridge} code="ntc-2023" frameDraft={FRAME_DEFAULTS} onCreateLinked={() => undefined} />);
  const nav = screen.getByTestId('model-member-navigator');
  await user.click(within(nav).getByRole('button', { name: /Seleccionar beam B1/ }));
  await user.click(within(nav).getByTestId('propose-linked-group'));
  const alert = await within(nav).findByRole('alert');
  expect(alert.textContent).toMatch(/No se aplicó ninguna sección/);
  expect(alert.textContent).toMatch(/fuera del conjunto conservan sus secciones actuales/);
  expect(alert.textContent).not.toMatch(/120×120|25×35/);
  expect(bridge.apply).not.toHaveBeenCalled();
});

it('descarta una respuesta pendiente si cambia el código o borrador de diseño', async () => {
  const user = userEvent.setup();
  const item = member('C1', 'column', 'L1', ['x:0']);
  const target = { id: 'U1', label: 'U1', kind: 'combination' as const, factors: [] };
  const provider: ModelResultProvider = { inventory: { projectId: 'p', kind: 'model2d', revision: 'r1', members: [item], targets: [target], supports: [], levels: [] }, member: async () => { throw new Error(); }, support: async () => { throw new Error(); } };
  let complete!: (step: ProposalStep) => void;
  const cancel = vi.fn();
  const propose = vi.fn((_code: unknown, _draft: unknown, onStep: (step: ProposalStep) => void) => { complete = onStep; return cancel; });
  const bridge = { kind: 'model2d', projectId: 'p', revision: 'r1', groups: [{ id: 'columns-L1', label: 'Columnas L1', kind: 'column', memberIds: ['C1'], lengthM: 3, width: 30, height: 50 }],
    propose, apply: vi.fn(), beams: 1, columns: 1, beamLengthM: 3, columnLengthM: 3, volumeM3: 1, variant: () => ({}) } as unknown as ModelSectionsBridge;
  const props = { modelSource: { resultProvider: provider } as ExternalStructureSource, modelSections: bridge, code: 'ntc-2023' as const, frameDraft: FRAME_DEFAULTS, onCreateLinked: () => undefined };
  const { rerender } = render(<ModelMemberNavigator {...props} />);
  const nav = screen.getByTestId('model-member-navigator');
  await user.click(within(nav).getByRole('button', { name: /Seleccionar column C1/ }));
  await user.click(within(nav).getByTestId('propose-linked-group'));

  rerender(<ModelMemberNavigator {...props} code="nsr-10" />);
  expect(cancel).toHaveBeenCalled();
  await act(async () => complete({ kind: 'done', proposal: { beam: { width: 35, height: 50 }, column: { width: 40, height: 40, barsPerFace: 3 }, ratio: .8, volumeM3: 1, trials: 3,
    groups: [{ id: 'columns-L1', label: 'Columnas L1', kind: 'column', memberIds: ['C1'], lengthM: 3, width: 40, height: 40 }] } }));
  expect(within(nav).queryByTestId('group-proposal-preview')).toBeNull();
  expect(bridge.apply).not.toHaveBeenCalled();
});

it('invalida una vista previa lista cuando cambia el borrador de diseño', async () => {
  const user = userEvent.setup();
  const item = member('C1', 'column', 'L1', ['x:0']);
  const target = { id: 'U1', label: 'U1', kind: 'combination' as const, factors: [] };
  const provider: ModelResultProvider = { inventory: { projectId: 'p', kind: 'model2d', revision: 'r1', members: [item], targets: [target], supports: [], levels: [] }, member: async () => { throw new Error(); }, support: async () => { throw new Error(); } };
  const proposal = { beam: { width: 35, height: 50 }, column: { width: 40, height: 40, barsPerFace: 3 }, ratio: .8, volumeM3: 1, trials: 3,
    groups: [{ id: 'columns-L1', label: 'Columnas L1', kind: 'column' as const, memberIds: ['C1'], lengthM: 3, width: 40, height: 40 }] };
  const apply = vi.fn();
  const bridge = { kind: 'model2d', projectId: 'p', revision: 'r1', groups: [{ id: 'columns-L1', label: 'Columnas L1', kind: 'column', memberIds: ['C1'], lengthM: 3, width: 30, height: 50 }],
    propose: (_code: unknown, _draft: unknown, onStep: (step: ProposalStep) => void) => { onStep({ kind: 'done', proposal }); return () => undefined; },
    apply, beams: 1, columns: 1, beamLengthM: 3, columnLengthM: 3, volumeM3: 1, variant: () => ({}) } as unknown as ModelSectionsBridge;
  const props = { modelSource: { resultProvider: provider } as ExternalStructureSource, modelSections: bridge, code: 'ntc-2023' as const, frameDraft: FRAME_DEFAULTS, onCreateLinked: () => undefined };
  const { rerender } = render(<ModelMemberNavigator {...props} />);
  const nav = screen.getByTestId('model-member-navigator');
  await user.click(within(nav).getByRole('button', { name: /Seleccionar column C1/ }));
  await user.click(within(nav).getByTestId('propose-linked-group'));
  expect(await within(nav).findByTestId('group-proposal-preview')).toBeTruthy();

  rerender(<ModelMemberNavigator {...props} frameDraft={{ ...FRAME_DEFAULTS, braced: 'yes' }} />);
  expect(within(nav).queryByTestId('group-proposal-preview')).toBeNull();
  expect(within(nav).queryByTestId('apply-linked-group')).toBeNull();
  expect(apply).not.toHaveBeenCalled();
});

it('conserva el preview ante un adaptador recreado con la misma revisión y aplica por el adaptador actual', async () => {
  const user = userEvent.setup();
  const item = member('C1', 'column', 'L1', ['x:0']);
  const target = { id: 'U1', label: 'U1', kind: 'combination' as const, factors: [] };
  const provider: ModelResultProvider = { inventory: { projectId: 'p', kind: 'model3d', revision: 'r1', members: [item], targets: [target], supports: [], levels: [] }, member: async () => { throw new Error(); }, support: async () => { throw new Error(); } };
  const proposal = { beam: { width: 35, height: 50 }, column: { width: 40, height: 40, barsPerFace: 3 }, ratio: .8, volumeM3: 1, trials: 3,
    groups: [{ id: 'columns-L1', label: 'Columnas L1', kind: 'column' as const, memberIds: ['C1'], lengthM: 3, width: 40, height: 40 }] };
  const makeBridge = (revision: string, apply: ReturnType<typeof vi.fn>) => ({ kind: 'model3d' as const, projectId: 'p', revision,
    groups: [{ id: 'columns-L1', label: 'Columnas L1', kind: 'column' as const, memberIds: ['C1'], lengthM: 3, width: 30, height: 50 }],
    propose: (_code: unknown, _draft: unknown, onStep: (step: ProposalStep) => void) => { onStep({ kind: 'done', proposal }); return () => undefined; },
    apply, beams: 1, columns: 1, beamLengthM: 3, columnLengthM: 3, volumeM3: 1, variant: () => ({}) }) as unknown as ModelSectionsBridge;
  const oldApply = vi.fn(), currentApply = vi.fn();
  const bridge = makeBridge('r1', oldApply);
  const props = { modelAxes: { resultProvider: provider } as never, space3dSections: bridge, code: 'ntc-2023' as const, frameDraft: FRAME_DEFAULTS, onCreateLinked: () => undefined };
  const { rerender } = render(<ModelMemberNavigator {...props} />);
  const nav = screen.getByTestId('model-member-navigator');
  await user.click(within(nav).getByRole('button', { name: /Seleccionar column C1/ }));
  await user.click(within(nav).getByTestId('propose-linked-group'));
  expect(await within(nav).findByTestId('group-proposal-preview')).toBeTruthy();

  rerender(<ModelMemberNavigator {...props} space3dSections={makeBridge('r1', currentApply)} />);
  expect(within(nav).getByTestId('group-proposal-preview')).toBeTruthy();
  await user.click(within(nav).getByTestId('apply-linked-group'));
  expect(currentApply).toHaveBeenCalledWith(proposal.beam, proposal.column, proposal.groups, ['C1']);
  expect(oldApply).not.toHaveBeenCalled();

  await user.click(within(nav).getByTestId('propose-linked-group'));
  expect(await within(nav).findByTestId('group-proposal-preview')).toBeTruthy();
  rerender(<ModelMemberNavigator {...props} space3dSections={makeBridge('r2', vi.fn())} />);
  expect(within(nav).queryByTestId('group-proposal-preview')).toBeNull();
});

it('ignora una respuesta tardía si cambia el miembro seleccionado aunque el proveedor ignore abort', async () => {
  const user = userEvent.setup();
  const members = [member('C1', 'column', 'L1', ['x:0']), member('C2', 'column', 'L1', ['x:0'])];
  const target = { id: 'U1', label: 'U1', kind: 'combination' as const, factors: [] };
  let resolve!: (snapshot: ModelDemandSnapshot) => void;
  const pending = new Promise<ModelDemandSnapshot>((done) => { resolve = done; });
  const provider: ModelResultProvider = { inventory: { projectId: 'p', kind: 'model2d', revision: 'r1', members, targets: [target], supports: [], levels: [] }, member: async () => pending, support: async () => { throw new Error(); } };
  const source = { resultProvider: provider } as ExternalStructureSource;
  const onCreateLinked = vi.fn();
  render(<ModelMemberNavigator modelSource={source} onCreateLinked={onCreateLinked} />);
  const nav = screen.getByTestId('model-member-navigator');
  await user.click(within(nav).getByRole('button', { name: /Seleccionar column C1/ }));
  await user.click(within(nav).getByRole('button', { name: 'Crear columna vinculada' }));
  await user.click(within(nav).getByRole('button', { name: /Seleccionar column C2/ }));
  resolve({ version: 1, source: { kind: 'model2d', projectId: 'p', revision: 'r1', memberId: 'C1' }, target,
    station: { xM: 0, side: 'right', lengthM: 3 }, units: 'kN-m', axes: { convention: '2D', localBasis: [] }, actions: { nKn: 0, vyKn: 0, vzKn: 0, torsionKnm: 0, myKnm: 0, mzKnm: 0 }, member: members[0]! });
  await Promise.resolve(); await Promise.resolve();
  expect(onCreateLinked).not.toHaveBeenCalled();
  expect(within(nav).getByTestId('member-selection').textContent).toContain('C2');
});
