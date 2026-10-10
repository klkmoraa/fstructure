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

- [x] Step 1: Add behavioral failing tests: v6 fields `{legacy:'yes'}` retained after export as v7; save/open/duplicate beam with a blank load value and custom bastion reproduces details exactly; details on a column rejected; 33 loads and strings33 rejected; memory capacity preflight prevents all mutation; missing details equals empty draft.
- [x] Step 2: Run focused Vitest commands and record intended failures before implementation.
- [x] Step 3: Implement typed validator, project/browser storage readers/writers and memory capture/equality/start/open atomic writes. Retain old keys/caps, cloning and incomplete-draft semantics. Expose a small useStoredBeamDetails(storage) hook using existing history patterns if needed; produce its exact signature in the report for Task2.
- [x] Step 4: Run related storage/memory tests and npm run verify; output must pass. Record any known baseline console warnings without suppressing tests.
- [x] Step 5: Commit only touched source/tests: feat(design): preserve structured beam details in workbench v7. Write task-1-report.md with interfaces, RED/GREEN commands/results and SHA.

### Task 2: Cargas generales y editor de bastones/estribos

**Files:** Modify src/design/elements/beam.ts, beamAnalysis.ts, src/features/design/workbench/beamModel.tsx, BeamWorkbench.tsx; create BeamDetailEditor.tsx and beamDetailInput.ts beside them; focused engine/adapter/editor tests and existing CSS as needed.

**Interfaces:** Consume BeamDetailDraft and storage/hook from Task1. Export parseBeamDetails(draft:BeamDetailDraft, spans:readonly SpanDraft[]): {loads:readonly BeamExtraLoad[]; bastions:readonly ProvidedBastion[]; stirrupZones:readonly(ProvidedStirrupZone|null)[]; errors:readonly string[]} with strict finite parsing and position validation. BeamExtraLoad exported from beam.ts: {spanIndex:number; category:'dead'|'live'; kind:'point'|'distributed'; startM:number; endM:number; startKn:number; endKn:number}. Point uses startKn kN and startM m; distributed uses kN/m, start/end m. Add optional extraLoads to BeamInput. beamToInput/beamReport accept optional details as final parameter; reportFromMemoryItem passes saved details. proposeBeamSection accepts optional details as final argument and uses the same extra loads/declared reinforcement hypothesis; UI never proposes against different hidden loads.

- [x] Step 1: Failing tests: simple L5 q4 over[0,1]+P10 at3 produces RA7.6/RB6.4 and force/moment balance <=1e-9; full triangular load q0→6 on L3 gives RA3/RB6 and peak moment at sqrt(3)m; invalid/blank/out-of-clear input stops calculation, not clamps; old single-point forms unchanged. Custom top bastion count2 diameter15.9 start1/end2 and zones end100/length.6/center200 reach engine/drawing; overlap and span mismatch diagnostic; details survive save/open.
- [x] Step 2: Run focused tests, record RED.
- [x] Step 3: Convert valid rows to serializable solver member loads per existing dead/live cases. Expose add/remove load/bastion rows and per-clear end/center zones under focused disclosures; ownBastions supports custom. Draw selectable regions with numeric keyboard controls, clear coordinate origin and same engine geometry. Surface existing development checks or explicit not-evaluated detail rather than inventing a rule. Report grouped loads and region data/PDF, and provide required/minimum/provided As and effective d from existing BedSection. Preserve input draft on invalid rows.
- [x] Step 4: Run related engines/adapters/UI tests plus npm run verify; confirm physical layout and legacy tests. Report UI selectors for browser QA.
- [x] Step 5: Commit feat(design): edit beam loads and reinforcement regions; report task-2-report.md.

### Task 3: Flexión propia con momento dado

**Files:** Create src/design/elements/flexureExercise.ts and test; create src/features/design/workbench/flexureModel.tsx, FlexureWorkbench.tsx and focused tests; integrate DesignWorkbench.tsx, designReport.ts, designMemory.tsx, workbenchStorage.ts, start/new-problem definitions and lazy Home entry only as needed.

