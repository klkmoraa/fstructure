# Distribución, CI, PWA y documentación

<a id="id-004"></a>

## [ ] ID-004 — Ejecutar gates WASM y Rust en CI

- Categoría: distribución / CI / numérico
- Prioridad: alta
- Estado: abierta
- Problema demostrado: CI ejecuta `npm run check`, pero ese script no incluye `numeric:wasm:gate`, `numeric:rust:test` ni el `architecture:test` completo.
- Evidencia: los tres gates pasan al ejecutarse por separado; workflow y scripts muestran que no forman parte del camino obligatorio de Pages.
- Impacto: una regresión del backend numérico o de arquitectura puede publicarse aunque el check web sea verde.
- Alcance: añadir jobs reproducibles con toolchains fijados, cachés seguras y artefactos/logs diagnósticos.
- Fuera de alcance: cambiar algoritmos numéricos, compilar todos los targets Rust o bloquear por benchmarks inestables.
- Dependencias: ninguna.
- Tareas relacionadas: ID-003, ID-015, ID-016.
- Criterios de aceptación:
  - [ ] CI ejecuta WASM, Rust y arquitectura en cada cambio que pueda afectarlos.
  - [ ] Las versiones de Node/Rust y el hash/artefacto numérico relevante quedan registrados.
  - [ ] Un fallo impide despliegue y muestra el comando local equivalente.
  - [ ] Las cachés no sustituyen compilación/verificación de fuentes modificadas.
- Estrategia de pruebas: probar workflow en PR con ejecución verde y fallo controlado temporal; comparar salida con comandos locales documentados.
- Riesgos: aumentar mucho el tiempo de CI, caché obsoleta o diferencias entre artefacto probado y publicado.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-010"></a>

## [ ] ID-010 — Alinear instalación, offline y actualización PWA

- Categoría: PWA / distribución
- Prioridad: media
- Estado: abierta
- Problema demostrado: existen manifiestos e iconos, pero `PwaUpdateNotice` no se monta y no se encontró `sw.js` generado en el flujo activo.
- Evidencia: `pwaLifecycle.ts` intenta registrar `./sw.js?...`; búsqueda de importadores/artefactos no demuestra service worker, precache, offline ni aviso de actualización.
- Impacto: la aplicación puede parecer instalable sin ofrecer el ciclo offline/actualización que su código sugiere.
- Alcance: decidir el nivel PWA real; retirar señales incompletas o implementar service worker, estrategia de caché y UX de actualización probadas bajo el base path de Pages.
- Fuera de alcance: sincronización cloud, offline ilimitado de archivos externos o actualización silenciosa que arriesgue trabajo local.
- Dependencias: ninguna.
- Tareas relacionadas: ID-005, ID-019.
- Criterios de aceptación:
  - [ ] El alcance PWA soportado está descrito con precisión en producto y documentación.
  - [ ] Instalación, primer offline, recarga offline y actualización se prueban en build de producción.
  - [ ] Una versión nueva no descarta trabajo local ni mezcla assets incompatibles.
  - [ ] Registro y rutas funcionan en local y bajo el subpath real de Pages.
- Estrategia de pruebas: E2E contra build de producción con contexto limpio, modo offline y dos versiones; inspección de manifest/service worker y recuperación ante fallo.
- Riesgos: servir assets obsoletos, bucle de actualización, caché excesiva de documentos sensibles o falsa promesa offline.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-015"></a>

## [ ] ID-015 — Reducir permisos del despliegue de Pages

