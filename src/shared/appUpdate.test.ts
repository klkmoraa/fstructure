// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { applyAppUpdate, resetAppUpdateForTests, subscribeAppUpdate, watchServiceWorker } from './appUpdate';

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