**Interfaces:** New DesignElementKind 'flexure'. Export FlexureExerciseInput={code:DesignCodeId; widthMm:number; heightMm:number; coverMm:number; fcMpa:number; fyMpa:number; stirrupDiameterMm:number; aggregateMm:number; momentKnM:number; top:BarGroup; bottom:BarGroup}; designFlexureExercise(input):FlexureExerciseResult exposing requiredMm2,minimumMm2,providedMm2,effectiveDepthMm,capacityKnM,layout,checks,notes and status consistent with report. Use existing shared requiredFlexuralSteelMm2/code law and physical layout; do not implement a divergent code equation. Raw form fields in FLEXURE_DEFAULTS, Mu empty for a new problem. export flexureReport(code,draft):DesignReport. Export proposeFlexureDimensions(input:FlexureExerciseInput,bounds:{widthMinMm:number;widthMaxMm:number;heightMinMm:number;heightMaxMm:number;stepMm:number}):{widthMm:number;heightMm:number;result:FlexureExerciseResult}|null; default search widths200–600mm, heights250–1500mm, step50mm, bounded enumeration in worker. Search smallest area feasible with chosen bars and evaluated flexure checks; explicit scope is section sizing by flexure only. Raw objective required|check|dimensions; default required.

- [x] Step 1: Failing tests of direct Mu (no span/load required), Mu=0 explicit vs blank, tension bed for positive/negative moment, reference rectangle equilibrium and As rounded only at display, failure of congested bars/above maximum, incomplete draft persistence. Dimension proposal retains Mu/material/bars, respects200–600/250–1500/50 bounds and returns none for no fit; edit/cancel ignores stale proposal and undo restores dimensions. Memory switch opens flexure and PDF includes given Mu, units, As/d and scope.
- [x] Step 2: Run RED; independently compute a small rectangular reference using stated code law/materials, tolerance <=0.1%.
- [x] Step 3: Implement focused compute-required/check-own/size-by-flexure objectives using direct moment, profile and geometry. Dimension mode explicitly sizes with chosen bars, shows bounds and limited checks, uses cancellable worker and applies dimensions only on click with history; calculation of As and discrete bar proposal stay distinct. Armado de referencia used to estimate d in required mode is labeled as a reference, never claimed as given by the professor. New own-exercise start clears actual geometry/material/action givens; independent-piece start may retain editable defaults. Show substituted equation and units in report groups plus citations already registered. New nav must fit mobile (scroll/chooser); unknown legacy exercises preserved. Complete all element maps/filters/start/undo/PDF paths; no solved examples added.
- [x] Step 4: npm run verify and focused direct flexure/legacy memory/start tests pass. Report limitations axial/biaxial/shear/development/deflection explicitly.
- [x] Step 5: Commit feat(design): solve flexure exercises from given actions; task-3-report.md.

### Task 4: Alternativas constructivas con geometría fija

**Files:** Create src/design/elements/reinforcementAlternatives.ts and tests; adapt relevant proposal workers and column/section/beam/flexure workbenches; create focused reusable ReinforcementAlternatives.tsx in workbench if useful; targeted concurrency/UI tests.

**Interfaces:** Consume pure engines and layouts from previous tasks and existing steel workers. Produce typed serializable candidate summaries with objective 'minimum-steel'|'few-diameters'|'available-bars', candidate reinforcement, checked status, steel area/weight with explicit length assumptions. Up to3 unique candidates; available diameter choices come from actual catalog. Reject invalid stock empty set rather than silently broadening. Fixed dimensions/material/loads; proposal application explicit history transaction. Applying flexure bars changes its objective to check in that same transaction; preview never substitutes current inputs/report. Preserve raw32; stock persistence may be clearly session-only or a stable bounded field encoding, never unvalidated extra entries. Report exact worker request/reply interfaces for later linked-piece consumption.

