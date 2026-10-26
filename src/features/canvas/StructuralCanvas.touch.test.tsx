// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import type { ProjectModel, Tool } from '../../types';
import { DEFAULT_EDITOR_LAYERS } from './editorLayers';
import { StructuralCanvas } from './StructuralCanvas';

/** jsdom has no pointer capture or hit testing; events still exercise the real editor and store. */
class TouchPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'touch';
    this.isPrimary = init.isPrimary ?? true;
  }
}

const Probe = () => {
  const { project, selection, setActiveTool } = useProject();
  return <>
    <output aria-label="selection">{JSON.stringify(selection)}</output>
    <output aria-label="model">{JSON.stringify({ nodes: project.nodes, members: project.members, nodalLoads: project.nodalLoads, memberLoads: project.memberLoads })}</output>
    {(['select', 'node', 'delete', 'pointLoad', 'support'] as Tool[]).map((tool) => <button key={tool} onClick={() => setActiveTool(tool)}>{tool}</button>)}
  </>;
};

const mount = (project: ProjectModel = createDefaultProject()) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  const { container } = render(<ProjectProvider><Probe /><StructuralCanvas layers={DEFAULT_EDITOR_LAYERS} dispatchLayers={() => undefined} /></ProjectProvider>);
  const canvas = container.querySelector<SVGSVGElement>('.structural-canvas')!;
  const object = (kind: string, id: string) => container.querySelector<SVGGElement>(`[data-structure-kind="${kind}"][data-structure-id="${id}"]`)!;
  return { container, canvas, object };
};

const contact = (x: number, y: number, pointerId = 1, isPrimary = true): PointerEventInit => ({
  pointerType: 'touch', pointerId, isPrimary, clientX: x, clientY: y, button: 0, bubbles: true,
});
const tap = (target: Element, canvas: Element, x: number, y: number) => {
  fireEvent.pointerDown(target, contact(x, y));
  fireEvent.pointerUp(canvas, contact(x, y));
};
const selected = () => JSON.parse(screen.getByLabelText('selection').textContent!);
const model = () => screen.getByLabelText('model').textContent;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('PointerEvent', TouchPointerEvent);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => window.clearTimeout(handle));
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('selección táctil del canvas', () => {
  it('elige el nudo más próximo cuando dos zonas táctiles se superponen', () => {
    const project = createDefaultProject();
    project.nodes[1] = { ...project.nodes[1], x: 0.2 };
    const { canvas, object } = mount(project);
    const near = object('node', 'N1');
    const far = object('node', 'N2');
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [far, near] });
    tap(far, canvas, 260, 500);
    expect(selected()).toEqual({ kind: 'node', id: 'N1' });
  });

  it('elige la barra más próxima y conserva ambas para resolver coincidencias', () => {
    const project = createDefaultProject();
    project.nodes[1] = { ...project.nodes[1], x: 0.2 };
    project.nodes[3] = { ...project.nodes[3], x: 0.2 };
    const { canvas, object } = mount(project);
    const near = object('member', 'M1');
    const far = object('member', 'M3');
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [far, near] });
    tap(far, canvas, 260, 330);
    expect(selected()).toEqual({ kind: 'member', id: 'M1' });
    tap(far, canvas, 260, 330);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('un segundo toque abre las coincidencias y sólo confirmar cambia la selección', () => {
    const { canvas, object } = mount();
    const node = object('node', 'N3');
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [node] });
    const before = model();
    tap(node, canvas, 260, 160);
    expect(selected()).toEqual({ kind: 'node', id: 'N3' });
    expect(screen.queryByRole('listbox')).toBeNull();
    tap(node, canvas, 260, 160);
    const choices = screen.getByRole('listbox');
    fireEvent.click(within(choices).getByRole('option', { name: /M2$/ }));
    expect(selected()).toEqual({ kind: 'node', id: 'N3' });
    fireEvent.keyDown(choices, { key: 'Enter' });
    expect(selected()).toEqual({ kind: 'member', id: 'M2' });
    expect(model()).toBe(before);
  });
});

describe('gestos táctiles sin editar el modelo', () => {
  it('abre el selector de apoyos después del click del toque y exige otra elección explícita', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    const { canvas, object } = mount();
    fireEvent.click(screen.getByRole('button', { name: /^support$/ }));
    const before = model();

    tap(object('node', 'N3'), canvas, 260, 160);
    // La nueva hoja puede ocupar el punto tocado. Todavía no debe existir al
    // emitir el navegador el click compatible que sigue a pointerup.
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(canvas);
    act(() => { frames.splice(0).forEach((callback) => callback(0)); });

    const dialog = screen.getByRole('dialog');
    expect(model()).toBe(before);
    fireEvent.click(within(dialog).getByRole('button', { name: /^Articulado$/ }));
    const after = JSON.parse(model()!);
    expect(after.nodes.find((node: { id: string }) => node.id === 'N3').support.type).toBe('pin');
  });

  it.each(['node', 'delete', 'pointLoad'] as const)('no ejecuta %s si al soltar hubo desplazamiento sin pointermove', async (tool) => {
    const { canvas, object } = mount();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${tool}$`) }));
    const before = model();
    const target = tool === 'node' ? canvas : object('node', 'N3');
    await act(async () => {
      fireEvent.pointerDown(target, contact(360, 260));
      fireEvent.pointerUp(canvas, contact(392, 284));
    });
    expect(model()).toBe(before);
    expect(canvas.dataset.interaction).toBe('idle');
  });

  it('el arrastre de un nudo sólo desplaza la cámara y no abre coincidencias', async () => {
    const { canvas, object } = mount();
    const before = model();
    fireEvent.pointerDown(object('node', 'N3'), contact(260, 160));
    fireEvent.pointerMove(canvas, contact(294, 186));
    expect(canvas.dataset.interaction).toBe('pan');
    await act(async () => { fireEvent.pointerUp(canvas, contact(294, 186)); });
    expect(model()).toBe(before);
    expect(selected()).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('pinch durante colocación y su dedo restante no crean nudos', async () => {
    const { canvas } = mount();
    fireEvent.click(screen.getByRole('button', { name: /^node$/ }));
    const before = model();
    fireEvent.pointerDown(canvas, contact(120, 250));
    fireEvent.pointerDown(canvas, contact(220, 250, 2, false));
    expect(canvas.dataset.interaction).toBe('pinch');
    fireEvent.pointerMove(canvas, contact(280, 260, 2, false));
    fireEvent.pointerUp(canvas, contact(280, 260, 2, false));
    expect(canvas.dataset.interaction).toBe('pan');
    fireEvent.pointerMove(canvas, contact(145, 275));
    await act(async () => { fireEvent.pointerUp(canvas, contact(145, 275)); });
    expect(canvas.dataset.interaction).toBe('idle');
    expect(model()).toBe(before);
  });

  it('pointercancel no confirma la colocación pendiente', async () => {
    const { canvas } = mount();
    fireEvent.click(screen.getByRole('button', { name: /^node$/ }));
    const before = model();
    fireEvent.pointerDown(canvas, contact(120, 250));
    await act(async () => { fireEvent.pointerCancel(canvas, contact(120, 250)); });
    expect(canvas.dataset.interaction).toBe('idle');
    expect(model()).toBe(before);
  });
});
