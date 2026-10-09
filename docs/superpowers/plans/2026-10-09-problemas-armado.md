# Problemas propios y armado visible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver problemas propios y proponer acero con geometría fija y distribución física visible.

**Architecture:** Los motores puros generan las barras que utilizan cálculo y dibujo. El taller convierte los borradores, ejecuta búsquedas cancelables en workers y ofrece formularios vacíos mediante el resguardo de memoria existente. Home sólo transmite una intención de inicio.

**Tech Stack:** Node 24, React 19, TypeScript, Vitest, Vite, workers y Playwright existentes.

**Spec:** `docs/superpowers/specs/2026-10-09-problemas-armado-design.md`

## Global Constraints

- Español; actuar sin preguntas; agentes Luna con razonamiento alto; commit en main y push tras verificación.
- Node 24, React 19 y TypeScript existentes; ninguna dependencia nueva.
- Cero pérdida de datos: documentos v1–v6 y borradores heredados siguen abriendo; iniciar un formulario propio usa el resguardo existente de memoria.
- Nada sale del dispositivo sin acción explícita; sin telemetría ni red implícita.
- Home ligera, diálogos y mesa lazy; fronteras 2D/3D intactas.
- Resultados derivados se invalidan al editar; nunca aplicar una propuesta calculada con entradas anteriores.
- Las formas no rectangulares conservan las distribuciones existentes; no adquieren grupos ficticios.
- Los dibujos y PDF deben reflejar los datos propios, los grupos y el alcance experimental.

## Review Focus

- Barras continuas sin refuerzo extra que ocupan dos capas: dibujo y centroide coinciden (Task 1).
- Columna rectangular con cantidades distintas por cara y circular: buscar acero nunca cambia sus dimensiones (Task 1).
- Grupos cerca de esquinas que colisionan con el centro de cara: rechazar con separación real (Task 2).
- Ejercicio antiguo con campo `exercise` y borrador incompleto: conservarlo sin reactivar ejemplos (Task 3).
- Editar, cambiar norma o salir durante una búsqueda: respuesta antigua no modifica el borrador (Task 3).

---

### Task 1: Barras físicas de viga y propuesta de acero de columna

**Files:**
- Create: `src/design/elements/beamBarLayout.ts` y prueba correspondiente.
- Modify: `src/design/elements/beam.ts`, `src/features/design/workbench/BeamDrawings.tsx`, `src/features/design/workbench/columnModel.tsx`.
- Test: pruebas existentes de beam, BeamDrawings y columnModel, o `columnReinforcement.test.ts` dedicado.

**Interfaces:**
- Produce `layoutBeamBed(...)` en el módulo nuevo: entrada geométrica en mm y grupos continuo/adicional; salida de barras `{ xMm, fromFaceMm, diameterMm, kind: 'continuous' | 'extra', layer: 1 | 2 }`. El implementador define/exporta tipos nombrados; cálculo y dibujo consumen una sola distribución.
- Produce `proposeColumnReinforcement(codeId: DesignCodeId, draft: typeof COLUMN_DEFAULTS): Partial<typeof COLUMN_DEFAULTS> | null` desde columnModel. Campos devueltos únicamente de armado: `bar`, `barsWidth`, `barsDepth`, `barCount` y `tie` si requiere el diámetro normativo. Mantiene datos y dimensiones; la función existente `proposeColumn` sigue dimensionando.

- [ ] Escribir pruebas que fallen: seis continuas sin extras pasan a dos capas, identidad/diámetro conservados, centroide ponderado coincide con la distribución; dibujo no lanza y representa las seis. Incluir diámetros mixtos y el caso automático anterior de dos continuas.
- [ ] Ejecutar las pruebas nuevas y observar el fallo de referencia.
- [ ] Implementar distribución compartida; respetar mínimo libre y máximo dos capas existentes, rechazar si no caben. Usar área real por barra para centroide. Corregir el dibujo para consumir el mismo resultado.
- [ ] Escribir y ejecutar en rojo pruebas de propuesta de columna rectangular 40×50, circular Ø45, acciones nulas explícitas, acciones no finitas y sección imposible. Comprobar dimensiones/materiales/acciones intactos y resultado sin fallos para una solución factible.
- [ ] Implementar búsqueda fija con catálogo existente, cantidades 2–12 por cara y 4–30 en circular; elegir mínimo As entre candidatos que el motor acepta, sin ocultar chequeos pendientes. No cambiar secciones ni separaciones capturadas.
- [ ] Ejecutar pruebas relacionadas y `npm run typecheck`, revisar regresiones numéricas; commit de Task 1 y reporte.