- [x] Step 1: Failing behavior tests: candidates retain width/height; every feasible candidate passes actual evaluated checks; stock subset respected; empty subset/no fit returns no feasible option; duplicate optimum removed; edit/cancel suppresses stale reply and undo restores applied bars.
- [x] Step 2: Run focused RED tests.
- [x] Step 3: Implement bounded enumeration/ranking in cancellable pure-module worker, reuse actual engines and physical coordinates. Provide comparison next to current result with As/diameters/layers/spacing and evaluated/excluded checks. Integrate beam, rectangular flexure, column and experimental section in their appropriate domains; generic Experimental remains Experimental. Move the existing beam geometry proposal into a cancellable worker too: extra loads can make an infeasible geometry search costly. Carry the complete draft/spans/details, present the returned dimensions for explicit apply/history, and suppress replies after edit/cancel/unmount. Include a deliberately infeasible large-load case that cancels without blocking the UI.
- [x] Step 4: npm run verify + related workers/engines/integration tests; no unbounded main-thread search. Controller runs browser/check once after remaining plans.
- [x] Step 5: Commit feat(design): compare constructible reinforcement alternatives; task-4-report.md.

### Task 5: Validación atómica de bundles y Diseño incompatible

**Files:** Create src/shared/project/designWorkbenchCodec.ts and focused tests; extract pure raw-detail guards into src/shared/project/designDetailValidation.ts as useful; modify workbenchStorage.ts/beamDetailDraft.ts to consume/re-export shared guards/constants, src/storage/bundleValidation.ts, unifiedBundleRepository.ts and tests, DesignSurface.tsx/status view and targeted storage/session/bundle tests. No broad UI rewrite.

**Interfaces:** Export inspectDesignDocument(value:unknown):{status:'empty'|'supported'|'future'|'opaque'|'invalid';schemaVersion:number|null;reason:string|null;entries:Record<string,JsonValue>|null}; supported validates complete known document instead of filtering invalid entries. Empty null/undefined or plain empty object only; other unrecognized JsonValue branches are opaque/read-only and preserved (legacy bundle tests deliberately use generic design JSON). Existing known versions1–7 migrate as before; future recognized kind with integer schemaVersion>7 is opaque and never interpreted as empty. Export current DESIGN_WORKBENCH_SCHEMA_VERSION=7 and shared limits16entries/240000chars/60memory; pure module imports only shared data helpers, never React/design engines/3D/UI. Expose WorkbenchStorage.readOnlyReason?:string; createProjectWorkbenchStorage detects future/opaque/invalid before any writes, canWrite false/write/flush no mutation; DesignSurface shows a clear read-only status without mounting editors that write defaults. Bundle validate/inspect/save rejects invalid known-version design before transactional replacement, accepts bounded opaque/future JsonValue unchanged under bundle's existing global limits; no limit increase or new hidden metadata.

- [ ] Step1: RED tests: valid bundle with v7 malformed beam-details/invalid memory.details/extra oversized typed array rejected before repository revision/data change; generic invalid ProjectModel still rejected; null/empty-object design supported as empty; generic unknown JsonValue retains opaque branch without rewriting it. Open v12 design with unknown entries, attempt default/editor/storage write/flush and save model-only change: raw design remains byte-equivalent canonically, version12 retained and user sees read-only reason. Existing known invalid branch does not autosave filtered entries. v1–v7 valid/incomplete string fields and unknown short fields still roundtrip; partial invalid key rejects whole known document rather than dropping it. Import invalid known design and subsequent unrelated model save cannot erase source. No static Home import of design UI.
- [ ] Step2: Run focused RED. Read qa-artifacts/ampliacion-total-2026-10-09/importacion-diseno.md to distinguish portable Home importer (no design branch) from unified repository flow; do not invent an existing unified import route.
- [ ] Step3: Implement pure central document inspection/guards/constants, use from both feature storage and bundle codec. Keep raw unknown future branch untouched and disable only its Design editor; model-only operations may retain future branch. Known invalid source rejected at bundle input boundary with actionable error; already-held invalid source blocks Design writes, no silent recovery/reset. Preserve raw source for existing recovery/export paths. Atomic repo validation before transaction; no duplicated independent validators. Later B/C/D extend this shared known-schema validation as they add DTOs/versions rather than only feature-local guards.
- [ ] Step4: npm run verify + focused bundle/storage/session/read-only tests and architecture gates; report exact extension points for B/C/D and fixture of nonmutating save. Controller exercises existing visible invalid import route and relevant typed bundle boundary separately.
- [ ] Step5: Commit fix(storage): preserve incompatible design documents and reject invalid bundles; task-5-report.md.

