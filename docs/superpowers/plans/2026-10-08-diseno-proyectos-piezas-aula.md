# Diseño para proyectos, piezas y aula — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar una actualización grande de Diseño con arranques por intención, piezas recuperables, ejercicios y mejores materiales/apoyos.

**Architecture:** Mantener motores y puentes. Separar catálogos/recetas y conservación de borradores del diálogo que los presenta. Reutilizar memoria v6, controles y layout existentes.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Python 3.12, Playwright con Chromium del sistema.

**Spec:** docs/superpowers/specs/2026-10-08-diseno-proyectos-piezas-aula-design.md

## Global Constraints

- Español; sin nuevas dependencias ni cambios en lockfile.
- Agentes gpt-6-luna con razonamiento high; sin subagentes anidados.
- Cada tarea se implementa y revisa antes de la siguiente; un único implementador escribe código a la vez.
- Usar el checkout cloud existente /workspace/fstructure, ya aislado por la plataforma; no crear worktrees.
- No perder borradores ni piezas; no ampliar comprobaciones normativas sin evidencia; no telemetría ni red implícita.
- Los puentes del workspace siguen siendo la única frontera con 3D.
- Conservar compatibilidad con documentos de taller v1–v6 y presupuestos totales actuales; admitir 96 campos por registro para el formulario de cimentaciones existente (79 campos).
- Tokens y componentes del sistema de diseño; escritorio, oscuro y móvil.
- El usuario autorizó decidir y ejecutar sin las revisiones conversacionales de diseño/plan; la revisión técnica sí se realiza.

## Review Focus

- Borrador incompleto al iniciar otro elemento: queda recuperable, incluso si no hay informe.
- Memoria al límite: ningún campo o elemento cambia si no cabe la conservación.
- Llegada desde 2D/3D con miembro: no abrir un selector que pierda la intención existente.
- Rodillo al extremo izquierdo: el apoyo opuesto estabiliza X cuando corresponda; dos rodillos no producen un falso resultado.
- Diámetro #2 en estructura/contratrabe: las advertencias del diseño de viga se conservan en el informe conjunto.

---

### Task 1: Materiales, refuerzo transversal y apoyos

**Files:**
- Modify: src/design/elements/{shared,beam,beamAnalysis,strapFooting,structure}.ts
- Modify: src/features/design/workbench/{common,BeamWorkbench,ColumnWorkbench,FrameWorkbench,FootingWorkbench,ConcreteStudio,beamModel,BeamDrawings}.tsx
- Create: src/features/design/workbench/MaterialFields.tsx (selector de resistencia sugerida y número editable)
- Create/extend meaningful tests alongside beamAnalysis, elements and workbench components.

**Interfaces:**
- Produces STIRRUP_SIZES with #2 6.4 mm plus existing sizes, keeping REBAR_SIZES unchanged.
- Produces BarSelect usage?: 'longitudinal' | 'transverse' (default longitudinal).
- BeamEnd adds 'roller'; existing inputs remain valid.
- MaterialFields consumes fc/fy strings and callbacks; optional fyv string/callback for beams and frames.
- Quick support presets only change supports, except continuous may append a span when needed.

- [x] Write and run failing behavioral tests for #2 labeling/manual transversal, retained column diameter failures, beam warning below 9.5 mm and unchanged automatic choices.
- [x] Implement catalog separation and warning propagation, without new normative claims.
- [x] Write/run failing tests for a left roller/right pin under q=10 kN/m, L=4 m (Mmax=20 kNm), a fixed/roller beam and rejection of two rollers.
- [x] Implement roller in solver input, drawings, selector and reports; retain legacy numerical results.
- [x] Write/run a failing UI test proving a resistance preset updates the real editable field/input conversion; implement MaterialFields with values from spec, and expose transverse fields.
- [x] Implement quick supports with existing draft history, preserving spans and loads; test that preservation/undo behavior.
- [x] Run covering tests and npm run typecheck, self-review and commit only this task. Record red/green evidence and changed files in the task report.

### Task 2: Catálogo de arranques y conservación de piezas

**Files:**
- Create: src/features/design/workbench/designStarts.ts
- Create: src/features/design/workbench/designStarts.test.ts
- Modify: src/features/design/workbench/designMemory.tsx and designMemory.test.tsx
- Modify: src/features/design/workbench/workbenchStorage.ts and workbenchStorage.test.tsx (64 → 96 campos; presupuesto total sin cambios)

