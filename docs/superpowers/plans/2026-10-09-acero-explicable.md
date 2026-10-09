# Acero explicable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver flexión con acciones dadas y editar/comparar armado y cargas propios, conservando cada pieza y su entrega.

**Architecture:** Motores puros en src/design, adaptadores y editores pequeños en el taller. Estado estructurado versionado y workers cancelables; cálculo/dibujo/PDF comparten los datos. Este bloque no introduce vínculos del modelo, losas ni secciones libres: sus planes siguientes consumen estas interfaces.

**Tech Stack:** TypeScript, React, Vitest, workers, pdf-lib existentes; Node 24 y npm 11.

**Spec:** docs/superpowers/specs/2026-10-09-acero-explicable.md

## Global Constraints

- Español; agentes Luna con razonamiento alto; sin dependencias nuevas, backend ni red implícita; separación territorial de AGENTS.md; Home carga diferida.
- Perfil no respaldado o check no evaluado nunca se presenta como cumple.
- No perder datos, aumentar presupuestos existentes ni reemplazar acciones dadas por cargas inventadas.
- Un solo implementador activo; TDD de comportamiento y cálculo, pruebas relacionadas y npm run verify. No pruebas de copy o CSS; navegador al integrar. Commit en main autorizado por AGENTS.md; no push de tareas parciales.
- Scratch/reports sólo en .superpowers/sdd/acero-explicable/; no git add -f. No agentes hijos.

## Review Focus

- Borrador con strings vacíos y filas inválidas: conservar sin interpretar como cero (tareas 1/2).
- Documento v6 con campos desconocidos y memoria llena: migrar sin descarte y cancelar antes de mutar (tarea 1).
- Distribución triangular y carga puntual con salto: equilibrio exacto y misma estación a izquierda/derecha (tarea 2).
- Mu grande o barras que no caben: diagnóstico sin proponer cumplimiento falso (tareas 3/4).
- Editar o cancelar durante búsqueda y deshacer aplicación: respuesta anterior no modifica nuevo borrador (tarea 4).

---

### Task 1: Estado estructurado de viga y memoria v7

**Files:** Create src/features/design/workbench/beamDetailDraft.ts; modify workbenchStorage.ts, designMemory.tsx, designReport.ts as needed; tests workbenchStorage.test.ts, designMemory.test.tsx and beamDetailDraft.test.ts in the same directory.

**Interfaces:** Export BeamDetailDraft = { kind:'beam'; version:1; loads:BeamLoadDraft[]; bastions:BeamBastionDraft[]; stirrupZones:BeamStirrupZoneDraft[] }. All editable numbers are raw strings <=32 chars. BeamLoadDraft={id,span,kind:'point'|'distributed',category:'dead'|'live',start,end,startValue,endValue}; BeamBastionDraft={id,bed:'top'|'bottom',count,diameterMm,startM,endM}; BeamStirrupZoneDraft={span,endSpacingMm,endLengthM,centerSpacingMm}; span is raw 1-based string. IDs <=32 safe chars; max32 loads,16 bastions,8 stirrup zones. Export EMPTY_BEAM_DETAILS and isBeamDetailDraft(value:unknown): value is BeamDetailDraft. Storage key beam-details; WorkbenchMemoryItem.details?:BeamDetailDraft valid only for element beam. Schema version7 reads1–7. No geometry validity in storage: incomplete physical rows must survive. Canonical empty detail draft and missing details compare equal.

- [ ] Step 1: Add behavioral failing tests: v6 fields `{legacy:'yes'}` retained after export as v7; save/open/duplicate beam with a blank load value and custom bastion reproduces details exactly; details on a column rejected; 33 loads and strings33 rejected; memory capacity preflight prevents all mutation; missing details equals empty draft.
- [ ] Step 2: Run focused Vitest commands and record intended failures before implementation.
- [ ] Step 3: Implement typed validator, project/browser storage readers/writers and memory capture/equality/start/open atomic writes. Retain old keys/caps, cloning and incomplete-draft semantics. Expose a small useStoredBeamDetails(storage) hook using existing history patterns if needed; produce its exact signature in the report for Task2.
- [ ] Step 4: Run related storage/memory tests and npm run verify; output must pass. Record any known baseline console warnings without suppressing tests.
- [ ] Step 5: Commit only touched source/tests: feat(design): preserve structured beam details in workbench v7. Write task-1-report.md with interfaces, RED/GREEN commands/results and SHA.

### Task 2: Cargas generales y editor de bastones/estribos

**Files:** Modify src/design/elements/beam.ts, beamAnalysis.ts, src/features/design/workbench/beamModel.tsx, BeamWorkbench.tsx; create BeamDetailEditor.tsx and beamDetailInput.ts beside them; focused engine/adapter/editor tests and existing CSS as needed.

**Interfaces:** Consume BeamDetailDraft and storage/hook from Task1. Export parseBeamDetails(draft:BeamDetailDraft, spans:readonly SpanDraft[]): {loads:readonly BeamExtraLoad[]; bastions:readonly ProvidedBastion[]; stirrupZones:readonly(ProvidedStirrupZone|null)[]; errors:readonly string[]} with strict finite parsing and position validation. BeamExtraLoad exported from beam.ts: {spanIndex:number; category:'dead'|'live'; kind:'point'|'distributed'; startM:number; endM:number; startKn:number; endKn:number}. Point uses startKn kN and startM m; distributed uses kN/m, start/end m. Add optional extraLoads to BeamInput. beamToInput/beamReport accept optional details as final parameter; reportFromMemoryItem passes saved details.

