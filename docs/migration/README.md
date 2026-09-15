# Consolidación de FStructure — 2026-09-14

Task 1 del [plan aprobado](../superpowers/plans/2026-09-14-fstructure-integral-rebuild.md). No cambia código de producción ni comportamiento del producto. No se hizo push ni se eliminaron datos.

## Repositorio canónico y baseline

- Canónico: `/Users/crismora/Desktop/FStructure/fstructure`.
- Base recibida: `0d1ad6d804af781a19d2ec36ef8fef2cdf3958d5`, árbol `729292186ffdcb31cf4be3b1552efcf4e19dab4f`, rama `feat/fusion-solvers`.
- Commit previo al clonado: `77c5bf33c4e839995f62735ac8e51fa90c827fff`, árbol `38c47d9a3d3123af6d5817eb60a0db4c8d097353`. Incluye el plan aprobado y la evidencia de origen.
- Clonado con `git clone --no-hardlinks --branch feat/fusion-solvers /Users/crismora/Desktop/FStructure/Fusiones /Users/crismora/Desktop/FStructure/fstructure`; `origin` restaurado a `https://github.com/klkmoraa/fstructure.git`.
- Se comprobó igualdad de HEAD/árbol antes de archivar. `.git` es un directorio autónomo, sin alternates. Los 338 objetos comparados no comparten inodos con el repositorio original. `git fsck --full` terminó con código 0; informó objetos dangling heredados, sin errores de integridad.
- Baseline de tests recibido del coordinador: `pnpm test`, 62 archivos / 324 pruebas aprobadas, cuatro avisos heredados de jsdom `HTMLCanvasElement.getContext`. No se repitió toda la suite durante esta migración; AGENTS.md exige validación focalizada.
- Build original y canónico: `pnpm build`, código 0, **83 archivos idénticos byte a byte**. Los avisos de importación dinámica ineficaz y tamaño de chunks ya aparecen en el build original. Se conserva el runtime/dependencias existentes mediante copia independiente de `node_modules`; no hubo actualización de dependencias.

La evidencia estructurada está en [pre-archive-verification.json](pre-archive-verification.json), [source-build-sha256.json](source-build-sha256.json), [source-build.log](source-build.log), [canonical-build.log](canonical-build.log) y [post-archive-build.log](post-archive-build.log). La igualdad del build cubre todo `dist`, incluidos workers, fuentes y assets, no sólo el HTML.

## Inventario SHA-256

[source-manifest.json](source-manifest.json) registra 2.400 archivos relevantes, estado Git (incluidas modificaciones previas), rama, commit, árbol, remotos y enlaces de worktrees. Incluye los worktrees anidados de Solver2D. Los directorios FEM y Aprendizaje estaban vacíos; sus estructuras completas se conservaron en el traslado.

| Raíz original | Archivos inventariados |
| --- | ---: |
| Fusiones | 632 |
| Solver2D | 1.621 |
| Solver3D | 100 |
| DiseñoEstructural | 47 |
| FEM-Estructural | 0 |
| Aprendizaje-y-Evidencia | 0 |

El nombre físico de DiseñoEstructural usa Unicode descompuesto (`DiseñoEstructural`), conservado literalmente en el manifiesto y archivo. La captura excluye `.git`, dependencias, builds, cachés/herramientas y la propia evidencia generada; la lista exacta está en el manifiesto. Git se documenta mediante metadatos e historial, no mediante hashes de archivos internos mutables. Los enlaces simbólicos se registran sin seguir su destino. Todos los archivos excluidos también se trasladaron físicamente, sin borrarlos.

Reproducción del chequeo de contenidos archivados:

```sh
node scripts/migration-manifest.mjs verify /Users/crismora/Desktop/FStructure-legacy-20260914 docs/migration/source-manifest.json
node --test scripts/migration-manifest.test.mjs scripts/migration-corpus.test.mjs
```

El primer comando verifica el snapshot histórico contra los contenidos conservados, sin exigir que metadatos Git o rutas de worktrees antiguos sigan vigentes. Resultado: 2.400 archivos comprobados, cero diferencias, antes y después de archivar. [archive-verification.json](archive-verification.json).

## Corpus migrado y deduplicación

[corpus-map.json](corpus-map.json) enumera cada archivo original y destino, SHA-256 de ambos y decisión de migración/deduplicación.

