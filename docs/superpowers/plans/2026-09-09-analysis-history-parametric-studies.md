# Analysis History and Parametric Studies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist successful analysis snapshots per project and add a non-destructive parametric study for member stiffness properties.

**Architecture:** Extend the existing project repository with a dedicated IndexedDB store for immutable analysis-run records. Reuse `RevisionSnapshot`/revision comparison for saved-run review, and add a pure parametric-study engine exposed through the existing worker-envelope pattern so the UI never mutates the live model.

**Tech Stack:** React 19, TypeScript, Vitest, IndexedDB repository, Web Workers, existing revision comparison and result-summary utilities.

**Spec:** The approved product scope in the conversation: (1) persistent analysis-run history, (3) “¿Qué pasa si…?” parametric studies. Do not add Model Doctor preflight or model annotations.

**Global Constraints**

- The live project, undo/redo history, and current analysis remain unchanged by either feature.
- Saved runs must be tied to a project checksum/signature and must preserve scenario identity and reliability context.
- Parametric variants are cloned models; no variant may be written back without a separate future explicit-apply flow.
- Existing Spanish/English catalogs and accessibility conventions remain complete.
- All new production behavior starts with a failing test and is verified with the focused tests plus the full project gate.

---

### Task 1: Add persistent analysis-run repository records

**Files:**
- Create: `src/storage/analysisRuns.ts`
- Modify: `src/storage/projectRepository.ts`
- Test: `src/storage/analysisRuns.test.ts`

**Interfaces:**
- `AnalysisRunSnapshot` contains the current revision snapshot payload: schema/kind, revision id, capture time, project, and analysis binding.
- `AnalysisRunRecord` contains `id`, `projectId`, `label`, `createdAt`, and `snapshot`.
- `ProjectRepository` produces `listAnalysisRuns(projectId)`, `saveAnalysisRun(record)`, and `deleteAnalysisRun(id)`.

- [x] **Step 1: Write failing repository tests** for saving, cloning, project filtering, newest-first ordering, and deletion through `InMemoryProjectRepository`.
- [x] **Step 2: Run the focused test and verify it fails** because the repository methods/types do not exist.
- [x] **Step 3: Implement the neutral record types and repository methods** for memory and IndexedDB implementations. Upgrade the database schema to version 2, create an `analysisRuns` object store, and cascade-delete runs when a project is deleted.
- [x] **Step 4: Run the focused test and verify it passes.**

### Task 2: Persist and review saved runs in Revision Comparison

**Files:**
- Modify: `src/features/revision-comparison/revisionComparison.ts`
- Modify: `src/features/revision-comparison/RevisionComparisonPanel.tsx`
- Modify: `src/features/revision-comparison/revisionComparison.css`
- Test: `src/features/revision-comparison/RevisionComparisonPanel.test.tsx`

**Interfaces:**
- Keep `RevisionSnapshot` as the comparison-facing alias of the neutral snapshot type.
- Add an optional repository injection to `RevisionComparisonPanel` for deterministic tests; production resolves the configured IndexedDB repository when available.
- Saved-run actions set the existing `baseline` state, so comparison warnings and locate behavior remain centralized.

- [x] **Step 1: Write failing component tests** for loading runs, saving the current successful snapshot with a label, selecting a saved run as baseline, and deleting a saved run.
- [x] **Step 2: Run the focused component test and verify it fails** because the panel has no saved-run controls.
- [x] **Step 3: Implement the saved-run section** with a label form, newest-first list, “use as baseline,” and delete actions. Disable save when the current snapshot has no usable analysis. Refresh the list after writes and preserve the existing in-memory baseline flow.
- [x] **Step 4: Add Spanish and English copy** for the saved-run section and status/error messages, then style it consistently with the existing comparison surface.
- [x] **Step 5: Run the focused component test and verify it passes.**

### Task 3: Add the pure parametric-study engine

**Files:**
- Create: `src/engine/parametricStudy.ts`
- Test: `src/engine/parametricStudy.test.ts`

**Interfaces:**
- `ParametricParameter = 'E' | 'A' | 'I'`.
- `ParametricStudyRequest` accepts a project, optional combination id, member id, parameter, and positive relative factors.
- `ParametricStudyResult` returns the selected member/parameter, base value, and variant rows containing factor, absolute value, reliability status, failure reason, and target-member N/M/v absolute metrics.
- The module exports factor parsing/validation and `runParametricStudy`.

- [x] **Step 1: Write failing engine tests** for factor parsing, target-member cloning, unchanged source project, successful metric extraction, and invalid member/factor rejection.
- [x] **Step 2: Run the focused test and verify it fails** because the engine module is absent.
- [x] **Step 3: Implement the minimal pure engine** using `analyzeProjectAuto` with education traces disabled and `summarizeAnalysisResults`/`resolveReliability` for each cloned variant.
- [x] **Step 4: Run the focused engine test and verify it passes.**

### Task 4: Expose parametric studies through workers and the Results summary

**Files:**
- Modify: `src/runtime/workerProtocol.ts`
- Modify: `src/runtime/workerHandlers.ts`
- Create: `src/workers/parametric.worker.ts`
- Create: `src/engine/useParametricStudy.ts`
- Create: `src/features/results/ParametricStudyCard.tsx`
- Modify: `src/features/results/ResultSummary.tsx`
- Modify: `src/features/results/results.css`
- Modify: `src/i18n/catalogs/es-results.ts`
- Modify: `src/i18n/catalogs/en-results.ts`
- Test: `src/features/results/ParametricStudyCard.test.tsx`

**Interfaces:**
- Add `parametric` as a worker domain with request/result payloads.
- `useParametricStudy` exposes `{ study, busy, error, run, clear }` and invalidates on the existing solver signature.
- `ParametricStudyCard` offers member, E/A/I, and relative-factor inputs; it renders a table of variant metrics and never calls a project mutation.

- [x] **Step 1: Write failing hook/card tests** for the default factor set, running a study, rendering variant metrics, and leaving the project unchanged.
- [x] **Step 2: Run the focused test and verify it fails** because the worker domain and card do not exist.
- [x] **Step 3: Add the worker protocol, handler, worker, and hook** following `useScenarioAnalysis` cancellation/invalidation behavior.
- [x] **Step 4: Implement the card** inside the existing successful `ResultSummary`, with explicit units, reliability/failure text, loading state, and accessible form labels.
- [x] **Step 5: Add bilingual catalog entries and focused styles.**
- [x] **Step 6: Run the focused UI test and verify it passes.**

### Task 5: Full verification

- [x] Run the focused repository, revision-comparison, engine, and parametric-card tests together.
- [x] Run `oxlint`, TypeScript typecheck, architecture checks/tests, the full Vitest suite, and the production build using the workspace Node runtime.
- [x] Inspect `git diff` and confirm only the approved two features plus their plan/tests/copy changed.

---

## Assumptions

- The first parametric-study release varies member `E`, `A`, or `I` by positive relative factors; load and support-stiffness sweeps remain future extensions.
- Saved analysis runs are immutable snapshots and are not automatically created on every calculation; the user explicitly saves a run to avoid noisy storage.
- The existing revision-comparison panel is the entry point for saved-run history, so no new top-level workspace surface is needed.
