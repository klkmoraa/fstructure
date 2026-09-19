# Migration record · FStructure

- Source: `https://github.com/klkmoraa/FusionStructure`
- Cutover tag: `monolith-cutover-20260904`
- Cutover commit: `700a0365352245a1db61f6938fd1bcd72f812fa7`
- Extraction: `git-filter-repo 2.47.0`, path allowlist
- Product: planar model, solver, workspace, education, reporting and storage
- Excluded from the original cutover: Space 3D and portal landing composition
- Status: experimental; no certification claim

The `src/engine/solver2dCorpus.ts` corpus and its manifest remain in the
repository. This integration branch later incorporated Space 3D as the local
module `src/modules/space3d`, including its model, store, worker and UI under
its MIT license. The application keeps the extracted 2D workspace as its only
shell at `?surface=workspace2d`; its direct 3D control replaces the central
work area in that same shell through an explicit, versioned 2D→3D handoff.
FEM is now a repository-local native mode with a linear TRI3/QUAD4 plane
stress/strain solver, strict Gmsh 4.1 ASCII import, versioned snapshots and
JSON/VTK export. Unsupported MITC4/TET4 physics remains fail-closed.
