---
name: fstructure-workflows
description: Preserva los contratos propios de FStructure al cambiar el modelo estructural, solver y unidades, comandos y undo/redo, persistencia y recuperación, workers, importación/exportación o adaptadores 2D/3D/FEM. Úsala para implementar o revisar cambios de dominio en este repositorio; no la cargues para copy o estilos aislados.
---

# Flujos de FStructure

Mantener la autoridad de `model2d`, la trazabilidad de resultados y la recuperación de datos por encima de la comodidad de una superficie concreta. Tratar toda capacidad como experimental salvo evidencia explícita en el producto.

## Preparación

1. Leer `AGENTS.md` y la tarea activa de `fix/features/`.
2. Identificar el flujo afectado y cargar la referencia correspondiente:
   - modelo, comandos, solver, unidades, workers o resultados: [arquitectura y datos](references/architecture-data.md);
   - persistencia, undo/redo, importación/exportación o enlaces entre herramientas: [flujos y fallos](references/workflows.md);
   - seleccionar pruebas proporcionales: [matriz de verificación](references/verification.md).
3. Anotar antes de editar: autoridad del dato, unidad interna, efecto sobre análisis, reversibilidad, persistencia, exportación y modo de fallo.

## Reglas de decisión

- Cambiar contratos de datos mediante normalización/migración versionada; no reinterpretar silenciosamente datos antiguos.
- Conservar valores completos en cálculo y persistencia. Formatear o redondear únicamente al presentar/exportar cuando el formato lo exija.
- Ejecutar cálculo costoso en workers y descartar respuestas obsoletas por revisión/protocolo.
- Mantener resultados como derivados: una edición de entradas los invalida y conserva procedencia cuando sea útil para comparar.
- Hacer cancelación y error visibles. Nunca convertir un solver fallido, una rama stale o un formato parcial en éxito aparente.
- No prometer equivalencia con AutoCAD, DWG, IFC, BIM u otro producto externo. Documentar el subconjunto exacto implementado y probar fixtures propios o públicos compatibles con licencia.
- No usar PDFs normativos como sustituto de reglas implementadas, evidencia de edición o revisión profesional.

## Cierre

Aplicar la fila adecuada de la matriz de verificación. Registrar comandos, resultado y limitaciones en la tarea activa. Si una comprobación exigida no puede ejecutarse, la tarea no se cierra.