- [ ] Step 1: Failing tests: simple L5 q4 over[0,1]+P10 at3 produces RA7.6/RB6.4 and force/moment balance <=1e-9; full triangular load q0→6 on L3 gives RA3/RB6 and peak moment at sqrt(3)m; invalid/blank/out-of-clear input stops calculation, not clamps; old single-point forms unchanged. Custom top bastion count2 diameter15.9 start1/end2 and zones end100/length.6/center200 reach engine/drawing; overlap and span mismatch diagnostic; details survive save/open.
- [ ] Step 2: Run focused tests, record RED.
- [ ] Step 3: Convert valid rows to serializable solver member loads per existing dead/live cases. Expose add/remove load/bastion rows and per-clear end/center zones under focused disclosures; ownBastions supports custom. Draw selectable regions with numeric keyboard controls, clear coordinate origin and same engine geometry. Surface existing development checks or explicit not-evaluated detail rather than inventing a rule. Report grouped loads and region data/PDF, and provide required/minimum/provided As and effective d from existing BedSection. Preserve input draft on invalid rows.
- [ ] Step 4: Run related engines/adapters/UI tests plus npm run verify; confirm physical layout and legacy tests. Report UI selectors for browser QA.
- [ ] Step 5: Commit feat(design): edit beam loads and reinforcement regions; report task-2-report.md.

### Task 3: Flexión propia con momento dado

**Files:** Create src/design/elements/flexureExercise.ts and test; create src/features/design/workbench/flexureModel.tsx, FlexureWorkbench.tsx and focused tests; integrate DesignWorkbench.tsx, designReport.ts, designMemory.tsx, workbenchStorage.ts, start/new-problem definitions and lazy Home entry only as needed.

**Interfaces:** New DesignElementKind 'flexure'. Export FlexureExerciseInput={code:DesignCodeId; widthMm:number; heightMm:number; coverMm:number; fcMpa:number; fyMpa:number; stirrupDiameterMm:number; aggregateMm:number; momentKnM:number; top:BarGroup; bottom:BarGroup}; designFlexureExercise(input):FlexureExerciseResult exposing requiredMm2,minimumMm2,providedMm2,effectiveDepthMm,capacityKnM,layout,checks,notes and status consistent with report. Use existing shared requiredFlexuralSteelMm2/code law and physical layout; do not implement a divergent code equation. Raw form fields in FLEXURE_DEFAULTS, Mu empty for a new problem. export flexureReport(code,draft):DesignReport.

- [ ] Step 1: Failing tests of direct Mu (no span/load required), Mu=0 explicit vs blank, tension bed for positive/negative moment, reference rectangle equilibrium and As rounded only at display, failure of congested bars/above maximum, incomplete draft persistence. Memory switch opens flexure and PDF includes given Mu, units, As/d and scope.
- [ ] Step 2: Run RED; independently compute a small rectangular reference using stated code law/materials, tolerance <=0.1%.
- [ ] Step 3: Implement focused compute-required/check-own objectives using direct moment, profile and geometry. Show substituted equation and units in report groups plus citations already registered. New nav must fit mobile (scroll/chooser); unknown legacy exercises preserved. Complete all element maps/filters/start/undo/PDF paths; no solved examples added.
- [ ] Step 4: npm run verify and focused direct flexure/legacy memory/start tests pass. Report limitations axial/biaxial/shear/development/deflection explicitly.
- [ ] Step 5: Commit feat(design): solve flexure exercises from given actions; task-3-report.md.

### Task 4: Alternativas constructivas con geometría fija

**Files:** Create src/design/elements/reinforcementAlternatives.ts and tests; adapt relevant proposal workers and column/section/beam/flexure workbenches; create focused reusable ReinforcementAlternatives.tsx in workbench if useful; targeted concurrency/UI tests.

**Interfaces:** Consume pure engines and layouts from previous tasks and existing steel workers. Produce typed serializable candidate summaries with objective 'minimum-steel'|'few-diameters'|'available-bars', candidate reinforcement, checked status, steel area/weight with explicit length assumptions. Up to3 unique candidates; available diameter choices come from actual catalog. Reject invalid stock empty set rather than silently broadening. Fixed dimensions/material/loads; proposal application explicit history transaction. Report exact worker request/reply interfaces for later linked-piece consumption.

- [ ] Step 1: Failing behavior tests: candidates retain width/height; every feasible candidate passes actual evaluated checks; stock subset respected; empty subset/no fit returns no feasible option; duplicate optimum removed; edit/cancel suppresses stale reply and undo restores applied bars.
- [ ] Step 2: Run focused RED tests.
- [ ] Step 3: Implement bounded enumeration/ranking in cancellable pure-module worker, reuse actual engines and physical coordinates. Provide comparison next to current result with As/diameters/layers/spacing and evaluated/excluded checks. Integrate beam, rectangular flexure, column and experimental section in their appropriate domains; generic Experimental remains Experimental.
- [ ] Step 4: npm run verify + related workers/engines/integration tests; no unbounded main-thread search. Controller runs browser/check once after remaining plans.
- [ ] Step 5: Commit feat(design): compare constructible reinforcement alternatives; task-4-report.md.
