/**
 * Cuánto ocupa el panel de Resultados contado desde el borde inferior de la
 * ventana hasta su propio techo.
 *
 * El riel flotante de herramientas se anclaba a una constante contra ese borde
 * —ningún antepasado suyo está posicionado—, así que era ciego al panel: con
 * Resultados desplegado el riel caía dentro y tapaba la explicación del índice
 * elástico, y con el panel plegado tapaba media banda del centro analítico.
 * El panel publica esta medida como `--results-band` y el riel se apoya en ella.
 *
 * Vive fuera del componente porque es aritmética, no interfaz: así se prueba
 * sin montar el panel ni fingir un `ResizeObserver`.
 */
export const resultsBandPx = (viewportHeight: number, panelTop: number): number => {
  if (!Number.isFinite(viewportHeight) || !Number.isFinite(panelTop)) return 0;
  // Un techo por encima de la ventana (panel más alto que la pantalla) no puede
  // devolver una banda mayor que la ventana: el riel se iría fuera por arriba.
  return Math.round(Math.min(Math.max(0, viewportHeight - panelTop), Math.max(0, viewportHeight)));
};
