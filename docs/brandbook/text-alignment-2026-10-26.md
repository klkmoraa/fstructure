# FStructure · Encuadre y alineación de texto · 26 de octubre de 2026

**Estado: correcciones implementadas, revisión independiente cerrada y verificación integrada completa.**

Esta revisión continúa la [mejora del canvas y flujo táctil](mobile-canvas-flow-2026-10-26.md). Revisa el contenido dentro de su marco: centrado de acciones, filas de campos, nombres completos, cifras, cotas y espacio disponible. Conserva el canon de FusionStructure, sus fuentes y materia.

## Alineación según la función

Los botones, iconos de acción, segmentos y cifras de los recuadros del canvas se centran en su superficie. Los títulos móviles de Diseño se centran respecto al panel completo, con espacios laterales simétricos. Etiquetas, descripciones e identificadores mantienen alineación de lectura a la izquierda; las columnas numéricas conservan alineación a la derecha y cifras tabulares.

## Correcciones y evidencia

| Superficie | Antes | Después |
| --- | --- | --- |
| Tarjetas de Inicio | Las descripciones empezaban a 52 o 55 px del borde superior según las líneas del título. | Una reserva común para el título deja todas a 56 px en 320 y 390 px. Icono y título siguen centrados entre sí. |
| Selectores compartidos | 60 px de relleno lateral reducían demasiado el espacio del valor. | 34 px de reserva total, flecha del token de 14 px y separación explícita; valores y unidades conservan su tamaño legible. |
| Inspector móvil | La regla de la barra superior quitaba el relleno de Ampliar y pegaba el texto al borde. | Relleno propio de 12 px; icono y palabra no se contraen. |
| Cifras SVG del Modelo 2D | Desplazamientos de hasta 6.34 px; seis cifras excedían la reserva medida. | Centro del rectángulo como anclaje horizontal y vertical; las ocho variantes medidas dan dx = 0, dy = 0 y texto dentro de su reserva. |
| Distribución en 2D horizontal | El margen simétrico de la cámara también recortaba una franja libre para los rótulos. | Área específica de rótulos: 50 px adicionales en el caso de 844 × 390, sin mover la cámara. La búsqueda acotada encuentra huecos fuera de los anillos locales y mantiene las guías hacia cada origen. |
| Selector de apoyos | Cinco nombres cortados a 320 px y cierre demasiado pequeño. | Dos o cuatro columnas según espacio, ocho nombres completos, reservas uniformes de texto y cierre de 44 × 44 px. |
| Edición de carga y coincidencias | Las acciones de la carga saltaban a otra fila; Cancelar y Confirmar tenían distinta alineación. | Valor y acciones comparten fila a 320 px; ambas confirmaciones quedan centradas. |
| Cabeceras de Diseño | A 320 px, Datos desplazaba el título 15.64 px y Resultados, 41.64 px. | Laterales simétricos: centro geométrico con diferencia de 0 px en las 36 combinaciones móviles medidas. |
| Campos de Diseño | Una etiqueta de dos líneas bajaba su valor respecto al campo vecino. | Filas compartidas de etiqueta, control y ayuda mediante subgrid local. |
| Segmentos y opciones técnicas | Objetivos, apoyos y nombres de métodos recortados. | Texto completo y centrado; controles largos ocupan el ancho necesario. Los grupos de diámetros usan una columna hasta 360 px. |
| Dibujos de Columna y Zapata | La cota h o el eje Y salían del SVG. | Márgenes de anotación en el marco; coordenadas estructurales y de armado intactas. |
| Selector de piezas | La pieza activa podía quedar fuera del dock horizontal a 320 px. | Se revela únicamente mediante el scroll horizontal del selector; no cambia el scroll del documento, del dibujo o de los datos. |
| Menús 3D | Cuatro nombres de menú competían por unos 36.5 px cada uno a 320 px. | Fila propia de unos 61 px por nombre; contador separado del texto. A 390 px permanece la fila compacta. |
| Generador 3D | El ancho intrínseco del prompt podía superar el diálogo y desplazarlo horizontalmente. | Tracks limitados al ancho real, acción en fila propia en móvil y sugerencias distribuidas por columnas. |
| Tarjetas, formularios y tablas 3D | Iconos, títulos y campos cambiaban de altura; encabezados de identificadores no seguían su columna. | Iconos en fila común, títulos centrados, campos emparejados e identificadores/encabezados alineados por función. |
| 3D horizontal | La selección quedaba limitada a 66 px; el menú cubría parcialmente una cifra de carga. | HUD con 144 px útiles en el caso medido; margen superior ajustado para dejar el rótulo completo. |

## Seguridad de la interacción

Ampliar el selector de apoyos reveló un caso de compatibilidad táctil: el click posterior al pointerup podía caer sobre una opción recién montada. La apertura se difiere al siguiente frame; abrir la hoja no cambia el apoyo. La prueba exige otra elección explícita para modificarlo.

