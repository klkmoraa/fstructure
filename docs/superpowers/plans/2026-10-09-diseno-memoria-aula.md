# Diseño: Memoria y Aula — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizar piezas y entregas del proyecto y acompañar los ejercicios con comparación analítica persistente.

**Architecture:** El hook de Memoria controla conservación y preflight; su diálogo queda en un módulo propio con filtros/selección de UI. Las guías de viga usan un campo corto existente en el formato de borrador y un helper independiente de recetas que utiliza el solver de servicio.

**Tech Stack:** React 19, TypeScript 6, Vitest, Vite, Python y Chromium/Playwright del entorno ya configurado.

**Spec:** docs/superpowers/specs/2026-10-09-diseno-memoria-aula-design.md

## Global Constraints

- Español; sin nuevas dependencias ni cambios de lockfile; agentes Luna high, sin subagentes anidados.
- Usar /workspace/fstructure, checkout cloud ya aislado; main autorizado por la persona y AGENTS.md. Un implementador de código a la vez.
- No perder datos del usuario, red implícita ni telemetría; mantener fronteras 2D/3D y motores/normas vigentes.
- Mantener 60 piezas, 180,000 caracteres de memoria, documento de 240,000 caracteres, 16 entradas, 96 campos y compatibilidad v1–v6.
- Copias de modelo siguen vinculadas al modelo vigente; no representan un segundo modelo.
- Comparación educativa de servicio separada de cumplimiento normativo; no agregar estados de aprobación ni reglas normativas nuevas.
- Tokens y componentes actuales; escritorio, oscuro y teléfono. Baseline dacd669 ya pasó 1,118 pruebas y full gate; no repetir baseline sin cambios.
- TDD y suites relacionadas por tarea; root corre verify/full gate final y navegador. La persona autorizó decidir y ejecutar sin gates conversacionales.

## Review Focus

- Abrir otra pieza con borrador actual incompleto y destino distinto: ambos quedan recuperables antes de cambiar campos/norma.
- Rechazo del presupuesto global aunque memory sola quepa: cero escrituras y estado/activo intactos.
- Copiar una fila con clave de 32 caracteres, filas y niveles: copia única, fuente y datos preservados, activo intacto.
- Selección oculta por filtros o un registro que deja de calcular: PDF completo no cambia por filtros; selección se recalcula por ids válidos.
- Cambiar hipótesis o datos inválidos de un ejercicio: no dejar visible un número anterior como comparación válida.

---

### Task 1: Mutaciones y apertura conservadora

**Files:** Modify src/features/design/workbench/{designMemory.tsx,designMemory.test.tsx,DesignWorkbench.tsx,DesignWorkbench.test.tsx}; extend workbenchStorage.test.tsx only if needed.

**Interfaces:** Export DesignMemory. Keep save/saveAxes/start returns; remove(id): 'removed' | 'full' | 'missing'; open(id): WorkbenchMemoryItem | 'full' | undefined; add duplicate(id): 'duplicated' | 'full' | 'missing'. commit helper validates next memory and preflights all planned writes before changing any state/writing. onLoad stays (id: string) => void; DesignWorkbench handles 'full' with message and keeps dialog open.

- [ ] Add failing tests for save/saveAxes/remove/open rejection using storage.canWrite false and a real valid document near 240,000 characters. Assert no write/persist, unchanged items/active and drafts.
- [ ] Implement common preflight for memory mutations with isMemoryItem, uniqueness, count/size and aggregate canWrite; retain public outcomes, ids, saved dates and independent drafts.
- [ ] Add failing open tests for incomplete current plus different target preserved, saved records unchanged, equivalent drafts deduplicated, full abort and missing default rows/levels loaded correctly. Implement conservative opening with the existing preservation semantics of start; preserve raw snapshots and current norm before writes.
- [ ] Remove the discard-confirmation branch in MemoryDialog; opening always uses conservative open. Handle blocked open/save in the real workbench with an actionable storage message.
- [ ] Add failing duplicate tests for arbitrary complete/incomplete rows, deep independence, source/code retained, unique 32-char tags, repeated copies and full-budget abort. Implement duplicate without loading or changing active.
- [ ] Run related memory/storage/workbench tests, typecheck, scoped lint and diff check; self-review and commit only source/tests. Write task-1-report.md with red/green evidence.

### Task 2: Memoria organizada y exportación por selección

**Files:** Create src/features/design/workbench/{DesignMemoryDialog.tsx,DesignMemoryDialog.test.tsx,designMemoryView.ts,designMemoryView.test.ts,designMemory.css}; modify designMemory.tsx to move only dialog UI, DesignWorkbench.tsx imports/integration, and designWorkbench.css only to remove moved styles if appropriate.

