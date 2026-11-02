import { expect, it, vi } from 'vitest';
import { flushPendingWritesOnHide, registerPendingWrite } from './pendingWrites';

const page = () => {
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
  return Object.assign(new EventTarget(), { document }) as unknown as Window & { document: { visibilityState: DocumentVisibilityState } };
};

it('al cerrar u ocultar la página vacía los guardados pendientes, y no al volver a ella', () => {
  const target = page();
  const flush = vi.fn(async () => undefined);
  const unregister = registerPendingWrite(flush);
  const stop = flushPendingWritesOnHide(target);
  try {
    target.dispatchEvent(new Event('pagehide'));
    expect(flush).toHaveBeenCalledTimes(1);
    target.document.dispatchEvent(new Event('visibilitychange'));
    expect(flush).toHaveBeenCalledTimes(1);
    target.document.visibilityState = 'hidden';
    target.document.dispatchEvent(new Event('visibilitychange'));
    expect(flush).toHaveBeenCalledTimes(2);
  } finally {
    stop();
    unregister();
  }
  target.dispatchEvent(new Event('pagehide'));
  expect(flush).toHaveBeenCalledTimes(2);
});

it('un guardado que falla al ocultar la página no impide los demás', () => {
  const target = page();
  const failing = registerPendingWrite(async () => { throw new Error('disco lleno'); });
  const saved = vi.fn(async () => undefined);
  const healthy = registerPendingWrite(saved);
  const stop = flushPendingWritesOnHide(target);
  try {
    target.dispatchEvent(new Event('pagehide'));
    expect(saved).toHaveBeenCalledTimes(1);
  } finally { stop(); failing(); healthy(); }
});
