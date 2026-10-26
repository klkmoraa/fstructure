# FStructure · Canvas y flujo táctil · 26 de octubre de 2026

**Estado: implementación, revisión independiente y verificación integrada completas.**

Esta entrega mejora el trabajo desde el teléfono en las tres mesas. Conserva el canon v2.0.0 de FusionStructure, el acento de Análisis y el claymorfismo funcional. El cambio se concentra en apuntar, navegar, editar y volver al dibujo con el contexto intacto.

## Decisiones de interacción

| Fricción observada | Cambio | Contrato que se conserva |
| --- | --- | --- |
| Nudos y barras exigían demasiada precisión con el dedo. | Captura táctil de 44 px; entre geometrías del mismo tipo se prioriza la más cercana al punto tocado. | El trazo visible, las coordenadas y la prioridad entre tipos de objeto se mantienen. |
| Elegir objetos superpuestos exigía mantener pulsado. | El primer toque selecciona; el segundo sobre una selección ambigua abre la lista de coincidencias. Una pista breve explica el gesto. | La lista previsualiza y exige confirmar; la pulsación larga sigue disponible. |
| Un movimiento final no comunicado por el navegador podía interpretarse como toque. | La posición de liberación también determina si hubo arrastre. Un pellizco o una cancelación no coloca ni modifica geometría. | Sólo una acción deliberada cambia el modelo. |
| La lista de coincidencias podía quedar detrás de la cápsula del dock. | Lista con scroll propio y acciones accesibles; la cápsula se aparta mientras se elige. | El dock principal y la navegación por teclado siguen disponibles. |
| Diseño trataba las vistas del teléfono como interruptores. | Dibujo, Datos y Resultados seleccionan una vista estable; Datos y Resultados ofrecen regreso explícito al dibujo. | Los campos permanecen montados, y girar el teléfono conserva la tarea activa. |
| La viga tenía un formulario largo sin accesos directos. | Accesos a Claros y cargas, Sección y Armado, con foco en el apartado sin abrir el teclado. | Se reutilizan los campos, validaciones y cálculos existentes. |
| El zoom de Diseño dependía del pellizco. | Botones − / porcentaje / +, además del pellizco; el punto ampliado se mantiene bajo los dedos. | El zoom del dibujo no se guarda en el proyecto. |
| El dock 3D ocultaba todos los nombres en móvil. | Elegir, Nudo, Barra, Apoyo, Carga y Generar muestran texto y áreas táctiles amplias. | Las operaciones existentes conservan su significado. |
| Cerrar el inspector 3D podía dejar oculta la selección. | La visibilidad depende del estado real de la hoja. Editar, volver al modelo y consultar resultados mantienen la selección y la cámara. | Cancelar descarta el borrador de edición sin modificar el objeto. |
| Un segundo dedo podía iniciar una selección o una colocación 3D. | La cámara recibe los gestos múltiples; arrastrar en planta desplaza y un toque selecciona. | La selección por ventana con ratón sigue disponible. |
| El ajuste al teclado sólo estaba conectado al modo 2D. | Los tres modos comparten VisualViewport. Diseño usa el alto visible y el inspector 3D se eleva sobre el teclado. | El zoom de página no se confunde con un teclado abierto. |
| El cierre y los campos se perdían al recorrer el inspector. | Cabecera persistente con Ampliar/Reducir y Cerrar; el campo enfocado se revela dentro de su panel. | No se desplaza el documento ni se reencuadra el canvas. |

## Criterios de diseño e ingeniería

