# Pruebas y calidad

<a id="id-003"></a>

## [ ] ID-003 — Recuperar un gate general completamente verde

- Categoría: pruebas y calidad
- Prioridad: alta
- Estado: abierta
- Problema demostrado: el script `check` se detiene en Vitest con dos fallos; 95/97 archivos y 585/587 casos pasan.
- Evidencia: fallos confirmados en `shellSolverDifferential.test.ts` y `structuralDesignMigration.test.ts`; typecheck, lint y tests anteriores se ejecutan, pero los pasos posteriores del script no llegan a correr.
- Impacto: no existe una señal única de integración confiable para aceptar cambios.
- Alcance: cerrar ID-001 e ID-002, ejecutar el pipeline completo y asegurar que CI reproduce el mismo resultado.
- Fuera de alcance: omitir suites, marcar tests como skip o reducir assertions para obtener verde artificial.
- Dependencias: ID-001, ID-002.
- Tareas relacionadas: ID-004, ID-005, ID-017.
- Criterios de aceptación:
  - [ ] `npm run check` termina con código 0 en un checkout limpio y runtime soportado.
  - [ ] No hay tests omitidos o snapshots actualizados sin revisión de intención.
  - [ ] CI usa el mismo comando y conserva logs suficientes para diagnosticar fallos.
  - [ ] La evidencia registra versiones de Node, package manager y commit.
- Estrategia de pruebas: reparar primero cada regresión aislada, luego ejecutar `npm run check` completo dos veces, una en local y otra en CI.
- Riesgos: enmascarar los fallos, depender de orden/estado local o aceptar flakiness como éxito.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

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
