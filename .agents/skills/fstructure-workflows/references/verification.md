# Matriz de verificación

| Cambio | Comprobación mínima | Ampliar cuando |
| --- | --- | --- |
| Tipos/compilación | `npm run typecheck` | afecta bundling: `npm run build` |
| Comando/modelo | test focalizado del comando y undo/redo | cambia normalización: añadir migración/round trip |
| Solver/unidades/Foundation | test numérico focalizado con tolerancia | cambia backend: WASM y Rust gates |
| Worker/protocolo | test de handler/protocolo, error y respuesta obsoleta | cambia varias familias: suite focalizada de workers |
| Persistencia/bundle | tests de repositorio, integridad y sesión unificada | cambia esquema: fixtures de versiones anteriores |
| Importación | fixture válido, corrupto y fuera de presupuesto | cambia formato: round trip e interoperabilidad externa |
| Exportación | parsear/verificar el artefacto generado | PDF/visual: inspección de páginas/captura |
| UI/accesibilidad | test de interacción + teclado + nombres | cambia layout: escritorio y móvil, claro y oscuro |
| 2D↔3D/FEM | adaptador, pérdidas y procedencia | cambia DOF/unidades: corpus diferencial |
| Cambio transversal | `npm run check`, que ya incluye lint, typecheck, arquitectura, suite, oráculo y build | — |

No cerrar una tarea porque el build pasa si su contrato es numérico, persistente o visual. Registrar el comando exacto, código de salida y casos no ejecutados.
