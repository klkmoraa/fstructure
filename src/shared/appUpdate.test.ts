// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { applyAppUpdate, loadOrReload, reloadForStaleCode, resetAppUpdateForTests, subscribeAppUpdate, watchServiceWorker, watchStaleChunks } from './appUpdate';
import { registerPendingWrite } from './pendingWrites';

afterEach(() => resetAppUpdateForTests());

const worker = () => Object.assign(new EventTarget(), { state: 'installing', postMessage: vi.fn() }) as unknown as ServiceWorker & { postMessage: ReturnType<typeof vi.fn> };
const registration = (fields: Partial<Record<'waiting' | 'installing', ServiceWorker | null>> = {}) =>
  Object.assign(new EventTarget(), { waiting: null, installing: null, update: vi.fn(async () => undefined), ...fields }) as unknown as ServiceWorkerRegistration;
const container = (controller: object | null) => Object.assign(new EventTarget(), { controller }) as unknown as ServiceWorkerContainer;

it('la primera instalación no ofrece recargar', () => {
  const seen: boolean[] = [];
  subscribeAppUpdate((ready) => seen.push(ready));
  watchServiceWorker(registration({ waiting: worker() }), container(null));
  expect(seen).toEqual([false]);
});

it('ofrece la versión que ya espera y la que termina de instalarse', () => {
  const seen: boolean[] = [];
  subscribeAppUpdate((ready) => seen.push(ready));
  const reg = registration();
  watchServiceWorker(reg, container({}));
  expect(seen).toEqual([false]);
  const installing = worker();
  Object.assign(reg, { installing });
  reg.dispatchEvent(new Event('updatefound'));
  Object.assign(installing, { state: 'installed' });
  Object.assign(reg, { waiting: installing });
  installing.dispatchEvent(new Event('statechange'));
  expect(seen).toEqual([false, true]);
});

it('recargar pide al worker que tome el control y recarga sólo cuando ya controla', () => {
  const waiting = worker();
  const sw = container({});
  watchServiceWorker(registration({ waiting }), sw);
  const reload = vi.fn();
  expect(applyAppUpdate(sw, reload)).toBe(true);
  expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  expect(reload).not.toHaveBeenCalled();
  sw.dispatchEvent(new Event('controllerchange'));
  expect(reload).toHaveBeenCalledTimes(1);
});

it('sin versión nueva no hace nada', () => {
  const reload = vi.fn();
  expect(applyAppUpdate(container({}), reload)).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});

it('si otra pestaña activa la versión nueva, aquí se ofrece recargar y «Recargar» recarga sin esperar', () => {
  const seen: boolean[] = [];
  subscribeAppUpdate((ready) => seen.push(ready));
  const waiting = worker();
  const sw = container({});
  watchServiceWorker(registration({ waiting }), sw);
  // La otra pestaña pulsó «Recargar»: el worker nuevo reclama también esta página.
  Object.assign(sw, { controller: {} });
  sw.dispatchEvent(new Event('controllerchange'));
  expect(seen.at(-1)).toBe(true);
  const reload = vi.fn();
  expect(applyAppUpdate(sw, reload)).toBe(true);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(waiting.postMessage).not.toHaveBeenCalled();
});

it('la primera instalación (sin controlador previo) no cuenta como versión vieja', () => {
  const seen: boolean[] = [];
  subscribeAppUpdate((ready) => seen.push(ready));
  const sw = container(null);
  watchServiceWorker(registration(), sw);
  Object.assign(sw, { controller: {} });
  sw.dispatchEvent(new Event('controllerchange'));
  expect(seen).toEqual([false]);
});

const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};

it('un chunk que ya no existe guarda lo pendiente y recarga una sola vez; si vuelve a fallar, ofrece el aviso', async () => {
  const storage = memoryStorage();
  const order: string[] = [];
  const unregister = registerPendingWrite(async () => { order.push('guardar'); });
  const reload = vi.fn(() => { order.push('recargar'); });
  const target = new EventTarget() as unknown as Window;
  const stop = watchStaleChunks(target, { storage, reload, now: () => 1_000, online: () => true });
  try {
    target.dispatchEvent(new Event('vite:preloadError'));
    // Un `lazy()` de la mesa que falla a la vez espera la misma recarga en vez de mostrar un error.
    let settled = false;
    void loadOrReload(() => Promise.reject(new Error('404')))().finally(() => { settled = true; });
    await vi.waitFor(() => expect(order).toEqual(['guardar', 'recargar']));
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    // La página recargada (estado nuevo) vuelve a fallar enseguida: no hay bucle, queda «Recargar».
    resetAppUpdateForTests();
    const seen: boolean[] = [];
    subscribeAppUpdate((ready) => seen.push(ready));
    expect(await reloadForStaleCode({ storage, reload, now: () => 30_000, online: () => true })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([false, true]);
    const manual = vi.fn();
    expect(applyAppUpdate(container({}), manual)).toBe(true);
    expect(manual).toHaveBeenCalledTimes(1);
  } finally { stop(); unregister(); }
});

it('sin red no recarga: el error del chunk sigue su curso', async () => {
  const reload = vi.fn();
  const options = { storage: memoryStorage(), reload, now: () => 1_000, online: () => false };
  await expect(loadOrReload(() => Promise.reject(new Error('offline')), options)()).rejects.toThrow('offline');
  expect(reload).not.toHaveBeenCalled();
});
