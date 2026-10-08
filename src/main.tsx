import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './design-system/fstructure.css';

const root = document.getElementById('root');
if (!root) throw new Error('FStructure root element is missing.');

createRoot(root).render(<StrictMode><App /></StrictMode>);

/* Instalada o no, la app abre sin conexión después de la primera visita: el
   service worker guarda el código en el dispositivo (no envía nada). Se
   registra cuando la página ya cargó, para no competir con el primer dibujo. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}
