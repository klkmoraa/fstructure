# Backlog de mejoras de FStructure

Este índice es la única fuente de estado. El detalle vive en los archivos enlazados; la marca, prioridad y estado deben coincidir siempre.

Marcas: `[ ]` abierta · `[>]` en curso · `[!]` bloqueada · `[x]` cerrada.

## Orden de ejecución

| Orden | Estado | ID | Prioridad | Categoría | Título | Dependencias | Detalle |
| ---: | :---: | --- | --- | --- | --- | --- | --- |
| 1 | [x] | ID-001 | crítica | Integridad de datos | Reparar el round trip del bundle unificado | — | [Datos y archivos](01-integridad-datos-archivos.md#id-001) |
| 2 | [x] | ID-002 | alta | Integridad de datos / documentación | Resolver la contradicción de PDFs normativos | — | [Datos y archivos](01-integridad-datos-archivos.md#id-002) |
| 3 | [x] | ID-003 | alta | Pruebas y calidad | Recuperar un gate general completamente verde | ID-001, ID-002 | [Pruebas](06-pruebas-calidad.md#id-003) |
| 4 | [x] | ID-004 | alta | Distribución / CI | Ejecutar gates WASM y Rust en CI | — | [Distribución](09-distribucion-ci-documentacion.md#id-004) |
| 5 | [ ] | ID-005 | alta | Pruebas y calidad | Añadir smoke E2E de las cuatro superficies | ID-003 | [Pruebas](06-pruebas-calidad.md#id-005) |
| 6 | [ ] | ID-006 | alta | Rendimiento | Reducir el bundle inicial y las importaciones ineficaces | ID-003 | [Rendimiento](04-rendimiento.md#id-006) |
| 7 | [ ] | ID-007 | alta | Compatibilidad | Definir y probar la matriz de importación/exportación | ID-003 | [Compatibilidad](08-compatibilidad-interoperabilidad.md#id-007) |
| 8 | [ ] | ID-008 | media | UI / accesibilidad | Dar estructura semántica a la mesa de trabajo | — | [UI y accesibilidad](03-ui-ux-accesibilidad.md#id-008) |
| 9 | [ ] | ID-009 | media | UI / responsive | Automatizar evidencia móvil y actualizar el ledger | ID-005 | [UI y accesibilidad](03-ui-ux-accesibilidad.md#id-009) |
| 10 | [ ] | ID-010 | media | PWA / distribución | Alinear instalación, offline y actualización PWA | — | [Distribución](09-distribucion-ci-documentacion.md#id-010) |
| 11 | [x] | ID-011 | media | Arquitectura | Eliminar la duplicación de Foundation en Space 3D | ID-003 | [Arquitectura](05-arquitectura-deuda-tecnica.md#id-011) |
| 12 | [ ] | ID-012 | media | Arquitectura | Dividir hotspots monolíticos por contratos | ID-003 | [Arquitectura](05-arquitectura-deuda-tecnica.md#id-012) |
| 13 | [ ] | ID-013 | media | Seguridad | Incorporar auditoría reproducible de dependencias | — | [Seguridad](07-seguridad-privacidad.md#id-013) |
| 14 | [ ] | ID-014 | media | Privacidad | Resolver el companion ReportLab no alcanzable | — | [Seguridad](07-seguridad-privacidad.md#id-014) |
| 15 | [>] | ID-015 | media | CI / seguridad | Reducir permisos del despliegue de Pages | — | [Distribución](09-distribucion-ci-documentacion.md#id-015) |
| 16 | [ ] | ID-016 | media | Distribución | Declarar y comprobar runtimes reproducibles | — | [Distribución](09-distribucion-ci-documentacion.md#id-016) |
| 17 | [ ] | ID-017 | media | Pruebas | Medir cobertura de contratos críticos | ID-003 | [Pruebas](06-pruebas-calidad.md#id-017) |
| 18 | [ ] | ID-018 | baja | Arquitectura / calidad | Retirar código muerto y advertencias de lint | ID-003 | [Arquitectura](05-arquitectura-deuda-tecnica.md#id-018) |
| 19 | [ ] | ID-019 | baja | Documentación | Reconciliar README, evidencia visual y estado real | ID-003, ID-009, ID-010 | [Distribución](09-distribucion-ci-documentacion.md#id-019) |

## Estado a 2026-09-19

Cerradas ID-001, ID-002, ID-003, ID-004 e ID-011. En curso ID-015, con lo que falta anotado en su detalle.

ID-004 se cierra por obsolescencia parcial y no se reabre: la tubería WASM/Rust que debía entrar a CI se retiró del repositorio por no tener consumidores, y la mitad vigente de la tarea, el gate de arquitectura, ya forma parte de `npm run check`. Si el backend numérico vuelve, corresponde una tarea nueva con ID propio.

## Fuentes de contexto

- [Auditoría base](00-auditoria-base.md)
- [Catálogo de skills](../../.agents/skills/CATALOG.md)
- [Guía raíz](../../AGENTS.md)

## Reglas de mantenimiento

- No cambiar una marca en el detalle sin cambiarla aquí en el mismo diff.
- Sólo `[x]` con todos los criterios y evidencia de cierre reproducible.
- Si una tarea crece, dividirla y enlazarla; no ampliar su alcance silenciosamente.
- Mantener IDs estables. Los IDs cerrados no se reutilizan.
- Registrar responsable y fechas al iniciar/cerrar, no al crear una tarea abierta.
