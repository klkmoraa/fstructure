# Auditoría base de FStructure

Fecha: 2026-09-18

Rama observada: `feat/fusion-solvers`

Commit base: `f68ecd83da0551c250efc7c42e7b23b86540d904`

Estado inicial: limpio (`git status --short` sin salida).

## Producto observado

SPA React 19 + Vite 8 + TypeScript 6, local-first y experimental. Un shell presenta 2D, Diseño, Space 3D y FEM sobre un proyecto común. El modelo 2D es autoridad; las demás superficies conservan ramas/resultados. Persistencia en localStorage e IndexedDB con revisiones, checksums, recuperación y migración. El cálculo usa workers y un backend numérico Rust/WASM; hay exportación JSON, expediente ZIP, PDF, SVG, PNG, CSV y VTK, importación DXF parcial, Gmsh 4.1 ASCII y formatos propios.

Inventario aproximado: 401 archivos `.ts`, 176 `.tsx`, 48 `.css`, 10 scripts `.mjs`, 97 archivos de prueba Vitest, 4 Node test, 1 Rust test y 1 Python test. El runtime declarado es Node 24 y Rust 1.98.1.

## Arquitectura y contratos

- Entrada única: `src/main.tsx` → `src/App.tsx` → `WorkspaceShell`.
- Modelo/comandos: `src/types.ts`, `src/data/`, `src/commands/`.
- Estado e historial: `src/store/ProjectContext.tsx` y contextos separados.
- Solver: `src/engine/`, `src/analysis-methods/`, `src/foundation/`.
- Persistencia: `src/storage/` y `src/shared/project/`.
- Dominios integrados: `src/design/`, `src/modules/space3d/`, `src/modules/fem/`.
- Gates de arquitectura existentes impiden otra entrada Vite, imports de productos hermanos y design-system anidado activo.

La frontera principal es sensata, pero existen copias históricas de Foundation bajo Space 3D y hotspots grandes: `StructuralCanvas.tsx` (2.941 líneas), `solver.ts` (2.499), `ProjectContext.tsx` (790) y varios generadores PDF de 1.000–1.700 líneas.

## Estado de validación

El `npm` del sistema no estaba en `PATH`; `npm run check` no arrancó por esa causa ambiental. Se usó Node 24.19.0 y `pnpm run check` del runtime de Codex para ejecutar literalmente el script `check` de `package.json` sin instalar ni cambiar dependencias.

| Comprobación ejecutada | Resultado |
| --- | --- |
| `git status --short` inicial | pasa, árbol limpio |
| Script `check` completo | falla en Vitest; pasos posteriores no se ejecutan |
| Vitest dentro de `check` | 95 archivos pasan, 2 fallan; 585 pruebas pasan, 2 fallan |
| `architecture:check` | pasa: Foundation y single-app |
| `architecture:test` | pasa, 16/16 |
| `build` | pasa con advertencias de chunks/importación dinámica |
| `numeric:wasm:gate` | pasa; solución `[1,2,3.0000000000000004]`, residuo 0 |
| Rust `faer_sparse_gate` | pasa, 1/1 con Rust 1.98.1 |
| `design:oracle` | pasa, 3/3 |
| Browser local, portada y 2D/Diseño/3D/FEM | cargan sin errores/warnings de consola; navegación principal pasa |
| Teclado/foco en 2D | foco visible de 2 px observado; 37 controles visibles con nombre accesible |
| Auditoría de dependencias | no ejecutable: `npm` ausente y `pnpm audit` rechaza `package-lock.json` |

## Fallos confirmados

1. `src/shared/project/shellSolverDifferential.test.ts`: el round trip del corpus a través de la sesión unificada falla con `Expected finite, acyclic JSON data`, originado en `canonicalSerialize` durante `clearWorking` de `unifiedProjectSession.ts`.
2. `src/design/structuralDesignMigration.test.ts:270`: exige cero PDFs normativos, pero hay cuatro PDFs presentes y versionados en `docs/references/normative/`.
3. El build genera `dist/assets/index-*.js` de 2.091,52 kB (598,53 kB gzip), CSS inicial de 690,66 kB (231,99 kB gzip) y un worker PDF de 2.228,48 kB. Vite informa cinco familias de imports dinámicos ineficaces.
4. La mesa de trabajo tiene `main`, landmarks y controles nombrados, pero no contiene ningún `h1`–`h6` visible ni nombre en el `main`; la portada sí tiene jerarquía.
5. Hay manifiestos y código de actualización PWA, pero `PwaUpdateNotice` no se monta y no existe `sw.js` generado/registrado en el flujo activo. La instalación no equivale a soporte offline.
6. CI ejecuta `npm run check`, pero ese script no incluye `numeric:wasm:gate`, `numeric:rust:test`, `architecture:test` completo ni un smoke de navegador.

## Seguridad y privacidad

No se encontraron secretos con patrones de claves comunes, sinks `dangerouslySetInnerHTML`/`eval`, handlers click sobre `div/span/li/tr/td`, ni tráfico de red activo del producto. Los archivos se limitan antes de leer/descomprimir; bundles verifican rutas, presupuestos y checksums. CI usa lockfile con `npm ci`.

`src/utils/reportlabEnhancer.ts` contiene un companion opcional que podría enviar PDF y payload a un endpoint configurable, pero no tiene importadores actuales: es código no alcanzable, no una exfiltración activa. Si se conecta, necesita consentimiento/destino visible y pruebas de privacidad. No hay gate reproducible de advisories de dependencias.

## UI, accesibilidad y responsive

La portada y las cuatro superficies cargaron en navegador Chromium integrado a 1280×720 sin overlay ni errores de consola. La navegación por tabs actualiza URL y contenido. El foco visible existe y no se observaron controles visibles sin nombre ni IDs duplicados. El viewport móvil no pudo variarse con el navegador disponible; el código contiene media queries, objetivos táctiles y pruebas de interacción, pero `docs/design/fidelity-ledger.md` también declara pendiente la evidencia móvil de Diseño. `design-qa.md` cita capturas bajo `output/playwright/` que no están versionadas.

## PWA, rendimiento y distribución

Hay manifiestos claro/oscuro e iconos instalables. Falta demostrar service worker, precache, offline y actualización. GitHub Actions usa `contents: write` y publica por una rama `gh-pages`; funciona, pero el permiso es más amplio que el flujo moderno de Pages. No hay `packageManager`/`engines` en `package.json`, aunque `.nvmrc` fija Node 24.

## Documentación frente al producto

README describe correctamente el carácter experimental y las cuatro superficies, pero mezcla dos introducciones y afirma un gate numérico/migratorio más amplio que el ejecutado en CI. La documentación visual presenta evidencia contradictoria: un QA histórico “passed” basado en rutas no versionadas y un ledger de Diseño aún “pendiente”. Los PDFs normativos contradicen una prueba y requieren una decisión de licencia/distribución.

## Límites de esta auditoría

- No se modificó código funcional ni se corrigieron los dos fallos.
- No se midió cobertura porque no está instalado/configurado un provider de coverage.
- No se ejecutó `npm audit` por ausencia de npm; no se infiere ausencia de vulnerabilidades.
- No se validó móvil real, lector de pantalla, instalación/offline PWA ni interoperabilidad contra AutoCAD/IFC/DWG.
- La inspección revisó contratos, hotspots, búsquedas de riesgo y flujos representativos; no constituye certificación estructural, legal ni de seguridad.
