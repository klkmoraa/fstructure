# Cimentación y despiece Implementation Plan

> Estado de esta publicación: pendiente. El cierre solicitado por el usuario publica los bloques A/B implementados; este plan C/D y sus referencias se conservan para la siguiente ampliación. Ninguna tarea de este plan se declara terminada.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revisar zapata aislada desde acciones simultáneas reales y producir despiece rastreable local por pieza/nivel/diámetro.

**Architecture:** Entrada directa adicional al motor de zapata, DTO de apoyo del proveedor de B y extensión de origen/memoria. Despiece puro independiente de UI, construido desde resultados físicos y expuesto por reportes y exportadores locales.

**Tech Stack:** TypeScript/React/workers/Vitest/pdf-lib existentes.

**Spec:** docs/superpowers/specs/2026-10-09-cimentacion-despiece.md

## Global Constraints

- Español, Luna high, sin dependencias, backend o red; territorialidad AGENTS.md.
- Compatibilidad v1–v8, límites actuales, preflight/undo/cancel y guardado de enlace apoyo; nueva escritura v9.
- No inventar CM/CV, capacidades geotécnicas, dimensiones de fabricación, traslapes o estados ausentes.
- Un implementador, sin agentes hijos/push; scratch sólo .superpowers/sdd/cimentacion-despiece/. TDD cálculo/datos, npm run verify/pruebas relacionadas, check general al integrar.

## Review Focus

- Tracción del apoyo o componente horizontal: diagnóstico/no evaluado visible (tarea1).
- Servicio y último de apoyos/revisiones diferentes: no permitir par incoherente (tarea1).
- Reacción actual y origen cambiado durante cálculo: respuesta cancelada, copia conservada (tarea1).
- Forma/traslape no definido: pendiente excluido del total certificado, aproximado rotulado (tarea2).
- Texto con =,+,-,@,comillas, salto, <script>: exportación inerte y relectura consistente (tarea2).

---

### Task 1: Acciones directas de zapata y enlace de apoyo

**Files:** Modify src/design/elements/footing.ts/tests, workbench/footingModel.tsx, FootingWorkbench.tsx, ModelMemberNavigator.tsx, LinkedPieceOrigin.ts/view, workbenchStorage.ts/designMemory.tsx/PDF and integration tests; small pure support conversion helper adjacent to origin.

**Interfaces:** Consume ModelResultProvider.support()/ModelSupportSnapshot of B. Add FootingDesignInput.actionsByState?:{service:{id:string;nKn:number;momentXKnm:number;momentYKnm:number};ultimate:{id:string;nKn:number;momentXKnm:number;momentYKnm:number}}. Optional input overrides legacy dead/live/combined Pu only when complete and valid. Expose reactionToFootingActions(snapshot):{nKn:number;momentXKnm:number;momentYKnm:number;horizontalXKn:number;horizontalYKn:number;axesNote:string}; state compression positive; original full global reaction retained. Extend stored origin union with LinkedSupportOrigin={version:1;kind:'support';service:ModelSupportSnapshot;ultimate:ModelSupportSnapshot;copiedFields:Record<string,string>}, valid only for footing. Extend WorkbenchOriginsDraft.byElement with footing; each family retains its own origin when switching dock, and memory origin remains per item. Pair same project/kind/node/revision, user selects roles explicitly. Raw form actionsMode='loads'|'direct', serviceAxial/ultimateAxial/serviceMx/serviceMy/ultimateMx/ultimateMy; direct new selection leaves soil capacity blank until user enters it. v9 reads1–9.

