# Propuestas y señales de la comunidad para FStructure

Fecha de consulta: 14 de octubre de 2026. Se revisaron páginas primarias de los proyectos. Las entradas son issues/discusiones de usuarios o respuestas de mantenedores; no representan promesas de producto ni requisitos para FStructure.

**Estados:** los hechos de páginas abiertas se marcan **Verificado**; los huecos se marcan **No verificado**. Consulta común: **2026-10-14**. Las lecturas para FStructure son inferencias.

## Excalidraw

| Estado de evidencia | Referencia | Fecha y estado observado | Hecho reportado | Lectura para FStructure |
|---|---|---|---|---|
| Verificado | [Issue #3641 — Wrap shape menu items on mobile](https://github.com/excalidraw/excalidraw/issues/3641) | Abierta; creada 25-05-2021; etiqueta “open for discussion; consensus not reached”. | La persona describe que el menú vertical de formas ocupa mucho de la pantalla móvil y propone envolver sus elementos para liberar lienzo. | Señal de que el dock debe reservar espacio para dibujar y no amontonar herramientas. La propuesta de envolver es una idea de la comunidad, no una pauta confirmada para copiar. |
| Verificado | [Issue #9705 — Touch Device Support](https://github.com/excalidraw/excalidraw/issues/9705) | Issue meta abierta; creada 28-06-2025; etiquetas mobile/tablet. | Agrupa reportes sobre multitáctil, stylus, rechazo de palma, cambio automático de herramienta y controles móviles. El estado del issue padre no determina el estado de cada issue hija. | Motiva una pasada específica de interacción táctil con selección, pan/zoom, dock y menús a 390 px. No se usa como validación de la interacción de FStructure. |

## PyNite

| Estado de evidencia | Referencia | Fecha y estado observado | Hecho reportado | Lectura para FStructure |
|---|---|---|---|---|
| Verificado | [Discussion #136 — Visualizing stress and strain](https://github.com/JWock82/PyNite/discussions/136) | Q&A contestada por el mantenedor el 14-11-2022. | Una persona pregunta cómo visualizar tensión/deformación local a lo largo de un miembro. El mantenedor explica que los miembros del modelo de barras no entregan ese campo y señala como vistas disponibles los diagramas de momento, cortante y axial. | Mantener la correspondencia entre la representación del modelo y el resultado disponible. Evitar dibujar contornos de tensión que el análisis de barras no calcula. |
| Verificado | [Discussion #180 — Can I use this library only to plot my truss structures?](https://github.com/JWock82/PyNite/discussions/180) | Q&A contestada el 28-12-2023. | El mantenedor confirma que puede renderizarse una armadura sin analizarla. La persona añade que en Debian/Jupyter la visualización aparece en ventana separada y quería conservarla al exportar el notebook. | El contexto de presentación importa junto con el diagrama: FStructure puede mantener resultado y controles integrados en la mesa web y ofrecer exportación explícita. No se adopta la ventana separada como patrón. |
| Verificado | [Discussion #106 — Suggestion Box / Priorities for Future Development](https://github.com/JWock82/PyNite/discussions/106) | Caja de ideas iniciada por el mantenedor el 10-11-2021; contiene respuestas posteriores. | Entre las ideas y solicitudes aparece leer/escribir hojas de cálculo; no es una solicitud de colocación de etiquetas o dock. | Útil sólo como señal de que intercambio y flujo de datos forman parte de solicitudes de usuarios. Se mantiene fuera del alcance visual V1–V9. |

## Frame3DD

| Estado de evidencia | Referencia | Fecha y estado observado | Hecho reportado | Lectura para FStructure |
|---|---|---|---|---|
| Verificado | [Repositorio principal `hpgavin/frame3dd`](https://github.com/hpgavin/frame3dd) | Al 14-10-2026 el contador de issues abiertos de la página indica `Issues 0`. No se encontró un issue/discussion del repositorio para resumir como propuesta comunitaria. | La documentación del proyecto y su página de ejemplos presentan entradas/resultados y gráficas de ejemplos estructurales, incluido un Pratt 2D. [Manual](https://hpgavin.github.io/frame3dd/web/Frame3DD-manual.html) | Evidencia alternativa explícita: manual y ejemplos oficiales muestran el tipo de salida que el proyecto soporta. No prueba una petición de usuario ni se describe como actividad comunitaria. |

## anaStruct

| Estado de evidencia | Referencia | Fecha y estado observado | Hecho reportado | Lectura para FStructure |
|---|---|---|---|---|
| Verificado | [Issue #42 — Designing a Warren Truss 2-d load simulation in Anastruct?](https://github.com/anastruct/anaStruct/issues/42) | Abierta 15-05-2020; cerrada como completada el 31-12-2022. | La persona que diseña una armadura Warren dice que quiere visualizar zonas de tensión, distribución de cargas y carga máxima. El mantenedor pregunta por los elementos de fuerza cero y el modelo. El historial consultado no permite concluir que esa capacidad surgiera de esta issue. | Señal de que quien modela una armadura quiere conectar forma, fuerzas y capacidad; no reutilizar el caso como criterio de cálculo ni suponer que hubo implementación. |
| Verificado | [Issue #204 — problem with plotting the results](https://github.com/anastruct/anaStruct/issues/204) | Abierta; creada 15-10-2023; etiquetada question. | `show_structure()` falla cuando falta la dependencia de plotting; un colaborador aclara que `anastruct[plot]` instala Matplotlib y pide el error de instalación si el extra falla. | La configuración de visualización debe explicar si faltan datos o dependencias y cómo recuperar el estado. En FStructure, el render de la mesa no debe presentarse como fallo de cálculo si la causa es otra. |

## Límites de interpretación

- Los títulos y estados son hechos observados en la página fuente al 14-10-2026. Los párrafos “Lectura para FStructure” son inferencias para revisar la propuesta, no conclusiones de los autores originales.
- Las Q&A y los issues describen problemas de uso concretos. No prueban prevalencia ni aceptación general y no se convierten automáticamente en funcionalidades de FStructure.
- El contador consultado de Frame3DD muestra cero issues abiertos; no se encontró una propuesta comunitaria concreta para citar. El manual y los ejemplos se indican como evidencia alternativa de la funcionalidad y salida documentadas; no se inventa una propuesta de comunidad.

## Licencias verificadas y datos que faltan

| Proyecto/artefacto | Evidencia primaria consultada | Resultado a 14-10-2026 | Alcance y hueco |
|---|---|---|---|
| [PyNite](https://github.com/JWock82/PyNite) | El repositorio identifica MIT; `setup.py` declara la versión 3.0.0 en `main`; [LICENSE](https://github.com/JWock82/PyNite/blob/main/LICENSE). | **Verificado: MIT**, versión observada 3.0.0. | La verificación cubre el código del repositorio consultado. No se tomaron imágenes, logos ni capturas del proyecto. |
| [OpenSeesPy](https://github.com/zhuminjie/OpenSeesPy) | README de `zhuminjie/OpenSeesPy`, rama `openseespy`. | **Verificado:** el README indica uso gratuito para investigación, educación y uso interno; exige una licencia similar a OpenSees.exe para redistribución comercial de OpenSeesPy, incluyendo aplicación o servicio que lo importe. No fija una versión en el README consultado. | No clasificarlo como MIT/BSD. Antes de una redistribución hay que confirmar con el mantenedor la versión/binario y los términos aplicables al wrapper. |
| [OpenSees, motor subyacente](https://opensees.github.io/OpenSeesDocumentation/developer/license.html) | Licencia oficial de OpenSees, copyright de The Regents of the University of California; el texto incluye condiciones para uso, redistribución y licencia para productos de distribución comercial. | **Verificado: OSSPL / términos de UC Regents**; uso no comercial para entidades educativas, de investigación y sin fines de lucro; uso interno para otras entidades; distribución comercial requiere licencia de UC Berkeley. | Aplica al motor subyacente además del aviso comercial de OpenSeesPy. La licencia del paquete binario exacto debe revisarse antes de incorporarlo. |
| [SFAP](https://monografias.ufop.br/handle/35400000/6692) | UFOP cataloga la monografía de 2024 de João Pedro Carneiro; [catálogo CILAMCE 2025](https://publicacoes.softaliza.com.br/cilamce-2025/catalog/category/research-beginners/3) lista el artículo de Carneiro, Andréa Regina Dias da Silva, Walliston dos Santos Fernandes y Ricardo Azoubel da Mota Silveira. | **No verificado** para repo autoritativo y licencia. | El nombre está desambiguado como el programa académico de UFOP descrito en esas obras, pero no se encontró un repo del autor con licencia. No equiparar a otras herramientas que compartan el acrónimo. |
| [Frame3DD](https://github.com/hpgavin/frame3dd) | Repositorio principal y [LICENSE](https://github.com/hpgavin/frame3dd/blob/main/LICENSE). | **Verificado: GPL-3.0**. | Referencia numérica o gráfica solamente; no copiar código ni redistribuir derivados sin revisión de la licencia aplicable. |
| [anaStruct](https://github.com/anastruct/anaStruct) | Repositorio principal y [LICENSE.txt](https://github.com/anastruct/anaStruct/blob/master/LICENSE.txt). | **Verificado: LGPL-3.0**. | Corrige la mención GPL-3.0 del borrador del plan. No copiar código en esta investigación. |
| [d3fc-label-layout](https://github.com/d3fc/d3fc/blob/master/packages/d3fc-label-layout/package.json) | Manifiesto del paquete declara `@d3fc/d3fc-label-layout` versión 7.0.4, `license: MIT`; [LICENSE](https://github.com/d3fc/d3fc/blob/master/LICENSE). | **Verificado: MIT**, paquete 7.0.4 observado en `master`. | Sólo se cita la estrategia/documentación. No se integra el paquete ni se asume que esta licencia cubra marcas, imágenes o capturas externas. |

La comprobación de una licencia de código no concede automáticamente derechos sobre logotipos, tipografías, capturas, marcas ni medios de terceros. Para esta investigación sólo se guardan enlaces a fuentes; no se descargaron activos externos ni se copiaron fragmentos de código.
