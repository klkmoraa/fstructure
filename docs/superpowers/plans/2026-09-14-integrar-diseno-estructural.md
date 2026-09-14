# Integración de Diseño Estructural en FStructure Solver2D

> **Para agentes:** usar `subagent-driven-development`, TDD y verificación focalizada por tarea. Este plan implementa la decisión aprobada de retirar la aplicación independiente y convertir Solver2D en el producto único.

**Objetivo:** integrar en FStructure Solver2D una superficie nativa de Diseño y entregar el primer flujo vertical experimental de una viga rectangular de concreto reforzado conforme a evidencia trazable de NTC CDMX 2023.

**Arquitectura:** persistir sólo asignaciones de diseño dentro del proyecto; calcular resultados derivados e inmutables en un worker; mantener el runtime completamente TypeScript y contrastar las fórmulas con un oráculo Python sin dependencia runtime. Reutilizar el broker de superficies, el contexto de proyecto, los resultados exactos del solver y el sistema visual vigente.

**Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Web Workers, Python 3 para validación, GitHub Actions y el design system existente.

**Especificación:** el plan aprobado en la conversación y los conceptos aceptados `design-workbench-desktop.png` y `design-workbench-mobile.png` del repositorio fuente en el commit `d80b45c`.

## Restricciones globales

- El producto permanece `Experimental`; no describir resultados como certificados o listos para obra.
- Norma inicial: NTC CDMX 2023 con edición, URL oficial, páginas/cláusulas y SHA-256 verificables.
- Runtime web exclusivamente TypeScript; Python sólo genera o valida fixtures de prueba.
- Primera sección: viga de concreto reforzado rectangular. Se excluyen torsión, vigas T/L, desarrollo/anclaje, traslapes, detallado sísmico, vigas profundas, columnas, losas y muros.
- Servicio v1: deformación elástica de corto plazo; fisuración refinada, fluencia, contracción y largo plazo se muestran como pendientes.
- Las asignaciones de diseño se guardan y participan en undo/redo sin invalidar un `AnalysisResult` estructural vigente. Los resultados de diseño no se persisten.
- Todo comportamiento de producción nuevo comienza con una prueba que falla por la ausencia del comportamiento.
- No mezclar historiales Git ni copiar la aplicación React independiente; migrar investigación, metadatos y conceptos útiles mediante un manifiesto.
- No versionar los PDF NTC 2017/2020 del prototipo; conservar sólo metadatos, enlaces y hashes.
- Usar únicamente tokens, controles y patrones visuales existentes de FStructure, cotejados contra el brandbook web.

### Task 1: Migrar evidencia, conceptos y decisiones al repositorio único

**Archivos:**
- Crear: `docs/design/structural-design-migration.md`
- Crear: `docs/design/open-source-landscape.md`
- Crear: `docs/design/brandbook-handoff.md`
- Crear: `docs/design/normative-sources.json`
- Copiar: `public/concepts/design-workbench-desktop.png`
- Copiar: `public/concepts/design-workbench-mobile.png`

- [ ] Escribir primero una prueba de manifiesto que falle si faltan el commit fuente, el estado de cada artefacto, su hash o si se intenta versionar un PDF normativo antiguo.
- [ ] Inventariar los archivos versionados del repositorio fuente en `d80b45c`, asignando `migrated`, `replaced` o `excluded` y una razón.
- [ ] Copiar los dos conceptos aceptados y registrar dimensiones y SHA-256.
- [ ] Extraer del brandbook paleta, tipografía, espaciado, radios, elevación, iconografía y reglas responsive que se aplicarán mediante el design system existente.
- [ ] Consolidar la investigación y comparar lenguaje/runtime, 2D frente a 3D y las licencias/capacidades de OpenSees/OpenSeesPy, Frame3DD, XC, CalculiX, FreeCAD e IfcOpenShell usando fuentes primarias.
- [ ] Crear el registro normativo 2023 sin afirmar cláusulas de concreto hasta verificarlas contra el documento oficial.
- [ ] Ejecutar la prueba de manifiesto y verificar que pasa.

### Task 2: Persistir asignaciones de diseño sin invalidar el análisis