**Interfaces:** Use exported DesignMemory from Task 1. MemoryDialog preserves current props; imports reportFromMemoryItem and models from hook/types. DesignMemoryView helpers derive search/filter statuses and selected reports without writing storage. Filter state: query, element ('all' or DesignElementKind), code ('all' or code id), status ('all' | 'pass' | 'warning' | 'fail' | 'invalid'). Selection is a Set of memory ids, not report indices. onExport keeps readonly DesignReport[].

- [ ] Add failing pure tests for accent/case-insensitive key/title/place/norm search, combined filters, partial-scope status distinction and invalid outcomes. Implement focused view helpers; no duplicate report computations.
- [ ] Add failing real-dialog tests for search/filter actions, reset, empty-vs-no-matches, persistent hidden selection, pruning deleted/invalid ids and complete export unaffected by filters.
- [ ] Extract/build the dialog with controls from the design system, summary counts, row checkboxes, select-visible/clear selection and explicit Exportar memoria/Exportar selección counts. Preserve saved order and exclude invalid reports with explicit notice.
- [ ] Add row duplicate action calling memory.duplicate; show outcome without loading. Test source row/active unchanged and rejected capacity message. Keep open/save/remove available and report failures.
- [ ] Implement responsive tokens CSS with accessible labels and touch targets; desktop/night/mobile QA belongs to Task 4.
- [ ] Run related hook/storage/dialog/view/workbench/PDF tests, typecheck, scoped lint and diff check; self-review and commit only source/tests; write task-2-report.md.

### Task 3: Referencias vivas de Aula

**Files:** Create src/features/design/workbench/{beamExercises.ts,beamExercises.test.ts,BeamExerciseGuide.tsx,BeamExerciseGuide.test.tsx,beamExercises.css}; modify beamModel.tsx, designStarts.ts, BeamWorkbench.tsx and tests for integration/memory roundtrip.

**Interfaces:** BEAM_DEFAULTS adds exercise: ''. Three beam exercise recipes set their existing id into fields.exercise; other beam starts keep ''. Helper module has no import from designStarts to avoid its beamModel cycle. Export evaluateBeamExercise(code: DesignCodeId, draft: BeamDraft, spans: readonly SpanDraft[]) giving title/problem/hypotheses and status comparable/changed/invalid with numeric formula/expected/solver/difference only when comparable. BeamExerciseGuide receives evaluation and onDismiss; unknown/empty exercise id shows no guide.

- [ ] Add failing tests for recipe ids persisted and exercise='' in piece recipes; roundtrip exercise field through project storage and memory/open without schema change.
- [ ] Add failing solver tests for starting cases: 31.25, 10, 10 kN·m (tolerance 1e-6); edit simple L to 6, q to 12 gives 54; combined CM+CV and point CM+CV summed per station before extracting peak. Implement current-value closed formulas and analyzeBeam using real converter/valid physical section properties.
- [ ] Add failing tests for extra span, self-weight, incompatible supports, point off-center, extra load family and invalid number: changed/invalid with no stale numeric comparison. Implement explicit hypotheses checks before solving.
- [ ] Build persistent panel in the beam workbench with original problem, current formula/substitution, solver service moment and absolute difference in kN·m. Distinguish service reference from normative checks. Dismiss changes only exercise field, through current undo history.
- [ ] Add real-workbench tests for recipe→guide, editable reference, suspended reference, hide/undo, memory/reopen; avoid tests that only freeze copy/style.
- [ ] Run exercise/starts/beam/workbench/memory/storage suites, typecheck, scoped lint and diff check; self-review, commit only source/tests and write task-3-report.md.

### Task 4: Validación, documentación y publicación

**Files:** Modify docs/design/design-workbench.md, TODO.md and docs/brandbook/{README.md,index.html}; add current screenshots and docs/design/diseno-memoria-aula-validation-2026-10-09.md.

- [ ] Browser: mixed beam/footing/frame memory, search/filter/select/copy, complete vs selection PDF with actual downloaded text, incomplete draft opening, save/reload; invalid import leaves model intact.
- [ ] Browser: three beam references, edit L/q, suspension, hide/undo and reopen guide, no page errors; desktop day/night and 390×844 overflow/touch checks. Update brandbook screenshots and inspect them.
- [ ] Correct stale v5 documentation to v6; document new behavior and remaining new-engine work; mark only delivered TODOs.
- [ ] Run npm run verify -- dacd6699eb343376fe66e47d63b9eac50678d921 and npm run check; record exact outputs.
- [ ] Independent whole-change review with Luna high, one final fix wave/scoped rereview if needed, covering checks and clean task workspace cleanup.
- [ ] Final verified commit to main, fast-forward push and actual gh-pages deploy commit confirmation.
