/**
 * Versión nueva de la app lista en el dispositivo.
 *
 * El service worker (`scripts/sw.template.js`) instala cada versión publicada y
 * la deja esperando: una pestaña abierta nunca mezcla código de dos versiones.
 * Aquí se avisa a la interfaz y, sólo cuando la persona pulsa «Recargar», se le
 * pide al worker que tome el control y se recarga la página. Nada sale del
 * dispositivo: el navegador sólo vuelve a leer `sw.js` del mismo origen.
 *
 * Si la versión nueva la activa otra pestaña, el worker borra la caché
 * anterior y esta página sigue con código viejo cuyos chunks `lazy()` ya no
 * existen: el mismo aviso se ofrece aquí (basta recargar) y, si un chunk llega
 * a fallar, se guarda lo pendiente y se recarga una sola vez.
 */
import { flushPendingWrites } from './pendingWrites';

type Listener = (ready: boolean) => void;

let waiting: ServiceWorker | null = null;
/** Esta página corre una versión anterior a la que ya está activa: recargar basta. */
let outdated = false;
/** Esta pestaña pidió el cambio: su propio `controllerchange` no es de otra. */
let applying = false;
let staleReload: Promise<boolean> | null = null;
const listeners = new Set<Listener>();
const isReady = () => waiting !== null || outdated;
const announce = () => listeners.forEach((listener) => listener(isReady()));

/** Los guardados pendientes se vacían antes de recargar; las escrituras en curso (3D, espejo de la biblioteca) tienen un instante para terminar. */
export const SETTLE_BEFORE_RELOAD_MS = 1_000;
/** Con la pestaña abierta mucho tiempo, se busca una versión nueva al volver a ella, a lo sumo una vez por hora. */
const CHECK_INTERVAL_MS = 60 * 60 * 1_000;

export function watchServiceWorker(registration: ServiceWorkerRegistration, container: ServiceWorkerContainer = navigator.serviceWorker): void {
  // Sin controlador es la primera instalación: no hay versión anterior que reemplazar.
  const offer = (worker: ServiceWorker | null) => {
    if (!worker || !container.controller) return;
    waiting = worker;
    announce();
  };
  offer(registration.waiting);
  // Otra pestaña pulsó «Recargar»: la versión nueva ya controla esta página,
  // que sigue con el código anterior y sin su caché. Sólo falta recargar.
  let controlled = container.controller !== null;
  container.addEventListener('controllerchange', () => {
    const replaced = controlled;
    controlled = true;
    if (!replaced || applying) return;
    waiting = null;
    outdated = true;
    announce();
  });
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed') offer(registration.waiting ?? installing);
    });
  });
  let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
    lastCheck = Date.now();
    void registration.update().catch(() => undefined);
  });
}

export function subscribeAppUpdate(listener: Listener): () => void {
  listeners.add(listener);
  listener(isReady());
  return () => { listeners.delete(listener); };
}

/** Activa la versión que espera y recarga cuando ya controla la página. */
export function applyAppUpdate(container: ServiceWorkerContainer = navigator.serviceWorker, reload: () => void = () => window.location.reload()): boolean {
  const worker = waiting;
  if (!worker) {
    if (!outdated) return false;
    reload();
    return true;
  }
  applying = true;
  container.addEventListener('controllerchange', () => reload(), { once: true });
  worker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

const STALE_RELOAD_KEY = 'fstructure.stale-chunk-reload';
/** Si el chunk vuelve a fallar en este lapso tras recargar, no se recarga otra vez: se ofrece el aviso. */
const STALE_RELOAD_GUARD_MS = 60_000;
/** Lo pendiente se guarda antes de recargar, sin esperar para siempre a un IndexedDB atascado. */
const FLUSH_BEFORE_RELOAD_MS = 3_000;

const sessionStore = (): Pick<Storage, 'getItem' | 'setItem'> | null => {
  try { return window.sessionStorage; } catch { return null; }
};

interface StaleReloadOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  reload?: () => void;
  now?: () => number;
  online?: () => boolean;
}

/**
 * Un `import()` falló: lo normal es que esta pestaña corra una versión vieja
 * cuyos chunks ya no están (otra pestaña activó la nueva y su worker borró la
 * caché, o Pages publicó otros hashes). Se vacían los guardados pendientes y se
 * recarga una sola vez; `sessionStorage` evita recargar en bucle. Sin red, o si
 * ya se recargó hace poco, no se recarga: queda el aviso «Recargar» para que la
 * persona decida. Devuelve si la página se está recargando.
 */
export function reloadForStaleCode(options: StaleReloadOptions = {}): Promise<boolean> {
  if (staleReload) return staleReload;
  const storage = options.storage === undefined ? sessionStore() : options.storage;
  const now = (options.now ?? Date.now)();
  const online = (options.online ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false))();
  let allowed = false;
  if (online && storage) {
    try {
      const last = Number(storage.getItem(STALE_RELOAD_KEY));
      allowed = !(last > 0 && now - last >= 0 && now - last < STALE_RELOAD_GUARD_MS);
      if (allowed) storage.setItem(STALE_RELOAD_KEY, String(now));
    } catch { allowed = false; }
  }
  if (!allowed) {
    if (online) { outdated = true; announce(); }
    return Promise.resolve(false);
  }
  const reload = options.reload ?? (() => window.location.reload());
  staleReload = Promise.race([
    flushPendingWrites().catch(() => undefined),
    new Promise<void>((resolve) => { setTimeout(resolve, FLUSH_BEFORE_RELOAD_MS); }),
  ]).then(() => { reload(); return true; });
  return staleReload;
}

/** Vite avisa con `vite:preloadError` cuando un `import()` o sus dependencias no cargan. */
export function watchStaleChunks(target: Window = window, options?: StaleReloadOptions): () => void {
  const onPreloadError = () => { void reloadForStaleCode(options); };
  target.addEventListener('vite:preloadError', onPreloadError);
  return () => target.removeEventListener('vite:preloadError', onPreloadError);
}

/**
 * Para los `lazy()` de la mesa: si su chunk no carga y la página se recarga,
 * el `Suspense` sigue mostrando «Cargando» hasta que la recarga ocurra, en vez
 * de un error; si no se recarga, el error sigue su curso.
 */
export const loadOrReload = <T>(load: () => Promise<T>, options?: StaleReloadOptions) => (): Promise<T> => load().catch(async (error: unknown) => {
  if (await reloadForStaleCode(options)) return new Promise<T>(() => undefined);
  throw error;
});

/** Sólo para pruebas: olvida la versión ofrecida. */
export function resetAppUpdateForTests(): void {
  waiting = null;
  outdated = false;
  applying = false;
  staleReload = null;
  listeners.clear();
}
