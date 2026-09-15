# FStructure numeric core

This local crate is the experimental sparse boundary shared by future 3D and
FEM analyses. It stores matrices as CSC/CSR and gates `faer` **0.24.4** behind
the `faer-backend` feature. The checked-in browser binding is consumed only by
the versioned numerical worker. `npm run numeric:wasm:gate` compiles the locked
crate for `wasm32-unknown-unknown`, generates temporary Node bindings and
executes a sparse LU fixture before that backend is accepted.
The gate also regenerates the browser bindings in a temporary directory and
fails if the checked-in worker artifact is stale. After a Rust change, refresh
it with:

```sh
cargo build --locked --manifest-path crates/numeric-core/Cargo.toml \
  --target wasm32-unknown-unknown --release --features faer-backend
wasm-bindgen crates/numeric-core/target/wasm32-unknown-unknown/release/fstructure_numeric_core.wasm \
  --target web --out-dir src/numeric/wasm
```

`faer` is MIT licensed. Upstream package metadata and the exact transitive
resolution are recorded in `Cargo.toml` and `Cargo.lock`.

The TypeScript runtime continues to expose the established dense solver as an
explicit `dense-reference` backend for small models and differential checks.
It is not an automatic fallback: an unavailable or failed WASM solve is
reported and must never allocate a dense matrix under a sparse admission.

The faer boundary measures condition and two independently normalized
algebraic residuals. It cannot prove whole-structure equilibrium, so its
quality evidence is explicitly `algebraic-only` and its common
`AnalysisQuality.level` cannot be `stable`. A 3D/FEM adapter must compute the
structural equilibrium residual before promoting a result.

Until symbolic fill estimation is implemented, admission uses a deliberately
pessimistic worst-case dense-fill term. This may reject a very sparse model
that could fit, but avoids admitting a job using an unsafe `O(nnz)` estimate.
