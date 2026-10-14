# FStructure — guía para agentes

FStructure (FS-A01) es la app de cálculo estructural de FusionStructure: una sola Home y una sola mesa, que se usa de dos formas con las mismas pantallas: **por separado** (un archivo individual abre sólo el Modelo 2D, el Modelo 3D o una pieza de Diseño, sin enlaces) o como **proyecto completo** (2D, 3D y Diseño enlazados). FStructure modela en 2D y en 3D y diseña en concreto en la misma mesa: el interruptor 2D | 3D | Diseño de su barra (URL `mode=3d`, `mode=design`) cambia sólo las herramientas del modo; el proyecto, el guardado y la barra son los mismos, y el paso 2D ↔ 3D se anima (el plano se tiende y el espacio emerge). El antiguo Solver 3D (FS-A02) es hoy el modo 3D; Elementos finitos (FS-A03) se retiró el 7 de octubre de 2026 (sus estudios guardados siguen en el registro del proyecto, `bundle.fem`, y no se borran). Es un proyecto para **experimentar**: casi todo aquí es guía, no regla.

## Cómo trabajamos

- Español. Actuar sin preguntar: decidir, verificar y contar qué se hizo y qué quedó fuera.
- Al cerrar algo verificado: commit en `main` y push. Cada push publica en GitHub Pages.
- Lo pendiente vive en `TODO.md`.

## Límites duros (los únicos)

1. **No perder datos del usuario.** Lo guardado se migra con versión; nada se sobrescribe ni se descarta en silencio.
2. **Nada sale del dispositivo** sin una acción explícita de la persona (sin telemetría ni red implícita).
3. **Los territorios no se mezclan.** El 2D con su Diseño y el 3D (`src/modules/space3d`) no importan código del otro ni leen sus datos; `npm run architecture:check` lo vigila. Los datos pasan sólo por puentes declarados en `src/integrations` (2D → 3D, eje del 3D → Diseño), que usa sólo `src/features/workspace` y que pueden usar el modelo, el motor y los datos del 3D, nunca su interfaz.
4. **`main` publicable.** CI corre `npm run check` y no publica si falla.

## Pruebas: el mínimo que cubre el cambio

| Toco | Corro |
| --- | --- |
| cualquier cosa | `npm run verify` (typecheck + pruebas relacionadas con lo cambiado) |
| CSS, copy, layout | mirarlo en el navegador; claro/oscuro, y móvil si cambió el layout |
| solver, unidades, diseño | un caso pequeño con valor de referencia y tolerancia |
| guardado/importación | abrir → guardar → reabrir, y un archivo inválido |
| algo transversal o antes de un cambio grande | `npm run check` |

No escribir pruebas para fijar estilo o copy. `npm run lint:design` sólo avisa. `npm run deadcode` (knip) lista archivos, exportaciones y dependencias sin uso.

## Mapa

