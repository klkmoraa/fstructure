# Migration record · FStructure

- Source: `https://github.com/klkmoraa/FusionStructure`
- Cutover tag: `monolith-cutover-20260904`
- Cutover commit: `700a0365352245a1db61f6938fd1bcd72f812fa7`
- Extraction: `git-filter-repo 2.47.0`, path allowlist
- Product: planar model, solver, workspace, education, reporting and storage
- Explicitly excluded: Space 3D and portal landing composition
- Status: experimental; no certification claim

The `src/engine/solver2dCorpus.ts` corpus and its manifest remain in the
repository. Cross-product navigation is an outbound link; no 3D model, store,
worker, or UI is imported into this product.
