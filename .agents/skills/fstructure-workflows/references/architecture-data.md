# Arquitectura y contratos de datos

## Autoridad y fronteras

`ProjectModel` en `src/types.ts` es el modelo físico/analítico 2D persistido. `src/data/` normaliza y migra; `src/commands/` produce mutaciones; `src/store/` coordina historial, workers y guardado. La UI no debe duplicar esas reglas.

El bundle de `src/shared/project/unifiedProjectBundle.ts` declara `model2d` como autoridad. Space 3D conserva `sourceProjectId`, `sourceVersion` y, para comparaciones exactas, `sourceModel2D`. FEM persiste estudios serializables. Un cambio de 2D puede dejar una rama 3D obsoleta; no debe actualizarla implícitamente.

## Unidades y precisión

- Geometría: metros.
- Fuerza: kN.
- Momento: kN·m.
- Módulo elástico: kN/m².
- Área e inercia: m² y m⁴.
- Masa: kg y kg·m² donde indiquen los tipos.
- Ángulos: grados en DTO que terminan en `Deg`; convertir explícitamente al entrar al álgebra.

Los tipos y comentarios cercanos son la autoridad para signos y ejes. Comparar números con tolerancias justificadas por escala; no usar igualdad exacta para resultados de punto flotante salvo identidades serializadas.

## Solver y workers

Los protocolos de `src/runtime/` y `src/engine/*Protocol*` deben permanecer versionados y serializables. El fallback en hilo principal debe producir el mismo contrato observable o un fallo explícito. Toda respuesta debe corresponder a la revisión solicitada; ignorar resultados tardíos después de una nueva edición o cancelación.

Los diagnósticos de estabilidad, condición, residuo y equilibrio son parte del resultado, no decoración. No ocultarlos para forzar un resultado “exitoso”. La física no implementada —por ejemplo elementos declarados sólo por codec— se rechaza de forma cerrada.

## Resultados y diseño

Un resultado depende del modelo normalizado, combinación, opciones y versión del motor. Al cambiar cualquiera, invalidarlo o emitir una nueva identidad. Las propuestas de diseño estructural deben conservar demanda, asignaciones, checks, edición normativa y evidencia; nunca presentarse como plano certificado.
