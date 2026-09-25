# FStructure — guía para agentes

FStructure es la app de cálculo estructural de FusionStructure: cuatro herramientas aisladas (FS-A01 FStructure 2D, FS-A02 Solver 3D, FS-A03 Elementos finitos, FS-A04 Diseño) detrás de un Inicio común. Es un proyecto para **experimentar**: casi todo aquí es guía, no regla.

## Cómo trabajamos

- Español. Actuar sin preguntar: decidir, verificar y contar qué se hizo y qué quedó fuera.
- Al cerrar algo verificado: commit en `main` y push. Cada push publica en GitHub Pages.
- Lo pendiente vive en `TODO.md`.

## Límites duros (los únicos)

1. **No perder datos del usuario.** Lo guardado se migra con versión; nada se sobrescribe ni se descarta en silencio.
2. **Nada sale del dispositivo** sin una acción explícita de la persona (sin telemetría ni red implícita).
3. **Las herramientas no se mezclan.** Ninguna importa código de otra ni lee sus datos; `npm run architecture:check` lo vigila.
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

- `src/App.tsx`: rutas `?surface=welcome` (Inicio) · `?surface=home&tool=` (bienvenida) · `?tool=` (mesa).
- `src/features/welcome/`: Inicio (`SuiteHome`) y bienvenida original de FStructure (`Model2DWelcome`).
- `src/features/tool-home/`: bienvenida común de 3D, FEM y Diseño.
- `src/features/workspace/`: `WorkspaceShell` (2D), `ToolShell` (3D/FEM/Diseño), `toolCatalog`, `toolIntent`. Es la única carpeta que conoce las cuatro herramientas.
- FS-A01: `src/features`, `src/engine`, `src/commands`, `src/store` · FS-A02: `src/modules/space3d` · FS-A03: `src/modules/fem` · FS-A04: `src/design`, `src/features/design`.
- Común: `src/foundation` (unidades, álgebra), `src/storage` (proyecto local), `src/design-system`, `src/workers`.

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