**Archivos:**
- Modificar: `src/types.ts`
- Modificar: `src/data/defaultProject.ts`
- Modificar: `src/data/migrate.ts`
- Modificar: contexto/comandos del proyecto que controlan cambios reversibles
- Probar: migración, firma de análisis, importación/exportación, undo/redo y borrado de miembro

**Interfaz pública:**

```ts
interface ReinforcedConcreteBeamAssignment {
  id: string
  memberId: string
  kind: 'reinforced-concrete-beam'
  standardId: 'ntc-cdmx-2023-concrete'
  ultimateCombinationId: string
  serviceCombinationId: string
  coverMm: number
  longitudinalSteelYieldMpa: number
  stirrupSteelYieldMpa: number
  preferredLongitudinalDiametersMm: number[]
  preferredStirrupDiametersMm: number[]
  stirrupLegs: 2 | 4
}
```

- [ ] Escribir pruebas que fallen para esquema v8, migración v7→v8, normalización y cambio reversible no analítico.
- [ ] Añadir `designAssignments: MemberDesignAssignment[]` al proyecto con una sola asignación por miembro.
- [ ] Usar por defecto recubrimiento 40 mm, acero 420 MPa, barras `[12,16,20,25,32]`, estribos `[8,10,12]` y dos ramas.
- [ ] Eliminar en cascada la asignación al eliminar el miembro y rechazar referencias rotas al importar.
- [ ] Mantener las asignaciones fuera de `analysisSignature` y añadir una ruta de actualización con undo/redo que preserve el resultado estructural.
- [ ] Ejecutar las pruebas focalizadas y verificar que pasan.

### Task 3: Implementar el núcleo normativo de viga y el oráculo Python

**Archivos:**
- Crear: `src/design/concrete/beamDesign.ts`
- Crear: `src/design/concrete/beamDesign.test.ts`
- Crear: `src/design/concrete/types.ts`
- Crear: `src/design/concrete/ntcConcrete2023.ts`
- Crear: `validation/python/concrete_beam_oracle.py`
- Crear: `validation/python/test_concrete_beam_oracle.py`
- Crear: `validation/fixtures/concrete-beam/*.json`

**Interfaz pública:** `designReinforcedConcreteBeam(input): ConcreteBeamDesignOutcome`, con estado `available | blocked`, alcance `complete-within-v1 | incomplete`, checks tipados, advertencias, procedencia y binding a combinaciones/análisis.

- [ ] Verificar y registrar las ecuaciones, factores, límites, cláusulas y páginas exactas de la NTC 2023 antes de codificar cada check.
- [ ] Escribir pruebas fallidas para conversión de unidades, flexión positiva/negativa, acero mínimo/máximo, cortante, estribos, separación y deformación corta.
- [ ] Implementar funciones puras para sección rectangular simplemente reforzada y selección determinista de arreglos de barras/estribos.
- [ ] Bloquear entradas sin sección/material de catálogo, combinaciones trazables, análisis confiable o evidencia normativa completa.
- [ ] Implementar el oráculo Python de forma independiente y comparar fixtures con tolerancias explícitas.
- [ ] Marcar fisuración refinada, fluencia, contracción y largo plazo como no evaluados, sin presentarlos como aprobación.
- [ ] Ejecutar Vitest, unittest Python y comparación cruzada.

### Task 4: Orquestar el diseño con el solver y un Web Worker

**Archivos:**
- Modificar: `src/runtime/workerProtocol.ts`
- Modificar: `src/runtime/workerHandlers.ts`
- Crear: `src/workers/design.worker.ts`
- Crear: `src/design/useConcreteBeamDesign.ts`
- Probar: protocolo, cancelación, fallback, invalidación y extracción de demandas

- [ ] Escribir pruebas fallidas para el dominio `design` y un hook que analiza combinaciones última y de servicio sin bloquear la UI.
- [ ] Añadir request/result tipados con snapshot del proyecto, miembro y asignación.
- [ ] Ejecutar `analyzeProjectAuto` para ambas combinaciones y extraer demandas de diagramas exactos en las secciones críticas normativas.
- [ ] Reutilizar fiabilidad y firmas existentes; invalidar el resultado derivado cuando cambien proyecto analítico, combinaciones o asignación.
- [ ] Exponer `{ outcome, busy, error, run, clear }` y fallback en hilo principal con el mismo contrato.
- [ ] Ejecutar las pruebas focalizadas y verificar que pasan.

