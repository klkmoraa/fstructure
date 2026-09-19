# UI, UX, accesibilidad y responsive

<a id="id-008"></a>

## [ ] ID-008 — Dar estructura semántica a la mesa de trabajo

- Categoría: UI / accesibilidad
- Prioridad: media
- Estado: abierta
- Problema demostrado: la mesa de trabajo usa landmarks y controles nombrados, pero su `main` no tiene nombre accesible y no hay encabezados visibles `h1`–`h6`.
- Evidencia: inspección del DOM en Chromium a 1280×720; la portada sí presenta jerarquía, mientras 2D/Diseño/3D/FEM comparten el shell sin encabezado de página.
- Impacto: lectores de pantalla y navegación por encabezados reciben menos contexto sobre la superficie activa.
- Alcance: definir un nombre estable para `main`, una jerarquía de encabezados y anuncios apropiados al cambiar de superficie.
- Fuera de alcance: rediseño visual total, cambio de identidad o sustitución del sistema de paneles.
- Dependencias: ninguna.
- Tareas relacionadas: ID-005, ID-009.
- Criterios de aceptación:
  - [ ] Cada superficie anuncia un nombre de página único y comprensible.
  - [ ] Existe una jerarquía de encabezados lógica sin introducir ruido visual innecesario.
  - [ ] Tabs, landmarks y paneles conservan relaciones ARIA válidas.
  - [ ] Teclado, foco y navegación actual continúan funcionando.
- Estrategia de pruebas: pruebas de componentes para nombres/roles; smoke con teclado y árbol de accesibilidad en las cuatro superficies; verificación manual con lector de pantalla en al menos un sistema.
- Riesgos: duplicar anuncios, ocultar encabezados de forma incorrecta o alterar el layout compacto.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-009"></a>

## [ ] ID-009 — Automatizar evidencia móvil y actualizar el ledger

- Categoría: UI / responsive
- Prioridad: media
- Estado: abierta
- Problema demostrado: el ledger marca pendiente la evidencia móvil de Diseño y las capturas históricas citadas por QA viven en una ruta ignorada.
- Evidencia: `docs/design/fidelity-ledger.md` conserva el pendiente; `design-qa.md` referencia `output/playwright/`, que no está versionado; esta auditoría no pudo variar el viewport del navegador integrado.
- Impacto: no hay evidencia reproducible de que las cuatro superficies sean utilizables en tamaños móviles y táctiles.
- Alcance: definir viewports representativos, automatizar recorridos y conservar artefactos o reportes verificables con política de actualización.
- Fuera de alcance: prometer soporte para todo dispositivo, rediseñar cada panel o sustituir pruebas en dispositivos reales.
- Dependencias: ID-005.
- Tareas relacionadas: ID-008, ID-019.
- Criterios de aceptación:
  - [ ] Hay pruebas reproducibles en al menos un móvil estrecho y una tableta.
  - [ ] Se cubren portada, 2D, Diseño, 3D y FEM, incluidos paneles y diálogos críticos.
  - [ ] No existe desbordamiento que impida alcanzar controles esenciales y los objetivos táctiles cumplen el criterio adoptado.
  - [ ] El ledger enlaza evidencia vigente generada por CI o un procedimiento documentado.
- Estrategia de pruebas: suite de navegador con emulación de viewport/touch, capturas y assertions de overflow; comprobación manual en un dispositivo cuando sea posible.
- Riesgos: basarse sólo en snapshots visuales, generar artefactos pesados o fijar pruebas a coordenadas frágiles.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.
