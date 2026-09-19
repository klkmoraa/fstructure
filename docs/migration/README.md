# Consolidación de FStructure — 2026-09-14

Task 1 del [plan aprobado](../superpowers/plans/2026-09-14-fstructure-integral-rebuild.md). Durante el corte original no se hizo push ni se eliminaron datos; una instrucción posterior del propietario retiró las copias legacy, como se registra al final.

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

La evidencia de esa comprobación histórica permanece en los manifiestos y logs
versionados. El producto no depende de esas rutas para funcionar.

## Estado actual del corpus

Las pruebas ejecutables y los fixtures aceptados viven directamente en
`src/modules/space3d`; no existe una segunda copia del módulo. Los fixtures y el
oráculo de vigas de concreto permanecen en `validation/`, y las fuentes de
investigación normativa permanecen en `docs/references/normative`.

Por instrucción posterior del propietario, se retiraron del árbol activo la
copia `docs/migration/legacy-space3d`, su mapa de duplicados y la prueba dedicada
a esa copia. También se movió el archivo externo
`/Users/crismora/Desktop/FStructure-legacy-20260914` a la Papelera. La única app
de trabajo es `/Users/crismora/Desktop/FStructure/fstructure`.
