# Diagrama axial y mapa de fluencia — diseño (20-oct-2026)

## Objetivo
Conservar el diagrama axial clásico de las armaduras **y** la nueva lectura por estado, identificando tracción positiva en azul y compresión negativa en rojo. Hacer entendible y recuperable el mapa de demanda/fluencia sin confundir una estimación elástica con una verificación de resistencia.

## Requisitos
- El diagrama N completo se dibuja en el lienzo para barras de armadura, con la forma y ordenadas calculadas por el solver, y aparece en el panel Resultados > Axial. No lo reemplaza la tabla T/C/0.
- Tensión (+): azul sólido. Compresión (−): rojo discontinuo. Axial ~0: neutro y punteado. El diagrama cambia de color exactamente en N=0; debe conservar el sentido de ordenadas y la lectura por cursor. No cambia resultados estructurales ni persistencia.
- Fluencia: ficha visible en el riel de Evidencia. Al seleccionarla se muestra el índice **η = (|N*|/A + |M*|/W) / Fy**, según los valores evaluables ya previstos; es experimental y no implica pandeo, diseño por norma, ni fallo estructural.
- Escala continua y interpretable en 0–2 de η, referencia etiquetada η=1 / 100% Fy, marcadores para máximo evaluado y selección, cobertura explícita y condición no evaluada separada de 0.
- Cambiar Axial ↔ Fluencia no modifica el modelo ni pierde la capa solicitada. Con Diagramas activos, tocar Axial o Fluencia debe cerrar Diagramas y aplicar la lectura elegida.
- Accesibilidad: patrón/texto además del color, nombres accesibles de controles, lector de barra/tabla, móvil Día/Noche sin solapamientos.

## Componentes y restricciones
Reutilizar `analysis.memberResults`, `trussAxialReadings`, `elasticDemandView`, `resultTab` y `editorLayers`; una sola fuente de signo axial y un solo mapa de demanda. Nuevas vistas viven en `src/features/canvas/TrussAxialPresentation.tsx`, `CanvasResultLayer.tsx`, `ElasticDemandLegend.tsx`, `ResultsPanel.tsx`. Tokens cromáticos semánticos en `src/design-system/tokens.css`. No modificar solver, geometría o documentos de proyecto.

## Validación
Pruebas unitarias de clipping en N=0 y lado invertido; N constante, variable y nulo; cursor, salto e interacción entre riel y resultados; índice máximo real, selección, cobertura parcial y ausencia de datos; verificación completa de CI y comprobación visual en tamaños móvil/escritorio, Día/Noche.

## Decisión de diseño
Mantener dos capas complementarias: el diagrama N comunica la distribución y el color sobre barra comunica rápidamente el estado. El mapa de fluencia es una lectura separada porque sus colores expresan magnitud de demanda, no el signo axial.
