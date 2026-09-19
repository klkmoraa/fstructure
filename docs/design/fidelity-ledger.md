# Ledger de fidelidad — Diseño

Este ledger compara el flujo integrado con los conceptos aceptados, no con la aplicación independiente. La autoridad visual es [desktop](../../public/concepts/design-workbench-desktop.png) y [móvil](../../public/concepts/design-workbench-mobile.png); el sistema de diseño y los tokens del producto se describen en [brandbook-handoff.md](brandbook-handoff.md).

## Estado de evidencia

La validación funcional está automatizada: apertura/cierre, selección compartida, asignación persistida, cálculo real, estados y ambos esquemas SVG tienen cobertura de pruebas. La evidencia visual con navegador está **pendiente**: el runtime local disponible carece del ejecutable `npx` requerido por el flujo de Playwright configurado para este proyecto. No se declara fidelidad visual aprobada hasta capturar escritorio y móvil con un runner disponible.

| # | Aspecto comparado | Intención de los conceptos | Implementación integrada | Evidencia visual | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Jerarquía de escritorio | Canvas dominante y hoja de cálculo lateral | Dock de Diseño en X2; una sola columna secuencial de configuración, demandas, refuerzo y evidencia | Pendiente de captura X2 | Pendiente |
| 2 | Acción de cálculo | Llamado a análisis rojo, claro y único | Botón `Calcular diseño` usa `--fs-family-analisis`; muestra actividad real del worker | Pendiente de captura X2/M1 | Pendiente |
| 3 | Densidad técnica | Cifras compactas, unidades visibles y detalles legibles | Métricas, disposición `Ø`, separación, deflexión y fuente usan tokens de datos | Pendiente de captura X2 | Pendiente |
| 4 | Detalle | Lectura transversal y longitudinal, no plano constructivo | Dos SVG accesibles derivados del refuerzo calculado y la leyenda de límite | Pendiente de captura X2/M1 | Pendiente |
| 5 | Móvil | Herramienta enfocada sin competir con canvas | K0 abre Diseño a pantalla completa; `≤700px` apila métricas y detalle | Pendiente de captura K0/teléfono | Pendiente |
| 6 | Acceso desde resultados | Entrada compacta al workbench | Lanzador persistente dentro de Resultados; Diseño y Resultados son excluyentes | Pendiente de captura X2/M1 | Pendiente |

## Cierre requerido

Cuando el runner esté disponible, capturar la superficie con una viga de catálogo y resultado disponible en: X2 de escritorio, M1, K0/teléfono y, cuando aplique, tema oscuro. Cada captura debe añadirse como ruta versionada o artefacto de CI, completar la columna de evidencia y registrar cualquier desviación deliberada con su razón. Los conceptos son dirección visual, no datos estructurales: los valores de las capturas deben provenir del worker, nunca de una maqueta.
