# Compatibilidad e interoperabilidad

<a id="id-007"></a>

## [ ] ID-007 — Definir y probar la matriz de importación/exportación

- Categoría: compatibilidad / archivos
- Prioridad: alta
- Estado: abierta
- Problema demostrado: el producto ofrece JSON, ZIP, PDF, SVG, PNG, CSV, VTK, DXF parcial, Gmsh 4.1 ASCII y formatos propios, pero no hay una matriz única de capacidades, versiones, límites y round trips.
- Evidencia: contratos distribuidos entre importadores, exportadores, README y pruebas; no se verificó interoperabilidad contra herramientas externas en esta auditoría.
- Impacto: usuarios y agentes pueden asumir compatibilidad o conservación de datos que el formato no garantiza.
- Alcance: inventariar dirección/versión/unidades/pérdidas por formato, crear corpus dorado pequeño y verificar importación/exportación según el contrato.
- Fuera de alcance: implementar DWG/IFC completos, prometer compatibilidad universal o certificar aplicaciones de terceros.
- Dependencias: ID-003.
- Tareas relacionadas: ID-001, ID-005, ID-019.
- Criterios de aceptación:
  - [ ] Una matriz versionada distingue importación, exportación, round trip, pérdida esperada y límites.
  - [ ] Cada formato soportado tiene fixture mínimo, caso inválido y assertions de unidades/coordenadas.
  - [ ] Los formatos parciales se identifican en UI y documentación antes de operar.
  - [ ] ZIP/bundles rechazan rutas peligrosas y exceso de presupuesto sin escribir estado parcial.
- Estrategia de pruebas: corpus dorado, property tests donde aplique, comparación semántica en lugar de bytes y validación puntual en herramientas externas disponibles.
- Riesgos: fixtures con licencia dudosa, comparación demasiado estricta de flotantes o etiquetar como round trip un flujo con pérdidas.
- Evidencia de cierre: pendiente.
- Responsable: sin asignar.
- Fechas: creada 2026-09-18; inicio —; cierre —.