### Task 2: Grupos separados y búsqueda de diámetros en sección

**Files:**
- Modify: `src/design/concrete/sectionStudio.ts`, `src/design/concrete/sectionStudio.test.ts`, `src/features/design/workbench/concreteStudioModel.tsx`, `src/features/design/workbench/concreteStudioModel.test.tsx`.
- Create: módulo pequeño de distribución de grupos si evita cargar más sectionStudio.

**Interfaces:**
- Extiende `SectionStudioInput.barLayout` con `'zones'`, propiedades opcionales `cornerBarCount` y `faceBarCount`. Sólo rectángulo/cuadrado; total 4×(corner+face). Sin cambio a entradas heredadas.
- Extiende `SECTION_DEFAULTS` con `cornerBarCount: '1'`, `faceBarCount: '1'`. sectionInput convierte y calcula el total en zones, validación informa enteros/fuera de rango. `preset: 'custom'` válido, sin rellenar datos.
- Extiende `proposeSectionReinforcement(input, options?: { diametersMm?: readonly number[] })`, misma unión de retorno actual. Sin opciones conserva búsqueda de diámetro fijo. Con opciones busca todos los diámetros finitos positivos únicos. En zones enumera corner 1–3 y face 0–3; en layouts anteriores conserva búsqueda hasta 24 barras. Elige menor As factible, desempate determinista. Propone sólo armado.

- [ ] Escribir/ejecutar en rojo tests de grupos: 600×600 con 3 por esquina y 3 por cara =24 posiciones distintas, simétricas, dentro del estribo y separación suficiente; 200×200 congestionada inválida; cantidades no enteras o >3 inválidas; círculo con zones inválido.
- [ ] Implementar coordenadas: c1 esquina; c2 esquina+vecino horizontal; c3 esquina+vecino horizontal+vertical. Centro de cara f1 centro, f2 ±paso/2, f3 −paso/0/+paso. Paso=db+clear mínimo geométrico existente. Todas las distancias entre pares se comprueban, no escalar ni superponer para aparentar encaje.
- [ ] Escribir/ejecutar en rojo búsqueda con catálogo: conserva geometría/materiales/acciones; supera configuración manual congestionada; no solución no muta; N/M negativos y perpendicular no verificable conservan rechazo vigente; diámetros inválidos rechazados; legado sin opciones sigue funcionando.
- [ ] Implementar extensión de búsqueda y adaptadores. Resultado/área/capacidad/cuántos usan posiciones reales; añadir reporte del acomodo y criterio de separación sin afirmar un máximo normativo de tres.
- [ ] Ejecutar pruebas relacionadas y `npm run typecheck`; commit y reporte de Task 2.

### Task 3: Formularios propios, interfaz reunida y búsquedas cancelables

**Files:**
- Modify: `src/features/design/workbench/ConcreteStudio.tsx`, `ColumnWorkbench.tsx`, `BeamWorkbench.tsx`, `designStarts.ts`, `DesignStartDialog.tsx`, `DesignWorkbench.tsx`, CSS de estos componentes si necesario.
- Modify: `src/features/welcome/HomePage.tsx`, `NewExerciseDialog.tsx`, `src/features/workspace/toolIntent.ts`, `src/features/workspace/adapters/DesignSurface.tsx`, `src/App.tsx`.
- Create: `src/features/design/workbench/reinforcementProposal.ts`, `reinforcementProposal.worker.ts` y pruebas de contrato/cancelación.
- Test: DesignWorkbench, designStarts, DesignStartDialog, HomePage, NewExerciseDialog y almacenamiento existentes; nuevas pruebas de ConcreteStudio/ColumnWorkbench si faltan.

