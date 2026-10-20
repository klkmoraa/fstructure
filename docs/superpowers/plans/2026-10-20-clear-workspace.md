# Clear Workspace Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the workspace and parallel independent work for Home and axial presentation. Final independent review before publication.

**Goal:** Make FStructure easier to start and use, and expose truss tension/compression clearly.

**Architecture:** Keep the existing project, shell and analysis contexts. Change presentation and tool discovery only; derive truss readings from current solver results.

**Tech Stack:** React, TypeScript, CSS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-clear-workspace-design.md`

## Global Constraints

- Preserve user projects, territory boundaries and action-only data export.
- Preserve Day/Night, keyboard access and Spanish/English.
- No new dependencies or solver/schema changes.
- Positive N means tension; negative N means compression.

## Review Focus

- Active secondary tools must remain discoverable after menu close or keyboard activation.
- Mobile mode changes must preserve the project and leave primary actions reachable.
- Missing/untrusted results must never look like zero axial force.
- Result colors/labels must not intercept picking or hide selection.
- Narrow viewports must retain controls without horizontal page overflow.

### Task 1: Home and empty model

- [x] Compact `features/welcome/HomePage.tsx` and `home.css`, preserving all existing callbacks.
- [x] Simplify `canvas/ModelStartCard.tsx` and `modelStart.css`; keep all starts, generator and drawing.
- [x] Inspect Home and empty model at 1440/390 in both themes; run smoke.

### Task 2: Workspace controls

- [x] Add behavior checks in `ToolRail.test.tsx` for load/secondary selection and Escape focus return; watch fail.
- [x] Add a small portal menu in `canvas/ToolDockMenu.tsx`, group ToolRail controls, keep active tools reachable.
- [x] Add native mobile selector to `MesaModeSwitch.tsx`, verify it calls the existing mode callback.
- [x] Put mobile undo/redo in `WorkspaceUtilities`, reduce header height and remove duplicate panel affordance.
- [x] Run targeted tests and inspect populated 2D, mobile menus and mode changes.

### Task 3: Truss axial reading

- [x] Write reference/invalid-result tests for `results/trussAxial.ts` and presentation tests; watch fail.
- [x] Derive finite, reliable truss readings; render non-interactive annotation overlay and compact legend.
- [x] Expose state and signed force in a selectable truss results table.
- [x] Verify triangular reference, load reversal, zero force, null/failed/untrusted results, unit conversion and selection.

### Task 4: Verification and publication

- [x] Run verify/check/smoke, inspect screenshots and targeted responsive interactions.
- [x] Fresh review of the whole diff; fix material findings.
- [x] Update documentation and brandbook captures.

Publication target: `main`. After uploading this commit, confirm GitHub Actions
and the live Pages build. The deployment workflow records that final status.

## Verification record

- `npm run verify`: 29 test files, 111 tests; TypeScript and affected-file lint passed.
- `npm run check`: architecture boundaries and 20 architecture tests, 210 Vitest files / 1,485 tests, six Python reference tests, and production build passed.
- `FS_CHROMIUM=/tmp/fstructure-browsers/chromium-1161/chrome-linux/chrome node scripts/smoke.mjs`: all 32 screens passed against the build produced by `check`.
- Chromium interaction review: desktop load/secondary menus and Escape focus return; mobile 2D → 3D → 2D preserved the project and all 13 Pratt members; 2D → Design remained available; utility undo/redo remained reachable.
- Layout review: 1440/390 in Day/Night, plus widths 320, 560, 760, 800, landscape 844 × 390 and 1024 × 768. No horizontal page overflow in the checked views.
- Axial reference: triangular 3–4–5 truss, AB +22.5 kN, AC/BC −37.5 kN; load reversal, true zero, missing/untrusted results, unit conversion and member selection covered.
- Pratt browser review: 13 members (six tension, five compression, two zero); selection from the canvas and the global axial table worked on desktop and mobile. The table's inherited minimum width was removed so all three columns fit the phone.
- A fresh independent reviewer found no material publication blockers. The updated brandbook keeps five reviewed captures.

Existing lint, jsdom canvas and bundle-size warnings remained non-blocking; no
new dependency, solver equation or saved-project schema was introduced.