- [ ] Step1: RED reference isolated 2m×2m serviceN400, Mx20/My40: average100 kPa and corner extrema55/145 kPa (q=N/A±Mx/Wx±My/Wy); ultimateN600 with concurrent moments30/60 distinct. Doubling only ultimate leaves service pressure identical, doubling only service leaves ultimate demands unchanged. Legacy result unchanged. Incomplete/negative states rejected. 2D/3D reaction signs/projection tested; mismatched node/revision pair rejected; link reopen/update preserves manual reinforcement and soil inputs; full memory prevents writes.
- [ ] Step2: Run focused RED and inspect existing footing consumers before mutation.
- [ ] Step3: Refactor source-of-actions accessor so all validation, sizing, soil pressure, shear/flexure/crushing and memo labels use selected state consistently, no residual dead/live hidden dependency. Keep legacy path. Expose supports tab/target service+ultimate selector and explicit create-footing action, atomic fields+origin writes and bounds. Document 3D vertical globalY, footing horizontalX/Z; 2D globalY vertical and normalZ second footing axis; action on footing opposite reaction on building. Horizontal actions retained and excluded explicitly if engine does not evaluate sliding. Origin state/update/view/export follows B. Missing soil capacity blocks checks, no assumed qa.
- [ ] Step4: npm run verify and relevant footing/memory/provider/workspace tests; reference and legacy fixtures pass. Report browser route/selectors.
- [ ] Step5: Commit feat(design): design isolated footings from concurrent support states; task-1-report.md.

### Task 2: Despiece reconciliado y exportadores

**Files:** Create src/design/elements/barSchedule.ts/test, workbench/barScheduleExport.ts/test, BarScheduleView.tsx, optional barSchedulePdf.ts; modify designReport.ts, relevant beam/column/footing/section/frame/flexure report adapters, memory panel and PDF; targeted tests.

**Interfaces:** Export BarScheduleRow={mark:string;pieceId:string;level:string;diameterMm:number;count:number;shape:'straight'|'hook'|'stirrup'|'unknown';segmentsMm:readonly number[];geometricLengthM:number|null;developmentLengthM:number|null;lapLengthM:number|null;unitLengthM:number|null;totalLengthM:number|null;weightKg:number|null;status:'defined'|'approximate'|'pending';notes:readonly string[]}; BarSchedule={rows:readonly BarScheduleRow[];basis:string;revision?:string;totals:{definedKg:number;approximateKg:number;pendingCount:number}}. Export createBarSchedule(source:BeamDesignResult|ColumnDesignResult|FootingDesignResult,identity:{pieceId:string;level:string}):BarSchedule; additional result kinds adapters where geometry known; BarSchedule.physicalPieceKeys?:readonly string[] from typed report.origin/native member IDs when available; otherwise pending rows from takeoff with explicit approximate basis. DesignReport.barSchedule?:BarSchedule. Export barScheduleCsv(schedules:readonly BarSchedule[]):string and barScheduleSvg(schedule:BarSchedule):string, consistent explicit SI headers/dimensions. Use current steel density7850 kg/m3 and actual bar area; no manufacturing shape standard invented.

- [ ] Step1: RED tests: count×unitlength=sum total; mass matches barMassKgPerM with <=1e-9 relative; custom bastion lengths/zones and separate marks reconcile with beam engine/takeoff; identical marks in different pieces never coalesce incorrectly; two selected reviews of the same physical source member are marked alternatives/duplicates, never silently summed as installed quantities; grouping level/diameter correct; unsupported lap returns pending/approximate not0 certified. CSV protects formulas (including leading whitespace), preserves quotes/newlines in parser re-read; SVG escapes IDs/text, dimensions consistent and pending displayed; input invalid numbers rejected.
- [ ] Step2: Run focused RED.
- [ ] Step3: Implement pure schedule builders from actual coordinates/results. Distinguish net geometry from bend/development allowances and pending laps; existing approximate takeoff remains labeled. UI adjacent to current report and memory selection, filters/grouping by level/diameter and optional waste percentage0 default bounded0–50 as separate estimate. CSV/SVG/PDF only explicit download, no network; PDF same schedule including provenance/scope/pending. Count/index marks deterministic per piece, no persisted derived schedule. Aggregate selection detects duplicate physical origins; show conflicting alternatives, separate their totals or require explicit variant selection for installed estimate, never silently choose one or double-count. Flexible SVG pagination/viewBox and table mobile horizontal scrolling within component.
- [ ] Step4: npm run verify and related takeoff/report/export/PDF tests. Report reconciliation fixtures and browser export actions; controller checks downloads/browser.
- [ ] Step5: Commit feat(design): export traceable reinforcement schedules; task-2-report.md.
