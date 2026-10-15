# Referencias visuales, comunidad y licencias de FStructure

Consulta de fuentes primarias: 14 de octubre de 2026. No se descargaron capturas ni activos externos y no se copió código. Los estados de GitHub son los que mostraban las páginas al consultar; los enlaces permiten revisar cambios posteriores.

## Pregunta 1 · ¿Qué patrones visuales pueden orientar V1–V9 sin apartarse del canon de FStructure?

### Resumen

Las fuentes útiles aportan reglas puntuales: separar primer uso de cero resultados y error, evitar solapamientos de etiquetas, conservar el espacio de lectura de una tabla y hacer los controles presentes cuando el dispositivo no tiene hover. Son referencias de comportamiento; la aplicación debe conservar los tokens, la tipografía, las señales estructurales y los controles del canon FStructure.

### Hallazgos con fuentes

- Carbon Design System, patrón de estados vacíos (página actualizada el 11-08-2026): propone títulos positivos, una acción principal contextual y tratamientos distintos para primer uso, acción sin resultados y error. En tablas, el mensaje sustituye el contenido vacío; no conserva encabezados sin datos. [Carbon: Empty states](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states)
- Carbon Data table (Stable; página actualizada el 30-09-2026): describe ordenamiento, expansión progresiva de filas, selección/acciones por fila y una barra de herramientas para botones, búsqueda, filtros y opciones. Define cinco alturas de fila (24, 32, 40, 48 y 64 px) y recomienda igualar la altura del encabezado con la de las filas. En móvil/táctil mantiene visibles los menús de acciones cuando el navegador no admite hover. No publica en esta página una regla completa para reflujo de tabla a tarjetas. [Carbon: Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines)
- Cloudscape distingue “sin recursos” de “sin coincidencias después de filtrar”; en el segundo estado muestra “Clear filter”. También recomienda contador de recursos y una acción de avance. La guía indica fecha de publicación 19-05-2020. [Cloudscape: Empty states](https://cloudscape.design/patterns/general/empty-states/)
- Supabase diferencia estado inicial y cero resultados, recomienda mantener la forma visual de la lista para un estado informativo en tablas y considerar el salto de layout entre carga y resultado. La página consultada no muestra versión o fecha editorial. [Supabase: Empty states](https://supabase.com/design-system/docs/ui-patterns/empty-states)
- Guidewire Jutro 10.13 explica carga, vacío, error y filas seleccionadas/expandidas; recomienda acción de recuperación en estados vacíos o error. Sus estados de tabla conservan la altura ocupada antes del cambio para reducir desplazamientos; el mínimo documentado por defecto es 400 px. Jutro 10.9 describe layouts responsive con 12 columnas en escritorio, 8 en tablet y 4 en móvil. [Jutro 10.13: Table states](https://docs.guidewire.com/jutro/documentation/10.13/table-states/), [Jutro 10.9: Floorplans and layouts](https://docs.guidewire.com/jutro/documentation/10.9/floorplans-layouts/)
- d3fc-label-layout 7.0.4 plantea ordenar rectángulos de etiquetas para evitar colisiones y ofrece estrategias greedy, simulated annealing y retirar las que sigan colisionando. El manifiesto declara MIT. [d3fc-label-layout README](https://github.com/d3fc/d3fc/blob/master/packages/d3fc-label-layout/README.md), [package.json 7.0.4](https://github.com/d3fc/d3fc/blob/master/packages/d3fc-label-layout/package.json)
- Vega Label Transform (documentado para Vega 5.16 o posterior) coloca etiquetas sin solaparlas entre sí y puede evitar que se crucen con las marcas del gráfico; acepta ocho anclajes alrededor de la marca. [Vega: Label transform](https://vega.github.io/vega/docs/transforms/label/)
- Vega-Lite documenta marcas de texto con posición, offsets `dx`/`dy`, alineación y límite de longitud; la página de marcas muestra cómo superponer valores a barras. No promete solución automática general de colisiones. [Vega-Lite: Text](https://vega.github.io/vega-lite/docs/text.html), [Vega-Lite: Mark](https://vega.github.io/vega-lite/docs/mark.html)
- Observable Plot describe `text` para rotular marcas y barras. Reconoce que etiquetas de demasiados puntos se solapan y propone filtrar qué puntos se rotulan; la guía consultada no aporta una colocación automática general. [Observable Plot: Text mark](https://old.observablehq.com/plot/marks/text), [Observable Plot: Bar mark](https://old.observablehq.com/plot/marks/bar)
- Excalidraw issue #3641 propone envolver el menú vertical de formas en móvil para liberar lienzo; sigue abierta con etiqueta “open for discussion; consensus not reached” (25-05-2021). Su issue meta #9705 reúne carencias de interacción táctil y tablet; sigue abierta (28-06-2025). Son reportes de usuarios, no una especificación aprobada. [#3641](https://github.com/excalidraw/excalidraw/issues/3641), [#9705](https://github.com/excalidraw/excalidraw/issues/9705)

### Interpretaciones

- Para V1 y V2 conviene definir primero el rectángulo de cada etiqueta y los tramos que no debe invadir; los métodos de d3fc/Vega son precedentes de resolución de colisión, no una orden para incorporar esas bibliotecas ni su código.
- Para V6/V7 sirve usar estados positivos y accionables, distinguiendo primer uso, filtro sin coincidencias y error. “Limpiar filtros” debe aparecer sólo cuando el filtro del usuario causó el vacío, alineado con la propuesta ya escrita para FStructure.
- Para V8, los reportes de Excalidraw justifican medir cuánto lienzo ocupa el dock y qué acciones quedan cubiertas en pantalla táctil. La documentación consultada no ofrece una receta canónica de dock para una mesa estructural; las capturas de FStructure a 390 px son la evidencia decisiva.
- Para tablas, Carbon es sólido en operaciones y controles táctiles; Jutro y Cloudscape cubren estados y responsive general. La reestructuración de filas a tarjetas sigue siendo una decisión local que debe compararse en 390 y 1440 px.
- Aplicación del canon: mantener ménsula, superficies, tipografía, tokens, radios y componentes locales de `docs/brandbook/README.md` y `src/design-system/`. FStructure es familia Análisis: el salmón es acento de acción; N/M/V/Δ/Fy/! son señales de resultado y no deben sustituirse por colores de producto. La autoridad local es [AGENTS.md](../../../../AGENTS.md) y el canon publicado es [FusionStructureBrand](https://klkmoraa.github.io/FusionStructureBrand/).

### Límites

- No se encontró en las guías seleccionadas una política común y verificable para convertir tablas complejas a tarjetas en móvil.
- No se halló una guía de un dock táctil de dibujo estructural que cubra mediciones, selección, herramientas, controles de cámara y resultados a la vez. La issue de Excalidraw documenta problemas de un producto distinto, no una solución lista para adoptar.
- Las métricas de aceptación propuestas en el documento final son umbrales de revisión para esta rama, no normas de Carbon, Cloudscape, Jutro o accesibilidad.

## Pregunta 2 · ¿Qué señales concretas aportan las issues y discusiones de Excalidraw, PyNite, Frame3DD y anaStruct?

### Resumen

Hay evidencia primaria de necesidades sobre menús táctiles, salida de gráficas en distintos entornos, etiquetas/resultados y visualización de armaduras. Frame3DD no tiene issues abiertas en su repositorio principal, por lo que se documenta expresamente esa ausencia y se usa el manual/ejemplos oficiales como evidencia alternativa, sin presentarlos como solicitudes comunitarias.

### Hallazgos con fuentes

- Excalidraw #3641: abierta desde 25-05-2021, sin consenso; describe el menú de formas vertical como ocupante de gran parte de la pantalla móvil y propone envolver elementos para recuperar espacio de lienzo. [Issue #3641](https://github.com/excalidraw/excalidraw/issues/3641)
- Excalidraw #9705: issue meta abierta desde 28-06-2025, con etiquetas mobile/tablet. Su autora agrupa carencias de multitáctil, stylus y cambio de herramienta, además de accesos de UI móvil. Los estados individuales de las issues enlazadas pueden variar; este registro sólo prueba que el tema agregado permanecía abierto al consultar. [Issue #9705](https://github.com/excalidraw/excalidraw/issues/9705)
- PyNite #136, Q&A contestada por el mantenedor el 14-11-2022: ante la pregunta por tensiones y deformaciones locales a lo largo de un miembro, responde que el modelo de barras no representa ese campo y señala los diagramas de momento, cortante y axial como el resultado visual más próximo. [Discussion #136](https://github.com/JWock82/PyNite/discussions/136)
- PyNite #180, Q&A contestada el 28-12-2023: una persona pregunta si puede usar PyNite sólo para dibujar una armadura y exportarla desde Jupyter; el mantenedor confirma que se puede renderizar sin analizar, y la persona reporta que el render abre una ventana separada en Debian/Jupyter. [Discussion #180](https://github.com/JWock82/PyNite/discussions/180)
- PyNite #106 es una caja de sugerencias iniciada por el mantenedor el 10-11-2021. En una respuesta se solicita leer/escribir hojas de Excel; es una señal de flujo de datos y prioridades, no una propuesta de etiquetas gráficas. [Discussion #106](https://github.com/JWock82/PyNite/discussions/106)
- Frame3DD `hpgavin/frame3dd` mostraba “Issues 0” al 14-10-2026; no hay una propuesta comunitaria accesible en ese tracker. Como evidencia alternativa, la página oficial del proyecto identifica análisis 2D/3D y ofrece entradas, resultados y plots de ejemplos, incluido un Pratt 2D; el manual del proyecto documenta la forma de entrada y resultados. Esto describe funciones y ejemplos del autor, no peticiones de usuarios. [Repositorio Frame3DD](https://github.com/hpgavin/frame3dd), [manual Frame3DD](https://hpgavin.github.io/frame3dd/web/Frame3DD-manual.html)
- anaStruct #42, abierta el 15-05-2020 y cerrada como completada el 31-12-2022: quien pregunta describe una armadura Warren y expresa interés en visualizar puntos de tensión y distribución de cargas junto con la carga máxima. La conversación disponible no confirma que esa capacidad se implementara a raíz de la issue. [Issue #42](https://github.com/anastruct/anaStruct/issues/42)
- anaStruct #204 sigue abierta, creada 15-10-2023: el reporte atribuye el fallo de `show_structure()` a que no se instaló Matplotlib; un colaborador aclara que el extra `anastruct[plot]` instala dependencias de trazado. Es una señal de descubribilidad/configuración, no una solicitud de nueva gráfica. [Issue #204](https://github.com/anastruct/anaStruct/issues/204)

### Interpretaciones

- Para la mesa FStructure conviene mostrar una banda/diagrama correspondiente al modelo que sí se calcula y dejar claro cuando una magnitud local no está representada por el modelo de barras; no sugerir contornos de tensiones que el motor no entrega.
- El caso PyNite sugiere que el contexto de render importa: una vista integrada en la mesa y la opción de exportar son más útiles que depender de una ventana de sistema separada.
- Los reportes de Excalidraw justifican comprobar en móvil que la barra no se coma el lienzo y que las herramientas frecuentes no dependan de hover o atajos de teclado.
- Los casos de anaStruct muestran que problemas de instalación de gráficos se perciben como fallos de resultados. En FStructure, los vacíos por falta de datos deben nombrar la causa y el siguiente paso.
- Ninguna issue externa por sí sola acredita que una característica sea necesaria o aprobada para FStructure; son señales de uso que se contrastan con las mejoras V1–V9 y el canon oficial.

### Límites

- No apareció una issue abierta específica de Frame3DD que pueda resumirse como propuesta de usuario. Se marca explícitamente la ausencia en vez de inferir una.
- Las issues de anaStruct #42 y #204 no prueban que una mejora de visualización se haya implementado; una se cerró sin historial suficiente para establecer esa relación y la otra es un problema de dependencias.
- No se revisó exhaustivamente cada issue enlazada dentro de la meta #9705; su estado individual puede ser distinto del estado del issue padre.

## Pregunta 3 · ¿Qué licencias están verificadas para PyNite, OpenSeesPy, SFAP, Frame3DD, anaStruct y d3fc-label-layout?

### Resumen

Se verifican licencias distintas: PyNite MIT, d3fc-label-layout MIT, Frame3DD GPL-3.0 y anaStruct LGPL-3.0. OpenSeesPy declara límites de uso para el wrapper/distribución comercial y su motor OpenSees lleva términos de UC Regents; no se debe tratar como una biblioteca genérica MIT/BSD. SFAP se identifica como un proyecto académico de UFOP, pero no se localizó un repositorio oficial ni una licencia verificable.

### Hallazgos con fuentes

- PyNite: repositorio `JWock82/PyNite`, rama `main`; el README/GitHub identifica licencia MIT y `setup.py` consultado informa versión 3.0.0. [PyNite](https://github.com/JWock82/PyNite), [setup.py](https://github.com/JWock82/PyNite/blob/main/setup.py), [LICENSE](https://github.com/JWock82/PyNite/blob/main/LICENSE)
- OpenSeesPy: repositorio `zhuminjie/OpenSeesPy`, rama `openseespy`; el README declara uso gratis para investigación, educación y uso interno, y exige una licencia similar a la de OpenSees.exe para redistribución comercial, incluida una app o servicio que importe `openseespy`. No se observó una versión de paquete en ese README. [OpenSeesPy README](https://github.com/zhuminjie/OpenSeesPy)
- Motor subyacente OpenSees: documentación oficial identifica a The Regents of the University of California como titular; contempla usos educativos, de investigación y entidades sin fines de lucro para fines no comerciales, uso interno para otras entidades y una licencia de UC Berkeley para distribución comercial. [OpenSees: copyright and license](https://opensees.github.io/OpenSeesDocumentation/developer/license.html)
- SFAP: el registro institucional UFOP atribuye la monografía “SFAP: um programa computacional...” a João Pedro Carneiro (2024). El catálogo CILAMCE 2025 identifica el artículo con Carneiro, Andréa Regina Dias da Silva, Walliston dos Santos Fernandes y Ricardo Azoubel da Mota Silveira. En las fuentes primarias consultadas no se identificó enlace a un repositorio oficial ni archivo de licencia; por tanto, repo/licencia quedan no verificados. [UFOP: monografía](https://monografias.ufop.br/handle/35400000/6692), [CILAMCE 2025: catálogo](https://publicacoes.softaliza.com.br/cilamce-2025/catalog/category/research-beginners/3)
- Frame3DD: el repositorio principal `hpgavin/frame3dd` identifica GPL-3.0; la página del autor señala GPL 3.0. [Frame3DD](https://github.com/hpgavin/frame3dd), [licencia del proyecto](https://github.com/hpgavin/frame3dd/blob/main/LICENSE)
- anaStruct: repositorio principal `anastruct/anaStruct`, rama `master`, identifica LGPL-3.0 y enlaza `LICENSE.txt`. Esto corrige la mención GPL-3.0 del borrador de §11. [anaStruct](https://github.com/anastruct/anaStruct), [LICENSE.txt](https://github.com/anastruct/anaStruct/blob/master/LICENSE.txt)
- d3fc-label-layout: manifiesto de `@d3fc/d3fc-label-layout` señala versión 7.0.4 y MIT; el repo `d3fc/d3fc` también declara MIT. [package.json](https://github.com/d3fc/d3fc/blob/master/packages/d3fc-label-layout/package.json), [licencia d3fc](https://github.com/d3fc/d3fc/blob/master/LICENSE)

### Interpretaciones

- Antes de usar OpenSeesPy en una app comercial o distribuir sus binarios hay que resolver la autorización de comercialización para ambos niveles relevantes: wrapper Python y motor OpenSees. La página de OpenSeesPy remite expresamente a términos similares a OpenSees.exe y a contacto con su mantenedor.
- Frame3DD y anaStruct pueden consultarse como referencias, pero copiar código o distribuir código derivado exige revisar sus licencias respectivas. Esta investigación no propone copiar ni incorporar código.
- La licencia MIT de una biblioteca no se usa como autorización para tomar capturas, marcas, tipografías, iconos o imágenes de su sitio; se enlazan las páginas y no se descargan activos.

### Límites

- La versión exacta de OpenSeesPy a evaluar y la licencia exacta de la distribución/binario que se usaría deben verificarse en el artefacto elegido antes de cualquier integración.
- No se pudo vincular SFAP con un repositorio GitHub institucional o del autor por evidencia primaria; existe una obra identificable, pero autoría técnica del repositorio y licencia de uso quedan no verificadas.
- No se realizó análisis legal de compatibilidad entre licencias, marca, medios de terceros o la distribución comercial concreta de FStructure.