- Los **diez tests originales de Space3D** se conservan verbatim en `docs/migration/legacy-space3d/src`, con la licencia MIT y el manifiesto de compatibilidad histórico. Son evidencia, fuera de la búsqueda de tests de Vitest y de la compilación de la aplicación.
- Nueve tests se activan en `src/modules/space3d`, sobre los módulos integrados existentes: design system, formato numérico, workspace model, álgebra lineal, unidades, corpus, codec, texturas de etiquetas y scene model. **9 archivos / 81 pruebas aprobadas**, sin nuevos avisos. [space3d-tests.log](space3d-tests.log).
- Dos adaptaciones exclusivamente de rutas: la guarda de diseño identifica correctamente el directorio del módulo y el `index.html` canónico; la comprobación de digests históricos lee el corpus preservado. Las restantes pruebas del corpus ejecutan el engine/codec/storage/worker integrado. No se cambian las aserciones numéricas.
- El décimo archivo, `Space3DEntryDialog.test.tsx`, es **referencia histórica, no ejecutado**: su diálogo de entrada independiente fue omitido intencionalmente de Fusiones. Restaurar ese componente duplicaría UI fuera del alcance de consolidación. Esta excepción fue aprobada por el coordinador de Task 1.
- Los fixtures de conversión planar y del engine, el corpus con oráculos analíticos, los siete fixtures DXF 2D y las licencias MIT ya existían idénticos en Fusiones: se retienen y sus hashes se registran, sin duplicar módulos.
- Se retienen los fixtures/oráculo Python de vigas de concreto y `docs/design/normative-sources.json` ya integrados en Fusiones.
- Se migran cuatro PDF públicos y su README de procedencia a `docs/references/normative`. Son referencias de investigación de ediciones 2017/2020; **no habilitan NTC 2023 ni constituyen una base normativa completa**. No se verificaron ni reinterpretaron fórmulas de esos PDF en esta tarea.
- No se migran resultados ilustrativos, `demoDesign.ts`, UI ni assets del prototipo independiente de Diseño.

Pruebas focalizadas:

```sh
pnpm exec vitest run src/modules/space3d --maxWorkers=1 --pool=threads --no-file-parallelism
node --test scripts/migration-manifest.test.mjs scripts/migration-corpus.test.mjs
pnpm build
```

El tooling de manifiestos tiene pruebas de comportamiento: determinismo, detección de alteraciones y ausencias, enlaces simbólicos y rechazo de rutas fuera del destino. El chequeo del corpus verifica los bytes de todos los destinos y la relación diez originales / nueve ejecutables / uno obsoleto. Seis pruebas Node aprobadas, [migration-tests.log](migration-tests.log).

## Archivo recuperable

Todos los movimientos se hicieron con rutas explícitas y `mv`, después de comprobar destino inexistente y origen exacto. Raíz de origen: `/Users/crismora/Desktop/FStructure`. Destino: `/Users/crismora/Desktop/FStructure-legacy-20260914`.

| Origen relativo | Destino relativo |
| --- | --- |
| Fusiones | Fusiones |
| Solver2D | Solver2D |
| Solver3D | Solver3D |
| DiseñoEstructural | DiseñoEstructural |
| FEM-Estructural | FEM-Estructural |
| Aprendizaje-y-Evidencia | Aprendizaje-y-Evidencia |
| .DS_Store | .DS_Store |

Un Vite preexistente (PID 48381, confirmado mediante `lsof`) recreó `Fusiones/.vite` tras mover el origen. Se terminó sólo ese proceso con SIGTERM y se conservó la carpeta regenerada como `Fusiones-regenerated-vite-cache`. Finder regeneró `.DS_Store`, conservado como `.DS_Store-regenerated`. No se borraron esos artefactos. El build posterior se ejecutó desde el canónico con dependencias locales independientes.

El workspace ignorado `.superpowers/sdd/2026-09-14-fstructure-integral-rebuild` se copió antes del traslado. Su ledger apunta al plan canónico. Las referencias históricas del baseline permanecen como procedencia.

### Recuperación

Los repositorios originales, sus modificaciones sin commit y metadatos están preservados. Los enlaces Git absolutos de los worktrees originales todavía nombran las rutas anteriores; **el archivo es recuperable, pero esos worktrees requieren reparar enlaces antes de usarlos en la ubicación archivada**. Esto no afecta al canónico autónomo. Si se decide reabrirlos, la reparación local sería:

```sh
git -C /Users/crismora/Desktop/FStructure-legacy-20260914/Solver2D/fstructure worktree repair /Users/crismora/Desktop/FStructure-legacy-20260914/Fusiones /Users/crismora/Desktop/FStructure-legacy-20260914/Solver2D/fstructure/.worktrees/feat-diseno-estructural /Users/crismora/Desktop/FStructure-legacy-20260914/Solver2D/fstructure/.worktrees/fix-load-collision-stacking
```

Ese comando **no se ejecutó**, para conservar intactos los metadatos originales. Como alternativa se pueden restaurar las carpetas a sus rutas originales después de resolver cualquier colisión. No hay necesidad de consultar, borrar o modificar repos remotos.