**Interfaces:**
- Consume `proposeColumnReinforcement` (Task 1) y `proposeSectionReinforcement` con opciones y campos zones (Task 2).
- Intención design añade `category?: 'project' | 'piece' | 'exercise'`; prop opcional `startCategory` atraviesa DesignSurface/DesignWorkbench a `initialCategory` del diálogo. Home callback `onOpenDesign(category?: 'project' | 'piece' | 'exercise')`.
- Proposal worker comparte unión serializable propia: entrada discriminada column/section con snapshot; respuesta proposed con sólo campos de armado o failed con reason. Helper crea/cancela worker y protege respuestas obsoletas; fallback existente sin worker permite resolver y descarta snapshots antiguos. No reutilizar ProposalStep de secciones de pórtico para otro significado.

- [ ] Escribir/ejecutar en rojo tests: Home Aula abre inicio exercise de Diseño; su modelo en blanco no ofrece selector de casos; tres inicios propios incompletos no calculan ni contienen referencia resuelta; iniciar preserva borradores actuales y memoria llena no cambia nada.
- [ ] Sustituir ejemplos de categoría exercise por `problem-section` (rectangle/layers/custom), `problem-column` (rectangular), `problem-beam` (un claro pin/roller). Vaciar dimensiones, cover, fc, fy y N/M imprescindibles; en viga vaciar longitud/dead/live, no simular Mu directo con cargas. Configuración restante explícita, tag vacío, campo exercise vacío.
- [ ] Retirar tarjetas Aula de casos prefabricados y selector visible del NewExerciseDialog; conservar APIs de datos educativas si usadas por proyectos guardados. Retirar BeamExerciseGuide de la mesa; preservar lectura del campo exercise y su memoria. Adaptar tests de guías retiradas a conservación de borrador, no a copy.
- [ ] Conectar intención Home → inicio exercise sin resetear trabajo; evitar importar motor/taller estáticamente en Home/App.
- [ ] Escribir/ejecutar en rojo tests de propuesta: sección congestionada puede pedir acero; catálogo o diámetro elegido; columna acero conserva sección y botón sección separado; editar/cambiar código/unmount/cancelar ignora respuestas pendientes; error no muta; fallback conserva comportamiento.
- [ ] Implementar workers y ciclo de cancelación al modificar snapshots. Aplicar únicamente campos permitidos de armado sobre snapshot vigente. Búsqueda cerrada y rechazos visibles; no poner una respuesta antigua encima de un cambio manual.
- [ ] Reunir los datos y simplificar: ConcreteStudio elimina preset destructivo y filosofía duplicada; datos de sección/materiales/acciones cercanos, acero con distribución y propuesta, controles de grupos 1–3/0–3, mostrar separación/As y explicar que son grupos separados. ColumnWorkbench reúne sección/materiales, acciones y acero/transversal; hipótesis de esbeltez en disclosure con resumen visible; botones «Proponer acero» y «Proponer sección». BeamWorkbench reúne datos geométricos/materiales y acero/transversal, mantiene cargas/apoyos juntos, detalles avanzados desplegables y alcance visible. No esconder una acción/cortante capturado sin indicarlo.
- [ ] Ejecutar pruebas relacionadas, typecheck y almacenamiento legado/incompleto; commit y reporte de Task 3.

## Cierre a cargo del controlador

- [ ] Revisar cada task con otro agente Luna alto; corregir importantes con el implementador original.
- [ ] Navegador real: datos de sección propios → propuesta → dibujo → memoria → recarga → PDF; columna fija y viga en dos capas; Aula sin ejemplos; cancelar/editar y grupos congestionados; importación inválida preserva documento. Día/Noche desktop y móvil 390px sin overflow.
- [ ] Actualizar TODO y ficha/capturas de brandbook, documentar evidencia numérica y limitaciones.
- [ ] `npm run verify -- 517024cfc1a2823300afd8795db65fc081612297` y `npm run check` deben terminar exitosamente.
- [ ] Una revisión global, una ola de fixes si necesaria y una revisión acotada; limpiar sólo scratch de este plan.
- [ ] Commit final main, push autorizado y comprobar publicación gh-pages contra SHA, consultando FETCH_HEAD en checkout single-branch.
