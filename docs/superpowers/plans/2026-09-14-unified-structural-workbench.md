# Unified Structural Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present 2D, Diseño, 3D and FEM as one continuous FusionStructure workspace.

**Architecture:** Keep the 2D project provider at the application root and retain `WorkspaceShell`/`AppShellLayout` as the only shell at `?surface=workspace2d`. A direct 3D topbar action and the FEM action replace only the center stage as native modes. Feed Space 3D through its public versioned handoff contract and keep Design in the existing surface broker.

**Tech Stack:** React 19, TypeScript, Vite, existing CSS token system, lucide-react, Three.js.

**Spec:** `docs/superpowers/specs/2026-09-14-unified-structural-workbench-design.md`

## Global Constraints

- Keep both numerical engines repository-local.
- Mark all four tools as Experimental and keep unsupported FEM formulations fail-closed.
- Do not invent a FEM result or imply certification; every published FEM field must come from the local linear solver.
- Use only a production build and focused browser walkthrough for this integration.

---

### Task 1: Native module integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/workspace/WorkspaceShell.tsx`
- Modify: `src/features/workspace/WorkspaceTopBar.tsx`
- Modify: `src/features/workspace/WorkspaceUtilities.tsx`
- Create: `src/features/workspace/nativeWorkspaceMode.css`

**Interfaces:**
- Consumes: active 2D project metadata and `AppSurface` navigation.
- Produces: direct native-mode controls and external module content in the existing center stage.

- [x] Keep `WorkspaceShell` as the single application shell.
- [x] Keep `?surface=workspace2d` as the single workbench URL and normalize legacy module URLs.
- [x] Add the direct 3D action to the existing 2D topbar without changing the shell design.
- [x] Remove 2D context controls while 3D/FEM own the center stage.
- [x] Keep 3D/FEM in the existing page without a new tab, route, selector, dock or overlay.

### Task 2: Versioned 2D to 3D projection

**Files:**
- Create: `src/integrations/planar2dToSpace3d.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ProjectModel`.
- Produces: `buildPlanar2DToSpace3DHandoff(project): Planar2DToSpace3DHandoffV1`.

- [x] Map planar nodes, members, load cases, combinations and nodal loads.
- [x] Record visible notes for assumptions and omitted semantics.
- [x] Pass the handoff to the lazy Space 3D workspace.

### Task 3: Embedded engine chrome

**Files:**
- Modify: `src/modules/space3d/features/space3d/Space3DWorkspace.tsx`
- Modify: `src/modules/space3d/features/space3d/space3d.css`

**Interfaces:**
- Consumes: `embedded?: boolean` on `Space3DWorkspaceProps`.
- Produces: a compact 3D surface whose own toolbar and canvas occupy the native center stage.

- [x] Remove duplicate 3D identity/navigation when embedded.
- [x] Keep 3D project import, export, example and reset actions accessible.
- [x] Keep transfer diagnostics compact without hiding the canvas.

### Task 4: Focused verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: built application.
- Produces: current integration documentation and browser evidence.

- [x] Run TypeScript and Vite production build.
- [x] Walk through 2D, 3D and FEM in the same desktop workbench.
- [x] Inspect the 2D-derived 3D handoff notice.
