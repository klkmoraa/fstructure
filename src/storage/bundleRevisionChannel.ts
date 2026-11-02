/**
 * Aviso entre pestañas de que un proyecto tiene una revisión nueva. Lleva sólo
 * el id y el número de revisión, nunca datos del proyecto, y viaja por un
 * `BroadcastChannel`: local al navegador y al mismo origen, nada sale del
 * dispositivo.
 */
export interface BundleRevisionNotice { projectId: string; revision: number }

export interface BundleRevisionChannel {
  post(notice: BundleRevisionNotice): void;
  listen(listener: (notice: BundleRevisionNotice) => void): () => void;
}

const CHANNEL_NAME = 'fstructure.bundle-revisions';

const isNotice = (value: unknown): value is BundleRevisionNotice => {
  if (!value || typeof value !== 'object') return false;
  const { projectId, revision } = value as Record<string, unknown>;
  return typeof projectId === 'string' && typeof revision === 'number' && Number.isInteger(revision);
};

/** Sin `BroadcastChannel` (navegadores muy viejos, pruebas) no hay aviso: el conflicto se detecta al guardar, como antes. */
export function createBroadcastRevisionChannel(): BundleRevisionChannel | undefined {
  if (typeof BroadcastChannel === 'undefined') return undefined;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return {
    post(notice) {
      try { channel.postMessage({ projectId: notice.projectId, revision: notice.revision }); } catch { /* el aviso es opcional */ }
    },
    listen(listener) {
      const onMessage = (event: MessageEvent) => { if (isNotice(event.data)) listener(event.data); };
      channel.addEventListener('message', onMessage);
      return () => channel.removeEventListener('message', onMessage);
    },
  };
}
