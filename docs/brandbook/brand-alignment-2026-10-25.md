# FStructure · Alineación de marca · 25 de octubre de 2026

**Estado: implementación y matriz visual verificadas.**

La entrega reúne la interfaz de Home, Modelo 2D, Modelo 3D y Diseño bajo la materia, la tipografía y los roles de color de FusionStructure. El claymorfismo expresa cómo se usa cada superficie: controles, paneles y hojas tienen profundidad; lienzos, diagramas y tablas permanecen planos para facilitar la lectura y la comparación.

## Referencias y prioridad

- **Canon:** [FusionStructureBrand · tokens.json v2.0.0](https://github.com/klkmoraa/FusionStructureBrand/blob/21e845669498b132c5a8e23a08ec1e6af65a878e/tokens/tokens.json), revisión `21e845669498b132c5a8e23a08ec1e6af65a878e`. Define neutros Día/Noche, familias, señales, tipo, radios, luz y movimiento; la familia Análisis aporta el acento y los roles del producto adaptan la lectura y la densidad técnica.
- **Emil, fuentes originales:** [emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md), [apple-design](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md) y [mobile-native](https://github.com/emilkowalski/skills/blob/main/skills/mobile-native/SKILL.md). Orientan respuesta, estados, movimiento y adaptación táctil. `apple-design` es una guía de interacción, no un ejecutable de lint ni una certificación de Apple.
- **Apple HIG:** [accesibilidad](https://developer.apple.com/design/human-interface-guidelines/accessibility), [botones](https://developer.apple.com/design/human-interface-guidelines/buttons), [layout](https://developer.apple.com/design/human-interface-guidelines/layout) y [movimiento](https://developer.apple.com/design/human-interface-guidelines/motion). Se aplican legibilidad, foco, control del usuario y áreas seguras, conservando las fuentes y la arcilla del canon.
- **Implementación:** [tokens](../../src/design-system/tokens.css), [materia](../../src/design-system/material.css) y [componentes](../../src/design-system/components/ui.css). El proceso usa revisión por ámbitos y verificación antes del cierre, conforme al flujo de Superpowers y a `AGENTS.md`.

## Alcance de la entrega

| Ámbito | Superficies ajustadas |
| --- | --- |
| Home | Navegación, tarjetas, nuevo ejercicio, Proyectos, Biblioteca y constructor de perfiles. |
| Modelo 2D | Barra común, dock y cápsula móvil, menús, chrome del lienzo, Inspector, Resultados y tablas de edición. |
| Modelo 3D | Barra de herramientas, dock, controles de vista, Inspector, resultados, menús y generador. La previsualización estructural usa tinta de geometría. |
| Diseño | Entrada de piezas, taller, estudio de sección, Memoria, formularios y controles de resultados. |
| Editores auxiliares | Perfiles, rigidez, favoritos, apoyos, edición masiva, generador, Model Doctor, cantidades, revisión de acero, comparaciones, comandos, PDF e importación DXF. |

La cobertura describe los componentes modificados. No implica una certificación de cada combinación de datos, navegador o dispositivo.

## Antes / Después / Por qué

| Antes | Después | Por qué |
| --- | --- | --- |
| Controles y paneles conservaban anulaciones de sombra de la etapa plana. | Relieve, cavidad y flotación asignados por función, con una sola luz superior izquierda. | La profundidad indica interacción y jerarquía. |
| Radios de tarjeta aplicados a campos y botones, con valores aislados. | Roles de 6, 12, 18 y 24 px; píldora de 999 px cuando corresponde. | Una forma coherente permite reconocer controles equivalentes. |
| Escala global de texto comprimida; body de 12.5 px y UI de 12 px. | Escala canónica en `rem`: lectura de 16 px, UI de 14 px y datos de 12.5 px al tamaño raíz habitual. | Se separa lectura general de densidad técnica. |
| Tintas secundarias oscuras y señales usadas como texto pequeño. | Jerarquía neutral Día/Noche y tinta legible separada del color gráfico de la señal. | El contraste del texto no depende de una línea pensada para el diagrama. |
| Algunos primarios tenían texto blanco; hover y pulsación oscurecían el salmón. | Carbón sobre el relleno canónico de Análisis; los estados se distinguen por luz, borde y hundimiento. | Conserva legibilidad en reposo, hover y pulsación. |
| Hover sin comprobar capacidad del puntero y reglas que pisaban `active`. | Hover limitado a `hover: hover` y `pointer: fine`, con prioridad del estado pulsado. | Evita estados pegados al tocar y confirma la presión de inmediato. |
| Algunos controles pequeños y anillos de foco confundidos con la sombra. | Áreas táctiles ajustadas a 44 px y foco de 2 px separado del borde. | Facilita apuntar y mantiene visible la navegación por teclado. |
| Desplazamientos de pulsación persistían con movimiento reducido. | `prefers-reduced-motion` elimina el desplazamiento y conserva la señal mediante borde y luz. | El estado sigue siendo perceptible sin movimiento. |
| La cápsula de selección podía desbordar a 320 px al ampliar sus acciones. | Cinco teclas de 44 × 44 px; sólo el identificador puede contraerse con elipsis. | Preserva acceso a las acciones en una pantalla estrecha. |

## Contrato visual aplicado

**Color y temas.** Papel `#F7F6F1`, superficie `#FFFEFA` y tinta `#14171A` en Día; carbón `#14171A`, superficie `#1B1F22` y tinta `#F2F4F3` en Noche. Análisis usa `#ED4B46` / `#FF8E80`, con `#C23A33` para texto de acción en Día y carbón sobre el relleno. En Noche, texto secundario y muted recuperan `#B4BDC0` y `#8B9599`; la señal de deformada corresponde a `#9B87FF`.

**Señales y datos.** N, M, V, Δ, Fy y atención conservan sus roles gráficos; el acento del producto no sustituye un resultado. Los aliases de tinta para etiquetas y cifras usan la tinta principal del tema. Los gráficos conservan su codificación, las cargas su familia propia y los resultados sus símbolos, signos y unidades. Las etiquetas del visor 3D usan además texturas sRGB para que el renderizado conserve la tinta del tema, sin aclararla. Las seis señales de Día miden aproximadamente 3.27–4.20:1 sobre `#FFFEFA`: son útiles como trazo, pero no justifican usarlas como único color de un texto pequeño.

| Nivel | Uso | Materia y forma |
| --- | --- | --- |
| Plano | Lienzo, gráfico, tabla, cifra y contenido dentro de un panel. | Sin relieve añadido al dato; radio de datos sólo donde corresponde. |
| Cavidad | Campo editable, selector y bandeja de controles. | `shadow-inset`; radio de control de 12 px. |
| Elevado | Botón, tarjeta y panel de trabajo. | `shadow-xs` o `shadow-raised`; radios de 12, 18 o 24 px según el rol. |
| Flotante | Menú, popover y controles superpuestos al lienzo. | `shadow-floating` y borde que separa del contenido inferior. |
| Hoja / modal | Tarea superpuesta y panel que nace de un borde. | `shadow-sheet` o `shadow-modal`; hoja de 18 px y modal de 24 px. |
| Pulsado / seleccionado | Acción durante la presión o elección persistente. | Cavidad; selección con borde/anillo de acento, además del estado semántico. |

**Pintura técnica.** Las cifras del visor 3D usan tinta de tema y texturas sRGB. Viga y Pórtico tienen marcadores SVG explícitos para las puntas puntuales y distribuidas; sus tonos coinciden con las astas sin depender de `context-stroke`. No se modifican geometrías ni valores del cálculo.

**Tipografía.** Inter para interfaz, Space Grotesk para títulos e IBM Plex Mono para datos; cifras tabulares. El tamaño raíz habitual produce cuerpo de 16 px, UI de 14 px, datos de 12.5 px y etiquetas de 10.5 px. La escala de títulos se aplica según el espacio disponible; los lienzos y las tablas conservan su densidad funcional.

**Interacción y accesibilidad.** Feedback corto con los tokens de 90/140 ms; cambios de contexto de 200/280 ms. Trazado y espera mantienen sus roles separados. Los controles táctiles ajustados usan el objetivo de 44 px; los inputs conservan un mínimo de 16 px en puntero grueso. Foco visible, `prefers-reduced-motion`, contraste aumentado y transparencia reducida tienen tratamiento explícito. Se preservan `viewport-fit=cover`, `100dvh`, `env(safe-area-inset-*)` y la gestión existente de VisualViewport para el teclado; el zoom de página permanece disponible fuera del lienzo.

## Verificación y límites

| Evidencia | Resultado |
| --- | --- |
| `npm run verify` | Correcto tras los últimos cambios: tipos, lint de 6 archivos, 314 pruebas relacionadas en 46 archivos y arquitectura. |
| `npm run check` | Correcto: 1,545 pruebas en 218 archivos, 20 pruebas de arquitectura, 7 casos del oráculo Python y build. |
| `npm run lint:design` | Correcto: las 31 reglas existentes están en línea. |
| `npm run smoke` | 64/64 vistas correctas: 16 pantallas a 390 y 1440 px, Día y Noche; sin errores de página/consola ni overflow horizontal. |
| Auditoría de dependencias | `npm audit --audit-level=high --omit=dev`: 0 vulnerabilidades. |
| Recorridos integrados de navegador | Correctos a 320 × 740, 390 × 844, 768 × 1024, 844 × 390 y 1440 × 900: navegación/Atrás, análisis de viga, dock y regreso del foco; mesas 3D/Diseño adicionales. Sin overflow horizontal ni errores de ejecución. |
| Cápsula móvil con cinco acciones y chip `M100` | Comprobación aislada en Chromium a 320 y 390 px: sin desbordamiento, cinco teclas de 44 × 44 px. No sustituye la matriz integrada. |

Después de la matriz global, se revisaron los marcadores SVG explícitos: 46 flechas a 390 px/Noche y 60 a 1440 px/Día, sin diferencias entre color de punta y asta. El visor 3D se comprobó en ambos temas con sus cifras y gráficos conservados. La revisión independiente por ámbitos terminó sin hallazgos pendientes.

La suite existente de conversión de un archivo individual a proyecto ahora espera la sincronización efectiva de la URL; conserva las comprobaciones de copia persistida y original intacto. La auditoría de diseño distingue los avisos de estilo de un fallo al ejecutar su runner.

**No verificado en Safari ni en iPhone físico.** Quedan para dispositivo real el teclado tras ampliar la página, áreas seguras, barras del navegador, orientación y modo PWA instalada. La emulación de Chromium no acredita esos comportamientos.

## Capturas de esta entrega

Capturas de la aplicación con Chromium. Las seis vistas de teléfono usan 390 × 844 px y la de escritorio, 1440 × 900 px.

| Vista | Captura |
| --- | --- |
| Home · Día | [brand-2026-10-home-light.png](assets/brand-2026-10-home-light.png) |
| Home · Noche | [brand-2026-10-home-dark.png](assets/brand-2026-10-home-dark.png) |
| Modelo 2D · Noche | [brand-2026-10-model-dark.png](assets/brand-2026-10-model-dark.png) |
| Herramientas · Noche | [brand-2026-10-tools-dark.png](assets/brand-2026-10-tools-dark.png) |
| Modelo 3D · Día | [brand-2026-10-space3d-light.png](assets/brand-2026-10-space3d-light.png) |
| Diseño de viga · Noche | [brand-2026-10-beam-design-dark.png](assets/brand-2026-10-beam-design-dark.png) |
| Estudio de sección · escritorio Día | [brand-2026-10-section-desktop-light.png](assets/brand-2026-10-section-desktop-light.png) |