- `src/App.tsx`: rutas `?surface=welcome` (Home; `&view=projects|templates|classroom|import|library` abre una sección) · `?tool=model2d` (mesa) · `?tool=model2d&mode=3d` (modo 3D) · `?tool=model2d&mode=design` (modo Diseño). Los enlaces viejos `tool=space3d`/`surface=workspace3d` abren el modo 3D y `tool=design` el modo Diseño; `surface=home` abre la Home y los de FEM (`tool=fem`, `surface=fem`) también.
- `src/features/welcome/`: la Home (`HomePage` + `home.css`): lo abierto con Continuar/Nuevo, «Calcular por separado» (Modelo 2D, Modelo 3D, Viga, Columna, Zapata, Sección a flexión, Estudio de sección, Pórtico), «Proyecto completo» (2D · 3D · Diseño), recientes y secciones (proyectos, plantillas, aula, importar, biblioteca).
- Cálculo individual: `settings.workScope = { kind: 'single', tool }` (sin él, proyecto completo; así está todo lo guardado antes). `src/shared/project/workScope` lo lee; `App` quita el interruptor de modos y corrige la URL al modo de la herramienta; el 2D oculta «Diseñar», el 3D «Traer del 2D» y Diseño monta sólo esa pieza (`DesignWorkbench scope="single"`) sin modelos ni selector de elementos. El Modelo 2D vacío (individual o no) ofrece los inicios de `src/data/modelStarts` (`ModelStartCard`), que se calculan al elegirlos. Se guarda como cualquier proyecto (mismo bundle) y Proyectos lo filtra como «Individuales».
- `src/features/workspace/`: `WorkspaceShell` (modo 2D), `ToolShell` (`MesaModeShell`: 3D y Diseño comparten el mismo shell montado), `mesaChrome.css` (geometría común de barra, dock y pie: lo que se repite entre mesas vive ahí), `MesaModeSwitch`, `mesaTransition` (la animación entre modos), `toolCatalog`, `toolIntent`. Es la única carpeta que conoce todos los territorios; sus adaptadores (`adapters/Space3DSurface`, `adapters/DesignSurface`) usan los puentes y recuerdan por proyecto la vista y la cámara del 3D y su selección (`adapters/mesaSelection`), para que Diseño abra la barra elegida.
- FS-A01: `src/features`, `src/engine`, `src/commands`, `src/store`; su modo Diseño en `src/design` (motores; `elements/model2dSource` traduce el Modelo 2D a la mesa Estructura) y `src/features/design` (taller); su modo 3D en `src/modules/space3d` (territorio propio).
- `src/integrations/`: `model2dSpace3d` («Traer del 2D»: el pórtico 2D extruido en pórticos paralelos, con su f′c) y `space3dDesign` (cada eje x = cte o z = cte del 3D como fuente de Estructura, con las acciones del modelo completo, columnas en flexión biaxial con k e índice de estabilidad propios fuera del plano, torsión de vigas y la planta para revisar todos los ejes). `space3dSections` adapta las propuestas de secciones a las propiedades A/Iy/Iz/J y comprueba todos los ejes; sólo el workspace lo aplica, como un cambio en el historial del 3D. El Modelo 2D analiza casos y recálculos agrietados mediante `model2dDesignWorker` y `model2dDesign.worker`; las funciones lectoras se reconstruyen con `src/design/elements/model2dAnalysis`. `frameCalculation` y `formNumbers` son conversiones puras del taller; los workers de propuestas sólo devuelven pasos y dimensiones. Todos los ejes se diseñan en el worker de la mesa (`src/features/workspace/adapters/space3dDesign.worker.ts`).
- Común: `src/foundation` (unidades, álgebra), `src/storage` (proyecto local), `src/design-system` (incluye las bandas de diagrama que comparten Diseño y el 2D, y `afterTransition`: el trabajo pesado espera a que termine la animación entre modos), `src/workers`.
- Acero del Modelo 2D: el workspace suministra `adapters/ModelSteelReview` al taller; `modelSteelAnalysis` usa el worker de análisis existente sin escribir el proyecto. Reutiliza `src/design/ntcSteel2023.ts` (sólo fluencia total de armadura A992 + I AISC en tensión pura), con su combinación y alcance propios. `NtcSteelDesignReview` también presenta ese componente en Resultados. `steelMemory` valida selecciones por proyecto (documento del taller v6 compatible con v1–v5); `adapters/steelReviewPdf` exporta la revisión no concluyente y adjunta su modelo, sólo por acción explícita.

## Cómo está hecho (guía)

- Unidades internas en metros y kN; se convierte sólo al mostrar o exportar.
- Un resultado es derivado: si cambian sus entradas, se invalida.
- El cálculo pesado va en workers con mensajes serializables.
- Lo no probado se muestra como **Experimental** en la interfaz.
- La Home carga ligera: la mesa (`WorkspaceShell`, `MesaModeShell`), three.js y los diálogos de la Home van en `lazy()`; no importar estos estáticamente desde `App` o la Home.
- Sin conexión: `vite.config.ts` genera `sw.js` desde `scripts/sw.template.js` (precarga el código salvo PDF; sólo lee del mismo origen, nunca envía datos).

## Marca

- Canon: [FusionStructureBrand](https://klkmoraa.github.io/FusionStructureBrand/). Brandbook de la familia: `docs/brandbook/` (abrir `index.html`).
- FStructure es familia **Análisis**: cambia sólo el acento. `#ED4B46` / `#FF8E80` en relleno, `#C23A33` como texto en Día, `#14171A` sobre el acento. Todo lo demás (neutros, tipo, radios, materia, movimiento, señales, voz) es del canon.
- La marca es la ménsula con la franja roja; el verde `#1AA57A` sólo aparece cuando se nombra a FusionStructure.
- Los resultados usan las seis señales (N, M, V, Δ, Fy, !); el acento nunca pinta un resultado.
- Tokens en `src/design-system/tokens.css`. Si un valor contradice el canon, se corrige aquí o se propone en el canon; si el experimento pide romperlo, se dice por qué en el commit.
- Si cambia la interfaz de una mesa, actualiza las capturas y la ficha de `docs/brandbook/`.
