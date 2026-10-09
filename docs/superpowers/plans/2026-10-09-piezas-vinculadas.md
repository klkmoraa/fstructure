# Piezas vinculadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seleccionar una demanda real del edificio, conservarla en una revisión propia y navegar plantas/ejes/miembros con la misma selección.

**Architecture:** DTO puros en diseño; adaptador 2D y puente 3D producen snapshots por objetivo/estación. Workspace ofrece proveedor worker al taller. Memoria guarda snapshots inmutables separados del borrador editable y calcula vigencia contra proveedor actual.

**Tech Stack:** TypeScript/React/workers/Vitest existentes.

**Spec:** docs/superpowers/specs/2026-10-09-piezas-vinculadas.md

## Global Constraints

- Español, agentes Luna high, sin dependencias, backend o red implícita, Home diferida y territorio de AGENTS.md.
- No mezclar máximos/casos, simular CM/CV ni convertir Mu a q; unidades kN/m explícitas y geometría mm en entradas de pieza.
- Un implementador, sin agentes hijos/push. No forzar scratch a Git. TDD comportamiento/cálculo y npm run verify/pruebas relacionadas; check global por controller al integrar.
- Documento v8 conserva v1–v7, detalles de A y límites actuales; cambios de origen nunca sobrescriben automáticamente una pieza.

## Review Focus

- Miembro compartido por dos ejes y estación en salto de carga: un solo ID original y lado explícito (tarea1).
- Caso/combinación inválido, solver fallido o revisión cambiada: error/cancelación sin snapshot plausible (tarea1).
- Origen ausente al reabrir: copia utilizable con vigencia no comprobable (tarea2).
- Memoria llena/importación inválida y enlace editado: preflight conserva borrador y origen original (tarea2).
- Filtro sin resultados/elemento sin piso/eje: selección coherente y accesible, sin descarte (tarea2).

---

### Task 1: Proveedor de demandas concurrentes e inventario

**Files:** Create src/design/elements/modelResultSnapshot.ts, model2dResultSnapshot.ts and tests; src/integrations/space3dResultSnapshot.ts and tests; workspace/adapters/modelResultWorker.ts, modelResult.worker.ts with tests as needed. Extend structure.ts ExternalStructureSource/ExternalStructureAxes optional provider; wire DesignSurface.tsx without changing territorial boundaries.

**Interfaces:** Export from modelResultSnapshot.ts ModelResultTarget={id:string;label:string;kind:'case'|'combination';factors:readonly {caseId:string;factor:number}[]}; ModelMemberRecord={id:string;label:string;family:'beam'|'column'|'other';levelId:string|null;axisIds:readonly string[];lengthM:number;section:{shape:'rectangular'|'circular'|'other';widthMm:number|null;depthMm:number|null;fcMpa:number|null;materialLabel:string};start:readonly[number,number,number];end:readonly[number,number,number]}; ModelSupportRecord={id:string;label:string;position:readonly[number,number,number]}. ModelResultInventory={projectId:string;kind:'model2d'|'model3d';revision:string;targets:readonly ModelResultTarget[];members:readonly ModelMemberRecord[];supports:readonly ModelSupportRecord[];levels:readonly{id:string;label:string;heightM:number}[]}. ModelDemandSnapshot={version:1;source:{kind:'model2d'|'model3d';projectId:string;revision:string;memberId:string;axisId?:string};target:ModelResultTarget;station:{xM:number;side:'left'|'right';lengthM:number};units:'kN-m';axes:{convention:string;localBasis:readonly(readonly[number,number,number])[]};actions:{nKn:number;vyKn:number;vzKn:number;torsionKnm:number;myKnm:number;mzKnm:number};member:ModelMemberRecord}. ModelSupportSnapshot analogous source nodeId, target, position, units, reactionGlobal:{fxKn,fyKn,fzKn,mxKnm,myKnm,mzKnm}. ModelResultProvider={inventory:ModelResultInventory;member(request:{memberId:string;targetId:string;xM:number;side:'left'|'right'},signal:AbortSignal):Promise<ModelDemandSnapshot>;support(request:{nodeId:string;targetId:string},signal:AbortSignal):Promise<ModelSupportSnapshot>}. All numbers finite; topology and orientation actual model; consumers choose service/ultimate role, not infer from name.

