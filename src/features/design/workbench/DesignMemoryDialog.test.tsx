// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignMemoryDialog } from './DesignMemoryDialog';
import { useDesignMemory } from './designMemory';
import { BEAM_DEFAULTS } from './beamModel';
import type { DesignElementKind, DesignReport } from './designReport';
import { DEFAULT_SPANS } from './beamModel';
import type { WorkbenchMemoryItem, WorkbenchStorage } from './workbenchStorage';
import type { ExternalStructureSource } from '../../../design/elements/structure';
import { createConcreteFrameProject } from '../../../data/defaultProject';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS } from './frameModel';

const saved = (id: string, tag: string, fc = BEAM_DEFAULTS.fc): WorkbenchMemoryItem => ({
  id, element: 'beam', code: 'ntc-2023', savedAt: '2026-10-01', fields: { ...BEAM_DEFAULTS, tag, fc }, rows: DEFAULT_SPANS.map((span) => ({ ...span })) as Record<string, string>[],
});
const savedModelFrame: WorkbenchMemoryItem = {
  id: 'model-frame', element: 'frame', code: 'ntc-2023', savedAt: '2026-10-01',
  fields: { ...FRAME_DEFAULTS, tag: 'Marco modelo', source: 'model' },
  rows: DEFAULT_BAYS as unknown as Record<string, string>[], levels: DEFAULT_STORIES as unknown as Record<string, string>[],
};
const storageFor = (items: WorkbenchMemoryItem[], state: { writable: boolean }) => {
  const data: Record<string, unknown> = { memory: items, 'memory-active': items[0]?.id ?? '' };
  const storage: WorkbenchStorage = {
    read: (key) => data[key], write: (key, value) => { data[key] = value; },
    canWrite: () => state.writable,
  };
  return { storage, data };
};

function Harness({ initial, state, onExport, modelSource = null }: { initial: WorkbenchMemoryItem[]; state: { writable: boolean }; onExport: (reports: readonly DesignReport[]) => void; modelSource?: ExternalStructureSource | null }) {
  const { storage } = storageForRef(initial, state);
  const memory = useDesignMemory(storage, 'beam' as DesignElementKind, 'ntc-2023', 0);
  const [message, setMessage] = React.useState<string | null>(null);
  return <DesignMemoryDialog open onOpenChange={() => {}} memory={memory} element="beam" modelSource={modelSource}
    onLoad={(id) => { setMessage(memory.open(id) === 'full' ? 'No cabe abrir esta pieza.' : null); }}
    onClearMessage={() => setMessage(null)} onExport={onExport} exporting={false} message={message} />;
}
function storageForRef(initial: WorkbenchMemoryItem[], state: { writable: boolean }) {
  const ref = React.useRef<ReturnType<typeof storageFor> | null>(null);
  if (!ref.current) ref.current = storageFor(initial, state);
  return ref.current;
}
import React from 'react';

afterEach(cleanup);
const renderDialog = (items: WorkbenchMemoryItem[], state = { writable: true }, onExport = vi.fn(), modelSource: ExternalStructureSource | null = null) => {
  const user = userEvent.setup();
  const view = render(<Harness initial={items} state={state} onExport={onExport} modelSource={modelSource} />);
  return { user, onExport, ...view };
};

