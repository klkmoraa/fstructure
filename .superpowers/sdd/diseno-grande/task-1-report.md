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

## Corrección de revisión round 1

- **Rojo de estado del miembro:** la regresión esperaba `warning` en el miembro de viga de la estructura con cociente numérico conservado; antes del arreglo encontró `pass`. `structure.ts` ahora copia `beam.result.status`, manteniendo el ratio intacto.
- **Rojo de cuantificación:** las pruebas de viga y columna con Ø6.4 mm detectaron marcas sin `#2` en estribos y grapas. `takeoff.ts` ahora etiqueta explícitamente las barras transversales; `takeoffBarUsage` centraliza la clasificación que reutiliza el PDF e incluye grapas.
- **Rojo de dibujo:** al ignorar temporalmente el estado en `ratioBand`, la prueba de mesa no encontró el miembro `data-band="review"`. La implementación usa color/patrón de revisión, asterisco y texto accesible en el rótulo, una leyenda explícita y estados de miembros/celdas; los cocientes mayores a 100 % o con estado fallido siguen con prioridad de fallo.
- **Verde:** `npx vitest run src/design/elements/elements.test.ts src/design/elements/frame.test.ts src/design/elements/columnDetailing.test.ts src/features/design/workbench/FrameDrawings.test.tsx src/features/design/workbench/FrameWorkbench.test.tsx src/features/design/workbench/designReport.test.ts` — 6 archivos y 92 pruebas aprobadas.
- `npm run typecheck` — aprobado; `git diff --check` — aprobado.

Cambios adicionales de esta corrección: `src/features/design/workbench/FrameDrawings.tsx`, `FrameWorkbench.tsx`, `FrameWorkbench.test.tsx`, `designWorkbench.css`, `src/design/elements/takeoff.ts`, `columnDetailing.test.ts`, `elements.test.ts`, `frame.test.ts`, `FrameDrawings.test.tsx` y `designReportPdf.ts`.

## Corrección de revisión round 1 — veredicto pendiente

- **Rojo conductual del caso #2:** en `DesignWorkbench.test.tsx`, elegir Ø6.4 mm produce el aviso complementario y estado `Revisar`; el flujo mostraba un botón superior `Cumple · 100 %`. La prueba esperaba `Revisión pendiente · 100 %` y falló antes del cambio.
- **Arreglo:** el indicador superior y el titular del panel de veredicto ahora llaman `Revisión pendiente` cuando el estado es `warning`. Los ratios siguen visibles; las rutas `pass` y `fail` no cambian.
- **Verde:** la prueba del caso #2 pasó después del cambio. El conjunto relacionado — `npx vitest run src/design/elements/elements.test.ts src/design/elements/frame.test.ts src/design/elements/columnDetailing.test.ts src/features/design/workbench/FrameDrawings.test.tsx src/features/design/workbench/FrameWorkbench.test.tsx src/features/design/workbench/DesignWorkbench.test.tsx src/features/design/workbench/designReport.test.ts` — pasó: 7 archivos, 106 pruebas.
- `npm run typecheck` y `git diff --check` — aprobados.