### Task 5: Integrar la superficie Diseño y el flujo interactivo

**Archivos:**
- Modificar: `src/features/workspace/WorkspaceTopBar.tsx`
- Modificar: `src/features/workspace/WorkspaceShell.tsx`
- Modificar: `src/features/workspace/surfacePresentation.ts`
- Modificar: `src/features/workspace/workspaceCommands.ts`
- Crear: `src/features/design/ConcreteBeamDesignSurface.tsx`
- Crear: componentes/estilos/pruebas focalizados del flujo de Diseño

- [ ] Escribir pruebas fallidas para abrir/cerrar Diseño, conservar la selección, editar una asignación y recorrer Configuración → Demandas → Refuerzo → Detalle y evidencia.
- [ ] Añadir un botón persistente `Diseño` y un comando accesible con retorno de foco.
- [ ] Presentar Diseño como panel acoplado en X2, drawer en M1 y pantalla completa en K0; hacerlo mutuamente exclusivo con Resultados.
- [ ] Implementar estados vacío, bloqueado, calculando, disponible y error; no usar datos simulados.
- [ ] Renderizar acero superior/inferior, estribos, deformación corta, checks y evidencia trazable.
- [ ] Dibujar detalles esquemáticos transversal y longitudinal como UI/SVG accesible, indicando que no son planos de fabricación.
- [ ] Mantener una tarjeta compacta en Resultados que abra Diseño.
- [ ] Añadir copy ES/EN, navegación por teclado y comportamiento responsive.
- [ ] Ejecutar pruebas UI focalizadas, build y QA visual contra ambos conceptos aceptados.

### Task 6: Integrar CI, documentación y puertas de entrega

**Archivos:**
- Modificar: `.github/workflows/deploy-pages.yml`
- Modificar: `README.md`
- Crear: `docs/design/concrete-beam-v1.md`
- Crear: `docs/design/fidelity-ledger.md`

- [ ] Escribir o actualizar pruebas de configuración para exigir quality gate Node, Python y fixtures antes del deploy.
- [ ] Añadir Python 3 y las validaciones del oráculo al workflow; ejecutar `npm run check` en vez de sólo build.
- [ ] Documentar uso, alcance, limitaciones, evidencia y ruta futura de acero, presfuerzo, diafragmas 2.5D y 3D/IFC.
- [ ] Ejecutar pruebas focalizadas, `npm run check`, pruebas Python y build desde cero.
- [ ] Verificar el flujo real en navegador en escritorio y móvil; capturar screenshots y completar un ledger de fidelidad con al menos cinco comparaciones.
- [ ] Revisar el diff completo, licencias, tamaño y ausencia de PDF normativos antiguos.

### Task 7: Publicar en FStructure y retirar el repositorio independiente

- [ ] Hacer revisión final completa de la rama y resolver hallazgos críticos/importantes.
- [ ] Integrar la rama en `main`, empujar a `klkmoraa/fstructure` y verificar commit, Actions y GitHub Pages públicos.
- [ ] Comparar el manifiesto de migración contra `d80b45c` y confirmar que todo artefacto útil está migrado, reemplazado o excluido con razón.
- [ ] Eliminar el remoto exacto `klkmoraa/fsteucture-diseno-estructural` mediante una sesión GitHub autenticada.
- [ ] Mover `/Users/crismora/Desktop/FStructure/DiseñoEstructural` a `~/.Trash/DiseñoEstructural-<fecha>` sólo después de confirmar la eliminación remota y el despliegue destino.
- [ ] Reportar commit final, URL pública, comprobaciones ejecutadas, eliminación remota y ruta recuperable en Papelera.

## Supuestos cerrados

- Las combinaciones última y de servicio se seleccionan explícitamente y deben portar jurisdicción, edición, estado límite y fuente.
- Los arreglos de refuerzo se seleccionan de las listas preferidas de forma determinista, minimizando primero déficit, luego exceso y finalmente número de barras.
- El primer detalle es informativo y esquemático; no resuelve anclajes, traslapes ni fabricación.
- 3D no forma parte de esta entrega; los futuros diafragmas se introducirán primero como restricciones/distribución 2.5D.
