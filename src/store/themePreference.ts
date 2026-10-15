import { useEffect, useState } from 'react';
import type { ThemeMode } from '../types';

const THEME_STORAGE_KEY = 'fusionstructure.theme';

/**
 * Tema inicial. La fusión había clavado el valor a `'light'` con un `setTheme`
 * vacío, así que el conmutador del producto y el comando de la paleta existían
 * pero no hacían nada. El orden es: lo que el usuario eligió aquí antes, y si
 * nunca eligió, lo que pide el sistema.
 */
const readPreferredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* almacenamiento bloqueado: se decide por preferencia del sistema */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Tema Día/Noche: lo aplica al documento y recuerda la elección en este dispositivo. */
export function useThemePreference() {
  const [theme, setTheme] = useState<ThemeMode>(readPreferredTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* modo privado: el tema vive sólo en memoria */ }
  }, [theme]);
  return [theme, setTheme] as const;
}