describe('DesignMemoryDialog', () => {
  it('filtra, mantiene selección oculta y exporta memoria completa o selección en orden guardado', async () => {
    const items = [saved('one', 'V-Árbol'), saved('two', 'V-Zapato')];
    const { user, onExport } = renderDialog(items);
    const full = screen.getByRole('button', { name: 'Exportar memoria (2)' });
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar V-Árbol' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en memoria' }), 'zapato');
    expect(screen.getByRole('row', { name: /V-Zapato/ })).toBeTruthy();
    expect(screen.queryByRole('row', { name: /V-Árbol/ })).toBeNull();
    expect((screen.getByRole('button', { name: 'Exportar selección (1)' }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Exportar selección (1)' }));
    expect(onExport).toHaveBeenLastCalledWith([expect.objectContaining({ tag: 'V-Árbol' })]);
    await user.click(screen.getByRole('button', { name: 'Seleccionar visibles' }));
    expect(screen.getByText('2 seleccionados')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    expect(screen.getByText('0 seleccionados')).toBeTruthy();
    await user.click(full);
    expect(onExport).toHaveBeenLastCalledWith([expect.objectContaining({ tag: 'V-Árbol' }), expect.objectContaining({ tag: 'V-Zapato' })]);
  });

  it('poda la selección cuando la fuente del Modelo 2D se vuelve inválida y no la restaura al regresar', async () => {
    const source = model2dDesignSource(createConcreteFrameProject());
    const { user, onExport, rerender } = renderDialog([savedModelFrame], { writable: true }, vi.fn(), source);
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Marco modelo' })).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar Marco modelo' }));
    expect(screen.getByText('1 seleccionados')).toBeTruthy();

    rerender(<Harness initial={[savedModelFrame]} state={{ writable: true }} onExport={onExport} modelSource={null} />);
    await waitFor(() => expect(screen.getByText('0 seleccionados')).toBeTruthy());
    expect(screen.queryByRole('checkbox', { name: 'Seleccionar Marco modelo' })).toBeNull();
    const selectionExport = screen.getByRole('button', { name: 'Exportar selección (0)' }) as HTMLButtonElement;
    const allExport = screen.getByRole('button', { name: 'Exportar memoria (0)' }) as HTMLButtonElement;
    expect(selectionExport.disabled).toBe(true);
    expect(allExport.disabled).toBe(true);
    expect(onExport).not.toHaveBeenCalled();

    rerender(<Harness initial={[savedModelFrame]} state={{ writable: true }} onExport={onExport} modelSource={source} />);
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Marco modelo' })).toHaveProperty('checked', false);
    expect(screen.getByText('0 seleccionados')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Exportar selección (0)' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('distingue lista vacía de búsqueda sin coincidencias y permite restablecer filtros', async () => {
    const { user } = renderDialog([saved('one', 'V-1')]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por estado' }), 'invalid');
    expect(screen.getByText(/No hay coincidencias/)).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por estado' }), 'all');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en memoria' }), 'inexistente');
    expect(screen.getByText(/No hay coincidencias/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Restablecer filtros' }));
    expect(screen.getByRole('row', { name: /V-1/ })).toBeTruthy();
    cleanup();
    render(<Harness initial={[]} state={{ writable: true }} onExport={vi.fn()} />);
    expect(screen.getByText(/Aún no hay elementos/)).toBeTruthy();
  });

  it('borra selección al eliminar id y excluye datos incompletos de la exportación', async () => {
    const { user, onExport } = renderDialog([saved('good', 'V-1'), saved('bad', 'V-2', '')]);
    expect(screen.queryByRole('checkbox', { name: 'Seleccionar V-2' })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar V-1' }));
    await user.click(screen.getByRole('button', { name: 'Quitar V-1 de la memoria' }));
    expect((screen.getByRole('button', { name: 'Exportar selección (0)' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onExport).not.toHaveBeenCalled();
    expect(screen.getByText(/1 elemento incompleto se excluye/)).toBeTruthy();
  });

  it('un duplicado exitoso limpia el aviso parental de un open rechazado y no activa la copia', async () => {
    const state = { writable: false };
    const { user } = renderDialog([saved('source', 'V-1')], state);
    await user.click(screen.getByRole('button', { name: 'Abrir V-1' }));
    expect(screen.getByText(/No cabe abrir esta pieza/)).toBeTruthy();
    state.writable = true;
    await user.click(screen.getByRole('button', { name: 'Duplicar V-1' }));
    expect(screen.getByRole('row', { name: /V-1 · copia/ })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar V-1' }).closest('tr')?.getAttribute('data-active')).toBe('true');
    expect(screen.queryByText(/No hay espacio suficiente|No cabe abrir/)).toBeNull();
  });

  it('muestra el rechazo de capacidad al duplicar', async () => {
    const { user } = renderDialog([saved('source', 'V-1')], { writable: false });
    await user.click(screen.getByRole('button', { name: 'Duplicar V-1' }));
    expect(screen.getByText(/No hay espacio suficiente para duplicar/)).toBeTruthy();
    expect(screen.queryByRole('row', { name: /V-1 · copia/ })).toBeNull();
  });
});
