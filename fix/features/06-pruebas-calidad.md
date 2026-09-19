# Pruebas y calidad

<a id="id-003"></a>

## [x] ID-003 — Recuperar un gate general completamente verde

- Categoría: pruebas y calidad
- Prioridad: alta
- Estado: cerrada
- Problema demostrado: el script `check` se detiene en Vitest con dos fallos; 95/97 archivos y 585/587 casos pasan.
- Evidencia: fallos confirmados en `shellSolverDifferential.test.ts` y `structuralDesignMigration.test.ts`; typecheck, lint y tests anteriores se ejecutan, pero los pasos posteriores del script no llegan a correr.
- Impacto: no existe una señal única de integración confiable para aceptar cambios.
- Alcance: cerrar ID-001 e ID-002, ejecutar el pipeline completo y asegurar que CI reproduce el mismo resultado.
- Fuera de alcance: omitir suites, marcar tests como skip o reducir assertions para obtener verde artificial.
- Dependencias: ID-001, ID-002.
- Tareas relacionadas: ID-004, ID-005, ID-017.
- Criterios de aceptación:
  - [x] `npm run check` termina con código 0 en un checkout limpio y runtime soportado.
  - [x] No hay tests omitidos o snapshots actualizados sin revisión de intención.
  - [x] CI usa el mismo comando y conserva logs suficientes para diagnosticar fallos.
  - [x] La evidencia registra versiones de Node, package manager y commit.
- Estrategia de pruebas: reparar primero cada regresión aislada, luego ejecutar `npm run check` completo dos veces, una en local y otra en CI.
- Riesgos: enmascarar los fallos, depender de orden/estado local o aceptar flakiness como éxito.
- Evidencia de cierre: pendiente por runtime. `npm run check` termina con código 0 de principio a fin: lint sin errores, typecheck limpio, `architecture:check` y `architecture:test` (18+2 casos) —que antes no formaban parte del script—, `check-design-delivery-gate`, Vitest 96/96 archivos y 563/563 casos, el oráculo de Python 3/3 y el build. Los dos fallos de origen quedaron resueltos en ID-001 e ID-002, sin omitir pruebas ni relajar assertions; al contrario, la suite ganó verificaciones contra solución cerrada. Entorno de la corrida: npm 10.9.7, commit 75ec8d5.
- Segunda corrida, la de CI: el job `quality` de la ejecución 35421893229 termina en `success` sobre el commit 57bc812 del pull request #8, en checkout limpio con `npm ci`. Resuelve la salvedad de runtime de la corrida local, que se hizo con Node v22.22.2: el workflow fija la versión con `node-version-file: .nvmrc` y `.nvmrc` declara Node 24, de modo que CI ejecuta el runtime soportado. En la misma ejecución el job `publish` queda en `skipped`, que es el comportamiento correcto para un evento `pull_request` y confirma que ningún PR obtiene token de escritura.
- Nota: es el primer check run de este pull request. Antes del arreglo de ID-004 el workflow sólo disparaba en `push` a `main`, así que `npm run check` no se habría ejecutado hasta después del merge.
- Responsable: auditoría del PR #8 (sesión Claude Code).
- Fechas: creada 2026-09-18; inicio 2026-09-19; cierre 2026-09-19.

<a id="id-005"></a>

## [ ] ID-005 — Añadir smoke E2E de las cuatro superficies

- Categoría: pruebas y calidad / E2E
- Prioridad: alta
- Estado: abierta
- Problema demostrado: no existe un gate de navegador versionado que recorra portada, 2D, Diseño, 3D y FEM; la verificación actual fue manual.
- Evidencia: las superficies cargaron y navegaron sin errores de consola a 1280×720, pero el repositorio no conserva un test equivalente ni su evidencia.
- Impacto: rutas, carga diferida, workers y composición del shell pueden romperse sin que pruebas unitarias lo detecten.
- Alcance: smoke estable de arranque, navegación, consola, acción mínima por superficie y artefactos de fallo.
- Fuera de alcance: automatizar toda la aplicación o validar precisión estructural sólo desde UI.
- Dependencias: ID-003.
- Tareas relacionadas: ID-006, ID-008, ID-009.
- Criterios de aceptación:
  - [ ] El smoke arranca un build/preview controlado y visita las cinco vistas.
  - [ ] Falla ante excepciones de página, overlays fatales o errores inesperados de consola.
  - [ ] Ejecuta una interacción representativa y comprobable en cada superficie.
  - [ ] Corre en CI con trazas/capturas sólo al fallar y sin depender de estado previo.
- Estrategia de pruebas: fixtures pequeños y deterministas, selectores semánticos, aislamiento por caso y ejecución repetida para detectar flakiness.
- Riesgos: tests acoplados a texto/posición, servidor huérfano en CI o falsos positivos por ignorar consola en exceso.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-017"></a>

## [ ] ID-017 — Medir cobertura de contratos críticos

- Categoría: pruebas / observabilidad de calidad
- Prioridad: media
- Estado: abierta
- Problema demostrado: hay 97 archivos Vitest y otras suites, pero no se genera cobertura ni se conoce la protección de contratos críticos.
- Evidencia: el provider de coverage no está instalado/configurado y no hay reporte ni umbral en scripts o CI.
- Impacto: el volumen de tests puede ocultar huecos en migraciones, persistencia, comandos, unidades, workers y fallos de recuperación.
- Alcance: adoptar medición compatible, definir una línea base y umbrales por módulos críticos sin perseguir una cifra global vacía.
- Fuera de alcance: exigir 100 %, contar E2E como sustituto de assertions o cubrir código generado.
- Dependencias: ID-003.
- Tareas relacionadas: ID-001, ID-006, ID-011, ID-012.
- Criterios de aceptación:
  - [ ] Existe un comando reproducible de cobertura con exclusiones justificadas.
  - [ ] Se publican métricas de línea/rama/función para contratos críticos y una línea base global.
  - [ ] CI evita regresiones acordadas sin bloquear por archivos irrelevantes.
  - [ ] Los huecos de alto riesgo se convierten en pruebas o tareas enlazadas.
- Estrategia de pruebas: ejecutar coverage sobre Vitest, auditar mapas/source maps y contrastar manualmente ramas de error en módulos críticos.
- Riesgos: optimizar la cifra en vez del comportamiento, ralentizar CI o medir incorrectamente workers/WASM.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.
