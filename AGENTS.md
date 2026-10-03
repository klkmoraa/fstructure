# FStructure — guía para agentes

FStructure es la app de cálculo estructural de FusionStructure: dos mesas aisladas (FS-A01 FStructure y FS-A03 Elementos finitos) detrás de un Inicio común. FStructure modela en 2D y en 3D y diseña en concreto en la misma mesa: el interruptor 2D | 3D | Diseño de su barra (URL `mode=3d`, `mode=design`) cambia sólo las herramientas del modo; el proyecto, el guardado y la barra son los mismos, y el paso 2D ↔ 3D se anima (el plano se tiende y el espacio emerge). El antiguo Solver 3D (FS-A02) es hoy el modo 3D. Es un proyecto para **experimentar**: casi todo aquí es guía, no regla.

## Cómo trabajamos

- Español. Actuar sin preguntar: decidir, verificar y contar qué se hizo y qué quedó fuera.
- Al cerrar algo verificado: commit en `main` y push. Cada push publica en GitHub Pages.
- Lo pendiente vive en `TODO.md`.

## Límites duros (los únicos)

1. **No perder datos del usuario.** Lo guardado se migra con versión; nada se sobrescribe ni se descarta en silencio.
2. **Nada sale del dispositivo** sin una acción explícita de la persona (sin telemetría ni red implícita).
3. **Los territorios no se mezclan.** El 2D con su Diseño, el 3D (`src/modules/space3d`) y FEM no importan código del otro ni leen sus datos; `npm run architecture:check` lo vigila. Los datos pasan sólo por puentes declarados en `src/integrations` (2D → 3D, eje del 3D → Diseño), que usa sólo `src/features/workspace` y que pueden usar el modelo, el motor y los datos del 3D, nunca su interfaz.
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

- `src/App.tsx`: rutas `?surface=welcome` (Inicio) · `?surface=home&tool=` (bienvenida) · `?tool=` (mesa) · `?tool=model2d&mode=3d` (modo 3D) · `?tool=model2d&mode=design` (modo Diseño). Los enlaces viejos `tool=space3d`/`surface=workspace3d` abren el modo 3D y `tool=design` el modo Diseño.
- `src/features/welcome/`: Inicio (`SuiteHome`) y bienvenida original de FStructure (`Model2DWelcome`).
- `src/features/tool-home/`: bienvenida común (hoy la usa FEM).
- `src/features/workspace/`: `WorkspaceShell` (modo 2D), `ToolShell` (FEM y `MesaModeShell`, los modos 3D y Diseño), `MesaModeSwitch`, `mesaTransition` (la animación entre modos), `toolCatalog`, `toolIntent`. Es la única carpeta que conoce todos los territorios; sus adaptadores (`adapters/Space3DSurface`, `adapters/DesignSurface`) usan los puentes.
- FS-A01: `src/features`, `src/engine`, `src/commands`, `src/store`; su modo Diseño en `src/design` (motores; `elements/model2dSource` traduce el Modelo 2D a la mesa Estructura) y `src/features/design` (taller); su modo 3D en `src/modules/space3d` (territorio propio) · FS-A03: `src/modules/fem`.
- `src/integrations/`: `model2dSpace3d` («Traer del 2D»: el pórtico 2D extruido en pórticos paralelos) y `space3dDesign` (un eje x = cte o z = cte del 3D como fuente de Estructura, con las acciones del modelo completo).
- Común: `src/foundation` (unidades, álgebra), `src/storage` (proyecto local), `src/design-system` (incluye las bandas de diagrama que comparten Diseño y el 2D), `src/workers`.

## Cómo está hecho (guía)

- Unidades internas en metros y kN; se convierte sólo al mostrar o exportar.
- Un resultado es derivado: si cambian sus entradas, se invalida.
- El cálculo pesado va en workers con mensajes serializables.
- Lo no probado se muestra como **Experimental** en la interfaz.

## Marca

- Canon: [FusionStructureBrand](https://klkmoraa.github.io/FusionStructureBrand/). Brandbook de la familia: `docs/brandbook/` (abrir `index.html`).
- FStructure es familia **Análisis**: cambia sólo el acento. `#ED4B46` / `#FF8E80` en relleno, `#C23A33` como texto en Día, `#14171A` sobre el acento. Todo lo demás (neutros, tipo, radios, materia, movimiento, señales, voz) es del canon.
- La marca es la ménsula con la franja roja; el verde `#1AA57A` sólo aparece cuando se nombra a FusionStructure.
- Los resultados usan las seis señales (N, M, V, Δ, Fy, !); el acento nunca pinta un resultado.
- Tokens en `src/design-system/tokens.css`. Si un valor contradice el canon, se corrige aquí o se propone en el canon; si el experimento pide romperlo, se dice por qué en el commit.
- Si cambia la interfaz de una mesa, actualiza las capturas y la ficha de `docs/brandbook/`.
