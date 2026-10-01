# Experiencia de uso Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Ejecución directa autorizada por AGENTS.md.

**Goal:** Hacer comprensibles y utilizables los recorridos de las cuatro mesas.

**Architecture:** Mejorar los shells y los componentes de cada herramienta sin
mezclar sus datos. La ayuda vive en workspace; FEM proyecta sólo su documento.

**Tech Stack:** React 19, TypeScript 6, Vite, Vitest, CSS y SVG.

**Spec:** `docs/superpowers/specs/2026-10-01-experiencia-de-uso-design.md`

## Global Constraints

- Sin dependencias adicionales; almacenamiento local y herramientas aisladas.
- No cambiar solvers, unidades internas ni alcance normativo.
- Tokens del canon; controles táctiles de al menos 44 px donde se modifican.
- No borrar ni reemplazar datos del usuario en la revisión.
- Copy y estilo se verifican visualmente, sin pruebas que los congelen.

## Review Focus

- Escape cancela un nombre sin guardarlo y devuelve el foco.
- La ayuda de una mesa no abre ni modifica otra herramienta.
- Una búsqueda no secuestra `/` al escribir en otro campo o en un diálogo.
- FEM conserva el documento y los resultados ante una importación inválida.
- Los menús y los errores permanecen alcanzables a 320 y 390 px.

### Task 1: Barra y ayuda contextual

**Files:** `WorkspaceTopBar.tsx`, `WorkspaceHelp.tsx`, `workspaceHelp.css`,
`WorkspaceShell.tsx`, `ToolShell.tsx`, `WorkspaceTopBar.test.tsx`.

**Interfaces:** `WorkspaceHelp({ tool, language })`; props de la barra conservadas.

- [x] Añadir regresión de Escape/foco y abrir/cerrar ayuda a las pruebas de barra.
- [x] Ejecutar `npx vitest run src/features/workspace/WorkspaceTopBar.test.tsx`.
  Expected: fallan los nuevos recorridos ausentes.
- [x] Implementar ayuda por herramienta y cancelación/foco del nombre.
  ```tsx
  <WorkspaceHelp tool={tool} language={language} />
  ```
- [x] Repetir las pruebas. Expected: todas pasan.

### Task 2: Bienvenidas y proyectos

**Files:** `ToolHome.tsx`, `toolHomes.test.tsx`, `ProjectHub.tsx`, `projectHub.css`.

**Interfaces:** `ProjectHub` recibe `tool` y `bundleRepository` para mostrar datos de la herramienta actual. Integrado desde main durante la ejecución.

- [x] Probar `/` fuera/dentro de un campo en ToolHome.
- [x] Ejecutar las pruebas de ToolHome. Expected: falla el foco de búsqueda.
- [x] Corregir atajo, Inicio, Escape; metadatos de recientes y desplegable de copias.
  ```tsx
  <ProjectHub variant="recent" tool={tool} bundleRepository={session?.repository} />
  ```
- [x] Repetir pruebas y revisar búsqueda/recuperaciones en navegador.
  Expected: búsqueda accesible y todas las copias conservadas.

### Task 3: Controles 2D/3D

**Files:** `design-system/components/editor.tsx`, `space3d.css`.

**Interfaces:** props públicas de ToolButton y Space3DRibbon sin cambios.

- [x] Añadir pista title derivada de etiqueta, detalle y atajo en ToolButton.
  ```tsx
  title={props.title ?? [label, detail, shortcut].filter(Boolean).join(' · ')}
  ```
- [x] Hacer que el menú y los comandos 3D quepan por filas en teléfono.
- [x] Revisar selección, asignación y controles 2D con teclado y a 390/320 px.
  Expected: los controles conservan sus acciones y no quedan fuera del ancho.

### Task 4: Vistas FEM

**Files:** `FemSurface.tsx`, `FemStudyView.tsx`, `FemMesh.tsx`, `femSurface.css`,
`FemSurface.test.tsx`, `FemStudyView.test.tsx`.

**Interfaces:** vistas consumen `FemDocumentV1`, `FemAnalysisResult | null`;
`onAnalyze` ejecuta la acción existente. No cambia el formato guardado.

- [x] Probar navegación a malla, consulta de resultados e importación inválida.
- [x] Ejecutar `npx vitest run src/modules/fem/FemSurface.test.tsx`.
  Expected: fallan las vistas ausentes.
