/**
 * Versión nueva de la app lista en el dispositivo.
 *
 * El service worker (`scripts/sw.template.js`) instala cada versión publicada y
 * la deja esperando: una pestaña abierta nunca mezcla código de dos versiones.
 * Aquí se avisa a la interfaz y, sólo cuando la persona pulsa «Recargar», se le
 * pide al worker que tome el control y se recarga la página. Nada sale del
 * dispositivo: el navegador sólo vuelve a leer `sw.js` del mismo origen.
 */
type Listener = (ready: boolean) => void;

let waiting: ServiceWorker | null = null;
const listeners = new Set<Listener>();
const announce = () => listeners.forEach((listener) => listener(waiting !== null));

/** Los guardados del proyecto (250 ms) y de Diseño (600 ms) esperan un instante: se dejan terminar antes de recargar. */
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
  listener(waiting !== null);
  return () => { listeners.delete(listener); };
}

/** Activa la versión que espera y recarga cuando ya controla la página. */
export function applyAppUpdate(container: ServiceWorkerContainer = navigator.serviceWorker, reload: () => void = () => window.location.reload()): boolean {
  const worker = waiting;
  if (!worker) return false;
  container.addEventListener('controllerchange', () => reload(), { once: true });
  worker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/** Sólo para pruebas: olvida la versión ofrecida. */
export function resetAppUpdateForTests(): void {
  waiting = null;
  listeners.clear();
}
