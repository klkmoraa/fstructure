import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { watchServiceWorker, watchStaleChunks } from './shared/appUpdate';
import { flushPendingWritesOnHide } from './shared/pendingWrites';
import './design-system/fstructure.css';
import './design-system/softClay.css';

const root = document.getElementById('root');
if (!root) throw new Error('FStructure root element is missing.');

createRoot(root).render(<StrictMode><App /></StrictMode>);

/* Al cerrar u ocultar la pestaña, el último cambio no espera su autoguardado. */
flushPendingWritesOnHide();
/* Un chunk que ya no existe (otra pestaña activó una versión nueva): se guarda y se recarga una vez. */
watchStaleChunks();

/* Instalada o no, la app abre sin conexión después de la primera visita: el
   service worker guarda el código en el dispositivo (no envía nada). Se
   registra cuando la página ya cargó, para no competir con el primer dibujo.
   Una versión publicada después espera hasta que la persona pulsa «Recargar». */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').then((registration) => watchServiceWorker(registration)).catch(() => undefined);
  });
}