## General producer and persistence safety (audit-backed addition)
Read qa-artifacts/ampliacion-total-2026-10-09/presupuesto-drafts.md. The actual project sink is session.saveDesign, not browser localStorage. Add an atomic accepted/rejected batch contract to both real storage providers and one reusable helper for producers; retain compatible legacy void mocks if necessary, but production mutations never rely only on optional canWrite. Individual write delegates to the validated batch. Entire merged document is validated BEFORE entries mutate; all or none. Revalidate at flush. No cap increase.

Migrate useStoredDraft setters/reset/replace (compatible functional updates), beam/frame row hooks, detail edits, memory commit/start/open/save/duplicate, code/element selectors and ModelSteelReview saved selections to publish React state/history only after batch acceptance. Full compound snapshot undo returns false on rejection and preserves both history stacks, so retry after freeing capacity works. Keep unknown raw fields and incomplete valid strings intact. Common rejected-write feedback explains that the previous value remains; no invisible UI/storage divergence. Hardening only write without migrating producers does not satisfy this contract.

Separate draft acceptance from durable save. Project persist callback returns/propagates Promise; DesignSurface must not swallow session.saveDesign failures. Keep unsaved accepted draft pending on sink failure, expose explicit pending/failure and a retry action, never indicate durable success on failed sink. Retry saves the current complete valid snapshot; asynchronous older completion cannot clear newer pending edits. Preserve existing session working-copy behavior needed by unrelated branch recovery; do not discard failed work. Unmount flush captures final pending snapshot safely, no unhandled rejection. Browser fallback acknowledges quota failure before publishing changed UI; multi-key fallback preserves previous values if its commit fails, without inventing a replacement normal-project storage route.

Additional RED/GREEN tests: valid 16-entry near-budget document, multiple individually fitting updates whose combined batch exceeds240000, accepted batch uses one snapshot; ordinary field and frame/beam rows reject without UI/report/history mutation, code/element change rejects visibly, memory and steel-memory indicators stay aligned. An async sink failure retains pending snapshot and displays retry; successful retry clears only its own revision, and newer editing during save stays pending. Known-invalid input never enters session working copy before validation. Use actual guards to verify generated bounded fixture is valid; not oversized strings or unrecognized branches. Existing A2 legal short padding is not itself a defect; no gratuitous test rewrite solely for fixture aesthetics.

Files additionally include common.tsx, BeamWorkbench.tsx, FrameWorkbench.tsx, DesignWorkbench.tsx, designMemory.tsx, ModelSteelReview.tsx, DesignSurface.tsx and unifiedProjectSession.ts only as needed for pre-validation/propagation. This is correctness plumbing and concise storage feedback, no broad UI redesign. Extend this accepted-batch contract in all subsequent B/C/D consumers.

Application metadata from A3/A4 is part of Task5 producer safety too: sizing appliedInputKey, proposal-clearing and applied notices only change after the same batch is accepted. Cover flexure, beam, column and experimental section apply callbacks; a rejection retains the active raw inputs, report, flags/history and a retryable preview.
