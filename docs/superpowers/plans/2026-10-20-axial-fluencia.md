# Diagrama axial y fluencia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Devolver el diagrama N a las armaduras, distinguir azul/rojo por signo y hacer verificable la lectura del índice elástico.

**Architecture:** La vista axial consume los diagramas del análisis sin alterar el solver y superpone estados T/C/0. La vista de fluencia consume exclusivamente `elasticDemandView`, con una leyenda compacta, una sola escala y datos trazables.

**Tech Stack:** React, TypeScript, Vitest, CSS/SVG, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-20-axial-fluencia-design.md`

## Global Constraints
- No cambiar solver ni resultados persistidos.
- Color azul para N positivo y rojo para N negativo; estado nulo neutro.
- Mapa η experimental, nunca indicador de cumplimiento de norma.
- No bloquear seleccionar objetos ni superponer la leyenda sobre acciones móviles.
- Compartir estado con la vista Axial y restaurarla al desactivar el mapa.

## Review Focus
- Barras diagonales o escala de ordenadas invertida: cortar N=0 por el signo, no por orientación de pantalla.
- N constante o exactamente cero: no duplicar extremos ni colorear cero como tensión.
- Móvil estrecho: mostrar valores sólo cuando quepan o al seleccionar.
- Fy o W faltantes: mostrar “sin evaluar”, nunca η=0.
- Cambio Diagramas → Axial/Fluencia: encender la vista correcta una sola vez.

---

### Task 1: Restaurar el diagrama axial con signos
**Files:** `src/features/canvas/CanvasResultLayer.tsx`, `src/features/canvas/TrussAxialPresentation.tsx`, `src/features/results/ResultsPanel.tsx`, `src/design-system/tokens.css`, `src/features/canvas/trussAxial.css`.
**Interfaces:** `AxialDiagramSigns({ baselineStart, baselineEnd, positivePoint, extent, children })` usa el diagrama existente. `trussAxialReadings` conserva clasificación.
- [x] Escribir casos para curvas positivas/negativas y N=0 y comprobar la regresión de barras de armadura.
- [x] Recuperar `diagramPath` para miembros truss y `DiagramView` para armaduras puras.
- [x] Aplicar azul/rojo en curva, barras, etiquetas y cursor, conservando el patrón.

### Task 2: Mejorar el mapa de demanda de fluencia
**Files:** `src/features/canvas/ElasticDemandLegend.tsx`, `elasticDemandLegend.css`, `CanvasGeometryLayer.tsx`, `evidenceLayers.ts`, `CanvasEvidenceRail.tsx`.
**Interfaces:** `elasticDemandView(project, analysis)` entrega `ratios`, `highest`, `readings`, `unevaluated`, `coverage`.
- [x] Escribir casos de máximo, barra seleccionada y cobertura con datos ausentes.
- [x] Añadir ficha Fluencia, escala 0–2, referencia Fy, máximo real y lectura seleccionada.
- [x] Mantener color de η durante selección y patrón especial para barras sin evaluar.

### Task 3: Navegación, regresiones y publicación
**Files:** `StructuralCanvas.tsx`, `ResultsPanel.tsx`, sus pruebas, `README.md`, `docs/brandbook/README.md`.
- [x] Añadir pruebas de cambio Axial ↔ Fluencia y salida de Diagramas.
- [ ] Ejecutar `npm run check` en CI con cero errores, revisar artefactos y estados del workflow.
- [ ] Publicar en `main` y comprobar la versión servida por GitHub Pages.
- [ ] Contrastar al menos una armadura y un mapa de fluencia en móvil y escritorio.