- Categoría: CI / seguridad
- Prioridad: media
- Estado: abierta
- Problema demostrado: `.github/workflows/deploy-pages.yml` concede `contents: write` para publicar en la rama `gh-pages`.
- Evidencia: permiso y acción de publicación visibles en el workflow actual.
- Impacto: el token del job tiene capacidad de escritura más amplia que un despliegue moderno con artefacto y entorno Pages.
- Alcance: evaluar/migrar al flujo oficial de Pages con permisos mínimos o documentar por qué la rama es necesaria y aislar el job.
- Fuera de alcance: cambiar proveedor de hosting, administrar secretos externos o rediseñar el release completo.
- Dependencias: ninguna.
- Tareas relacionadas: ID-004, ID-016.
- Criterios de aceptación:
  - [ ] Cada permiso del workflow se justifica y se limita al job que lo requiere.
  - [ ] El despliegue usa el mecanismo mínimo compatible con Pages y conserva historial/auditoría.
  - [ ] Pull requests no confiables no obtienen un token con escritura.
  - [ ] El sitio publicado conserva base path, assets y navegación.
- Estrategia de pruebas: revisión estática del workflow, ejecución en rama protegida/entorno de prueba y smoke del artefacto publicado.
- Riesgos: interrumpir Pages, perder dominio/configuración o asumir permisos inexistentes en forks.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-016"></a>

## [ ] ID-016 — Declarar y comprobar runtimes reproducibles

- Categoría: distribución / tooling
- Prioridad: media
- Estado: abierta
- Problema demostrado: `.nvmrc` fija Node 24 y Rust fija 1.98.1, pero `package.json` no declara `engines` ni `packageManager`; en el entorno auditado `npm` no estaba en `PATH`.
- Evidencia: metadatos del repositorio y fallo ambiental al intentar el comando recomendado.
- Impacto: agentes y CI pueden usar package managers/versiones distintas y obtener instalaciones o auditorías incompatibles.
- Alcance: elegir runtime/package manager autoritativos, declararlos en metadatos y comprobarlos al inicio de workflows/comandos.
- Fuera de alcance: contenerizar todo el desarrollo o soportar versiones indefinidas.
- Dependencias: ninguna.
- Tareas relacionadas: ID-004, ID-013, ID-015.
- Criterios de aceptación:
  - [ ] Node, package manager, Rust y Python requerido tienen versiones/rangos explícitos y coherentes.
  - [ ] Instalación bloqueada usa el lockfile autoritativo sin convertirlo.
  - [ ] CI y documentación fallan pronto con un mensaje accionable ante runtime incompatible.
  - [ ] Un checkout limpio reproduce build y gates documentados.
- Estrategia de pruebas: matriz mínima con versión soportada y una incompatible, instalación limpia, build y gates numéricos.
- Riesgos: fijar versiones imposibles para colaboradores, mantener dos lockfiles o activar Corepack sin documentarlo.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-019"></a>

## [ ] ID-019 — Reconciliar README, evidencia visual y estado real

- Categoría: documentación
- Prioridad: baja
- Estado: abierta
- Problema demostrado: README mezcla dos introducciones y describe gates más amplios que CI; QA visual cita artefactos ignorados y el ledger conserva pendientes.
- Evidencia: comparación de README, workflow, `design-qa.md`, `docs/design/fidelity-ledger.md` y resultados de esta auditoría.
- Impacto: una persona o IA puede elegir comandos incorrectos, sobreestimar garantías o dar por cerrada evidencia no reproducible.
- Alcance: consolidar introducción, separar capacidad de gate obligatorio y enlazar evidencia vigente con fecha/commit.
- Fuera de alcance: material comercial, reescribir toda la documentación o declarar certificación de ingeniería.
- Dependencias: ID-003, ID-009, ID-010.
- Tareas relacionadas: ID-002, ID-004, ID-007, ID-016.
- Criterios de aceptación:
  - [ ] README tiene una sola introducción y comandos ejecutables en el runtime declarado.
  - [ ] Cada afirmación de calidad distingue prueba local, CI, verificación manual y limitación.
  - [ ] QA/ledger enlazan artefactos disponibles o un procedimiento reproducible.
  - [ ] Las limitaciones experimental, normativa, móvil y PWA coinciden con el producto real.
- Estrategia de pruebas: ejecutar todos los comandos copiados desde la documentación, validar enlaces locales y revisión cruzada contra workflows/package scripts.
- Riesgos: documentación que envejece sin dueño, duplicar fuentes de verdad o convertir resultados puntuales en garantías permanentes.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.
