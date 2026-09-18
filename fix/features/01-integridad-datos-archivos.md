# Integridad de datos y archivos

<a id="id-001"></a>

## [ ] ID-001 — Reparar el round trip del bundle unificado

- Categoría: integridad de datos / funcionalidad principal
- Prioridad: crítica
- Estado: abierta
- Problema demostrado: el corpus diferencial no completa el ciclo exportar–limpiar–importar en la sesión unificada.
- Evidencia: `src/shared/project/shellSolverDifferential.test.ts` falla con `Expected finite, acyclic JSON data`; la traza llega a `canonicalSerialize` desde `clearWorking` en `unifiedProjectSession.ts`.
- Impacto: una operación de recuperación o intercambio puede no restaurar el estado completo; además mantiene rojo el gate general.
- Alcance: aislar el valor no finito o ciclo, corregir el contrato de serialización/sesión y preservar compatibilidad de bundles existentes.
- Fuera de alcance: rediseñar el formato completo, cambiar resultados del solver o migrar el almacenamiento a un backend remoto.
- Dependencias: ninguna.
- Tareas relacionadas: ID-003, ID-007, ID-017.
- Criterios de aceptación:
  - [ ] El test diferencial pasa sin relajar la validación de JSON finito y acíclico.
  - [ ] El estado exportado, limpiado e importado conserva entidades, ramas y resultados esperados.
  - [ ] Hay una regresión mínima que identifica el campo que originaba el fallo.
  - [ ] Los bundles previos soportados siguen importando o existe una migración explícita y probada.
- Estrategia de pruebas: reproducir primero el caso aislado; añadir pruebas de unidad para serialización y una prueba de integración de round trip; ejecutar después `npm run test` y `npm run check`.
- Riesgos: ocultar datos inválidos mediante filtrado silencioso, romper checksums o convertir un fallo visible en pérdida de información.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-002"></a>

## [ ] ID-002 — Resolver la contradicción de PDFs normativos

- Categoría: integridad de datos / documentación
- Prioridad: alta
- Estado: abierta
- Problema demostrado: una prueba exige que no haya PDFs normativos versionados, mientras el repositorio contiene cuatro bajo `docs/references/normative/`.
- Evidencia: `src/design/structuralDesignMigration.test.ts:270` falla al encontrar esos cuatro archivos seguidos por Git.
- Impacto: el gate general permanece rojo y no está clara la política de licencia, procedencia y distribución de referencias normativas.
- Alcance: decidir y documentar si esos PDFs pueden distribuirse; alinear repositorio, prueba, `.gitignore` y referencias sin perder trazabilidad.
- Fuera de alcance: interpretar normas, certificar cálculos o sustituir asesoría legal sobre derechos de autor.
- Dependencias: ninguna; la decisión de distribución puede requerir revisión del titular del proyecto.
- Tareas relacionadas: ID-003, ID-019.
- Criterios de aceptación:
  - [ ] Cada PDF tiene procedencia, licencia/permiso y decisión de distribución registradas.
  - [ ] La prueba expresa la política acordada y pasa por la razón correcta.
  - [ ] No quedan enlaces rotos ni instrucciones que dependan de archivos ausentes.
  - [ ] El diff no incorpora contenido normativo nuevo sin autorización verificable.
- Estrategia de pruebas: ejecutar el test aislado de migración, revisar `git ls-files` y validar enlaces de la documentación; completar con `npm run check`.
- Riesgos: publicar material restringido, borrar una fuente necesaria sin reemplazo o debilitar el test para ocultar la contradicción.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.
