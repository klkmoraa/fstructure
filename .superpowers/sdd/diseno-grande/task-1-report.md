# Task 1 — materiales, refuerzo transversal y apoyos

## Resultado

Implementado en el checkout `/workspace/fstructure`. La armadura longitudinal conserva exactamente su catálogo #2.5–#11 y filtros. El catálogo transversal añade #2 Ø6.4 mm, que se identifica como `#2` en vigas, columnas, pórticos, contratrabes, láminas y reportes. Las búsquedas automáticas de estribos no cambiaron. Las columnas conservan su comprobación de diámetro y su fallo cuando corresponde.

Los estribos de viga menores a 9.5 mm llevan una advertencia complementaria que dice expresamente que su aceptación normativa no está verificada y que no crea un mínimo. Se propaga a las revisiones de vigas, estructuras y contratrabes. Se añadieron apoyos explícitos `roller`, estabilización X para rodillo izquierdo con articulación derecha y rechazo de dos rodillos. Los dibujos reflejan los apoyos del solver. Los presets preservan cargas y claros; el preset continua duplica el claro si sólo existe uno y el cambio se deshace junto.

`MaterialFields` ofrece f′c 150, 200, 250, 300, 350 y 400 kg/cm²; fy/fyv 2800, 4200, 5000 y 6000 kg/cm². Los valores permanecen editables y la conversión existente al motor se conserva. No se añadieron campos a borradores.

## Evidencia TDD y validación

- **Rojo de catálogo/apoyos:** antes de implementar, `npx vitest run src/design/elements/elements.test.ts` falló en la ausencia de `STIRRUP_SIZES` y porque el solver aceptaba dos rodillos. Tras implementar, la suite pasó.
- **Rojo de campos de materiales:** con el callback del selector temporalmente desconectado, `MaterialFields.test.tsx` falló con el campo en `250` donde esperaba `300`. Restaurado el callback, la prueba pasó y confirmó también la conversión kg/cm² → MPa por `beamToInput`.
- **Pruebas de cobertura finales:** `npx vitest run src/design/elements/elements.test.ts src/design/elements/frame.test.ts src/design/elements/strapFooting.test.ts src/features/design/workbench/MaterialFields.test.tsx src/features/design/workbench/BeamDrawings.test.tsx src/features/design/workbench/beamModel.test.ts src/features/design/workbench/DesignWorkbench.test.tsx src/features/design/workbench/designReport.test.ts` — 8 archivos, 92 pruebas aprobadas.
- `npm run typecheck` — aprobado.
- `git diff --check` — aprobado.

## Archivos modificados

- `src/design/elements/beam.ts`, `beamAnalysis.ts`, `shared.ts`, `structure.ts`, `strapFooting.ts`.
- `src/design/elements/elements.test.ts`, `frame.test.ts`, `strapFooting.test.ts`.
- `src/features/design/workbench/MaterialFields.tsx`, `MaterialFields.test.tsx`, `beamModel.test.ts`, `BeamDrawings.test.tsx`.
- `src/features/design/workbench/BeamDrawings.tsx`, `BeamWorkbench.tsx`, `ColumnDrawings.tsx`, `ColumnWorkbench.tsx`, `ConcreteStudio.tsx`, `DesignWorkbench.test.tsx`, `FootingWorkbench.tsx`, `FrameWorkbench.tsx`, `beamModel.tsx`, `columnModel.tsx`, `common.tsx`, `designReportPdf.ts`, `footingModel.tsx`, `frameModel.tsx`.

## Pendiente / preocupaciones

No se ejecutó la suite completa ni la revisión visual de todo el taller; corresponden a la integración final. La propagación del aviso de estructura conserva cualquier fallo independiente, como el de anclaje: el aviso complementario aparece en la nota sin cambiar ese veredicto.