El desplazamiento del selector de piezas sólo modifica su `scrollLeft`. La prueba y el recorrido conservan el zoom al 125 %, el scroll del dibujo de 100 a 100, el de los datos de 200 a 200 y el documento en (0, 0).

La franja ampliada del canvas reserva también la intersección real de la cápsula contextual con el SVG. Se mide cuando cambia la interfaz, sin añadir lecturas del DOM a cada frame de pan o zoom. La revisión independiente repitió la selección de N1 y su desplazamiento hasta 18 px del borde inferior: cero intersecciones con la cápsula y 8.87 px libres bajo la etiqueta del nudo.

La búsqueda adicional está acotada a 64 intentos de bordes por reparto y una rejilla de hasta 25 × 17 posiciones por tamaño no agotado. El caso de pórtico horizontal conserva sus 16 cifras, con cero colisiones en Día y Noche. En una prueba extrema, al llevar ese pórtico al borde inferior con la cápsula abierta, las 17 cifras obligatorias permanecen y no invaden controles; cinco pares aún coinciden entre sí. Ese caso saturado requiere acercar o reencuadrar. No se descartan valores obligatorios para ocultar la saturación.

No se modifican cálculos, normas, unidades, resultados, geometría estructural ni formato de guardado.

## Verificación

La matriz de Diseño cubre seis piezas a 320, 390, 844 y 1440 px, Día/Noche: 48 estados con fuentes cargadas y medición explícita de la fuente. Se revisan también columna circular, cinco cimentaciones, seis formas de sección y los controles de sus diagramas. Los ocho escenarios del 3D recorren generador, ejemplo, selección, edición, cancelación, análisis y resultados. El canvas 2D se comprueba en los mismos cuatro tamaños y ambos temas.

La medición del reparto de etiquetas usó Chromium con CPU ralentizada 4×, 30 muestras de cinco repartos y orden alternado. El pórtico real pasó de una mediana de 4.49 a 4.20 ms; el caso saturado de 48 cifras pasó de 25.55 a 28.28 ms. El coste adicional de búsqueda se observa en saturación. La máquina era compartida y estas medidas no equivalen al rendimiento de un teléfono físico.

| Comprobación final | Resultado |
| --- | --- |
| `npm run verify` | Typecheck, lint de 18 archivos y 339 pruebas relacionadas en 46 archivos, correctos. |
| `npm run check` | 1,582 pruebas en 225 archivos, 20 pruebas de arquitectura, siete casos del oráculo Python y build, correctos. |
| `npm run lint:design` | Guía de diseño en línea. |
| `npm run smoke` | 64/64 pantallas: 390 y 1440 px, Día/Noche, sin desbordamiento horizontal ni errores de página/consola. |
| Revisión independiente | Reserva de la cápsula corregida y reproducida; sin bloqueadores pendientes. |

Se mantienen cuatro avisos de optional chaining ya existentes en `promoteProject.test.ts`, los avisos de canvas de jsdom y los avisos de tamaño de chunks/importación dinámica del build. No son errores nuevos de esta revisión.

Las medidas proceden de Chromium aislado; la prueba física de Safari/iPhone, teclado y áreas seguras sigue pendiente.

## Capturas finales

| Vista | Captura |
| --- | --- |
| Inicio · tarjetas a 320 px | [align-2026-10-26-home-320-light.png](assets/align-2026-10-26-home-320-light.png) |
| Modelo 2D · cifras centradas | [align-2026-10-26-2d-labels-light.png](assets/align-2026-10-26-2d-labels-light.png) |
| Modelo 2D · cifras en horizontal | [align-2026-10-26-2d-landscape-light.png](assets/align-2026-10-26-2d-landscape-light.png) |
| Modelo 2D · cápsula y etiquetas separadas | [align-2026-10-26-2d-capsule-landscape-light.png](assets/align-2026-10-26-2d-capsule-landscape-light.png) |
| Modelo 2D · apoyos a 320 px | [align-2026-10-26-2d-supports-320-light.png](assets/align-2026-10-26-2d-supports-320-light.png) |
| Secciones · datos a 320 px | [align-2026-10-26-section-320-dark.png](assets/align-2026-10-26-section-320-dark.png) |
| Flexión · opciones completas | [align-2026-10-26-flexure-320-light.png](assets/align-2026-10-26-flexure-320-light.png) |
| Columna · cotas dentro del marco | [align-2026-10-26-column-dark.png](assets/align-2026-10-26-column-dark.png) |
| Modelo 3D · generador a 320 px | [align-2026-10-26-3d-generator-320-light.png](assets/align-2026-10-26-3d-generator-320-light.png) |
| Modelo 3D · inspector a 320 px | [align-2026-10-26-3d-inspector-320-light.png](assets/align-2026-10-26-3d-inspector-320-light.png) |
| Modelo 3D · cifra completa en horizontal | [align-2026-10-26-3d-landscape-dark.png](assets/align-2026-10-26-3d-landscape-dark.png) |
