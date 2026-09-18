# Arquitectura y deuda técnica

<a id="id-011"></a>

## [ ] ID-011 — Eliminar la duplicación de Foundation en Space 3D

- Categoría: arquitectura
- Prioridad: media
- Estado: abierta
- Problema demostrado: `linearAlgebra.ts`, `units.ts` y sus pruebas existen tanto en `src/foundation/` como en `src/modules/space3d/foundation/` con hashes idénticos.
- Evidencia: `shasum` devuelve `06660d…` para ambas copias de álgebra, `588999…` para unidades y hashes iguales para sus tests.
- Impacto: dos fuentes de verdad pueden divergir y duplican revisión, mantenimiento y ejecución de pruebas.
- Alcance: escoger la autoridad, migrar imports, retirar copias y reforzar el gate de arquitectura contra reintroducciones.
- Fuera de alcance: fusionar todos los dominios 2D/3D o cambiar convenciones físicas/unidades.
- Dependencias: ID-003.
- Tareas relacionadas: ID-012, ID-017.
- Criterios de aceptación:
  - [ ] Hay una sola implementación y una sola suite autoritativa para cada contrato compartido.
  - [ ] Space 3D consume la frontera pública acordada sin imports circulares.
  - [ ] Un gate impide volver a crear copias activas.
  - [ ] Pruebas de unidades, álgebra, arquitectura y producto pasan sin cambios numéricos.
- Estrategia de pruebas: comparar corpus antes/después, ejecutar suites de Foundation y Space 3D, `architecture:check`, `architecture:test` y el gate general.
- Riesgos: introducir ciclos, exponer internals o confundir unidades homónimas con contratos distintos.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-012"></a>

## [ ] ID-012 — Dividir hotspots monolíticos por contratos

- Categoría: arquitectura / mantenibilidad
- Prioridad: media
- Estado: abierta
- Problema demostrado: `StructuralCanvas.tsx` tiene 2.941 líneas, `engine/solver.ts` 2.499, `ProjectContext.tsx` 790 y varios generadores PDF entre 1.000 y 1.700.
- Evidencia: recuento de líneas del árbol actual y concentración de responsabilidades de UI, cálculo, estado y presentación.
- Impacto: eleva el coste de revisión y el riesgo de regresiones; dificulta aislar pruebas y cargar capacidades bajo demanda.
- Alcance: definir seams y extraer por responsabilidad en incrementos pequeños, empezando por el hotspot con mejor cobertura.
- Fuera de alcance: reescritura total, cambio de framework, abstracciones genéricas sin consumidor o refactor simultáneo de todos los archivos.
- Dependencias: ID-003.
- Tareas relacionadas: ID-006, ID-011, ID-017, ID-018.
- Criterios de aceptación:
  - [ ] Cada extracción declara contrato, dueño de datos y dependencia permitida.
  - [ ] El comportamiento observable y los resultados numéricos permanecen equivalentes.
  - [ ] Las piezas extraídas admiten pruebas unitarias o de integración más pequeñas.
  - [ ] Métricas antes/después demuestran menor concentración sin aumentar ciclos.
- Estrategia de pruebas: caracterización previa, extracción incremental, pruebas focalizadas y gate general en cada corte; revisión de grafo de imports.
- Riesgos: mover líneas sin mejorar cohesión, proliferar prop drilling o romper orden de efectos e historial.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.

<a id="id-018"></a>

## [ ] ID-018 — Retirar código muerto y advertencias de lint

- Categoría: arquitectura / calidad
- Prioridad: baja
- Estado: abierta
- Problema demostrado: el lint actual termina sin error pero emite aproximadamente 42 advertencias, y la auditoría encontró rutas no alcanzables como el companion ReportLab.
- Evidencia: salida de `npm run check` hasta Vitest y ejecución aislada de lint; búsqueda de importadores para `src/utils/reportlabEnhancer.ts` sin resultados.
- Impacto: el ruido oculta nuevas señales y aumenta la superficie que futuras IAs pueden interpretar erróneamente como activa.
- Alcance: clasificar advertencias, eliminar código realmente muerto o conectarlo mediante tareas específicas, y fijar un presupuesto decreciente.
- Fuera de alcance: cambios funcionales masivos, formateo indiscriminado o silenciar reglas globalmente sin justificación.
- Dependencias: ID-003.
- Tareas relacionadas: ID-012, ID-014.
- Criterios de aceptación:
  - [ ] Cada advertencia inicial está corregida, aceptada con razón local o registrada en una tarea concreta.
  - [ ] El lint no aumenta su presupuesto y CI rechaza regresiones nuevas.
  - [ ] Los módulos retirados no tienen consumidores ni contrato documental vigente.
  - [ ] Build, pruebas y typecheck continúan verdes.
- Estrategia de pruebas: inventario machine-readable de warnings, búsqueda de referencias, eliminación en lotes pequeños y ejecución de checks focalizados/general.
- Riesgos: eliminar rutas cargadas dinámicamente, confundir API pública con código muerto o degradar señal con excepciones amplias.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.