**Interfaces:**
- Export DesignStartCategory = 'project' | 'piece' | 'exercise'.
- Export DesignStart: id, category, element: DesignElementKind, title, description, optional reference, source?: 'model' | 'model3d', fields: Record<string,string>, rows?: Record<string,string>[], levels?: Record<string,string>[].
- Export DESIGN_STARTS: readonly DesignStart[], using copies of existing defaults.
- Extend DesignMemory.start(start: DesignStart): 'started' | 'full'. It preserves the current selected code, captures affected drafts, clears active association for the new draft and writes element. A source start merges frame fields with existing values, changing source only.
- UI in Task 3 will call start, then remount the selected element; no model is mutated here.

- [x] Write/run failing tests for all categories and the concrete recipes required by spec.
- [x] Implement recipes using current model converters and defaults. Keep saved tags ≤32 chars. Exercise simple beam: L=5 m, CM=10 kN/m, CV=0, no weight, pin/roller, reference service M=31.25 kNm. Cantilever: L=2 m, CM=5, CV=0, no weight, fixed/free, reference M=10 kNm. Point: L=4 m, CM/CV=0, P CM=10 at 2 m, no weight, pin/roller, reference M=10 kNm. Remaining exercises use editable current defaults with explicit hypotheses; do not promise pass.
- [x] Verify each recipe reaches its existing engine without invalid geometry; verify the three analytic beam references against the real solver (tolerance 1e-6).
- [x] Write/run failing start tests: preserve incomplete active draft; preserve a different target draft; avoid duplicating saved equivalent; memory budget/capacity abort writes; repeat start/reopen produces independent recoverable pieces; source start retains user materials and code.
- [x] Write/run a failing roundtrip test for all 79 FOOTING_DEFAULTS fields as draft and memory item; raise record field cap to 96 while keeping total size/memory limits and rejecting excessive records.
- [x] Implement the atomic start operation with existing memory validation and budget limits. Invalid calculation is allowed as a recoverable memory draft.
- [x] Run memory/storage/recipe suites, self-review and commit only this task; report exact tests.

### Task 3: Entrada Proyecto / Pieza / Ejercicio

**Files:**
- Create: src/features/design/workbench/DesignStartDialog.tsx and designStart.css
- Create: src/features/design/workbench/DesignStartDialog.test.tsx
- Modify: src/features/design/workbench/DesignWorkbench.tsx and DesignWorkbench.test.tsx
- Modify: src/App.tsx, src/features/workspace/toolIntent.ts and adapters/DesignSurface.tsx

**Interfaces:**
- DesignStartDialog receives open/onOpenChange, model availability flags, current code/projectName, and onStart(DesignStart).
- DesignWorkbench adds startPicker?: boolean; start initialized from it only once. New design action opens the selector in native and isolated layouts.
- ToolIntent design variant adds picker?: boolean. Home openDesign sets picker:true without forcing element=beam. Model/member intents stay as they are. DesignSurface passes picker through, preserving startSource.

- [x] Write/run failing UI tests that Home picker intent and the persistent action open the selector, model/member entry does not, and a recipe loads actual fields/rows without losing previous drafts.
- [x] Build Dialog+Tabs with Proyecto/Pieza/Ejercicio, short useful descriptions/reference values, disabled model entries with explanations and navigation to existing modeling actions where useful.
- [x] Integrate memory.start result; full capacity leaves dialog open with actionable message and unchanged form. Started recipe updates element, report state/history and remount key; close dialog. Canceled picker leaves current draft intact.
- [x] Preserve current code; do not initialize recipes on repeated renders or normal dock switching. Keyboard navigation uses existing Tabs/Dialog behavior.
- [x] Style via tokens, responsive cards and accessible touch targets without a third topbar row.
- [x] Run covering tests, typecheck and architecture check, self-review and commit only this task.

### Task 4: Verificación visual, documentación y entrega

**Files:**
- Modify: docs/design/design-workbench.md, TODO.md, docs/brandbook/{README.md,index.html}
- Add: docs/brandbook/assets/diseno-arranque-*.jpg (day/night/mobile) and supported-workflow screenshots where necessary.

- [x] Run npm run verify against the initial HEAD and npm run check; investigate every required failure.
- [x] Start app and verify real Home → picker → exercise, recipe material editing, #2 warning, complete model entry, two pieces saved/reopened, export request if feasible.
- [x] Check desktop/day/night and mobile for horizontal overflow, clipped controls, keyboard focus and support drawings; fix any discovered regressions with covering tests.
- [x] Update docs and TODO with delivered behavior and remaining new-engine work, and add brandbook evidence.
- [ ] Independent whole-change review with Luna high; resolve material findings and rerun affected checks.
- [ ] Commit final docs/verification fixes and push main only if fast-forward; report verified results and actual publication state.