- [x] Implementar vista Modelo/material/apoyos/cargas, malla SVG y tablas.
  ```tsx
  <FemStudyView document={document} analysis={analysis} onAnalyze={runAnalysis} />
  ```
- [x] Repetir pruebas, analizar el ejemplo y verificar valores desde el motor.
  Expected: resultados reales; el archivo inválido no sustituye el anterior.

### Task 5: Diseño y títulos

**Files:** `WorkbenchLayout.tsx`, `DesignWorkbench.tsx`, `designWorkbench.css`,
`DesignWorkbench.test.tsx`, `App.tsx`, `TODO.md`.

**Interfaces:** callback de clipboard actual; `onReport` y persistencia intactos.

- [x] Probar respuesta a rechazo del portapapeles y acceso a datos inválidos.
- [x] Ejecutar pruebas de Diseño. Expected: falla el mensaje de error ausente.
- [x] Implementar respuesta visible, guía de cálculo automático y enlace a Datos.
  ```tsx
  catch { setExportMessage('No se pudo copiar. Puedes exportar la memoria en PDF.'); }
  ```
- [x] Título por ruta/herramienta y actualización precisa de TODO.
- [x] Repetir pruebas. Expected: todos los recorridos pasan.

### Task 6: Verificación y publicación

**Files:** capturas y ficha en `docs/brandbook/`; este registro.

- [x] `npm run verify`; `npm run check`. Expected: exit 0.
- [x] Recorrer Inicio, bienvenidas y cuatro mesas en día/noche/móvil.
- [x] Guardar capturas, revisar diff y obtener una revisión fresca de la rama.
- [x] Corregir hallazgos importantes y repetir sus comprobaciones.
- [x] Commit en main y push según AGENTS.md; comprobar CI/Pages y SHA final.
  Expected: gate y publicación exitosos, sin cambios pendientes.

## Evidencia de cierre local

- `npm run check`: 131 archivos, 933 pruebas; 5 casos del oráculo de Python y build correctos.
- Revisión independiente de código: corregidos formato anticipado de tablas FEM, solapamiento de guía 3D y competencia Guía/paleta 2D. Revisión final sin hallazgos concretos.
- Navegador: Día/Noche a 1440 × 900 y controles móviles a 320 × 780 y 390 × 844. Escape devuelve el foco; `/` enfoca Buscar; la paleta se cierra dentro de la mesa.
- 2D, proyecto de prueba: viga de 5 m con 10 kN/m; reacciones de 25 kN y momento máximo de 31.25 kN·m. Creación con teclado táctil, nodos, barra, apoyos y carga verificados.
- 3D, ejemplo de prueba: 4 nudos, 3 barras, 3 apoyos y 1 carga; Δ máximo 0.08973 mm en N4 y reacción vertical total 40 kN.
- FEM, TRI3: σx = 200, σy = 60, τxy = 0, von Mises = 177.764 kN/m²; Ux del nudo 2 = 0.00091 mm. Documento y análisis restaurados al reabrir. Importación inválida y resultados incompletos cubiertos en pruebas.
- Diseño: datos inválidos llevan al campo correspondiente; longitud restaurada a 5 m. Fallo de portapapeles cubierto en pruebas.
- Capturas nuevas de las cuatro mesas en `docs/brandbook/assets/`; ficha actualizada. Se usó un proyecto de prueba, sin editar los proyectos existentes.
- Límite de la comprobación: el navegador integrado no confirmó la descarga del PDF de Diseño. La generación pasa las pruebas; la entrega mediante compartir/descargar necesita comprobarse en navegador de usuario.

## Publicación comprobada

- Implementación: `f72b84ab8e7db9b0b2e88a275fa564ddb24e5760`.
- [Quality gate y publicación](https://github.com/klkmoraa/fstructure/actions/runs/36904521999): ambos trabajos y sus pasos completados correctamente.
- `gh-pages`: `321682a03bdfc00c182386c809b0a77bed9dff6d`, mensaje `deploy: f72b84ab8e7d`.
- [App pública](https://klkmoraa.github.io/fstructure/): HTTP 200. JavaScript y CSS principal, FEM y ToolHome coinciden por SHA-256 con el commit publicado. Inicio comprobado en navegador.