Se aplican las guías originales de Emil: [emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md), [apple-design](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md) y [mobile-native](https://github.com/emilkowalski/skills/blob/main/skills/mobile-native/SKILL.md), junto con las skills de ingeniería TypeScript/React y accesibilidad de visualizaciones. Superpowers organiza el trabajo por ámbitos, la revisión y la verificación previa al cierre.

La geometría técnica permanece plana. El relieve distingue botones, campos, paneles y selección; no cambia colores de cargas ni señales de resultados. Los controles nuevos reutilizan tokens de tipografía, radio, materia y foco. Los campos táctiles mantienen al menos 16 px; las acciones principales del teléfono tienen objetivos de 44 px o mayores. El estado de gestos, vistas y ampliación de panel es temporal y no se añade al archivo del usuario.

No se modifican los motores estructurales, las normas de diseño, los formatos de guardado ni los puentes entre territorios. La exportación PDF sigue requiriendo una acción explícita.

## Evidencia

| Verificación integrada | Resultado |
| --- | --- |
| `npm run verify` | Typecheck, lint de 31 archivos y 478 pruebas relacionadas en 86 archivos, correctos. |
| `npm run check` | 1,572 pruebas en 224 archivos, 20 pruebas de arquitectura, siete casos del oráculo Python y build, correctos. |
| `npm run lint:design` | Guía de diseño en línea. |
| `npm run smoke` | 64/64 pantallas: 390 y 1440 px, Día y Noche; sin overflow horizontal ni errores de página/consola. |
| `git diff --check` | Sin errores. |

Recorridos completados en Chromium aislado:

| Caso | Resultado observado |
| --- | --- |
| 2D · Día/Noche, 390 × 844 | Captura a 21 px del centro del nudo y 20 px del eje de barra; coincidencias, previsualización y confirmación. Pan y pinch conservan exactamente el modelo guardado. |
| Coincidencias densas · 390 × 844 y 390 × 560 | Trece candidatos, scroll interior, navegación hasta el último con End y confirmación de 44 px alcanzable. |
| 3D · 390 × 844, 844 × 390 y 1440 × 900 | Dock nombrado, Editar/Resultados, cierre y reapertura con selección/cámara; multitouch sin colocar nudos. Sin overflow ni errores de página. |
| Viga desde Inicio · 390 px Día y 320 px Noche | Claro de 5.5 m, CM de 12.5 kN/m, sección de 30 × 55 cm y cuatro barras inferiores conservados al guardar en memoria, reabrir y recargar completamente el proyecto. La URL conserva el mismo proyecto. |
| Datos → Dibujo → Datos | Scroll conservado: 1274 → 1274 a 390 px; 1300 → 1300 a 320 px en el recorrido desde Inicio. |
| Resultados y orientación | La vista elegida permanece al girar a 844 × 390 y volver. |
| PDF de la viga | Ninguna descarga previa a Exportar. Dos PDFs descargados y abiertos con `pdf-lib`: siete páginas cada uno y aproximadamente 276 kB. |
| Zoom de Diseño | Botones, pellizco y desplazamiento con dos dedos al 300 %; el zoom de página sigue en 1 durante el gesto del dibujo. |
| Teclado simulado | A 320 px y 460 px de alto visible, campo entre y347–391 y vistas entre y403–460. En 3D, hoja y campo enfocado dentro de los 480 px visibles; el foco vuelve a Editar al cerrar. |
| Revisión independiente | Sin hallazgos bloqueantes en selección, cancelación, foco, multitouch, zoom, giro ni aislamiento de datos. |

Las pruebas de teclado usan reducción controlada del área visible; no equivalen a un teclado físico de iOS. La prueba existente de resortes 3D ahora busca Resultados dentro del Centro analítico, porque el HUD añade otra acción legítima con ese nombre. Conserva sus comprobaciones de reacción, deshacer/rehacer, guardado y reapertura.

**Pendiente en dispositivo real:** Safari en iPhone, barras del navegador, áreas seguras, teclado después de ampliar la página, PWA instalada y hoja nativa de compartir el PDF.


## Capturas finales

Siete capturas de teléfono a 390 × 844 px y una en horizontal a 844 × 390 px.

| Vista | Captura |
| --- | --- |
| 2D · selección, Día | [touch-2026-10-26-2d-selection-light.png](assets/touch-2026-10-26-2d-selection-light.png) |
| 2D · coincidencias, Noche | [touch-2026-10-26-2d-picker-dark.png](assets/touch-2026-10-26-2d-picker-dark.png) |
| 3D · acciones contextuales, Día | [touch-2026-10-26-3d-selection-light.png](assets/touch-2026-10-26-3d-selection-light.png) |
| 3D · editor, Noche | [touch-2026-10-26-3d-editor-dark.png](assets/touch-2026-10-26-3d-editor-dark.png) |
| Viga · dibujo, Día | [touch-2026-10-26-beam-drawing-light.png](assets/touch-2026-10-26-beam-drawing-light.png) |
| Viga · datos, Día | [touch-2026-10-26-beam-data-light.png](assets/touch-2026-10-26-beam-data-light.png) |
| Viga · resultados, Noche | [touch-2026-10-26-beam-results-dark.png](assets/touch-2026-10-26-beam-results-dark.png) |
| Viga · resultados en horizontal, Noche | [touch-2026-10-26-beam-landscape-dark.png](assets/touch-2026-10-26-beam-landscape-dark.png) |