- [ ] Step1: RED tests on small 2D simple beam L5 q4[0,1]+P10@3: reactions7.6/6.4; one selected target produces simultaneous N/V/M, distinct target factors exact and no max mixing; station jump left/right correct. 3D rotated member keeps local basis and global support vector; two-axis member deduplicated; failed/aborted run rejects, nonexistent target/station rejected. Revision differs after geometry/case/load edit.
- [ ] Step2: Run focused tests and confirm intended failures. Read qa-artifacts/ampliacion-total-2026-10-09/contratos-proyecto.md for existing APIs, not as requirements substitute.
- [ ] Step3: Implement native-target analysis using existing solvers (original model cases/combinations, distinct from category-based Design combinations). Serializable request/reply workers; no solving in React render. Inventory derives geometric levels where declared labels absent, keeps unassigned members. Optional resultProvider on external source/axes, shared provider instance in workspace. Preserve declared analysis order/method or expose a distinct first-order target label with scope, never silently claim the model analysis was reproduced. Section shape/material label are native, no equivalent rectangle for a T/L/steel/arbitrary shape. Bound/cancel jobs and reject stale revision replies. Report exact integrations/sign conventions for Task2/C.
- [ ] Step4: npm run verify + adapters/solver/source/architecture targeted checks pass. Record reference/sign fixture results.
- [ ] Step5: Commit feat(design): expose concurrent model result snapshots; task-1-report.md in this plan workspace.

### Task 2: Revisión vinculada, vigencia y navegador

**Files:** Create LinkedPieceOrigin.ts/LinkedPieceOriginView.tsx/ModelMemberNavigator.tsx and tests in workbench; modify workbenchStorage.ts, designMemory.tsx, designReport.ts/PDF, DesignWorkbench.tsx, FrameWorkbench.tsx, BuildingAxes.tsx, WorkbenchLayout.tsx, DesignSurface.tsx; focused integration tests.

**Interfaces:** Consume ModelResultProvider/DTO from Task1; flexureReport/columnToInput from A. Export LinkedPieceOrigin={version:1;snapshot:ModelDemandSnapshot;copiedFields:Record<string,string>}; WorkbenchMemoryItem.origin?:LinkedPieceOrigin; draft key piece-origin stores WorkbenchOriginsDraft={version:1;byElement:Partial<Record<'column'|'flexure',LinkedPieceOrigin>>}, with a separate origin for each element draft. Export WorkbenchOrigin=LinkedPieceOrigin (C later adds support union) and WorkbenchOriginsDraft; helpers select origin by active element. Export originState(origin,provider,currentFields):{source:'current'|'stale'|'unavailable';edited:boolean}. Validator finite/raw string limits plus <=64 factors, <=16 axisIds, <=3 basis vectors, bounded strings256 labels/128 IDs. DesignReport.origin?:WorkbenchOrigin retains typed provenance; origin decoration includes the original snapshot in input fingerprint and memo/groups so exports/hash use the actual origin. Enforce total existing document limit. create-linked callback owned by DesignWorkbench preflights atomic fields+origin writes/remount; snapshot never stored inside string field.

- [ ] Step1: RED tests: frame selected member→target/station→create column/flexure copies one vector and IDs; transforming 2D tension-positive N to compression-positive Pu and 3D local bending axes correct; origin stale after source revision, unavailable without provider, edited after changing copied actions. Save/open/duplicate/PDF retains vector and scope; memory full prevents writes; malformed basis/NaN rejected. Switching column/flexure/beam dock retains each draft origin independently and a manual draft never inherits another family origin. Filter/floor/axis changes leave unknown assignments visible and no ghost selection.
- [ ] Step2: Run focused RED. Keep actions explicit in kN/kNm and raw form conversion uses current adapters units.
- [ ] Step3: Implement schema8 validators/memory/history/new-problem clearing only that element origin, keeping other family drafts and saved entries. Unified contextual navigator filters level/axis/family/review state/search, selectable table and plan share member IDs; use onShowMembers for model scene selection and existing section bridge preview for group edits. Provide target, station and left/right controls beside selection; worker progress/cancel. Create linked piece explicitly; unsupported member section shape/material cannot silently create a rectangular RC piece; show why and retain original snapshot in selection. Circular columns use actual diameter/current column adapter if supported; beam direct flexure is rectangular only. UI/PDF show original target/factors/full vector, projection/scope, source status and edited indicator. Update reads fresh snapshot only on click, updates copied action/geometry fields after preflight while preserving own reinforcement; unavailable/error leaves current fields. View origin works from reopened memory. New manual problem clears link atomically, not existing saved entries.
- [ ] Step4: npm run verify + relevant memory/frame/axes/workspace/provider tests. Export browser selectors, fixtures and migration notes to report.
- [ ] Step5: Commit feat(design): navigate buildings and retain linked piece provenance; task-2-report.md.
